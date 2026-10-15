import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewRotation } from '../src/lib/reviewRotation.js';
const words = Array.from({ length: 23 }, (_, index) => ({ id: String(index) }));
test('reviews each group on days 1, 3, 5, 7 with rest days', () => {
  const days = buildReviewRotation(words, 7);
  assert.deepEqual(days.map((batch) => batch.length), [10, 0, 10, 0, 10, 0, 10]);
  for (const index of [0, 2, 4, 6]) assert.deepEqual(days[index], words.slice(0, 10));
});
test('covers all groups before repeating the first group', () => {
  const days = buildReviewRotation(words, 22);
  assert.deepEqual(days[7], words.slice(10, 20));
  assert.deepEqual(days[14], words.slice(20));
  assert.deepEqual(days[21], words.slice(0, 10));
});
test('reloading advances from the original anchor, without shifting dates', () => {
  const days = buildReviewRotation(words, 14);
  assert.deepEqual(buildReviewRotation(words, 7, 10, 3), days.slice(3, 10));
});
test('empty and duplicate vocabulary stays safe', () => {
  assert.deepEqual(buildReviewRotation([], 2), [[], []]);
  assert.deepEqual(buildReviewRotation([words[0], words[0]], 3), [[words[0]], [], [words[0]]]);
});
