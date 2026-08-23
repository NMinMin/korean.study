export function todayStrOf(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayStr() {
  return todayStrOf(new Date());
}

export function computeStreak(dates = []) {
  const set = new Set(dates);
  let cursor = new Date();
  if (!set.has(todayStrOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(todayStrOf(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeBestStreak(dates = []) {
  const sorted = [...new Set(dates)].sort();
  let best = 0, run = 0, prev = null;
  for (const d of sorted) {
    if (prev) {
      const p = new Date(prev);
      p.setDate(p.getDate() + 1);
      run = todayStrOf(p) === d ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
