import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/features/study/DictationView.jsx', import.meta.url), 'utf8');
const effectStart = source.indexOf('    let alive = true;', source.indexOf('export default function DictationView'));
const effectEnd = source.indexOf('    // eslint-disable-next-line', effectStart);

test('failed final attempt clears all test answers while preserving practice and its summary', async () => {
  const start = source.indexOf('  const finishAttempt = (statusSnapshot, verifiedSnapshot) => {') + '  const finishAttempt = (statusSnapshot, verifiedSnapshot) => {'.length;
  const end = source.indexOf('\n  };', start);
  for (const correctCount of [0, 4, 5]) {
    const lines = Array.from({ length: 6 }, (_, no) => ({ no }));
    const verified = { 'practice:0': 'correct' };
    const status = {};
    lines.forEach((item, index) => {
      verified[`test:${item.no}`] = index < correctCount ? 'correct' : 'forgot';
      status[index] = index < correctCount ? 'correct' : 'failed';
    });
    const state = {};
    const saves = [];
    const writes = { current: Promise.resolve() };
    const finish = new Function('statusSnapshot', 'verifiedSnapshot', 'orderedLines', 'progressKey', 'mode', 'total', 'DICTATION_PASS_PERCENT', 'setCompletionResult', 'setVerified', 'window', 'storageKey', 'progressSaveRef', 'saveRemoteActivityProgress', 'lesson', 'onProgress', 'setShowCompletion', source.slice(start, end));
    finish(status, verified, lines, (mode, item) => `${mode}:${item.no}`, 'test', 6, 80,
      (value) => { state.summary = value; }, (value) => { state.verified = value; },
      { storage: { set: async () => {} } }, 'key', writes,
      async (...args) => { saves.push(args); return 0; }, { id: 'lesson', textbookId: 'book' },
      () => {}, (value) => { state.completed = value; });
    await writes.current;
    assert.deepEqual(state.summary, { correctCount, skippedCount: 0 });
    assert.equal(state.completed, true);
    if (correctCount < 5) {
      assert.equal(state.verified['practice:0'], 'correct');
      assert.ok(lines.every((item) => state.verified[`test:${item.no}`] === 'forgot'));
      assert.equal(saves[0][7], 0);
    } else {
      assert.equal(state.verified, undefined);
      assert.equal(saves.length, 0);
    }
  }
});

test('retry invalidates an in-flight load of the old completed attempt', async () => {
  let finishLoad;
  const pending = new Promise((resolve) => { finishLoad = resolve; });
  const revision = { current: 0 };
  let restored = false;
  const runLoad = new Function('progressLoadRevision', 'readScopedProgress', 'loadRemoteActivityProgress', 'storageKey', 'legacyDictationProgressKey', 'lesson', 'userId', 'window', 'setVerified', source.slice(effectStart, effectEnd));
  const cleanup = runLoad(revision, () => pending, async () => [], 'dictation', () => 'legacy', { id: 'lesson' }, 'user',
    { storage: { set: async () => {} } }, () => { restored = true; });

  const retryStart = source.indexOf('  const retryDictation = () => {') + '  const retryDictation = () => {'.length;
  const retryEnd = source.indexOf('\n  };', retryStart);
  const setters = [...source.slice(retryStart, retryEnd).matchAll(/\b(set\w+)\(/g)].map((match) => match[1]);
  const state = { setVerified: { 'test:1': 'correct', 'practice:1': 'correct' } };
  const runRetry = new Function('progressLoadRevision', 'autoAdvanceRef', 'clearTimeout', 'mode', ...setters, source.slice(retryStart, retryEnd));
  runRetry(revision, { current: null }, () => {}, 'test', ...setters.map((name) => (value) => {
    state[name] = typeof value === 'function' ? value(state[name]) : value;
  }));
  finishLoad({ value: JSON.stringify({ 'test:1': 'correct' }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(restored, false);
  assert.equal(state.setShowCompletion, false);
  assert.deepEqual(state.setVerified, { 'practice:1': 'correct' });
  assert.deepEqual(state.setStatus, {});
  assert.deepEqual(state.setReveal, {});
  cleanup();
});
