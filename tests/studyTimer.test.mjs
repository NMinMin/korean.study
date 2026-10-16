import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// Exercise the actual tracking effect with a controlled browser clock.
const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const start = source.indexOf("    if (!profile?.id || !ACTIVE_STUDY_VIEWS.has(view))");
const end = source.indexOf('  }, [profile?.id, view]);', start);
const createTracker = new Function('profile', 'ACTIVE_STUDY_VIEWS', 'view', 'document', 'window', 'Date', 'recordStudyMinutes', 'refreshUserStats', source.slice(start, end));

test('persists the final seconds, refreshes streak and excludes hidden time', async () => {
  let now = 0;
  let tick;
  let interval;
  let refreshes = 0;
  const saves = [];
  const listeners = new Map();
  const document = {
    visibilityState: 'visible',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const window = {
    ...document,
    setInterval: (fn, delay) => { tick = fn; interval = delay; return 1; },
    clearInterval: () => {},
  };
  const cleanup = createTracker({ id: 'learner' }, new Set(['study']), 'study', document, window,
    { now: () => now }, async (minutes) => {
      saves.push(minutes);
      return { targetMinutes: 15, todayMinutes: 15.24 };
    }, async () => { refreshes++; });
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  assert.equal(interval, 15_000);
  now = 15_000;
  tick();
  await settle();
  assert.deepEqual(saves, [0.25]);
  assert.equal(refreshes, 1);

  now = 16_000;
  document.visibilityState = 'hidden';
  listeners.get('visibilitychange')();
  await settle();
  assert.equal(saves[1], 1 / 60);
  now = 600_000;
  tick();
  now = 900_000;
  tick();
  await settle();
  assert.equal(saves.length, 2);
  cleanup();
});
