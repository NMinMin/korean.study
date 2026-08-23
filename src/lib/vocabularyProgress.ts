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

async function vocabularyRows(lesson: LessonIdentity): Promise<VocabularyRow[]> {
  if (!supabase || !lesson.id || !lesson.textbookId) return []
  const { data, error } = await supabase
    .from('vocabulary')
    .select('id, word_ko, lesson_id')
    .eq('lesson_id', lesson.id)
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    word_ko: row.word_ko,
    lesson_id: row.lesson_id,
    textbook_id: lesson.textbookId as string,
  }))
}

export async function loadRemoteVocabularyState(lesson: LessonIdentity, userId?: string | null): Promise<LocalVocabularyState | null> {
  if (!supabase || !userId) return null
  const words = await vocabularyRows(lesson)
  if (!words.length) return null
  const ids = words.map((word) => word.id)
  const [progress, bookmarks, notes] = await Promise.all([
    supabase.from('vocabulary_progress').select('vocabulary_id, mastery, last_rating, next_review_at, times_reviewed').eq('user_id', userId).in('vocabulary_id', ids),
    supabase.from('vocabulary_bookmarks').select('vocabulary_id').eq('user_id', userId).in('vocabulary_id', ids),
    supabase.from('vocabulary_notes').select('vocabulary_id, note').eq('user_id', userId).in('vocabulary_id', ids),
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

export async function saveRemoteVocabularyState(lesson: LessonIdentity, userId: string | null | undefined, state: LocalVocabularyState) {
  if (!supabase || !userId) return false
  const words = await vocabularyRows(lesson)
  if (!words.length) return false
  const operations: PromiseLike<unknown>[] = []
  for (const word of words) {
    const item = state[word.word_ko]
    if (!item) continue
    if (item.box || item.lastRating || item.dueAt || item.timesReviewed) {
      operations.push(supabase.from('vocabulary_progress').upsert({
        user_id: userId,
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
    operations.push(item.starred
      ? supabase.from('vocabulary_bookmarks').upsert({ user_id: userId, vocabulary_id: word.id })
      : supabase.from('vocabulary_bookmarks').delete().eq('user_id', userId).eq('vocabulary_id', word.id))
    if (item.note?.trim()) operations.push(supabase.from('vocabulary_notes').upsert({ user_id: userId, vocabulary_id: word.id, note: item.note.trim(), updated_at: new Date().toISOString() }))
    else operations.push(supabase.from('vocabulary_notes').delete().eq('user_id', userId).eq('vocabulary_id', word.id))
  }
  await Promise.all(operations)
  return true
}

export async function loadRemoteVocabularyStateForWords(words: IdentifiedVocabulary[], userId?: string | null): Promise<LocalVocabularyState | null> {
  if (!supabase || !userId || !words.length) return null
  const ids = words.map((word) => word.id)
  const { data, error } = await supabase
    .from('vocabulary_progress')
    .select('vocabulary_id, mastery, last_rating, next_review_at, times_reviewed')
    .eq('user_id', userId)
    .in('vocabulary_id', ids)
  if (error) return null
  const byId = new Map(words.map((word) => [word.id, word]))
  const state: LocalVocabularyState = {}
  for (const item of data ?? []) {
    const word = byId.get(item.vocabulary_id)?.word
    if (word) state[word] = {
      box: item.mastery || 1,
      lastRating: item.last_rating ?? undefined,
      dueAt: item.next_review_at ?? undefined,
      timesReviewed: item.times_reviewed || 0,
    }
  }
  return state
}

export async function saveRemoteVocabularyStateForWords(words: IdentifiedVocabulary[], userId: string | null | undefined, state: LocalVocabularyState) {
  if (!supabase || !userId || !words.length) return false
  const operations: PromiseLike<unknown>[] = []
  for (const word of words) {
    const item = state[word.word]
    if (!item) continue
    operations.push(supabase.from('vocabulary_progress').upsert({
      user_id: userId,
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
  await Promise.all(operations)
  return true
}
