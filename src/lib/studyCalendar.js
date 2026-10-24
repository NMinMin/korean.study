export const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export function planOnDate(versions, dateKey) {
  return versions.filter((v) => v.effective_from === '-infinity' || v.effective_from <= dateKey)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from)).at(-1)
    || { weekly_schedule: DEFAULT_DAYS, daily_goal_minutes: 15 };
}

export function isStudyDate(versions, dateKey) {
  const day = new Date(`${dateKey}T12:00:00`).getDay() || 7;
  return planOnDate(versions, dateKey).weekly_schedule.includes(day);
}

export function shiftStudyDate(key, days) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nextStudyDate(versions, key) {
  // An empty schedule intentionally pauses reviews.
  for (let offset = 0; offset < 370; offset++) {
    const candidate = shiftStudyDate(key, offset);
    if (isStudyDate(versions, candidate)) return candidate;
  }
  return null;
}

export function countStudyDates(versions, start, end) {
  let count = 0;
  for (let key = start; key < end; key = shiftStudyDate(key, 1)) {
    if (isStudyDate(versions, key)) count++;
  }
  return count;
}
