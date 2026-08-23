import { supabase } from './supabase'

export type ActivityKind = 'tuvung' | 'nghechep' | 'shadowing' | 'ontap'
export type ActivityProgressRecord = { activityType: ActivityKind; progressPercent: number; completedItems: Record<string, unknown>; completedAt: string | null }

export async function loadRemoteActivityProgress(lessonId?: string): Promise<ActivityProgressRecord[]> {
  if (!supabase || !lessonId) return []
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase.from('activity_progress')
    .select('activity_type, progress_percent, completed_items, completed_at')
    .eq('user_id', auth.user.id).eq('lesson_id', lessonId)
  if (error) return []
  return (data ?? []).map((row) => ({ activityType: row.activity_type as ActivityKind, progressPercent: Number(row.progress_percent || 0), completedItems: (row.completed_items || {}) as Record<string, unknown>, completedAt: row.completed_at }))
}

export async function saveRemoteActivityProgress(textbookId: string | undefined, lessonId: string | undefined, activityType: ActivityKind, completedItems: Record<string, unknown>, totalItems: number): Promise<number> {
  if (!supabase || !textbookId || !lessonId) return 0
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return 0
  const progressPercent = totalItems > 0 ? Math.min(100, Math.round((Object.keys(completedItems).length / totalItems) * 100)) : 0
  const { error } = await supabase.from('activity_progress').upsert({
    user_id: auth.user.id, textbook_id: textbookId, lesson_id: lessonId, activity_type: activityType,
    progress_percent: progressPercent, completed_items: completedItems,
    completed_at: progressPercent >= 100 ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,lesson_id,activity_type' })
  if (error) throw error
  return progressPercent
}
