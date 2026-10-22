import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

// Exercise the dashboard service with isolated data sources, without a login
// or database. The real scoped storage keys and fallback reader remain in use.
const state = { remote: {}, rows: [], stored: new Map(), source: null }
globalThis.__dashboardProgressTest = state
globalThis.window = {
  storage: {
    async get(key) { return state.stored.has(key) ? { value: state.stored.get(key) } : null },
    async set(key, value) { state.stored.set(key, value) },
  },
}
const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/supabase')) return { url: moduleUrl('export const supabase = null'), shortCircuit: true }
    if (specifier.endsWith('/fallbackData')) return {
      url: moduleUrl('export const VOCAB_SAMPLE = []; export const GRAMMAR_SAMPLE = []; export const SHADOW_LINES = Array(6).fill({})'), shortCircuit: true,
    }
    if (specifier.endsWith('/vocabularyProgress')) return {
      url: moduleUrl(`
        export async function loadRemoteVocabularyState() { globalThis.__dashboardProgressTest.source = 'lesson'; return globalThis.__dashboardProgressTest.remote }
        export async function loadRemoteVocabularyStateForWords() { globalThis.__dashboardProgressTest.source = 'words'; return globalThis.__dashboardProgressTest.remote }
      `), shortCircuit: true,
    }
    if (specifier.endsWith('/activityProgress')) return {
      url: moduleUrl('export async function loadRemoteActivityProgress() { return globalThis.__dashboardProgressTest.rows }'), shortCircuit: true,
    }
    if (specifier.endsWith('/storageShim')) return { url: new URL('../src/services/storageShim.js', import.meta.url).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const { computeRadarStats, computeHomeProgress } = await import('../src/features/dashboard/progressService.js')
const { vocabProgressKey, reflexHistoryKey } = await import('../src/services/storageShim.js')
hooks.deregister()
const lesson = { id: 'lesson-1', no: 1, textbookId: 'book-1' }
const profile = { id: 'learner-1' }
const vocabulary = ['가', '나', '다', '라'].map((word, i) => ({ word, id: `word-${i}`, lessonId: lesson.id, textbookId: lesson.textbookId }))

test.beforeEach(() => {
  state.remote = {}
  state.rows = []
  state.stored.clear()
  state.source = null
})

test('canonical flashcard ratings populate vocabulary and retention, ignoring stale scoped data', async () => {
  state.stored.set(vocabProgressKey(lesson, profile.id), JSON.stringify({ 가: { box: 1 } }))
  state.remote = {
    가: { lastRating: 'good', box: 4, timesReviewed: 4 },
    나: { lastRating: 'forgot', box: 1, timesReviewed: 1 },
    다: { starred: true, note: 'bookmark only' },
    obsolete: { lastRating: 'good', box: 4 },
  }
  const result = await computeRadarStats(lesson, profile, vocabulary)
  assert.equal(state.source, 'words')
  assert.deepEqual(result.detail.vocab, { count: 2, total: 4 })
  assert.deepEqual(result.detail.retained, { count: 1, total: 2 })
  assert.equal(result.axes[0].pct, 25)
})

test('first learned word counts as studied but does not yet count as long-term memory', async () => {
  state.remote = { 가: { lastRating: 'good', box: 1, timesReviewed: 1 } }
  state.rows = [{ activityType: 'tuvung', progressPercent: 25 }]
  const result = await computeRadarStats(lesson, profile, vocabulary)
  assert.deepEqual(result.detail.vocab, { count: 1, total: 4 })
  assert.deepEqual(result.detail.retained, { count: 0, total: 1 })
  assert.equal(result.axes[0].pct, 25)
})

test('reflex details read the same per-lesson history written by review', async () => {
  state.stored.set(reflexHistoryKey(lesson, profile.id), JSON.stringify({ count: 3, timeLeftSum: 4, scoreSum: 250 }))
  const result = await computeRadarStats(lesson, profile, vocabulary)
  assert.deepEqual(result.detail.reflex, { count: 3, avgTimeLeft: 1.3, avgScore: 83 })
  const otherUser = await computeRadarStats(lesson, { id: 'other-learner' }, vocabulary)
  assert.equal(otherUser.detail.reflex, null)
})

test('fallback decks use scoped ratings when canonical records are unavailable', async () => {
  state.remote = null
  state.stored.set(vocabProgressKey(lesson, profile.id), JSON.stringify({ 가: { lastRating: 'good', box: 4 } }))
  const result = await computeRadarStats(lesson, profile, vocabulary.map(({ word }) => ({ word })))
  assert.equal(state.source, 'lesson')
  assert.deepEqual(result.detail.retained, { count: 1, total: 1 })
  assert.equal(result.axes[0].pct, 25)
})

test('empty decks and malformed reflex history remain finite and empty', async () => {
  state.stored.set(reflexHistoryKey(lesson, profile.id), '{broken')
  const result = await computeRadarStats(lesson, profile, [])
  assert.deepEqual(result.detail.vocab, { count: 0, total: 0 })
  assert.equal(result.detail.reflex, null)
  assert.ok(result.axes.every((axis) => Number.isFinite(axis.pct)))
  assert.equal((await computeHomeProgress(lesson, profile.id, []))[0].pct, 0)
})
