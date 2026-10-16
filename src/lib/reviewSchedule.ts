import { supabase } from './supabase'
import { buildReviewRotation } from './reviewRotation.js'

export type ReviewWord = {
  id: string
  lessonId: string
  textbookId: string
  word: string
  meaningVi: string
  type?: string | null
  pron?: string | null
  mnemonic?: string | null
  img?: string | null
  audio?: string | null
  sortOrder: number
}

export type VocabularyReviewDay = {
  dateKey: string
  words: ReviewWord[]
  evaluation?: VocabularyReviewEvaluation
}

export type VocabularyReviewEvaluation = {
  rating: 'Bad' | 'Good' | 'Perfect'
  score: number
  correctCount: number
  totalCount: number
  feedback: string
  completedAt: string
  wordResults?: Record<string, boolean>
}

const DAY_MS = 86_400_000
const DAILY_LIMIT = 10
const ROTATION_KEY = 'progress:vocabulary-review-rotation'
const RESULT_KEY_PREFIX = 'progress:vocabulary-review-result:'

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number)
  return localDateKey(new Date(year, month - 1, day + days))
}

export async function loadVocabularyReviewSchedule(userId: string, numberOfDays = 14): Promise<VocabularyReviewDay[]> {
  const todayKey = localDateKey()
  const emptyDays: VocabularyReviewDay[] = Array.from({ length: numberOfDays }, (_, index) => ({ dateKey: shiftDateKey(todayKey, index), words: [] }))
  if (!supabase || !userId) return emptyDays

  const resultKeys = emptyDays.map((day) => `${RESULT_KEY_PREFIX}${day.dateKey}`)
  const [completedResult, evaluationResult] = await Promise.all([
    supabase
      .from('lesson_progress')
      .select('lesson_id, textbook_id, updated_at')
      .eq('user_id', userId)
      .gte('progress_percent', 100)
      .order('updated_at'),
    supabase
      .from('user_progress_states')
      .select('state_key, state_value')
      .eq('user_id', userId)
      .in('state_key', [...resultKeys, ROTATION_KEY]),
  ])
  if (evaluationResult.error) throw evaluationResult.error
  for (const row of evaluationResult.data ?? []) {
    const dateKey = row.state_key.slice(RESULT_KEY_PREFIX.length)
    const day = emptyDays.find((item) => item.dateKey === dateKey)
    if (!day) continue
    try {
      const value = JSON.parse(row.state_value) as VocabularyReviewEvaluation
      if (['Bad', 'Good', 'Perfect'].includes(value.rating)) day.evaluation = value
    } catch {
      // Ignore malformed legacy state and keep the review calendar usable.
    }
  }
  if (completedResult.error || !completedResult.data?.length) return emptyDays

  const completedLessonIds = completedResult.data.map((item) => item.lesson_id)
  const vocabularyResult = await supabase
    .from('lesson_exercises')
    .select('id, lesson_id, prompt_ko, prompt_vi, answer, explanation_vi, image_url, media_url, audio_url, sort_order')
    .in('lesson_id', completedLessonIds)
    .eq('skill_type', 'vocabulary_grammar')
    .eq('status', 'published')
    .in('exercise_type', ['vocabulary', 'vocab', 'word', 'flashcard'])
    .order('sort_order')
  if (vocabularyResult.error || !vocabularyResult.data?.length) return emptyDays

  const vocabulary = vocabularyResult.data.map((item) => {
    const answer = item.answer && typeof item.answer === 'object' && !Array.isArray(item.answer)
      ? item.answer as Record<string, unknown>
      : {}
    const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
    return {
      id: item.id,
      lesson_id: item.lesson_id,
      word_ko: text(answer.word) ?? text(answer.correct) ?? item.prompt_ko,
      meaning_vi: text(answer.meaning) ?? item.prompt_vi ?? '',
      part_of_speech: text(answer.partOfSpeech),
      pronunciation: text(answer.pronunciation),
      mnemonic: text(answer.mnemonic) ?? item.explanation_vi,
      image_url: text(answer.imageUrl) ?? item.image_url ?? item.media_url,
      audio_url: text(answer.audioUrl) ?? item.audio_url,
      sort_order: item.sort_order,
    }
  })
  const lessonMeta = new Map(completedResult.data.map((item) => [item.lesson_id, item]))
  const words: ReviewWord[] = vocabulary.map((item) => ({
    id: item.id, lessonId: item.lesson_id,
    textbookId: lessonMeta.get(item.lesson_id)?.textbook_id || '',
    word: item.word_ko, meaningVi: item.meaning_vi, type: item.part_of_speech,
    pron: item.pronunciation, mnemonic: item.mnemonic, img: item.image_url,
    audio: item.audio_url, sortOrder: item.sort_order,
  })).filter((word) => word.word && word.meaningVi)
  const rotationRow = (evaluationResult.data ?? []).find((row) => row.state_key === ROTATION_KEY)
  const rotation = rotationRow ? JSON.parse(rotationRow.state_value) : {}
  if (!rotation.cycleAnchor) {
    rotation.cycleAnchor = todayKey
    rotation.cycleWordIds = words.map((word) => word.id)
    const { error } = await supabase.from('user_progress_states').upsert({
      user_id: userId, state_key: ROTATION_KEY,
      state_value: JSON.stringify(rotation), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,state_key' })
    if (error) throw error
  }
  // Keep group membership stable when new vocabulary is added.
  const byId = new Map(words.map((word) => [word.id, word]))
  const previousIds: string[] = rotation.cycleWordIds || []
  const previousSet = new Set(previousIds)
  const orderedWords = [
    ...previousIds.map((id) => byId.get(id)).filter((word): word is ReviewWord => Boolean(word)),
    ...words.filter((word) => !previousSet.has(word.id)),
  ]
  const utcDay = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  const elapsedDays = Math.max(0, Math.round((utcDay(todayKey) - utcDay(rotation.cycleAnchor)) / DAY_MS))
  const batches = buildReviewRotation(orderedWords, numberOfDays, DAILY_LIMIT, elapsedDays)
  batches.forEach((batch: ReviewWord[], index: number) => { emptyDays[index].words = batch })
  if (emptyDays[0]?.evaluation && rotation.dateKey === todayKey) {
    const completedIds = new Set(rotation.wordIds || [])
    emptyDays[0].words = words.filter((word) => completedIds.has(word.id))
  }

  return emptyDays
}

export async function saveVocabularyReviewResult(
  userId: string,
  dateKey: string,
  words: ReviewWord[],
  answers: Array<{ sourceId: string; targetWord: string; correct: boolean }>,
  evaluation: VocabularyReviewEvaluation,
) {
  if (!supabase || !userId || !words.length) return false
  const rotationResult = await supabase.from('user_progress_states')
    .select('state_value').eq('user_id', userId).eq('state_key', ROTATION_KEY).maybeSingle()
  if (rotationResult.error) throw rotationResult.error
  const rotation = rotationResult.data ? JSON.parse(rotationResult.data.state_value) : {}
  const counts = { ...(rotation.counts || {}) }
  const answeredIds = new Set(answers.map((answer) => answer.sourceId))
  const reviewedWords = words.filter((word) => answeredIds.has(word.id))
  if (rotation.completedAt !== evaluation.completedAt) {
    const alreadyReviewed = new Set(rotation.dateKey === dateKey ? rotation.wordIds || [] : [])
    reviewedWords.forEach((word) => {
      if (!alreadyReviewed.has(word.id)) counts[word.id] = (Number(counts[word.id]) || 0) + 1
    })
  }
  const ids = words.map((word) => word.id)
  const currentResult = await supabase
    .from('vocabulary_progress')
    .select('vocabulary_id, mastery, correct_count, incorrect_count, times_reviewed')
    .eq('user_id', userId)
    .in('vocabulary_id', ids)
  if (currentResult.error) throw currentResult.error

  const currentById = new Map((currentResult.data ?? []).map((item) => [item.vocabulary_id, item]))
  const answerById = new Map(answers.map((answer) => [answer.sourceId, answer.correct]))
  const now = new Date()
  const addDays = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString()
  const rows = words.map((word) => {
    const current = currentById.get(word.id)
    const correct = answerById.get(word.id) === true
    const mastery = correct ? Math.min(5, Number(current?.mastery || 0) + 1) : 1
    const interval = correct ? ([0, 1, 2, 4, 7, 7][mastery] || 7) : 1
    return {
      user_id: userId,
      textbook_id: word.textbookId,
      lesson_id: word.lessonId,
      vocabulary_id: word.id,
      mastery,
      correct_count: Number(current?.correct_count || 0) + (correct ? 1 : 0),
      incorrect_count: Number(current?.incorrect_count || 0) + (correct ? 0 : 1),
      last_rating: correct ? 'good' : 'forgot',
      next_review_at: addDays(interval),
      times_reviewed: Number(current?.times_reviewed || 0) + 1,
      updated_at: now.toISOString(),
    }
  })
  const [progressWrite, resultWrite, rotationWrite] = await Promise.all([
    supabase.from('vocabulary_progress').upsert(rows, { onConflict: 'user_id,vocabulary_id' }),
    supabase.from('user_progress_states').upsert({
      user_id: userId,
      state_key: `${RESULT_KEY_PREFIX}${dateKey}`,
      state_value: JSON.stringify({
        ...evaluation,
        wordResults: Object.fromEntries(reviewedWords.map((word) => [word.id, answerById.get(word.id) === true])),
      }),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,state_key' }),
    supabase.from('user_progress_states').upsert({
      user_id: userId, state_key: ROTATION_KEY,
      state_value: JSON.stringify({ ...rotation, counts, dateKey, wordIds: reviewedWords.map((word) => word.id), completedAt: evaluation.completedAt }),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,state_key' }),
  ])
  if (rotationWrite.error) throw rotationWrite.error
  if (progressWrite.error) throw progressWrite.error
  if (resultWrite.error) throw resultWrite.error
  window.dispatchEvent(new CustomEvent('kstudy:vocabulary-review-updated'))
  return true
}
