import { VOCAB_SAMPLE, GRAMMAR_SAMPLE, SHADOW_LINES } from '../../data/fallbackData';
import {
  lessonProgressKey,
  vocabProgressKey,
  legacyVocabProgressKey,
  shadowProgressKey,
  legacyShadowProgressKey,
  dictationProgressKey,
  legacyDictationProgressKey,
  reviewHistoryKey,
  legacyLessonProgressKey,
  readScopedProgress,
} from '../../services/storageShim';
import { markRemoteActivityCompleted, loadRemoteActivityProgress } from '../../lib/activityProgress';
import { loadRemoteVocabularyState } from '../../lib/vocabularyProgress';
import { correctDictationResults } from '../dashboard/progressService';

export const ACTIVITIES = [
  {
    id: 'tuvung', label: 'Từ vựng & Ngữ pháp', icon: 'book', color: '#4A90E2', bg: '#EEF4FD',
    desc: 'Học thẻ từ mới và các điểm ngữ pháp trong bài', cta: 'Học ngay',
  },
  {
    id: 'nghechep', label: 'Nghe chép chính tả', icon: 'head', color: '#3FA95C', bg: '#EBF7EE',
    desc: 'Nghe đoạn hội thoại và chép lại chính xác', cta: 'Bắt đầu nghe',
  },
  {
    id: 'shadowing', label: 'Shadowing', icon: 'mic', color: '#7C6FE4', bg: '#F0EEFC',
    desc: 'Nghe và lặp lại theo người bản ngữ để luyện ngữ điệu', cta: 'Bắt đầu luyện',
  },
  {
    id: 'ontap', label: 'Ôn tập', icon: 'chat', color: '#F0912E', bg: '#FDF3E7',
    desc: 'Củng cố kiến thức và tự đánh giá mức độ ghi nhớ', cta: 'Ôn tập ngay',
  },
];

export const activityCompletionKey = (lesson, userId) =>
  lessonProgressKey('activity-completion', lesson, userId);

export async function markActivityCompleted(lesson, userId, activityId) {
  const key = activityCompletionKey(lesson, userId);
  let completed = {};
  try {
    const saved = await window.storage.get(key);
    if (saved?.value) completed = JSON.parse(saved.value);
  } catch (e) { }
  completed[activityId] = { completedAt: new Date().toISOString() };
  await window.storage.set(key, JSON.stringify(completed));
  await markRemoteActivityCompleted(lesson?.textbookId, lesson?.id, activityId);
  return completed;
}

export async function isActivityMarkedCompleted(lesson, userId, activityId) {
  try {
    const saved = await window.storage.get(activityCompletionKey(lesson, userId));
    return !!(saved?.value && JSON.parse(saved.value)?.[activityId]);
  } catch (e) {
    return false;
  }
}

export const mergeVocabStates = (local = {}, remote = {}) => {
  const merged = { ...local };
  for (const [key, value] of Object.entries(remote)) {
    if (!merged[key] || (value.timesReviewed || 0) >= (merged[key].timesReviewed || 0)) {
      merged[key] = { ...merged[key], ...value };
    }
  }
  return merged;
};

export async function loadActivityProgress(lesson, userId) {
  const out = { tuvung: 0, shadowing: 0, nghechep: 0, ontap: 0 };
  try {
    const remoteRows = await loadRemoteActivityProgress(lesson?.id);
    for (const row of remoteRows) out[row.activityType] = Math.max(out[row.activityType] || 0, row.progressPercent);
  } catch (e) { }
  try {
    const userKey = vocabProgressKey(lesson, userId);
    const [v, remote] = await Promise.all([
      readScopedProgress(userKey, legacyVocabProgressKey(lesson), userId),
      userId ? loadRemoteVocabularyState(lesson, userId) : Promise.resolve(null),
    ]);
    const localState = v?.value ? JSON.parse(v.value) : {};
    const merged = remote ? mergeVocabStates(localState, remote) : localState;
    if (Object.keys(merged).length) out.tuvung = Math.max(out.tuvung, Math.round((Object.keys(merged).length / VOCAB_SAMPLE.length) * 100));
  } catch (e) { }
  try {
    const s = await readScopedProgress(shadowProgressKey(lesson, userId), legacyShadowProgressKey(lesson), userId);
    if (s?.value) out.shadowing = Math.max(out.shadowing, Math.round((Object.keys(JSON.parse(s.value)).length / SHADOW_LINES.length) * 100));
  } catch (e) { }
  try {
    const d = await readScopedProgress(dictationProgressKey(lesson, userId), legacyDictationProgressKey(lesson), userId);
    if (d?.value) out.nghechep = Math.max(out.nghechep, Math.round((Object.keys(correctDictationResults(JSON.parse(d.value))).length / SHADOW_LINES.length) * 100));
  } catch (e) { }
  try {
    const r = await readScopedProgress(reviewHistoryKey(lesson, userId), legacyLessonProgressKey('review-history', lesson.no), userId);
    if (r?.value) {
      const hist = JSON.parse(r.value);
      const totalReviewable = VOCAB_SAMPLE.length + GRAMMAR_SAMPLE.reduce((s, g) => s + g.formula.length, 0) + SHADOW_LINES.length + (SHADOW_LINES.length - 1);
      const mastered = Object.values(hist).filter((h) => h.correct > 0 && h.correct >= h.wrong).length;
      out.ontap = Math.max(out.ontap, Math.round((mastered / totalReviewable) * 100));
    }
  } catch (e) { }
  return out;
}
