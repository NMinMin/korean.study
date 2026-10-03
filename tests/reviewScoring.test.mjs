import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateReviewComposite } from '../src/features/review/reviewScoring.js'

test('empty sessions earn zero points', () => {
  assert.equal(calculateReviewComposite().composite, 0)
})

test('skipped shadowing remains in the denominator and counts as zero', () => {
  const result = calculateReviewComposite([{ correct: true }], [], [{ score: 100 }, { score: 100, timedOut: true }], 1000)
  assert.equal(result.reflexAccuracy, 50)
  assert.equal(result.composite, 87.5)
  assert.equal(calculateReviewComposite([{ correct: true }], [], [{ timedOut: true }], 1000).reflexAccuracy, 0)
})

test('invalid AI scores cannot inflate or corrupt the grade', () => {
  const result = calculateReviewComposite([{ correct: true }], [{ score: 200 }, { score: NaN }], [{ score: -20 }], 1000)
  assert.equal(result.writingAvg, 50)
  assert.equal(result.reflexAccuracy, 0)
  assert.ok(Number.isFinite(result.composite))
  assert.ok(result.composite >= 0 && result.composite <= 100)
})

test('correct and incorrect answers produce different scores', () => {
  const perfect = calculateReviewComposite([{ correct: true }], [], [], 1000)
  const wrong = calculateReviewComposite([{ correct: false }], [], [], 1000)
  assert.equal(perfect.composite, 100)
  assert.ok(wrong.composite < 80)
})
