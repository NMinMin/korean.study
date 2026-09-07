import { supabase } from './supabase'

export type LocalVocabularyState = Record<string, {
  box?: number
  lastRating?: 'good' | 'forgot' | 'vague'
  dueAt?: string
  timesReviewed?: number
  starred?: boolean
  note?: string
}>

type VocabularyRow = {
  id: string
  word_ko: string
  lesson_id: string
  textbook_id: string
}

type IdentifiedVocabulary = {
  id: string
  word: string
  lessonId: string
  textbookId: string
}

type LessonIdentity = {
  id?: string | null
  textbookId?: string | null
}

export type FlashcardSessionState = {
  words: string[]
  contentTab: 'vocab' | 'grammar'
  grammarIdx: number
}

async function authenticatedUserId(requestedUserId?: string | null): Promise<string | null> {
  if (!supabase) return null
  // getUser() always performs a network request. Flashcards read/write often,
  // so use the already validated local Supabase session here; RLS remains the
  // final authority for every database operation.
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user) return null
  // The authenticated user is the only valid owner under RLS. Never trust a
  // user id supplied by view state when writing personal learning progress.
  if (requestedUserId && requestedUserId !== data.session.user.id) {
    console.warn('Bỏ qua user_id không khớp phiên đăng nhập khi lưu tiến trình từ vựng')
  }
  return data.session.user.id
}

export async function loadRemoteFlashcardSession(stateKey: string, userId?: string | null): Promise<FlashcardSessionState | null> {
  if (!supabase || !stateKey.startsWith('progress:')) return null
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return null
  const { data, error } = await supabase
    .from('user_progress_states')
    .select('state_value')
    .eq('user_id', ownerId)
    .eq('state_key', stateKey)
    .maybeSingle()
  if (error) {
    console.error('Không thể tải vị trí phiên Flashcard', error)
    return null
  }
  if (!data?.state_value) return null
  try {
    const value = JSON.parse(data.state_value)
    return {
      words: Array.isArray(value.words) ? value.words.filter((word: unknown): word is string => typeof word === 'string') : [],
      contentTab: value.contentTab === 'grammar' ? 'grammar' : 'vocab',
      grammarIdx: Number.isInteger(value.grammarIdx) ? value.grammarIdx : 0,
    }
  } catch {
    return null
  }
}

export async function saveRemoteFlashcardSession(stateKey: string, userId: string | null | undefined, state: FlashcardSessionState): Promise<boolean> {
  if (!supabase || !stateKey.startsWith('progress:')) return false
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return false
  const { error } = await supabase.from('user_progress_states').upsert({
    user_id: ownerId,
    state_key: stateKey,
    state_value: JSON.stringify(state),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,state_key' })
  if (error) {
    console.error('Không thể lưu vị trí phiên Flashcard', error)
    return false
  }
  return true
}

async function vocabularyRows(lesson: LessonIdentity): Promise<VocabularyRow[]> {
  if (!supabase || !lesson.id || !lesson.textbookId) return []
  const { data, error } = await supabase
    .from('lesson_exercises')
    .select('id, prompt_ko, lesson_id')
    .eq('lesson_id', lesson.id)
    .eq('skill_type', 'vocabulary_grammar')
    .in('exercise_type', ['vocabulary', 'vocab', 'word', 'flashcard'])
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    word_ko: row.prompt_ko,
    lesson_id: row.lesson_id,
    textbook_id: lesson.textbookId as string,
  }))
}

async function loadRemoteVocabularyStateUncached(lesson: LessonIdentity, userId?: string | null): Promise<LocalVocabularyState | null> {
  if (!supabase || !userId) return null
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return null
  const words = await vocabularyRows(lesson)
  if (!words.length) return null
  const ids = words.map((word) => word.id)
  const [progress, bookmarks, notes] = await Promise.all([
    supabase.from('vocabulary_progress').select('vocabulary_id, mastery, last_rating, next_review_at, times_reviewed').eq('user_id', ownerId).in('vocabulary_id', ids),
    supabase.from('vocabulary_bookmarks').select('vocabulary_id').eq('user_id', ownerId).in('vocabulary_id', ids),
    supabase.from('vocabulary_notes').select('vocabulary_id, note').eq('user_id', ownerId).in('vocabulary_id', ids),
  ])
  if (progress.error || bookmarks.error || notes.error) return null
  const byId = new Map(words.map((word) => [word.id, word]))
  const state: LocalVocabularyState = {}
  for (const item of progress.data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word_ko
    if (word) state[word] = {
      box: item.mastery || 1,
      lastRating: item.last_rating ?? undefined,
      dueAt: item.next_review_at ?? undefined,
      timesReviewed: item.times_reviewed || 0,
    }
  }
  for (const item of bookmarks.data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word_ko
    if (word) state[word] = { ...state[word], starred: true }
  }
  for (const item of notes.data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word_ko
    if (word) state[word] = { ...state[word], note: item.note }
  }
  return state
}

const VOCABULARY_STATE_CACHE_MS = 10_000
const vocabularyStateRequests = new Map<string, { expiresAt: number; promise: Promise<LocalVocabularyState | null> }>()
const vocabularyStateWrites = new Map<string, Promise<boolean>>()

async function waitForVocabularyWrite(key: string) {
  const pending = vocabularyStateWrites.get(key)
  if (pending) await pending.catch(() => false)
}

export async function loadRemoteVocabularyState(lesson: LessonIdentity, userId?: string | null): Promise<LocalVocabularyState | null> {
  const key = `lesson:${userId || 'anonymous'}:${lesson.id || 'unknown'}`
  await waitForVocabularyWrite(key)
  const cached = vocabularyStateRequests.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.promise
  const promise = loadRemoteVocabularyStateUncached(lesson, userId).catch((error) => {
    vocabularyStateRequests.delete(key)
    throw error
  })
  vocabularyStateRequests.set(key, { expiresAt: Date.now() + VOCABULARY_STATE_CACHE_MS, promise })
  return promise
}

async function saveRemoteVocabularyStateNow(lesson: LessonIdentity, userId: string | null | undefined, state: LocalVocabularyState) {
  if (!supabase || !userId) return false
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return false
  const words = await vocabularyRows(lesson)
  if (!words.length) return false
  const operations: PromiseLike<unknown>[] = []
  for (const word of words) {
    const item = state[word.word_ko]
    if (!item) continue
    if (item.box || item.lastRating || item.dueAt || item.timesReviewed) {
      operations.push(supabase.from('vocabulary_progress').upsert({
        user_id: ownerId,
        textbook_id: word.textbook_id,
        lesson_id: word.lesson_id,
        vocabulary_id: word.id,
        mastery: item.box || 1,
        last_rating: item.lastRating ?? null,
        next_review_at: item.dueAt ?? null,
        times_reviewed: item.timesReviewed || 0,
        updated_at: new Date().toISOString(),
      }))
    }
    if (item.starred !== undefined) operations.push(item.starred
      ? supabase.from('vocabulary_bookmarks').upsert({ user_id: ownerId, vocabulary_id: word.id })
      : supabase.from('vocabulary_bookmarks').delete().eq('user_id', ownerId).eq('vocabulary_id', word.id))
    if (item.note !== undefined) {
      if (item.note.trim()) operations.push(supabase.from('vocabulary_notes').upsert({ user_id: ownerId, vocabulary_id: word.id, note: item.note.trim(), updated_at: new Date().toISOString() }))
      else operations.push(supabase.from('vocabulary_notes').delete().eq('user_id', ownerId).eq('vocabulary_id', word.id))
    }
  }
  const results = await Promise.all(operations)
  const failed = results.find((result: any) => result?.error)
  if (failed && (failed as any).error) {
    console.error('Không thể lưu tiến trình từ vựng theo người dùng', (failed as any).error)
    return false
  }
  if (operations.length > 0) window.dispatchEvent(new CustomEvent('kstudy:vocabulary-review-updated'))
  vocabularyStateRequests.delete(`lesson:${userId || 'anonymous'}:${lesson.id || 'unknown'}`)
  return operations.length > 0
}

export function saveRemoteVocabularyState(lesson: LessonIdentity, userId: string | null | undefined, state: LocalVocabularyState) {
  const key = `lesson:${userId || 'anonymous'}:${lesson.id || 'unknown'}`
  vocabularyStateRequests.delete(key)
  const previous = vocabularyStateWrites.get(key) ?? Promise.resolve(true)
  const write = previous.catch(() => false).then(() => saveRemoteVocabularyStateNow(lesson, userId, state))
  vocabularyStateWrites.set(key, write)
  void write.finally(() => {
    if (vocabularyStateWrites.get(key) === write) vocabularyStateWrites.delete(key)
  })
  return write
}

const IS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (id?: string | null): boolean => Boolean(id && IS_UUID_REGEX.test(id))

async function loadRemoteVocabularyStateForWordsUncached(words: IdentifiedVocabulary[], userId?: string | null): Promise<LocalVocabularyState | null> {
  if (!supabase || !userId || !words.length) return null
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return null
  const validWords = words.filter((word) => isUuid(word.id))
  if (!validWords.length) return null
  const ids = validWords.map((word) => word.id)
  const [progress, bookmarks, notes] = await Promise.all([
    supabase.from('vocabulary_progress').select('vocabulary_id, mastery, last_rating, next_review_at, times_reviewed').eq('user_id', ownerId).in('vocabulary_id', ids),
    supabase.from('vocabulary_bookmarks').select('vocabulary_id').eq('user_id', ownerId).in('vocabulary_id', ids),
    supabase.from('vocabulary_notes').select('vocabulary_id, note').eq('user_id', ownerId).in('vocabulary_id', ids),
  ])
  if (progress.error || bookmarks.error || notes.error) return null
  const byId = new Map(validWords.map((word) => [word.id, word]))
  const state: LocalVocabularyState = {}
  for (const item of progress.data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word
    if (word) state[word] = {
      box: item.mastery || 1,
      lastRating: item.last_rating ?? undefined,
      dueAt: item.next_review_at ?? undefined,
      timesReviewed: item.times_reviewed || 0,
    }
  }
  for (const item of bookmarks.data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word
    if (word) state[word] = { ...state[word], starred: true }
  }
  for (const item of notes.data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word
    if (word) state[word] = { ...state[word], note: item.note }
  }
  return state
}

export async function loadRemoteVocabularyStateForWords(words: IdentifiedVocabulary[], userId?: string | null): Promise<LocalVocabularyState | null> {
  const ids = words.map((word) => word.id).sort().join(',')
  const key = `words:${userId || 'anonymous'}:${ids}`
  await waitForVocabularyWrite(key)
  const cached = vocabularyStateRequests.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.promise
  const promise = loadRemoteVocabularyStateForWordsUncached(words, userId).catch((error) => {
    vocabularyStateRequests.delete(key)
    throw error
  })
  vocabularyStateRequests.set(key, { expiresAt: Date.now() + VOCABULARY_STATE_CACHE_MS, promise })
  return promise
}

async function saveRemoteVocabularyStateForWordsNow(words: IdentifiedVocabulary[], userId: string | null | undefined, state: LocalVocabularyState) {
  if (!supabase || !userId || !words.length) return false
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return false
  const validWords = words.filter((word) => isUuid(word.id))
  if (!validWords.length) return false
  const operations: PromiseLike<unknown>[] = []
  for (const word of validWords) {
    const item = state[word.word]
    if (!item) continue
    if (item.box || item.lastRating || item.dueAt || item.timesReviewed) {
      operations.push(supabase.from('vocabulary_progress').upsert({
        user_id: ownerId,
        textbook_id: word.textbookId,
        lesson_id: word.lessonId,
        vocabulary_id: word.id,
        mastery: item.box || 1,
        last_rating: item.lastRating ?? null,
        next_review_at: item.dueAt ?? null,
        times_reviewed: item.timesReviewed || 0,
        updated_at: new Date().toISOString(),
      }))
    }
    if (item.starred !== undefined) operations.push(item.starred
      ? supabase.from('vocabulary_bookmarks').upsert({ user_id: ownerId, vocabulary_id: word.id })
      : supabase.from('vocabulary_bookmarks').delete().eq('user_id', ownerId).eq('vocabulary_id', word.id))
    if (item.note !== undefined) {
      if (item.note.trim()) operations.push(supabase.from('vocabulary_notes').upsert({ user_id: ownerId, vocabulary_id: word.id, note: item.note.trim(), updated_at: new Date().toISOString() }))
      else operations.push(supabase.from('vocabulary_notes').delete().eq('user_id', ownerId).eq('vocabulary_id', word.id))
    }
  }
  const results = await Promise.all(operations)
  const failed = results.find((result: any) => result?.error)
  if (failed && (failed as any).error) {
    console.error('Không thể lưu tiến trình ôn từ theo người dùng', (failed as any).error)
    return false
  }
  if (operations.length > 0) window.dispatchEvent(new CustomEvent('kstudy:vocabulary-review-updated'))
  const ids = words.map((word) => word.id).sort().join(',')
  vocabularyStateRequests.delete(`words:${userId || 'anonymous'}:${ids}`)
  return operations.length > 0
}

export function saveRemoteVocabularyStateForWords(words: IdentifiedVocabulary[], userId: string | null | undefined, state: LocalVocabularyState) {
  const ids = words.map((word) => word.id).sort().join(',')
  const key = `words:${userId || 'anonymous'}:${ids}`
  vocabularyStateRequests.delete(key)
  const previous = vocabularyStateWrites.get(key) ?? Promise.resolve(true)
  const write = previous.catch(() => false).then(() => saveRemoteVocabularyStateForWordsNow(words, userId, state))
  vocabularyStateWrites.set(key, write)
  void write.finally(() => {
    if (vocabularyStateWrites.get(key) === write) vocabularyStateWrites.delete(key)
  })
  return write
}
