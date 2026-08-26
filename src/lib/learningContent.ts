import { supabase } from './supabase'

export type LearningTextbook = {
  id: string
  slug: string
  title: string
  titleVi?: string | null
  description?: string | null
  status: 'draft' | 'published' | 'locked' | 'no_content'
  lessonCount: number
  completedLessonCount: number
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
  status: 'done' | 'current' | 'locked'
  progressPercent: number
}

export type LearningCatalog = {
  textbooks: LearningTextbook[]
  myTextbooks: LearningTextbook[]
  availableTextbooks: LearningTextbook[]
  lessons: LearningLesson[]
  activeTextbook: LearningTextbook
  continueLesson?: LearningLesson
  continueCompletedToday: boolean
  hasStarted: boolean
  vocabulary: LearningVocabulary[]
  grammar: LearningGrammar[]
  exercises: LearningExercise[]
}

const REQUIRED_LESSON_ACTIVITIES = ['tuvung', 'nghechep', 'shadowing', 'ontap'] as const

function localDateKey(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
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

export type LearningGrammar = {
  id: string
  lessonId: string
  pattern: string
  meaningVi: string
  usageVi?: string | null
  conjugationVi?: string | null
  notesVi?: string | null
  sortOrder: number
}

export type LearningExercise = {
  id: string
  lessonId: string
  skillType: 'vocabulary_grammar' | 'dictation' | 'shadowing' | 'review'
  exerciseType: string
  promptKo?: string | null
  promptVi?: string | null
  answer: Record<string, unknown>
  explanationVi?: string | null
  mediaUrl?: string | null
  imageUrl?: string | null
  audioUrl?: string | null
  sortOrder: number
}

async function loadLearningCatalogUncached(preferredTextbookId?: string): Promise<LearningCatalog | null> {
  if (!supabase) return null
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  const [textbookResult, lessonResult, membershipResult, progressResult, activityResult] = await Promise.all([
    supabase.from('textbooks').select('id, slug, title_ko, title_vi, description, status, sort_order').order('sort_order'),
    supabase.from('lessons').select('id, textbook_id, lesson_number, title_ko, title_vi, status').order('lesson_number'),
    userId
      ? supabase.from('user_textbooks').select('textbook_id, status').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
    userId
      ? supabase.from('lesson_progress').select('textbook_id, lesson_id, progress_percent, last_activity, last_position, updated_at').eq('user_id', userId).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    userId
      ? supabase.from('activity_progress').select('lesson_id, activity_type, progress_percent, completed_at, updated_at').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (textbookResult.error || lessonResult.error || membershipResult.error || progressResult.error || activityResult.error || !textbookResult.data?.length) return null

  const [vocabularyResult, grammarResult, exerciseResult] = await Promise.all([
    supabase
      .from('vocabulary')
      .select('id, lesson_id, word_ko, meaning_vi, part_of_speech, pronunciation, mnemonic, image_url, audio_url, sort_order')
      .order('sort_order'),
    supabase
      .from('grammar_patterns')
      .select('id, lesson_id, structure, meaning_vi, usage_vi, conjugation_vi, notes_vi, sort_order')
      .order('sort_order'),
    supabase
      .from('lesson_exercises')
      .select('id, lesson_id, skill_type, exercise_type, prompt_ko, prompt_vi, answer, explanation_vi, media_url, image_url, audio_url, sort_order')
      .order('sort_order'),
  ])
  if (vocabularyResult.error || grammarResult.error || exerciseResult.error) return null
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
  const activitiesByLesson = new Map<string, Map<string, { percent: number; completedAt: string | null }>>()
  for (const row of activityResult.data ?? []) {
    const activities = activitiesByLesson.get(row.lesson_id) ?? new Map()
    const current = activities.get(row.activity_type)
    const percent = Number(row.progress_percent || 0)
    if (!current || percent >= current.percent) {
      activities.set(row.activity_type, { percent, completedAt: row.completed_at })
    }
    activitiesByLesson.set(row.lesson_id, activities)
  }
  const storedProgress = new Map((progressResult.data ?? []).map((row) => [row.lesson_id, Number(row.progress_percent || 0)]))
  const effectiveLessonProgress = new Map<string, number>()
  const lessonCompletionDates = new Map<string, string>()
  for (const lessonRow of lessonResult.data ?? []) {
    const activities = activitiesByLesson.get(lessonRow.id)
    const activityPercent = activities
      ? Math.round(REQUIRED_LESSON_ACTIVITIES.reduce((sum, activity) => sum + (activities.get(activity)?.percent || 0), 0) / REQUIRED_LESSON_ACTIVITIES.length)
      : 0
    effectiveLessonProgress.set(lessonRow.id, Math.max(storedProgress.get(lessonRow.id) || 0, activityPercent))
    const completedRows = REQUIRED_LESSON_ACTIVITIES.map((activity) => activities?.get(activity))
    if (completedRows.every((activity) => activity && activity.percent >= 100 && activity.completedAt)) {
      const completedAt = completedRows.map((activity) => activity?.completedAt || '').sort().at(-1)
      if (completedAt) lessonCompletionDates.set(lessonRow.id, localDateKey(completedAt))
    }
  }
  const textbookProgress = new Map<string, number>()
  const textbookCompletedLessons = new Map<string, number>()
  for (const book of textbookResult.data) {
    // Tiến độ giáo trình phải dùng cùng mẫu số với số bài hiển thị trên card.
    // Các bài đang biên soạn vẫn thuộc cấu trúc giáo trình và được tính 0% cho
    // tới khi người học có thể hoàn thành; tránh trường hợp 1/7 nhưng hiện 100%.
    const textbookLessonIds = new Set(
      (lessonResult.data ?? []).filter((lesson) => lesson.textbook_id === book.id).map((lesson) => lesson.id),
    )
    const completedCount = [...textbookLessonIds].filter((lessonId) => (effectiveLessonProgress.get(lessonId) || 0) >= 100).length
    textbookCompletedLessons.set(book.id, completedCount)
    const progress = textbookLessonIds.size ? Math.round((completedCount / textbookLessonIds.size) * 100) : 0
    textbookProgress.set(book.id, progress)
  }
  const textbooks: LearningTextbook[] = textbookResult.data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title_ko,
    titleVi: row.title_vi,
    description: row.description,
    status: row.status,
    lessonCount: lessonCounts.get(row.id) ?? 0,
    completedLessonCount: textbookCompletedLessons.get(row.id) ?? 0,
    hasContent: (lessonResult.data ?? []).some((lesson) => lesson.textbook_id === row.id && lesson.status === 'published'),
    isAdded: memberships.has(row.id),
    userStatus: memberships.get(row.id),
    progressPercent: textbookProgress.get(row.id) ?? 0,
  }))
  const myTextbooks = textbooks.filter((book) => book.isAdded)
  const availableTextbooks = textbooks.filter((book) => book.status === 'published' && !book.isAdded)
  const todayKey = localDateKey()
  const bookHasUnfinishedLesson = (bookId: string) => (lessonResult.data ?? []).some(
    (item) => item.textbook_id === bookId && item.status === 'published' && (effectiveLessonProgress.get(item.id) || 0) < 100,
  )
  const bookCompletedToday = (bookId: string) => (lessonResult.data ?? []).some(
    (item) => item.textbook_id === bookId && lessonCompletionDates.get(item.id) === todayKey,
  )
  const latestBook = textbooks.find((book) => book.id === progressResult.data?.[0]?.textbook_id && book.isAdded)
  const activeTextbook =
    textbooks.find((book) => book.id === preferredTextbookId)
    ?? (latestBook && (bookHasUnfinishedLesson(latestBook.id) || bookCompletedToday(latestBook.id)) ? latestBook : undefined)
    ?? myTextbooks.find((book) => book.hasContent && bookHasUnfinishedLesson(book.id))
    ?? latestBook
    ?? myTextbooks.find((book) => book.hasContent)
    ?? textbooks.find((book) => book.status === 'published' && book.hasContent)
    ?? textbooks[0]
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
      status: (effectiveLessonProgress.get(row.id) || 0) >= 100 ? 'done' : row.status === 'published' ? 'current' : 'locked',
      progressPercent: effectiveLessonProgress.get(row.id) || 0,
    }))
  const latestProgress = (progressResult.data ?? []).find((progress) => progress.textbook_id === activeTextbook.id)
  const hasStarted = (progressResult.data ?? []).some((progress) => progress.textbook_id === activeTextbook.id)
    || lessons.some((lesson) => lesson.progressPercent > 0)
  const completedTodayLesson = [...lessons]
    .filter((lesson) => lessonCompletionDates.get(lesson.id) === todayKey)
    .sort((a, b) => b.no - a.no)[0]
  // `markLessonStarted` records last_activity = "lesson" whenever the learner
  // deliberately opens a lesson. Honour that explicit choice even at 0%, so a
  // reload/dashboard visit never jumps back to an older lesson.
  const explicitlySelectedLesson = latestProgress?.last_activity === 'lesson'
    ? lessons.find((lesson) => lesson.id === latestProgress.lesson_id && lesson.status === 'current' && lesson.progressPercent < 100)
    : undefined
  const latestInProgress = lessons.find((lesson) => lesson.id === latestProgress?.lesson_id && lesson.progressPercent > 0 && lesson.progressPercent < 100)
    ?? lessons.find((lesson) => lesson.status === 'current' && lesson.progressPercent > 0 && lesson.progressPercent < 100)
  const nextLesson = lessons.find((lesson) => lesson.status === 'current' && lesson.progressPercent < 100)
  const continueLesson = explicitlySelectedLesson ?? completedTodayLesson ?? latestInProgress ?? nextLesson
  const continueCompletedToday = Boolean(completedTodayLesson && continueLesson?.id === completedTodayLesson.id)
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
  const grammar: LearningGrammar[] = (grammarResult.data ?? [])
    .filter((row) => activeLessonIds.has(row.lesson_id))
    .map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      pattern: row.structure,
      meaningVi: row.meaning_vi,
      usageVi: row.usage_vi,
      conjugationVi: row.conjugation_vi,
      notesVi: row.notes_vi,
      sortOrder: row.sort_order,
    }))
  const exercises: LearningExercise[] = (exerciseResult.data ?? [])
    .filter((row) => activeLessonIds.has(row.lesson_id))
    .map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      skillType: row.skill_type as LearningExercise['skillType'],
      exerciseType: row.exercise_type,
      promptKo: row.prompt_ko,
      promptVi: row.prompt_vi,
      answer: (row.answer ?? {}) as Record<string, unknown>,
      explanationVi: row.explanation_vi,
      mediaUrl: row.media_url,
      imageUrl: row.image_url,
      audioUrl: row.audio_url,
      sortOrder: row.sort_order,
    }))
  return { textbooks, myTextbooks, availableTextbooks, lessons, activeTextbook, continueLesson, continueCompletedToday, hasStarted, vocabulary, grammar, exercises }
}

const CATALOG_CACHE_MS = 10_000
const catalogRequests = new Map<string, { expiresAt: number; promise: Promise<LearningCatalog | null> }>()

export function loadLearningCatalog(preferredTextbookId?: string): Promise<LearningCatalog | null> {
  const key = preferredTextbookId || 'active'
  const cached = catalogRequests.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.promise
  const promise = loadLearningCatalogUncached(preferredTextbookId).catch((error) => {
    catalogRequests.delete(key)
    throw error
  })
  catalogRequests.set(key, { expiresAt: Date.now() + CATALOG_CACHE_MS, promise })
  return promise
}

function invalidateLearningCatalogCache(): void {
  catalogRequests.clear()
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
  invalidateLearningCatalogCache()
}

export async function markLessonStarted(textbookId: string, lessonId: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  const marker = { textbook_id: textbookId, last_activity: 'lesson', updated_at: new Date().toISOString() }
  const { data: existing, error: updateError } = await supabase.from('lesson_progress')
    .update(marker)
    .eq('user_id', data.user.id)
    .eq('lesson_id', lessonId)
    .select('lesson_id')
    .maybeSingle()
  if (updateError) throw updateError
  if (existing) {
    invalidateLearningCatalogCache()
    return
  }
  const { error: insertError } = await supabase.from('lesson_progress').insert({
    user_id: data.user.id,
    textbook_id: textbookId,
    lesson_id: lessonId,
    progress_percent: 0,
    last_activity: 'lesson',
    last_position: {},
    updated_at: marker.updated_at,
  })
  if (insertError) throw insertError
  invalidateLearningCatalogCache()
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
  invalidateLearningCatalogCache()
}
