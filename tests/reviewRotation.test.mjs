import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewRotation } from '../src/lib/reviewRotation.js';

const words = Array.from({ length: 23 }, (_, index) => ({ id: String(index) }));

test('covers every word before starting another round', () => {
  const batches = buildReviewRotation(words, {}, 6);
  assert.deepEqual(batches.map((batch) => batch.length), [10, 10, 3, 10, 10, 3]);
  assert.equal(new Set(batches.slice(0, 3).flat().map((word) => word.id)).size, 23);
  assert.deepEqual(batches[0], batches[3]);
});

test('resumes saved progress and prioritizes newly added words', () => {
  const counts = Object.fromEntries(words.slice(0, 10).map((word) => [word.id, 1]));
  const batches = buildReviewRotation(words, counts, 3);
  assert.deepEqual(batches[0], words.slice(10, 20));
  assert.deepEqual(batches[1], words.slice(20));
  assert.deepEqual(batches[2], words.slice(0, 10));
});

test('small and duplicate lists never repeat a word within one batch', () => {
  assert.deepEqual(buildReviewRotation([words[0], words[0]], {}, 2), [[words[0]], [words[0]]]);
  assert.deepEqual(buildReviewRotation([], {}, 2), [[], []]);
});
