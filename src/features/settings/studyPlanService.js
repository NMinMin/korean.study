import { supabase } from '../../lib/supabase';
import { todayStr } from '../../utils/streakUtils';
import {
  userStorageKey,
  readScopedProgress,
  legacyTextbookProgressKey,
} from '../../services/storageShim';
import {
  loadRemoteDailyGoal,
  saveRemoteDailyGoal,
  loadRemoteStudyPlan,
  saveRemoteStudyPlan,
  recordRemoteStudyMinutes,
} from '../../lib/studySettings';
import {
  isCelebrationSoundEnabled,
  CELEBRATION_SOUND_KEY,
} from '../../services/audioService';

export const studyPlanKey = (userId) => userStorageKey('study-plan', userId);
export const dailyGoalKey = (userId) => userStorageKey('daily-goal', userId);
export const lastNotifSeenKey = (userId) => userStorageKey('last-notif-seen', userId);
export const studyLogKey = (userId) => userStorageKey('study-log', userId);

export const WEEK_DAYS = [
  { key: 'mon', label: 'T2' },
  { key: 'tue', label: 'T3' },
  { key: 'wed', label: 'T4' },
  { key: 'thu', label: 'T5' },
  { key: 'fri', label: 'T6' },
  { key: 'sat', label: 'T7' },
  { key: 'sun', label: 'CN' },
];

export const DEFAULT_STUDY_PLAN = {
  targetDate: null,
  weeklySchedule: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  reminderEnabled: false,
  reminderTime: '20:00',
  lastReminderShownDate: null,
};

const readLocalJson = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(`kstudy:${key}`);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
};

export function getCachedDailyGoal(userId) {
  const cached = readLocalJson(dailyGoalKey(userId));
  return {
    targetMinutes: Number(cached?.targetMinutes) || 15,
    todayMinutes: cached?.todayDate === todayStr() ? Number(cached?.todayMinutes) || 0 : 0,
    todayDate: todayStr(),
    trackingVersion: 2,
  };
}

export function getCachedStudyPlan(userId) {
  const cached = readLocalJson(studyPlanKey(userId));
  return {
    ...DEFAULT_STUDY_PLAN,
    ...(cached || {}),
    weeklySchedule: {
      ...DEFAULT_STUDY_PLAN.weeklySchedule,
      ...(cached?.weeklySchedule || {}),
    },
  };
}

export async function touchStudyLog(userId) {
  let dates = [];
  try {
    const r = await readScopedProgress(studyLogKey(userId), legacyTextbookProgressKey('study-log'), userId);
    dates = JSON.parse(r.value).dates || [];
  } catch (e) { }
  const t = todayStr();
  if (!dates.includes(t)) {
    dates = [...dates, t];
    if (dates.length > 400) dates = dates.slice(-400);
    try { await window.storage.set(studyLogKey(userId), JSON.stringify({ dates })); } catch (e) { }
  }
  return dates;
}

export async function loadStudyGoalDates(userId) {
  try {
    const result = await readScopedProgress(studyLogKey(userId), legacyTextbookProgressKey('study-log'), userId);
    return JSON.parse(result.value).dates || [];
  } catch (e) {
    return [];
  }
}

export async function getDailyGoal(userId, editing = false) {
  const remote = await loadRemoteDailyGoal(todayStr(), editing);
  if (remote) {
    if (!editing) try { await window.storage.set(dailyGoalKey(userId), JSON.stringify(remote)); } catch (e) { }
    return remote;
  }
  try {
    const r = await readScopedProgress(dailyGoalKey(userId), legacyTextbookProgressKey('daily-goal'), userId);
    const g = JSON.parse(r.value);
    if (g.todayDate !== todayStr() || g.trackingVersion !== 2) {
      return { targetMinutes: g.targetMinutes || 15, todayMinutes: 0, todayDate: todayStr(), trackingVersion: 2 };
    }
    return { targetMinutes: g.targetMinutes || 15, todayMinutes: g.todayMinutes || 0, todayDate: g.todayDate, trackingVersion: 2 };
  } catch (e) {
    return { targetMinutes: 15, todayMinutes: 0, todayDate: todayStr(), trackingVersion: 2 };
  }
}

export async function saveDailyGoal(g, userId) {
  if (!await saveRemoteDailyGoal(g)) throw new Error('Không thể lưu mục tiêu học. Vui lòng thử lại.');
  const active = await loadRemoteDailyGoal(todayStr());
  const normalized = g.todayDate === todayStr()
    ? { ...g, targetMinutes: Number(g.targetMinutes) || 15 }
    : { ...g, targetMinutes: Number(g.targetMinutes) || 15, todayMinutes: 0, todayDate: todayStr(), trackingVersion: 2 };
  try {
    await window.storage.set(dailyGoalKey(userId), JSON.stringify(active || normalized));
    window.dispatchEvent(new CustomEvent('kstudy:daily-goal-updated', { detail: active || normalized }));
    return normalized;
  } catch (e) {
    return normalized;
  }
}

export async function recordStudyMinutes(minutes, userId) {
  const remote = await recordRemoteStudyMinutes(minutes);
  if (!remote) return null;
  try {
    await window.storage.set(dailyGoalKey(userId), JSON.stringify(remote));
  } catch (error) { }
  window.dispatchEvent(new CustomEvent('kstudy:daily-goal-updated', { detail: remote }));
  if (remote.targetMinutes > 0 && remote.todayMinutes >= remote.targetMinutes) {
    await touchStudyLog(userId);
  }
  return remote;
}

export async function getStudyPlan(userId, editing = false) {
  let local = { ...DEFAULT_STUDY_PLAN };
  try {
    const r = await readScopedProgress(studyPlanKey(userId), legacyTextbookProgressKey('study-plan'), userId);
    if (r?.value) local = { ...local, ...JSON.parse(r.value) };
  } catch (e) { }
  const remote = await loadRemoteStudyPlan(editing);
  if (!remote) return local;
  const merged = { ...local, ...remote, lastReminderShownDate: local.lastReminderShownDate };
  try {
    localStorage.setItem(CELEBRATION_SOUND_KEY, String(remote.effectSoundEnabled));
    if (!editing) await window.storage.set(studyPlanKey(userId), JSON.stringify(merged));
  } catch (e) { }
  return merged;
}

export async function saveStudyPlan(plan, effectSoundEnabled = isCelebrationSoundEnabled(), userId, targetMinutes) {
  const success = await saveRemoteStudyPlan(plan, effectSoundEnabled, targetMinutes);
  if (!success) throw new Error('Không thể lưu kế hoạch. Vui lòng thử lại.');
  try {
    localStorage.setItem(CELEBRATION_SOUND_KEY, String(effectSoundEnabled));
  } catch (e) { }
  window.dispatchEvent(new CustomEvent('kstudy:vocabulary-review-updated'));
  try {
    await getStudyPlan(userId);
    const active = await loadRemoteDailyGoal(todayStr());
    if (active) {
      await window.storage.set(dailyGoalKey(userId), JSON.stringify(active));
      window.dispatchEvent(new CustomEvent('kstudy:daily-goal-updated', { detail: active }));
    }
  } catch (error) { /* The plan is already saved; refresh cached state on the next load. */ }
}

export async function hasNewCommunityActivity(userId) {
  try {
    let seenTs = 0;
    try {
      const s = await readScopedProgress(lastNotifSeenKey(userId), legacyTextbookProgressKey('last-notif-seen'), userId);
      seenTs = JSON.parse(s.value).ts || 0;
    } catch (e) { }
    if (!supabase) return false;
    const { data, error } = await supabase
      .from('posts')
      .select('created_at')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    return new Date(data.created_at).getTime() > seenTs;
  } catch (e) {
    return false;
  }
}

export async function markNotifSeen(userId) {
  try {
    await window.storage.set(lastNotifSeenKey(userId), JSON.stringify({ ts: Date.now() }));
  } catch (e) { }
}
