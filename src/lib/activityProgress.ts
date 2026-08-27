import { supabase } from './supabase'

export type ActivityKind = 'tuvung' | 'nghechep' | 'shadowing' | 'ontap'
export type ActivityProgressRecord = { activityType: ActivityKind; progressPercent: number; completedItems: Record<string, unknown>; completedAt: string | null }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isDatabaseId(value?: string): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

type ActivityProgressPayload = {
  user_id: string
  textbook_id: string
  lesson_id: string
  activity_type: ActivityKind
  progress_percent: number
  completed_items: Record<string, unknown>
  completed_at: string | null
  updated_at: string
}

async function writeActivityProgress(payload: ActivityProgressPayload): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.rpc('save_activity_progress', {
    p_textbook_id: payload.textbook_id,
    p_lesson_id: payload.lesson_id,
    p_activity_type: payload.activity_type,
    p_progress_percent: payload.progress_percent,
    p_completed_items: payload.completed_items,
    p_completed_at: payload.completed_at,
  })

  if (error) {
    console.error('Không thể lưu activity_progress', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      activityType: payload.activity_type,
      lessonId: payload.lesson_id,
    })
    throw error
  }
}

async function currentAuthUserId() {
  if (!supabase) return null
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return null
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) {
    window.dispatchEvent(new CustomEvent('kstudy:auth-expired'))
    return null
  }
  return auth.user.id
}

export async function loadRemoteActivityProgress(lessonId?: string): Promise<ActivityProgressRecord[]> {
  if (!supabase || !isDatabaseId(lessonId)) return []
  const userId = await currentAuthUserId()
  if (!userId) return []
  const { data, error } = await supabase.from('activity_progress')
    .select('activity_type, progress_percent, completed_items, completed_at')
    .eq('user_id', userId).eq('lesson_id', lessonId)
  if (error) return []
  return (data ?? []).map((row) => ({ activityType: row.activity_type as ActivityKind, progressPercent: Number(row.progress_percent || 0), completedItems: (row.completed_items || {}) as Record<string, unknown>, completedAt: row.completed_at }))
}

export async function saveRemoteActivityProgress(textbookId: string | undefined, lessonId: string | undefined, activityType: ActivityKind, completedItems: Record<string, unknown>, totalItems: number, maxPercent = 100): Promise<number> {
  if (!supabase || !isDatabaseId(textbookId) || !isDatabaseId(lessonId)) return 0
  const userId = await currentAuthUserId()
  if (!userId) return 0
  const progressPercent = totalItems > 0 ? Math.min(maxPercent, Math.round((Object.keys(completedItems).length / totalItems) * 100)) : 0
  await writeActivityProgress({
    user_id: userId, textbook_id: textbookId, lesson_id: lessonId, activity_type: activityType,
    progress_percent: progressPercent, completed_items: completedItems,
    completed_at: progressPercent >= 100 ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  })
  return progressPercent
}

export async function markRemoteActivityCompleted(textbookId: string | undefined, lessonId: string | undefined, activityType: ActivityKind): Promise<void> {
  if (!supabase || !isDatabaseId(textbookId) || !isDatabaseId(lessonId)) return
  const userId = await currentAuthUserId()
  if (!userId) return
  const { data: current } = await supabase.from('activity_progress').select('completed_items').eq('user_id', userId).eq('lesson_id', lessonId).eq('activity_type', activityType).maybeSingle()
  await writeActivityProgress({
    user_id: userId, textbook_id: textbookId, lesson_id: lessonId, activity_type: activityType,
    progress_percent: 100, completed_items: current?.completed_items || { completed: true },
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })
}
