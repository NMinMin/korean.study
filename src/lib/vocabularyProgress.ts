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

async function authenticatedUserId(requestedUserId?: string | null): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  // The authenticated user is the only valid owner under RLS. Never trust a
  // user id supplied by view state when writing personal learning progress.
  if (requestedUserId && requestedUserId !== data.user.id) {
    console.warn('Bỏ qua user_id không khớp phiên đăng nhập khi lưu tiến trình từ vựng')
  }
  return data.user.id
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

export async function saveRemoteVocabularyState(lesson: LessonIdentity, userId: string | null | undefined, state: LocalVocabularyState) {
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
    operations.push(item.starred
      ? supabase.from('vocabulary_bookmarks').upsert({ user_id: ownerId, vocabulary_id: word.id })
      : supabase.from('vocabulary_bookmarks').delete().eq('user_id', ownerId).eq('vocabulary_id', word.id))
    if (item.note?.trim()) operations.push(supabase.from('vocabulary_notes').upsert({ user_id: ownerId, vocabulary_id: word.id, note: item.note.trim(), updated_at: new Date().toISOString() }))
    else operations.push(supabase.from('vocabulary_notes').delete().eq('user_id', ownerId).eq('vocabulary_id', word.id))
  }
  const results = await Promise.all(operations)
  const failed = results.find((result: any) => result?.error)
  if (failed && (failed as any).error) {
    console.error('Không thể lưu tiến trình từ vựng theo người dùng', (failed as any).error)
    return false
  }
  return operations.length > 0
}

export async function loadRemoteVocabularyStateForWords(words: IdentifiedVocabulary[], userId?: string | null): Promise<LocalVocabularyState | null> {
  if (!supabase || !userId || !words.length) return null
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return null
  const ids = words.map((word) => word.id)
  const { data, error } = await supabase
    .from('vocabulary_progress')
    .select('vocabulary_id, mastery, last_rating, next_review_at, times_reviewed')
    .eq('user_id', ownerId)
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
  const ownerId = await authenticatedUserId(userId)
  if (!ownerId) return false
  const operations: PromiseLike<unknown>[] = []
  for (const word of words) {
    const item = state[word.word]
    if (!item) continue
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
  const results = await Promise.all(operations)
  const failed = results.find((result: any) => result?.error)
  if (failed && (failed as any).error) {
    console.error('Không thể lưu tiến trình ôn từ theo người dùng', (failed as any).error)
    return false
  }
  return operations.length > 0
}
