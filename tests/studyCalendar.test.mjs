import test from 'node:test';
import assert from 'node:assert/strict';
import { countStudyDates, isStudyDate, nextStudyDate, planOnDate } from '../src/lib/studyCalendar.js';
import { buildReviewRotation } from '../src/lib/reviewRotation.js';

const versions = [
  { effective_from: '-infinity', weekly_schedule: [1, 2, 3, 4, 5], daily_goal_minutes: 15 },
  { effective_from: '2026-10-26', weekly_schedule: [2, 4], daily_goal_minutes: 30 },
];

test('weekend rest preserves a Friday streak until Monday', () => {
  assert.equal(countStudyDates(versions.slice(0, 1), '2026-10-24', '2026-10-26'), 0);
  assert.equal(isStudyDate(versions, '2026-10-24'), false);
  assert.equal(isStudyDate(versions, '2026-10-25'), false);
});

test('edits switch both goal and calendar at the next Monday boundary', () => {
  assert.equal(planOnDate(versions, '2026-10-25').daily_goal_minutes, 15);
  assert.equal(planOnDate(versions, '2026-10-26').daily_goal_minutes, 30);
  assert.equal(isStudyDate(versions, '2026-10-26'), false);
  assert.equal(nextStudyDate(versions, '2026-10-24'), '2026-10-27');
  assert.equal(nextStudyDate(versions, '2026-10-23'), '2026-10-23');
});

test('missed days use the plan that was active on each date', () => {
  assert.equal(countStudyDates(versions, '2026-10-22', '2026-10-30'), 4);
  assert.equal(countStudyDates(versions, '2026-10-24', '2026-10-30'), 2);
});

test('review rotation pauses over rest days instead of dropping their batches', () => {
  const words = [{ id: 'one' }];
  const calendar = versions.slice(0, 1);
  const fridayOffset = countStudyDates(calendar, '2026-10-19', '2026-10-23');
  const mondayOffset = countStudyDates(calendar, '2026-10-19', '2026-10-26');
  assert.equal(fridayOffset, 4);
  assert.equal(mondayOffset, 5);
  assert.deepEqual(buildReviewRotation(words, 1, 10, fridayOffset), [words]);
  assert.deepEqual(buildReviewRotation(words, 2, 10, mondayOffset), [[], words]);
});

test('an empty schedule pauses reviews, and a future plan resumes them', () => {
  const paused = [{ effective_from: '-infinity', weekly_schedule: [] }];
  assert.equal(nextStudyDate(paused, '2026-10-24'), null);
  assert.equal(countStudyDates(paused, '2026-10-19', '2026-10-26'), 0);
  assert.equal(nextStudyDate([...paused, versions[1]], '2026-10-24'), '2026-10-27');
});
