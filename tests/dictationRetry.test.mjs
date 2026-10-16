import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/features/study/DictationView.jsx', import.meta.url), 'utf8');
const effectStart = source.indexOf('    let alive = true;', source.indexOf('export default function DictationView'));
const effectEnd = source.indexOf('    // eslint-disable-next-line', effectStart);

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
