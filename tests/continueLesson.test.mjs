import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('selecting a new lesson, returning home and continuing opens the newly selected lesson', () => {
  const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const start = source.indexOf("  const openLesson = (l, backView = 'tuvung-bai') => {") + "  const openLesson = (l, backView = 'tuvung-bai') => {".length;
  const end = source.indexOf('\n  };', start);
  let state = { ...catalog, lessons: catalog.lessons.map((item) => ({ ...item, textbookId: 'book' })) };
  let opened;
  let view;
  const choiceRef = { current: null };
  const open = new Function('l', 'backView', 'profile', 'latestLessonChoice', 'markLessonStarted', 'learningCatalog', 'setLearningCatalog', 'preferSelectedLesson', 'setLesson', 'setLessonDetailBackView', 'setView', source.slice(start, end));
  const select = (item) => open(item, 'home', { id: 'learner' }, choiceRef, async () => {}, state,
    (update) => { state = update(state); }, preferSelectedLesson, (value) => { opened = value; }, () => {}, (value) => { view = value; });
  select(state.lessons[1]);
  assert.equal(view, 'lesson-detail');
  view = 'home';
  // A background response still points to the older 45% lesson.
  state = preferSelectedLesson({ ...catalog, lessons: state.lessons }, choiceRef.current, 'learner');
  select(state.continueLesson);
  assert.equal(opened.id, 'new');
  assert.equal(opened.progressPercent, 0);
  assert.equal(view, 'lesson-detail');
});

test('server catalog retains a latest zero-percent lesson even after its activity marker changes', () => {
  const source = readFileSync(new URL('../src/lib/learningContent.ts', import.meta.url), 'utf8');
  const start = source.indexOf('  const explicitlySelectedLesson =');
  const end = source.indexOf('  const allLessonsMap', start);
  const choose = new Function('latestProgress', 'lessons', 'completedTodayLesson', `${source.slice(start, end)}\nreturn continueLesson;`);
  const result = choose({ lesson_id: 'new', progress_percent: 0, last_activity: 'tuvung' }, catalog.lessons, undefined);
  assert.equal(result.id, 'new');
});
