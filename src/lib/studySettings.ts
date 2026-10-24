import { supabase } from './supabase'
import { todayStr } from '../utils/streakUtils'
import { planOnDate } from './studyCalendar.js'

export async function loadStudyCalendar(userId: string) {
  if (!supabase) throw new Error('Không thể kết nối lịch học')
  const { data, error } = await supabase.from('study_plan_versions')
    .select('effective_from, weekly_schedule, daily_goal_minutes').eq('user_id', userId).order('effective_from')
  if (error) throw error
  return data ?? []
}

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
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    window.dispatchEvent(new CustomEvent('kstudy:auth-expired'))
    return null
  }
  return data.user.id
}

export async function loadRemoteDailyGoal(date: string, editing = false): Promise<DailyGoalData | null> {
  if (!supabase) return null
  const userId = await currentUserId()
  if (!userId) return null
  const [settings, stats] = await Promise.all([
    supabase.from('user_settings').select('daily_goal_minutes').eq('user_id', userId).maybeSingle(),
    supabase.from('daily_study_stats').select('minutes').eq('user_id', userId).eq('study_date', date).maybeSingle(),
  ])
  if (settings.error || stats.error) return null
  return {
    targetMinutes: Number(editing ? settings.data?.daily_goal_minutes ?? 15 : planOnDate(await loadStudyCalendar(userId), date).daily_goal_minutes),
    todayMinutes: Number(stats.data?.minutes ?? 0),
    todayDate: date,
    trackingVersion: 2,
  }
}

export async function saveRemoteDailyGoal(goal: DailyGoalData) {
  if (!supabase) return false
  const userId = await currentUserId()
  if (!userId) return false
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    daily_goal_minutes: goal.targetMinutes,
    updated_at: new Date().toISOString(),
  })
  return !error
}

export async function recordRemoteStudyMinutes(minutes: number): Promise<DailyGoalData | null> {
  if (!supabase || !Number.isFinite(minutes) || minutes <= 0) return null
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return null
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    window.dispatchEvent(new CustomEvent('kstudy:auth-expired'))
    return null
  }
  const { data, error } = await supabase.rpc('record_study_minutes', { p_minutes: minutes, p_study_date: todayStr() })
  if (error) {
    const message = String(error.message || '').toLowerCase()
    if (error.code === 'PGRST301' || error.code === '42501' || message.includes('jwt') || message.includes('unauthorized') || message.includes('authentication required')) {
      window.dispatchEvent(new CustomEvent('kstudy:auth-expired'))
    }
    console.error('Không thể ghi thời gian học vào mục tiêu ngày', { code: error.code, message: error.message })
    throw error
  }
  if (!data) return null
  const row = Array.isArray(data) ? data[0] : data
  return {
    targetMinutes: Number(row?.target_minutes ?? 15),
    todayMinutes: Number(row?.today_minutes ?? 0),
    todayDate: String(row?.study_date ?? new Date().toISOString().slice(0, 10)),
    trackingVersion: 2,
  }
}

export async function loadRemoteStudyPlan(editing = false): Promise<(StudyPlanData & { effectSoundEnabled: boolean }) | null> {
  if (!supabase) return null
  const userId = await currentUserId()
  if (!userId) return null
  const [settings, plan, target] = await Promise.all([
    supabase.from('user_settings').select('weekly_schedule, reminder_enabled, reminder_time, effect_sound_enabled').eq('user_id', userId).maybeSingle(),
    supabase.from('study_plans').select('target_completion_date').eq('user_id', userId).maybeSingle(),
    supabase.from('study_target_versions').select('target_completion_date').eq('user_id', userId)
      .lte('effective_from', todayStr()).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (settings.error || plan.error || target.error) return null
  const active = planOnDate(await loadStudyCalendar(userId), todayStr())
  const selectedDays = new Set<number>((editing ? settings.data?.weekly_schedule ?? [1, 2, 3, 4, 5] : active.weekly_schedule) as number[])
  return {
    targetDate: (editing ? plan.data : target.data)?.target_completion_date ?? null,
    weeklySchedule: Object.fromEntries(dayKeys.map((key, index) => [key, selectedDays.has(index + 1)])),
    reminderEnabled: Boolean(settings.data?.reminder_enabled),
    reminderTime: String(settings.data?.reminder_time ?? '20:00').slice(0, 5),
    lastReminderShownDate: null,
    effectSoundEnabled: settings.data?.effect_sound_enabled !== false,
  }
}

export async function saveRemoteStudyPlan(plan: StudyPlanData, effectSoundEnabled: boolean, targetMinutes?: number) {
  if (!supabase) return false
  const userId = await currentUserId()
  if (!userId) return false
  const weeklySchedule = dayKeys.flatMap((key, index) => plan.weeklySchedule[key] ? [index + 1] : [])
  if (targetMinutes !== undefined) {
    const { error } = await supabase.rpc('save_weekly_study_plan', {
      p_days: weeklySchedule, p_goal: targetMinutes, p_target: plan.targetDate,
      p_reminder: plan.reminderEnabled, p_time: plan.reminderTime, p_sound: effectSoundEnabled,
    })
    return !error
  }
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
