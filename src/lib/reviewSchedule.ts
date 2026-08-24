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
}

const DAY_MS = 86_400_000
const DAILY_LIMIT = 10
// The first review is one day after lesson completion. Subsequent placements
// are day 3 and day 7 relative to that completion date.
const REVIEW_OFFSETS = [0, 2, 6]

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
  const emptyDays = Array.from({ length: numberOfDays }, (_, index) => ({ dateKey: shiftDateKey(todayKey, index), words: [] as ReviewWord[] }))
  if (!supabase || !userId) return emptyDays

  const completedResult = await supabase
    .from('lesson_progress')
    .select('lesson_id, textbook_id, updated_at')
    .eq('user_id', userId)
    .gte('progress_percent', 100)
    .order('updated_at')
  if (completedResult.error || !completedResult.data?.length) return emptyDays

  const completedLessonIds = completedResult.data.map((item) => item.lesson_id)
  const vocabularyResult = await supabase
    .from('vocabulary')
    .select('id, lesson_id, word_ko, meaning_vi, part_of_speech, pronunciation, mnemonic, image_url, audio_url, sort_order')
    .in('lesson_id', completedLessonIds)
    .order('sort_order')
  if (vocabularyResult.error || !vocabularyResult.data?.length) return emptyDays

  const vocabularyIds = vocabularyResult.data.map((item) => item.id)
  const progressResult = await supabase
    .from('vocabulary_progress')
    .select('vocabulary_id, mastery, correct_count, incorrect_count, last_rating, next_review_at, times_reviewed')
    .eq('user_id', userId)
    .in('vocabulary_id', vocabularyIds)
  if (progressResult.error) return emptyDays

  const lessonMeta = new Map(completedResult.data.map((item) => [item.lesson_id, item]))
  const progressByWord = new Map((progressResult.data ?? []).map((item) => [item.vocabulary_id, item]))
  const candidates = vocabularyResult.data.map((item) => {
    const progress = progressByWord.get(item.id)
    const lesson = lessonMeta.get(item.lesson_id)
    const completedKey = localDateKey(new Date(lesson?.updated_at || Date.now()))
    const nextReviewKey = progress?.next_review_at ? localDateKey(new Date(progress.next_review_at)) : shiftDateKey(completedKey, 1)
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
  }).sort((a, b) => a.desiredKey.localeCompare(b.desiredKey) || a.randomOrder - b.randomOrder || b.priority - a.priority)

  const scheduledIds = emptyDays.map(() => new Set<string>())
  const placeWord = (word: ReviewWord, desiredIndex: number) => {
    for (let index = Math.max(0, desiredIndex); index < numberOfDays; index += 1) {
      if (emptyDays[index].words.length < DAILY_LIMIT && !scheduledIds[index].has(word.id)) {
        emptyDays[index].words.push(word)
        scheduledIds[index].add(word.id)
        return index
      }
    }
    return -1
  }

  for (const candidate of candidates) {
    const firstIndex = placeWord(candidate.word, daysBetween(todayKey, candidate.desiredKey))
    if (firstIndex < 0) continue
    for (const offset of REVIEW_OFFSETS.slice(1)) placeWord(candidate.word, firstIndex + offset)
  }

  return emptyDays
}
