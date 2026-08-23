export type LessonStorageIdentity = {
  id?: string | null
  lessonId?: string | null
  textbookId?: string | null
  textbook_id?: string | null
  no?: number | string | null
}

function segment(value: unknown, fallback: string) {
  const normalized = String(value ?? '').trim()
  return encodeURIComponent(normalized || fallback)
}

export function lessonProgressKey(
  kind: string,
  lesson: LessonStorageIdentity | null | undefined,
  userId?: string | null,
  suffix?: string | number,
) {
  const user = segment(userId, 'guest')
  const textbook = segment(lesson?.textbookId ?? lesson?.textbook_id, 'unassigned-textbook')
  const lessonId = segment(lesson?.id ?? lesson?.lessonId ?? (lesson?.no != null ? `lesson-${lesson.no}` : null), 'unassigned-lesson')
  const base = `progress:${segment(kind, 'general')}:${user}:${textbook}:${lessonId}`
  return suffix == null ? base : `${base}:${segment(suffix, 'default')}`
}

export function textbookProgressKey(kind: string, textbookId: string | null | undefined, userId?: string | null, suffix?: string | number) {
  const base = `progress:${segment(kind, 'general')}:${segment(userId, 'guest')}:${segment(textbookId, 'unassigned-textbook')}`
  return suffix == null ? base : `${base}:${segment(suffix, 'default')}`
}

export function userStorageKey(kind: string, userId?: string | null) {
  return `${segment(kind, 'general')}:${segment(userId, 'guest')}`
}

// Read-only compatibility keys. New writes must use the scoped builders above.
export const legacyLessonProgressKey = (kind: string, lessonNumber: number | string) => `${kind}:2-1:${lessonNumber}`
export const legacyTextbookProgressKey = (kind: string, suffix?: string | number) => suffix == null ? `${kind}:2-1` : `${kind}:2-1:${suffix}`
