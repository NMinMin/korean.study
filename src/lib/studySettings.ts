import { supabase } from './supabase'

export type DailyGoalData = {
  targetMinutes: number
  todayMinutes: number
  todayDate: string
  trackingVersion: number
}

export type StudyPlanData = {
  targetDate: string | null
  weeklySchedule: Record<string, boolean>
  reminderEnabled: boolean
  reminderTime: string
  lastReminderShownDate: string | null
}

const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

async function currentUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function loadRemoteDailyGoal(date: string): Promise<DailyGoalData | null> {
  if (!supabase) return null
  const userId = await currentUserId()
  if (!userId) return null
  const [settings, stats] = await Promise.all([
    supabase.from('user_settings').select('daily_goal_minutes').eq('user_id', userId).maybeSingle(),
    supabase.from('daily_study_stats').select('minutes').eq('user_id', userId).eq('study_date', date).maybeSingle(),
  ])
  if (settings.error || stats.error) return null
  return {
    targetMinutes: Number(settings.data?.daily_goal_minutes ?? 15),
    todayMinutes: Number(stats.data?.minutes ?? 0),
    todayDate: date,
    trackingVersion: 2,
  }
}

export async function saveRemoteDailyGoal(goal: DailyGoalData) {
  if (!supabase) return false
  const userId = await currentUserId()
  if (!userId) return false
  const [settings, stats] = await Promise.all([
    supabase.from('user_settings').upsert({ user_id: userId, daily_goal_minutes: goal.targetMinutes, updated_at: new Date().toISOString() }),
    supabase.from('daily_study_stats').upsert({ user_id: userId, study_date: goal.todayDate, minutes: goal.todayMinutes, updated_at: new Date().toISOString() }),
  ])
  return !settings.error && !stats.error
}

export async function loadRemoteStudyPlan(): Promise<(StudyPlanData & { effectSoundEnabled: boolean }) | null> {
  if (!supabase) return null
  const userId = await currentUserId()
  if (!userId) return null
  const [settings, plan] = await Promise.all([
    supabase.from('user_settings').select('weekly_schedule, reminder_enabled, reminder_time, effect_sound_enabled').eq('user_id', userId).maybeSingle(),
    supabase.from('study_plans').select('target_completion_date').eq('user_id', userId).maybeSingle(),
  ])
  if (settings.error || plan.error) return null
  const selectedDays = new Set<number>((settings.data?.weekly_schedule ?? [1, 2, 3, 4, 5]) as number[])
  return {
    targetDate: plan.data?.target_completion_date ?? null,
    weeklySchedule: Object.fromEntries(dayKeys.map((key, index) => [key, selectedDays.has(index + 1)])),
    reminderEnabled: Boolean(settings.data?.reminder_enabled),
    reminderTime: String(settings.data?.reminder_time ?? '20:00').slice(0, 5),
    lastReminderShownDate: null,
    effectSoundEnabled: settings.data?.effect_sound_enabled !== false,
  }
}

export async function saveRemoteStudyPlan(plan: StudyPlanData, effectSoundEnabled: boolean) {
  if (!supabase) return false
  const userId = await currentUserId()
  if (!userId) return false
  const weeklySchedule = dayKeys.flatMap((key, index) => plan.weeklySchedule[key] ? [index + 1] : [])
  const [settings, savedPlan] = await Promise.all([
    supabase.from('user_settings').upsert({
      user_id: userId,
      weekly_schedule: weeklySchedule,
      reminder_enabled: plan.reminderEnabled,
      reminder_time: plan.reminderTime,
      effect_sound_enabled: effectSoundEnabled,
      updated_at: new Date().toISOString(),
    }),
    supabase.from('study_plans').upsert({ user_id: userId, target_completion_date: plan.targetDate, updated_at: new Date().toISOString() }),
  ])
  return !settings.error && !savedPlan.error
}
