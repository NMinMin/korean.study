import test from 'node:test';
import assert from 'node:assert/strict';
import { getReviewWordResult } from '../src/utils/reviewWordResult.js';

test('shows ticks for legacy 10/10 and crosses for legacy 0/10', () => {
  assert.equal(getReviewWordResult({ totalCount: 10, correctCount: 10 }, 'word', 10), true);
  assert.equal(getReviewWordResult({ totalCount: 10, correctCount: 0 }, 'word', 10), false);
});
test('uses individual answers and does not guess mixed legacy results', () => {
  const evaluation = { totalCount: 2, correctCount: 1, wordResults: { first: true, second: false } };
  assert.equal(getReviewWordResult(evaluation, 'first', 2), true);
  assert.equal(getReviewWordResult(evaluation, 'second', 2), false);
  assert.equal(getReviewWordResult({ totalCount: 10, correctCount: 8 }, 'word', 10), null);
  assert.equal(getReviewWordResult({ totalCount: 10, correctCount: 10 }, 'word', 5), null);
  assert.equal(getReviewWordResult(null, 'word', 10), null);
});
