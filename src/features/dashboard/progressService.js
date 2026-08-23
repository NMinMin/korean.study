import { supabase } from '../../lib/supabase';
import { VOCAB_SAMPLE, GRAMMAR_SAMPLE, SHADOW_LINES } from '../../data/fallbackData';
import {
  vocabProgressKey,
  legacyVocabProgressKey,
  dictationProgressKey,
  legacyDictationProgressKey,
  shadowProgressKey,
  legacyShadowProgressKey,
  reviewHistoryKey,
  legacyLessonProgressKey,
  readScopedProgress,
} from '../../services/storageShim';
import { loadStudyGoalDates } from '../settings/studyPlanService';
import { computeStreak } from '../../utils/streakUtils';
import { loadRemoteActivityProgress } from '../../lib/activityProgress';

export const correctDictationResults = (saved = {}) =>
  Object.fromEntries(
    Object.entries(saved).filter(([, v]) => typeof v === 'object' && v !== null && v.correct === true)
  );

export async function computeAndSyncUserStats(profile, lesson) {
  if (!lesson) return { displayName: profile?.displayName || 'Người học', xp: 0, streak: 0, updatedAt: Date.now() };
  const userId = profile?.id;
  let xp = 0;
  try {
    const v = await readScopedProgress(vocabProgressKey(lesson, userId), legacyVocabProgressKey(lesson), userId);
    xp += Object.keys(JSON.parse(v.value)).length * 10;
  } catch (e) { }
  try {
    const d = await readScopedProgress(dictationProgressKey(lesson, userId), legacyDictationProgressKey(lesson), userId);
    xp += Object.keys(correctDictationResults(JSON.parse(d.value))).length * 12;
  } catch (e) { }
  try {
    const s = await readScopedProgress(shadowProgressKey(lesson, userId), legacyShadowProgressKey(lesson), userId);
    xp += Object.keys(JSON.parse(s.value)).length * 12;
  } catch (e) { }
  try {
    const r = await readScopedProgress(reviewHistoryKey(lesson, userId), legacyLessonProgressKey('review-history', lesson.no), userId);
    const h = JSON.parse(r.value);
    xp += Object.values(h).filter((x) => x.correct > 0).length * 5;
  } catch (e) { }

  const dates = await loadStudyGoalDates(userId);
  const streak = computeStreak(dates);
  const stats = { userId, displayName: profile?.displayName || 'Người học', xp, streak, updatedAt: Date.now() };
  try {
    if (supabase && userId) {
      await supabase.from('leaderboard_stats').upsert({ user_id: userId, xp, streak, updated_at: new Date().toISOString() });
    }
  } catch (e) { }
  return stats;
}

export async function computeHomeProgress(lesson, userId, vocabulary = VOCAB_SAMPLE) {
  if (!lesson) return [];
  const out = [
    { key: 'tuvung', label: 'Từ vựng & Ngữ pháp', pct: 0, detail: `0 / ${vocabulary.length} từ`, color: '#4A90E2', bg: '#EEF4FD', icon: 'book' },
    { key: 'nghe', label: 'Nghe chép chính tả', pct: 0, detail: `0 / ${SHADOW_LINES.length} câu`, color: '#3FA95C', bg: '#EBF7EE', icon: 'head' },
    { key: 'shadowing', label: 'Shadowing', pct: 0, detail: `0 / ${SHADOW_LINES.length} câu`, color: '#7C6FE4', bg: '#F0EEFC', icon: 'mic' },
    { key: 'ungdung', label: 'Ôn tập', pct: 0, detail: 'Chưa ôn tập', color: '#F0912E', bg: '#FDF3E7', icon: 'chat' },
  ];
  try {
    const v = await readScopedProgress(vocabProgressKey(lesson, userId), legacyVocabProgressKey(lesson), userId);
    if (v?.value) {
      const n = Object.keys(JSON.parse(v.value)).length;
      out[0].pct = Math.round((n / vocabulary.length) * 100);
      out[0].detail = `${n} / ${vocabulary.length} từ`;
    }
  } catch (e) { }
  try {
    const d = await readScopedProgress(dictationProgressKey(lesson, userId), legacyDictationProgressKey(lesson), userId);
    if (d?.value) {
      const parsed = correctDictationResults(JSON.parse(d.value));
      const n = Object.keys(parsed).length;
      out[1].pct = Math.round((n / SHADOW_LINES.length) * 100);
      out[1].detail = `${n} / ${SHADOW_LINES.length} câu`;
    }
  } catch (e) { }
  try {
    const s = await readScopedProgress(shadowProgressKey(lesson, userId), legacyShadowProgressKey(lesson), userId);
    if (s?.value) {
      const n = Object.keys(JSON.parse(s.value)).length;
      out[2].pct = Math.round((n / SHADOW_LINES.length) * 100);
      out[2].detail = `${n} / ${SHADOW_LINES.length} câu`;
    }
  } catch (e) { }
  try {
    const r = await readScopedProgress(reviewHistoryKey(lesson, userId), legacyLessonProgressKey('review-history', lesson.no), userId);
    if (r?.value) {
      const hist = JSON.parse(r.value);
      const totalReviewable = vocabulary.length + GRAMMAR_SAMPLE.reduce((s, g) => s + g.formula.length, 0) + SHADOW_LINES.length + (SHADOW_LINES.length - 1);
      const mastered = Object.values(hist).filter((h) => h.correct > 0 && h.correct >= h.wrong).length;
      out[3].pct = Math.round((mastered / totalReviewable) * 100);
      out[3].detail = `${mastered} / ${totalReviewable} mục đã vững`;
    }
  } catch (e) { }
  try {
    const remoteRows = await loadRemoteActivityProgress(lesson?.id);
    const keyMap = { tuvung: 0, nghechep: 1, shadowing: 2, ontap: 3 };
    for (const row of remoteRows) {
      const targetIndex = keyMap[row.activityType];
      if (targetIndex !== undefined) out[targetIndex].pct = Math.max(out[targetIndex].pct, row.progressPercent);
    }
  } catch (e) { }
  return out;
}

export async function computeRadarStats(lesson, profile, vocabulary = VOCAB_SAMPLE) {
  const userId = profile?.id;
  const progress = await computeHomeProgress(lesson, userId, vocabulary);
  const vocabPct = progress.find((p) => p.key === 'tuvung')?.pct || 0;
  const nghePct = progress.find((p) => p.key === 'nghe')?.pct || 0;
  const shadowPct = progress.find((p) => p.key === 'shadowing')?.pct || 0;

  let grammarPct = 0;
  try {
    const r = await readScopedProgress(reviewHistoryKey(lesson, userId), legacyLessonProgressKey('review-history', lesson.no), userId);
    const history = r?.value ? JSON.parse(r.value) : {};
    const gramEntries = Object.entries(history).filter(([k]) => k.startsWith('gram:'));
    if (gramEntries.length) {
      const mastered = gramEntries.filter(([, v]) => v.correct > 0 && v.correct >= v.wrong).length;
      grammarPct = Math.round((mastered / gramEntries.length) * 100);
    }
  } catch (e) { }

  const stats = await computeAndSyncUserStats(profile, lesson);
  const streakPct = Math.min(100, Math.round((stats.streak / 14) * 100));

  const axes = [
    { key: 'tuvung', label: 'Từ vựng', pct: vocabPct },
    { key: 'nguphap', label: 'Ngữ pháp', pct: grammarPct },
    { key: 'nghe', label: 'Nghe hiểu', pct: nghePct },
    { key: 'phatam', label: 'Phát âm', pct: shadowPct },
    { key: 'chuyencan', label: 'Chuyên cần', pct: streakPct },
  ];

  let vocabLearned = 0, vocabRetained = 0;
  try {
    const v = await readScopedProgress(vocabProgressKey(lesson, userId), legacyVocabProgressKey(lesson), userId);
    if (v?.value) {
      const entries = Object.values(JSON.parse(v.value));
      vocabLearned = entries.length;
      vocabRetained = entries.filter((w) => (w.box || 0) >= 4).length;
    }
  } catch (e) { }

  let dictationDone = 0;
  try {
    const d = await readScopedProgress(dictationProgressKey(lesson, userId), legacyDictationProgressKey(lesson), userId);
    if (d?.value) dictationDone = Object.keys(correctDictationResults(JSON.parse(d.value))).length;
  } catch (e) { }

  let shadowDone = 0;
  try {
    const s = await readScopedProgress(shadowProgressKey(lesson, userId), legacyShadowProgressKey(lesson), userId);
    if (s?.value) shadowDone = Object.keys(JSON.parse(s.value)).length;
  } catch (e) { }

  const detail = {
    vocab: { count: vocabLearned, total: vocabulary.length },
    listening: { count: dictationDone, total: SHADOW_LINES.length },
    pronunciation: { count: shadowDone, total: SHADOW_LINES.length },
    reflex: null,
    retained: { count: vocabRetained, total: vocabLearned },
  };

  return { axes, detail };
}
