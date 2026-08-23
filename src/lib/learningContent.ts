import { supabase } from './supabase'

export type LearningTextbook = {
  id: string
  slug: string
  title: string
  titleVi?: string | null
  description?: string | null
  status: 'draft' | 'published' | 'locked' | 'no_content'
  lessonCount: number
  hasContent: boolean
  isAdded: boolean
  userStatus?: 'studying' | 'completed' | 'paused'
  progressPercent: number
}

export type LearningLesson = {
  id: string
  textbookId: string
  no: number
  title: string
  titleVi?: string | null
  words: number
  contentStatus: 'draft' | 'published' | 'locked' | 'no_content'
  status: 'current' | 'locked'
  progressPercent: number
}

export type LearningCatalog = {
  textbooks: LearningTextbook[]
  myTextbooks: LearningTextbook[]
  availableTextbooks: LearningTextbook[]
  lessons: LearningLesson[]
  activeTextbook: LearningTextbook
  continueLesson?: LearningLesson
  hasStarted: boolean
  vocabulary: LearningVocabulary[]
}

export type LearningVocabulary = {
  id: string
  lessonId: string
  word: string
  meaningVi: string
  type?: string | null
  pron?: string | null
  mnemonic?: string | null
  img?: string | null
  audio?: string | null
  sortOrder: number
}

const ACTIVE_SLUG = 'sejong-conversation-workbook-2-1'

export async function loadLearningCatalog(preferredTextbookId?: string): Promise<LearningCatalog | null> {
  if (!supabase) return null
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  const [textbookResult, lessonResult, membershipResult, progressResult] = await Promise.all([
    supabase.from('textbooks').select('id, slug, title_ko, title_vi, description, status, sort_order').order('sort_order'),
    supabase.from('lessons').select('id, textbook_id, lesson_number, title_ko, title_vi, status').order('lesson_number'),
    userId
      ? supabase.from('user_textbooks').select('textbook_id, status').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
    userId
      ? supabase.from('lesson_progress').select('textbook_id, lesson_id, progress_percent, last_activity, last_position, updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (textbookResult.error || lessonResult.error || membershipResult.error || progressResult.error || !textbookResult.data?.length) return null

  const vocabularyResult = await supabase
    .from('vocabulary')
    .select('id, lesson_id, word_ko, meaning_vi, part_of_speech, pronunciation, mnemonic, image_url, audio_url, sort_order')
    .order('sort_order')
  if (vocabularyResult.error) return null
  const wordCounts = new Map<string, number>()
  for (const row of vocabularyResult.data ?? []) {
    wordCounts.set(row.lesson_id, (wordCounts.get(row.lesson_id) ?? 0) + 1)
  }
  const lessonCounts = new Map<string, number>()
  for (const row of lessonResult.data ?? []) {
    lessonCounts.set(row.textbook_id, (lessonCounts.get(row.textbook_id) ?? 0) + 1)
  }
  const memberships = new Map(
    (membershipResult.data ?? []).map((row) => [row.textbook_id, row.status as LearningTextbook['userStatus']]),
  )
  const textbookProgress = new Map<string, number>()
  for (const book of textbookResult.data) {
    const publishedLessonIds = new Set(
      (lessonResult.data ?? []).filter((lesson) => lesson.textbook_id === book.id && lesson.status === 'published').map((lesson) => lesson.id),
    )
    const total = (progressResult.data ?? [])
      .filter((progress) => publishedLessonIds.has(progress.lesson_id))
      .reduce((sum, progress) => sum + Number(progress.progress_percent || 0), 0)
    textbookProgress.set(book.id, publishedLessonIds.size ? Math.round(total / publishedLessonIds.size) : 0)
  }
  const textbooks: LearningTextbook[] = textbookResult.data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title_ko,
    titleVi: row.title_vi,
    description: row.description,
    status: row.status,
    lessonCount: lessonCounts.get(row.id) ?? 0,
    hasContent: (lessonResult.data ?? []).some((lesson) => lesson.textbook_id === row.id && lesson.status === 'published'),
    isAdded: memberships.has(row.id),
    userStatus: memberships.get(row.id),
    progressPercent: textbookProgress.get(row.id) ?? 0,
  }))
  const myTextbooks = textbooks.filter((book) => book.isAdded)
  const availableTextbooks = textbooks.filter((book) => book.status === 'published' && !book.isAdded)
  const activeTextbook =
    textbooks.find((book) => book.id === preferredTextbookId)
    ?? textbooks.find((book) => book.id === progressResult.data?.[0]?.textbook_id && book.isAdded)
    ?? myTextbooks.find((book) => book.hasContent)
    ?? textbooks.find((book) => book.slug === ACTIVE_SLUG)
  if (!activeTextbook) return null
  const lessons: LearningLesson[] = (lessonResult.data ?? [])
    .filter((row) => row.textbook_id === activeTextbook.id)
    .map((row) => ({
      id: row.id,
      textbookId: row.textbook_id,
      no: row.lesson_number,
      title: row.title_ko,
      titleVi: row.title_vi,
      words: wordCounts.get(row.id) ?? 0,
      contentStatus: row.status,
      status: row.status === 'published' ? 'current' : 'locked',
      progressPercent: Number((progressResult.data ?? []).find((progress) => progress.lesson_id === row.id)?.progress_percent || 0),
    }))
  const latestProgress = (progressResult.data ?? []).find((progress) => progress.textbook_id === activeTextbook.id)
  const continueLesson = lessons.find((lesson) => lesson.id === latestProgress?.lesson_id)
    ?? lessons.find((lesson) => lesson.status === 'current')
    ?? lessons[0]
  const hasStarted = (progressResult.data ?? []).some((progress) => progress.textbook_id === activeTextbook.id)
  const activeLessonIds = new Set(lessons.map((lesson) => lesson.id))
  const vocabulary: LearningVocabulary[] = (vocabularyResult.data ?? [])
    .filter((row) => activeLessonIds.has(row.lesson_id))
    .map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      word: row.word_ko,
      meaningVi: row.meaning_vi,
      type: row.part_of_speech,
      pron: row.pronunciation,
      mnemonic: row.mnemonic,
      img: row.image_url,
      audio: row.audio_url,
      sortOrder: row.sort_order,
    }))
  return { textbooks, myTextbooks, availableTextbooks, lessons, activeTextbook, continueLesson, hasStarted, vocabulary }
}

export async function addUserTextbook(textbookId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase chưa được cấu hình')
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) throw new Error('Bạn cần đăng nhập để thêm giáo trình')
  const { error } = await supabase.from('user_textbooks').upsert(
    { user_id: data.user.id, textbook_id: textbookId, status: 'studying' },
    { onConflict: 'user_id,textbook_id' },
  )
  if (error) throw error
}

export async function markLessonStarted(textbookId: string, lessonId: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: data.user.id,
      textbook_id: textbookId,
      lesson_id: lessonId,
      last_activity: 'lesson',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  )
  if (error) throw error
}

export async function syncLessonProgress(
  textbookId: string,
  lessonId: string,
  progressPercent: number,
  lastActivity = 'lesson',
): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  const normalized = Math.max(0, Math.min(100, Math.round(progressPercent)))
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: data.user.id,
      textbook_id: textbookId,
      lesson_id: lessonId,
      progress_percent: normalized,
      last_activity: lastActivity,
      last_position: { progressPercent: normalized },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  )
  if (error) throw error
}
