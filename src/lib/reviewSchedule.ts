import { supabase } from './supabase'

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
}

const DAY_MS = 86_400_000
const DAILY_LIMIT = 10
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

function daysBetween(from: string, to: string) {
  const parse = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
  }
  return Math.round((parse(to) - parse(from)) / DAY_MS)
}

// Stable daily shuffle: the same learner sees a consistent list during the
// day, while words are still randomly distributed instead of following the
// vocabulary sort order.
function randomRank(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
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
      .in('state_key', resultKeys),
  ])
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
  const vocabularyIds = vocabulary.map((item) => item.id)
  const progressResult = await supabase
    .from('vocabulary_progress')
    .select('vocabulary_id, mastery, correct_count, incorrect_count, last_rating, next_review_at, times_reviewed, updated_at')
    .eq('user_id', userId)
    .in('vocabulary_id', vocabularyIds)
  if (progressResult.error) return emptyDays

  const lessonMeta = new Map(completedResult.data.map((item) => [item.lesson_id, item]))
  const progressByWord = new Map((progressResult.data ?? []).map((item) => [item.vocabulary_id, item]))
  const candidates = vocabulary.map((item) => {
    const progress = progressByWord.get(item.id)
    const lesson = lessonMeta.get(item.lesson_id)
    const completedKey = localDateKey(new Date(lesson?.updated_at || Date.now()))
    const progressUpdatedKey = progress?.updated_at ? localDateKey(new Date(progress.updated_at)) : null
    // Dữ liệu được tạo lúc học bài (cùng ngày bài đạt 100%) là lần học đầu,
    // chưa phải một lượt ôn. Một số bản cũ đã ghi nhầm hạn +3 ngày ở đây;
    // luôn đưa lượt ôn đầu tiên về ngày kế tiếp. Sau lượt ôn thật sự,
    // updated_at khác ngày hoàn thành bài và next_review_at tiếp tục điều
    // khiển các mốc +3 rồi +7 ngày.
    const isInitialLearning = !progress || progressUpdatedKey === completedKey
    const nextReviewKey = isInitialLearning
      ? shiftDateKey(completedKey, 1)
      : progress?.next_review_at
        ? localDateKey(new Date(progress.next_review_at))
        : shiftDateKey(progressUpdatedKey || completedKey, 1)
    const desiredKey = nextReviewKey < todayKey ? todayKey : nextReviewKey
    const priority =
      (progress?.last_rating === 'forgot' ? 120 : progress?.last_rating === 'vague' ? 75 : 0)
      + Number(progress?.incorrect_count || 0) * 12
      - Number(progress?.correct_count || 0) * 2
      + (5 - Number(progress?.mastery || 0)) * 9
      + (!progress ? 55 : 0)
    return {
      desiredKey,
      priority,
      randomOrder: randomRank(`${todayKey}:${desiredKey}:${item.id}`),
      // Hiển thị trước toàn bộ các mốc còn lại để lịch không tạo một
      // khoảng nghỉ dài giả. Mốc 1–3–7 được tính từ lần học đầu tiên:
      // từ ngày 1 tới ngày 3 là +2 ngày, tới ngày 7 là thêm +4 ngày.
      projectedOffsets: isInitialLearning || Number(progress?.mastery || 0) <= 1
        ? [0, 2, 6]
        : Number(progress?.mastery || 0) === 2
          ? [0, 4]
          : [0],
      word: {
        id: item.id,
        lessonId: item.lesson_id,
        textbookId: lesson?.textbook_id || '',
        word: item.word_ko,
        meaningVi: item.meaning_vi,
        type: item.part_of_speech,
        pron: item.pronunciation,
        mnemonic: item.mnemonic,
        img: item.image_url,
        audio: item.audio_url,
        sortOrder: item.sort_order,
      } satisfies ReviewWord,
    }
  }).sort((a, b) => a.desiredKey.localeCompare(b.desiredKey) || b.priority - a.priority || a.randomOrder - b.randomOrder)

  const scheduledIds = emptyDays.map(() => new Set<string>())
  const placeWord = (word: ReviewWord, desiredIndex: number) => {
    // Lịch 1–3–7 là các mốc cố định, không phải hàng đợi công việc.
    // Nếu một mốc đã đủ 10 từ thì không đẩy phần dư sang ngày kế tiếp,
    // vì làm vậy sẽ biến lịch ngắt quãng thành lịch ôn liên tục.
    const index = Math.max(0, desiredIndex)
    if (
      index >= numberOfDays
      || emptyDays[index].words.length >= DAILY_LIMIT
      || scheduledIds[index].has(word.id)
    ) return -1

    emptyDays[index].words.push(word)
    scheduledIds[index].add(word.id)
    return index
  }

  // Xếp lượt đầu của toàn bộ từ trước để từ chưa được ôn không bị một lượt
  // lặp dự kiến chiếm mất chỗ (giới hạn 10 từ/ngày).
  const placedCandidates = candidates.map((candidate) => ({
    candidate,
    firstIndex: placeWord(candidate.word, daysBetween(todayKey, candidate.desiredKey)),
  }))

  for (const { candidate, firstIndex } of placedCandidates) {
    if (firstIndex < 0) continue
    // Các lượt sau là dự kiến. Khi người học ôn thật, next_review_at được
    // cập nhật và lần tải lịch kế tiếp sẽ tính lại theo kết quả Đã nhớ /
    // Chưa nhớ của chính người dùng.
    for (const offset of candidate.projectedOffsets.slice(1)) {
      placeWord(candidate.word, firstIndex + offset)
    }
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
  const [progressWrite, resultWrite] = await Promise.all([
    supabase.from('vocabulary_progress').upsert(rows, { onConflict: 'user_id,vocabulary_id' }),
    supabase.from('user_progress_states').upsert({
      user_id: userId,
      state_key: `${RESULT_KEY_PREFIX}${dateKey}`,
      state_value: JSON.stringify(evaluation),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,state_key' }),
  ])
  if (progressWrite.error) throw progressWrite.error
  if (resultWrite.error) throw resultWrite.error
  window.dispatchEvent(new CustomEvent('kstudy:vocabulary-review-updated'))
  return true
}
