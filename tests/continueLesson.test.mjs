import assert from 'node:assert/strict';
import test from 'node:test';
import { preferSelectedLesson } from '../src/utils/continueLesson.js';

const oldLesson = { id: 'old', status: 'current', progressPercent: 45 };
const newLesson = { id: 'new', status: 'current', progressPercent: 0 };
const catalog = { activeTextbook: { id: 'book' }, lessons: [oldLesson, newLesson], continueLesson: oldLesson };
const choice = { userId: 'learner', textbookId: 'book', lessonId: 'new' };

test('opening a zero-percent lesson wins over an unfinished lesson and a stale refresh', () => {
  const selected = preferSelectedLesson(catalog, choice, 'learner');
  assert.equal(selected.continueLesson.id, 'new');
  assert.equal(selected.continueLesson.progressPercent, 0);
  assert.equal(selected.hasStarted, true);
  assert.equal(selected.continueCompletedToday, false);
  const staleRefresh = { ...catalog, continueCompletedToday: true };
  assert.equal(preferSelectedLesson(staleRefresh, choice, 'learner').continueLesson.id, 'new');
  assert.equal(catalog.continueLesson.id, 'old');
});

test('uses the most recent selection and keeps choices scoped to the learner and textbook', () => {
  assert.equal(preferSelectedLesson(catalog, { ...choice, lessonId: 'old' }, 'learner').continueLesson.id, 'old');
  assert.equal(preferSelectedLesson(catalog, choice, 'another-user'), catalog);
  assert.equal(preferSelectedLesson(catalog, { ...choice, textbookId: 'another-book' }, 'learner'), catalog);
});

test('does not pin a completed, removed or locked lesson', () => {
  for (const status of ['done', 'locked']) {
    const updated = { ...catalog, lessons: [oldLesson, { ...newLesson, status }] };
    assert.equal(preferSelectedLesson(updated, choice, 'learner'), updated);
  }
  assert.equal(preferSelectedLesson(catalog, { ...choice, lessonId: 'missing' }, 'learner'), catalog);
});
