import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, Sparkles, Target, RotateCcw, CheckCircle2,
  XCircle, Volume2, Lightbulb, Trophy, Star, Award, Check, NotebookPen,
  AlertTriangle, Headphones, Home, Lock, MessageCircle, Mic, Type
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { requestAIJson } from '../../services/aiService';
import { speakKo, playCorrectSound, playIncorrectSound, playCelebrationSound } from '../../services/audioService';
import { renderKo, shuffleArr } from '../../utils/textUtils';
import { SwBunnyEmpty, BunnyMascot, FcBunny } from '../../components/common/Mascots';
import { VOCAB_SAMPLE, GRAMMAR_SAMPLE, SHADOW_LINES, DiamondIcon } from '../../data/fallbackData';
import {
  reviewHistoryKey,
  legacyLessonProgressKey,
  readScopedProgress,
  saveScopedProgress
} from '../../services/storageShim';
import { markRemoteActivityCompleted } from '../../lib/activityProgress';

function pickDistractors(all, excludeIdx, n, getter) {
  const pool = all.map((_, i) => i).filter((i) => i !== excludeIdx);
  return shuffleArr(pool).slice(0, n).map((i) => getter(all[i]));
}

/* ------------------------------------------------------------------ */
/*  5 mức độ khó — số câu hỏi & dạng bài tăng dần theo số sao.          */
/*  (Số từ vựng "phạm vi" trong bản spec được xấp xỉ qua questionCount  */
/*  vì bài ôn lấy trực tiếp câu hỏi theo trọng số, không tách 2 bước    */
/*  "chọn từ rồi mới chọn câu hỏi" để tránh làm phức tạp không cần thiết) */
/* ------------------------------------------------------------------ */
/* Phân bổ 5 mức sao — đã giảm nhẹ cấp 1-4 để tránh quá tải (ban đầu 3★/4★  */
/* ra tới 37-42 câu, quá dài cho một lượt ôn). Giờ tăng dần đều đặn, dùng   */
/* grammarQuestions/dialogueCount làm SỐ LƯỢNG cụ thể thay vì lấy hết theo  */
/* pattern. Riêng 5★ vẫn là lựa chọn chủ đích "ôn đủ 100%" bài học.        */
const REVIEW_DIFFICULTY = [
  { stars: 1, label: "Rất dễ", vocabCount: 8, vocabTypes: ["image", "meaning"], listeningCount: 3, dialogueCount: 0, grammarQuestions: 0, writingCount: 0, shadowingCount: 0 },
  { stars: 2, label: "Dễ", vocabCount: 10, vocabTypes: ["image", "meaning", "fillblank", "translate"], listeningCount: 4, dialogueCount: 0, grammarQuestions: 2, writingCount: 0, shadowingCount: 0 },
  { stars: 3, label: "Trung bình", vocabCount: 12, vocabTypes: ["image", "meaning", "fillblank", "translate"], listeningCount: 4, dialogueCount: 2, grammarQuestions: 2, writingCount: 2, shadowingCount: 1 },
  { stars: 4, label: "Khó", vocabCount: 14, vocabTypes: ["meaning", "fillblank", "translate"], listeningCount: 5, dialogueCount: 3, grammarQuestions: 3, writingCount: 2, shadowingCount: 2 },
  { stars: 5, label: "Rất khó", vocabCount: VOCAB_SAMPLE.length, vocabTypes: ["meaning", "fillblank", "translate"], listeningCount: 6, dialogueCount: SHADOW_LINES.length - 1, grammarQuestions: 6, writingCount: 3, shadowingCount: 3 },
];

// Trộn mảng CÓ THỂ LẶP LẠI GIỐNG HỆT NHAU cho cùng 1 seed — dùng để sinh "đề
// thi chuẩn" giống nhau cho MỌI người dùng ở lần đầu chọn 1 mức sao (không
// dùng Math.random ở đây, khác với shuffleArr thường dùng cho "Đổi đề mới").
function seededShuffle(arr, seed) {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const standardExamTakenKey = (stars, lesson, userId) => lessonProgressKey("standard-exam", lesson, userId, stars);
async function hasTakenStandardExam(stars, lesson, userId) {
  try {
    const legacyKey = legacyTextbookProgressKey("standard-exam-taken", stars);
    const r = await readScopedProgress(standardExamTakenKey(stars, lesson, userId), legacyKey, userId);
    return !!JSON.parse(r.value)?.taken;
  } catch (e) { return false; }
}
async function markStandardExamTaken(stars, lesson, userId) {
  try { await window.storage.set(standardExamTakenKey(stars, lesson, userId), JSON.stringify({ taken: true })); } catch (e) { }
}

/* --- lưu & đọc lịch sử ôn tập thật qua window.storage (persistent) --- */

async function loadReviewHistory(lesson, userId) {
  try {
    const res = await readScopedProgress(reviewHistoryKey(lesson, userId), legacyLessonProgressKey("review-history", lesson.no), userId);
    const local = res?.value ? JSON.parse(res.value) : {};
    const remoteRows = await loadRemoteActivityProgress(lesson?.id);
    const remote = remoteRows.find((row) => row.activityType === "ontap")?.completedItems || {};
    return { ...local, ...remote };
  } catch (e) { return {}; }
}
async function saveReviewHistory(lesson, userId, history) {
  try {
    await window.storage.set(reviewHistoryKey(lesson, userId), JSON.stringify(history));
    const completed = Object.fromEntries(Object.entries(history).filter(([, item]) => item?.correct > 0 && item.correct >= item.wrong));
    const total = VOCAB_SAMPLE.length + GRAMMAR_SAMPLE.reduce((sum, item) => sum + item.formula.length, 0) + SHADOW_LINES.length + (SHADOW_LINES.length - 1);
    await saveRemoteActivityProgress(lesson.textbookId, lesson.id, "ontap", completed, total);
  } catch (e) { }
}

/* Lưu lại kết quả Shadowing phản xạ (từ Ôn tập) LÂU DÀI — trước đây kết quả
   này chỉ tồn tại trong phiên làm bài rồi mất, không có cách nào để tính
   chỉ số "Phản xạ" tổng hợp cho Tiến độ cá nhân. */
const reflexHistoryKey = (lesson, userId) => lessonProgressKey("reflex", lesson, userId);
async function saveReflexAttempts(lesson, userId, reflexResults) {
  const valid = (reflexResults || []).filter((r) => !r.timedOut);
  if (valid.length === 0) return;
  let cur = { count: 0, timeLeftSum: 0, scoreSum: 0 };
  try {
    const r = await readScopedProgress(reflexHistoryKey(lesson, userId), legacyTextbookProgressKey("reflex-history"), userId);
    cur = JSON.parse(r.value);
  } catch (e) { }
  valid.forEach((r) => { cur.count += 1; cur.timeLeftSum += r.timeLeftAtDone; cur.scoreSum += r.score; });
  try { await window.storage.set(reflexHistoryKey(lesson, userId), JSON.stringify(cur)); } catch (e) { }
}
async function loadReflexStats(lesson, userId) {
  try {
    const r = await readScopedProgress(reflexHistoryKey(lesson, userId), legacyTextbookProgressKey("reflex-history"), userId);
    const cur = JSON.parse(r.value);
    if (!cur.count) return null;
    return { count: cur.count, avgTimeLeft: Math.round((cur.timeLeftSum / cur.count) * 10) / 10, avgScore: Math.round(cur.scoreSum / cur.count) };
  } catch (e) { return null; }
}

/* --- chọn câu hỏi theo trọng số: 70% sai nhiều, 20% chưa gặp, 10% đã thuộc --- */
function weightedPick(pool, n, history) {
  const buckets = { wrong: [], unseen: [], mastered: [] };
  pool.forEach((item) => {
    const h = history[item.key];
    if (!h) buckets.unseen.push(item);
    else if (h.wrong > 0 && h.wrong >= h.correct) buckets.wrong.push(item);
    else buckets.mastered.push(item);
  });
  const bySeenAsc = (a, b) => (history[a.key]?.lastSeenAt || 0) - (history[b.key]?.lastSeenAt || 0);
  buckets.wrong.sort(bySeenAsc);
  buckets.mastered.sort(bySeenAsc);
  buckets.unseen = shuffleArr(buckets.unseen);

  const targetWrong = Math.round(n * 0.7);
  const targetUnseen = Math.round(n * 0.2);
  const targetMastered = Math.max(0, n - targetWrong - targetUnseen);

  const picked = [];
  let shortfall = 0;
  [[buckets.wrong, targetWrong], [buckets.unseen, targetUnseen], [buckets.mastered, targetMastered]].forEach(([bucket, target]) => {
    const taken = bucket.splice(0, target);
    picked.push(...taken);
    shortfall += target - taken.length;
  });
  if (shortfall > 0) {
    const rest = shuffleArr([...buckets.wrong, ...buckets.unseen, ...buckets.mastered]);
    picked.push(...rest.slice(0, shortfall));
  }
  return shuffleArr(picked).slice(0, n);
}

/* --- chọn câu hỏi theo ĐÚNG phạm vi bao phủ của mức sao: từ vựng theo      */
/* trọng số (weightedPick), còn nghe hiểu/hội thoại/ngữ pháp lấy đủ theo    */
/* số lượng cấu hình — đảm bảo 5★ ôn đủ 100% nội dung bài, không random hết */
/* Có `seed`: dùng để sinh "ĐỀ THI CHUẨN" — cố định, GIỐNG NHAU cho mọi     */
/* người dùng ở cùng 1 mức sao, KHÔNG theo lịch sử cá nhân (để làm thang đo */
/* chung). Không có seed: hành vi cũ, chọn theo trọng số lịch sử cá nhân.   */
function buildCoverageSelection(difficulty, fullPool, history, seed, vocabulary = VOCAB_SAMPLE) {
  let salt = 0;
  const shuffle = (arr) => (seed ? seededShuffle(arr, seed + (salt++) * 97) : shuffleArr(arr));
  const selected = [];

  let vocabWords;
  if (difficulty.vocabCount >= vocabulary.length) {
    vocabWords = vocabulary.map((w) => w.word);
  } else if (seed) {
    vocabWords = shuffle(vocabulary).slice(0, difficulty.vocabCount).map((w) => w.word);
  } else {
    vocabWords = weightedPick(vocabulary.map((w) => ({ key: `vocab:${w.word}`, word: w.word })), difficulty.vocabCount, history).map((x) => x.word);
  }
  vocabWords.forEach((word) => {
    const candidates = fullPool.filter((q) => q.key === `vocab:${word}` && difficulty.vocabTypes.includes(q.type));
    if (candidates.length) selected.push(shuffle(candidates)[0]);
  });

  const listeningQs = shuffle(fullPool.filter((q) => q.type === "listening")).slice(0, difficulty.listeningCount);
  selected.push(...listeningQs);

  const dialogueQs = shuffle(fullPool.filter((q) => q.type === "dialogue")).slice(0, difficulty.dialogueCount);
  selected.push(...dialogueQs);

  const grammarQs = shuffle(fullPool.filter((q) => q.type === "grammar")).slice(0, difficulty.grammarQuestions);
  selected.push(...grammarQs);

  return shuffle(selected);
}

// Chọn N câu Shadowing (phản xạ có đồng hồ đếm ngược) từ SHADOW_LINES thật.
function pickShadowingLines(count, seed) {
  const shuffle = seed ? (arr) => seededShuffle(arr, seed + 777) : shuffleArr;
  return shuffle(SHADOW_LINES).slice(0, count);
}

/* --- sinh đề "Ứng dụng" — người học tự viết câu, không chép nguyên văn --- */
function generateWritingPrompts(stars) {
  const words = shuffleArr(VOCAB_SAMPLE).map((w) => w.word);
  const gram = shuffleArr(GRAMMAR_SAMPLE);
  if (stars === 3) {
    return [
      { id: "w1", instruction: `Viết một câu sử dụng từ vựng: **${words[0]}**`, dialogue: false },
      { id: "w2", instruction: `Viết một câu sử dụng ngữ pháp: **${gram[0].pattern}**`, dialogue: false },
    ];
  }
  if (stars === 4) {
    return [
      { id: "w1", instruction: `Viết một câu có chứa ít nhất 2 từ vựng: **${words[0]}**, **${words[1]}**`, dialogue: false },
      { id: "w2", instruction: `Viết một câu sử dụng từ vựng **${words[2]}** và ngữ pháp **${gram[0].pattern}**`, dialogue: false },
    ];
  }
  return [
    { id: "w1", instruction: `Viết một câu có chứa ít nhất 3 từ vựng: **${words[0]}**, **${words[1]}**, **${words[2]}**`, dialogue: false },
    { id: "w2", instruction: `Viết một câu sử dụng từ vựng **${words[3]}** và ngữ pháp **${gram[0].pattern}**`, dialogue: false },
    { id: "w3", instruction: `Viết đoạn hội thoại ngắn (2 câu) sử dụng **${words[4]}**, **${words[5]}** và ngữ pháp **${gram[1]?.pattern || gram[0].pattern}**`, dialogue: true },
  ];
}

/* --- AI chấm bài viết thật — nhiều tiêu chí, có kiểm tra chép nguyên văn --- */
async function gradeWriting(prompt, userAnswer) {
  const plain = prompt.instruction.replace(/\*\*/g, "");
  const aiPrompt = `Bạn là giáo viên tiếng Hàn chấm bài viết ứng dụng của học viên người Việt.

Yêu cầu đề bài: ${plain}
Học viên đã viết: "${userAnswer}"

Chấm dựa trên: đúng ngữ pháp, đúng cách dùng từ vựng, đúng ngữ cảnh, độ tự nhiên, chính tả, trợ từ, mức độ giống người bản xứ. Nếu câu gần giống nguyên văn ví dụ có sẵn trong sách thay vì tự sáng tạo, hãy trừ điểm và ghi rõ trong phần lỗi.

Trả lời CHỈ bằng JSON, không markdown, không chữ nào khác:
{
  "score": <số nguyên 0-100>,
  "strengths": "<1 câu tiếng Việt, khen cụ thể>",
  "errors": "<1-2 câu tiếng Việt, chỉ lỗi cụ thể nếu có, hoặc 'Không có lỗi đáng kể' nếu tốt>",
  "naturalVersion": "<câu tiếng Hàn tự nhiên hơn nếu cần chỉnh, hoặc giữ nguyên nếu đã tốt>",
  "explanation": "<1 câu tiếng Việt giải thích ngắn gọn>"
}`;
  try {
    const { value: parsed } = await requestAIJson(aiPrompt);
    if (typeof parsed.score !== "number") throw new Error("malformed");
    return parsed;
  } catch (e) {
    return { score: 60, strengths: "Bạn đã thử viết câu bằng tiếng Hàn.", errors: "Không thể chấm chi tiết lúc này do lỗi kết nối.", naturalVersion: userAnswer, explanation: "" };
  }
}


async function generateReviewFeedback(wrongLabels) {
  if (!wrongLabels.length) return "Bạn làm rất tốt, không có lỗi nào đáng chú ý trong lượt ôn tập này! 🎉";
  // Nhận xét tổng kết đơn giản không cần AI; tránh gọi dịch vụ ngoài không cần thiết.
  return `Bạn cần ôn lại thêm: ${wrongLabels.slice(0, 3).join(", ")}. Làm lại các câu này một lượt để ghi nhớ chắc hơn nhé.`;
}

export function SkillCompletionView({ title, description, assessment, loading, onBack, onRetry, retryLabel = "Kiểm tra lại" }) {
  return (
    <section className="skill-complete-card">
      <div className="skill-complete-icon"><CheckCircle2 size={42} /></div>
      <span className="skill-complete-kicker">HOÀN THÀNH</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {loading && <div className="skill-complete-ai"><Sparkles size={16} /> AI đang tổng hợp nhận xét toàn bài...</div>}
      {assessment && (
        <div className="skill-complete-assessment">
          <div><Sparkles size={16} /><strong>{assessment.level || "Nhận xét AI"}</strong></div>
          <p>{assessment.summary}</p>
          {assessment.focus && <small><Lightbulb size={13} /> {assessment.focus}</small>}
        </div>
      )}
      <div className="skill-complete-actions">
        <button className="fc-nav-btn" onClick={onBack}><ChevronLeft size={17} /> Về bài học</button>
        <button className="fc-nav-btn primary" onClick={onRetry}><RotateCcw size={17} /> {retryLabel}</button>
      </div>
    </section>
  );
}

function buildReviewPool(vocabulary = VOCAB_SAMPLE, grammar = GRAMMAR_SAMPLE, lines = SHADOW_LINES, exercises = []) {
  const VOCAB_SAMPLE = vocabulary;
  const GRAMMAR_SAMPLE = grammar;
  const SHADOW_LINES = lines;
  const pool = [];

  // 1) Chọn hình đúng — dùng ảnh 28 từ vựng
  VOCAB_SAMPLE.forEach((w, i) => {
    if (!w.img) return;
    const distractors = pickDistractors(VOCAB_SAMPLE, i, 3, (x) => x.img).filter(Boolean);
    if (distractors.length < 3) return;
    const options = shuffleArr([{ img: w.img, correct: true }, ...distractors.map((d) => ({ img: d, correct: false }))]);
    pool.push({ type: "image", category: "tuvung", prompt: w.word, options, correctExplain: w.meaningVi, key: `vocab:${w.word}`, label: w.word });
  });

  // 2) Chọn nghĩa đúng — dùng nghĩa 28 từ vựng
  VOCAB_SAMPLE.forEach((w, i) => {
    const distractors = pickDistractors(VOCAB_SAMPLE, i, 3, (x) => x.meaningVi);
    const options = shuffleArr([{ text: w.meaningVi, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
    pool.push({ type: "meaning", category: "tuvung", prompt: w.word, options, correctExplain: w.pron ? `phát âm: ${w.pron}` : null, key: `vocab:${w.word}`, label: w.word });
  });

  // 3) Nghe hiểu — dùng audio + nghĩa 6 câu Shadowing
  SHADOW_LINES.forEach((line, i) => {
    const distractors = pickDistractors(SHADOW_LINES, i, 3, (x) => x.vi);
    const options = shuffleArr([{ text: line.vi, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
    pool.push({ type: "listening", category: "nghehieu", prompt: line.ko, audio: line.audio, options, correctExplain: `nguyên văn: ${line.ko.replace(/\*\*/g, "")}`, key: `listen:${line.no}`, label: `Câu ${line.no} (nghe hiểu)` });
  });

  // 4) Ngữ pháp — dùng công thức 2 điểm ngữ pháp
  GRAMMAR_SAMPLE.forEach((g) => {
    g.formula.forEach((f) => {
      const others = GRAMMAR_SAMPLE.flatMap((gg) => gg.formula.map((ff) => ff.form)).filter((form) => form !== f.form);
      const distractors = shuffleArr(others).slice(0, 3);
      if (distractors.length < 3) return;
      const options = shuffleArr([{ text: f.form, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
      pool.push({ type: "grammar", category: "nguphap", prompt: f.condition, options, patternName: g.pattern, correctExplain: g.context, key: `gram:${g.no}:${f.form}`, label: g.pattern });
    });
  });

  // 5) Điền từ — lấy đúng câu hội thoại thật, che phần từ được tô đậm (**...**)
  const boldedSpans = [];
  VOCAB_SAMPLE.forEach((w) => {
    (w.dialogue || []).forEach((d) => {
      const m = d.ko.match(/\*\*(.+?)\*\*/);
      if (m) boldedSpans.push({ full: d.ko, target: m[1], word: w.word });
    });
  });
  boldedSpans.forEach((item) => {
    const others = boldedSpans.filter((x) => x.target !== item.target);
    const distractors = shuffleArr(others).slice(0, 3).map((x) => x.target);
    if (distractors.length < 3) return;
    const blanked = item.full.replace(/\*\*(.+?)\*\*/, "ـــــ");
    const options = shuffleArr([{ text: item.target, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
    pool.push({ type: "fillblank", category: "tuvung", prompt: blanked, options, correctExplain: VOCAB_SAMPLE.find((v) => v.word === item.word)?.meaningVi, key: `vocab:${item.word}`, label: item.word });
  });

  // 6) Dịch câu — cho nghĩa tiếng Việt, chọn đúng từ tiếng Hàn
  VOCAB_SAMPLE.forEach((w, i) => {
    const distractors = pickDistractors(VOCAB_SAMPLE, i, 3, (x) => x.word);
    const options = shuffleArr([{ text: w.word, correct: true, isKo: true }, ...distractors.map((d) => ({ text: d, correct: false, isKo: true }))]);
    pool.push({ type: "translate", category: "tuvung", prompt: w.meaningVi, options, correctExplain: w.pron ? `phát âm: ${w.pron}` : null, key: `vocab:${w.word}`, label: w.word });
  });

  // 7) Hội thoại — chọn đúng câu tiếp theo trong mạch hội thoại thật (kiểm tra
  //    hiểu ngữ cảnh, không chỉ nghe/dịch từng câu rời rạc)
  SHADOW_LINES.forEach((line, i) => {
    if (i >= SHADOW_LINES.length - 1) return; // câu cuối không có "câu tiếp theo"
    const correctNext = SHADOW_LINES[i + 1];
    const otherIdx = SHADOW_LINES.map((_, j) => j).filter((j) => j !== i && j !== i + 1);
    const distractors = shuffleArr(otherIdx).slice(0, 3).map((j) => SHADOW_LINES[j].ko);
    if (distractors.length < 3) return;
    const options = shuffleArr([{ text: correctNext.ko, correct: true, isKo: true }, ...distractors.map((d) => ({ text: d, correct: false, isKo: true }))]);
    pool.push({ type: "dialogue", category: "hoithoai", prompt: line.ko, options, correctExplain: correctNext.vi, key: `dlg:${line.no}`, label: `Câu ${line.no} (mạch hội thoại)` });
  });

  exercises.filter((exercise) => exercise.skillType === "review").forEach((exercise) => {
    const correct = String(exercise.answer?.correct || "");
    if (!correct) return;
    if (exercise.exerciseType === "fill_blank") {
      const distractors = shuffleArr(vocabulary.map((word) => word.word).filter((word) => word !== correct)).slice(0, 3);
      pool.push({
        type: "fillblank",
        category: "tuvung",
        prompt: exercise.promptKo,
        options: shuffleArr([{ text: correct, correct: true, isKo: true }, ...distractors.map((text) => ({ text, correct: false, isKo: true }))]),
        correctExplain: exercise.promptVi || exercise.explanationVi,
        key: `exercise:${exercise.id}`,
        label: correct,
      });
    }
    if (exercise.exerciseType === "multiple_choice_meaning") {
      const distractors = shuffleArr(vocabulary.map((word) => word.meaningVi).filter((meaning) => meaning !== correct)).slice(0, 3);
      pool.push({
        type: "meaning",
        category: "tuvung",
        prompt: exercise.promptKo,
        options: shuffleArr([{ text: correct, correct: true }, ...distractors.map((text) => ({ text, correct: false }))]),
        correctExplain: exercise.explanationVi,
        key: `exercise:${exercise.id}`,
        label: exercise.promptKo,
      });
    }
  });

  return pool;
}

/* ---------- Màn 1: Giới thiệu + chọn độ khó ---------- */
/* ------------------------------------------------------------------ */
/*  ÔN TẬP — MÀN CHÍNH: 2 lựa chọn rõ ràng theo đúng tài liệu yêu cầu   */
/* ------------------------------------------------------------------ */
export function ReviewHubView({ onBack, onPickByLesson, onPickRandom }) {
  return (
    <section className="rv-page">
      <div className="rv-hub-top">
        <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
        <h1 className="rv-title">Ôn tập</h1>
      </div>
      <p className="rv-sub" style={{ marginTop: -6, marginBottom: 4 }}>Chọn cách bạn muốn củng cố lại kiến thức đã học — cả 2 cách đều có 5 mức độ khó.</p>
      <div className="rv-hub-grid">
        <button className="rv-hub-card" onClick={onPickByLesson}>
          <span className="rv-hub-ico" style={{ background: "#F0EEFC" }}><NotebookPen size={26} color="#7C6FE4" /></span>
          <b>Ôn tập theo bài</b>
          <span>Chọn đúng những bài học bạn muốn ôn lại — chủ động giới hạn phạm vi.</span>
        </button>
        <button className="rv-hub-card" onClick={onPickRandom}>
          <span className="rv-hub-ico" style={{ background: "#FDF3E7" }}><Sparkles size={26} color="#F0912E" /></span>
          <b>Ôn tập ngẫu nhiên</b>
          <span>Kiểm tra năng lực tổng quát như một bài thi thật, luyện phản xạ dài hạn.</span>
        </button>
      </div>
    </section>
  );
}

export function ReviewLessonSelectView({ onBack, onNext, lessons = FALLBACK_LESSONS }) {
  const [selected, setSelected] = useState(() => new Set(lessons[0] ? [lessons[0].no] : []));
  const toggle = (no, locked) => {
    if (locked) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  return (
    <section className="card page">
      <div className="card-title-row">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <div className="card-title"><NotebookPen size={19} color="#7C6FE4" /> Ôn tập theo bài · Chọn phạm vi</div>
        </div>
      </div>
      <p className="page-note" style={{ background: "none", padding: 0, color: "#8B85AB" }}>
        Tick chọn những bài học bạn muốn đưa vào phạm vi ôn tập (chọn được nhiều bài cùng lúc).
      </p>
      <div className="lesson-list">
        {lessons.map((l) => {
          const locked = l.status === "locked";
          const checked = selected.has(l.no);
          return (
            <button
              key={l.no}
              className={`lesson-row rv-lesson-check ${l.status} ${checked ? "checked" : ""}`}
              disabled={locked}
              onClick={() => toggle(l.no, locked)}
            >
              <span className={`rv-checkbox ${checked ? "on" : ""}`}>{checked && <CheckCircle2 size={14} color="#fff" />}</span>
              <span className="lesson-no">{l.no}과</span>
              <span className="lesson-main">
                <b>Bài {l.no}</b>
                <em>{l.title}</em>
              </span>
              {locked && <span className="lesson-badge lock-b"><Lock size={11} /> Chưa có nội dung</span>}
            </button>
          );
        })}
      </div>
      <button className="primary-btn" style={{ alignSelf: "flex-end" }} disabled={selected.size === 0} onClick={() => onNext([...selected])}>
        Tiếp theo — Chọn độ khó <ChevronRight size={16} />
      </button>
    </section>
  );
}


export function ReviewIntroView({ lesson, userId, mode, selectedLessons, vocabulary = VOCAB_SAMPLE, grammar = GRAMMAR_SAMPLE, lines = SHADOW_LINES, exercises = [], onBack, onStart }) {
  const [stars, setStars] = useState(3);
  const [hasStandard, setHasStandard] = useState(null); // random mode: null=đang kiểm tra, false=lần đầu (đề chuẩn), true=đã làm rồi (đề mới)
  const poolSize = useMemo(() => buildReviewPool(vocabulary, grammar, lines, exercises).length, [vocabulary, grammar, lines, exercises]);
  const diff = REVIEW_DIFFICULTY[stars - 1];
  const stats = [
    { label: "Từ vựng", count: vocabulary.length, icon: BookOpen, color: "#7C6FE4", bg: "#F0EEFC" },
    { label: "Ngữ pháp", count: grammar.length, icon: NotebookPen, color: "#3FA95C", bg: "#EBF7EE" },
    { label: "Hội thoại", count: lines.length, icon: MessageCircle, color: "#E8912E", bg: "#FDF3E7" },
    { label: "Nghe hiểu", count: lines.length, icon: Headphones, color: "#4A90E2", bg: "#EEF4FD" },
  ];
  const isFull = diff.vocabCount >= VOCAB_SAMPLE.length && diff.dialogueCount >= SHADOW_LINES.length - 1 && diff.listeningCount >= SHADOW_LINES.length;
  const estimatedCount = diff.vocabCount + diff.listeningCount + diff.dialogueCount + diff.grammarQuestions;

  useEffect(() => {
    if (mode !== "random") return;
    let alive = true;
    setHasStandard(null);
    hasTakenStandardExam(stars, lesson, userId).then((taken) => { if (alive) setHasStandard(taken); });
    return () => { alive = false; };
  }, [stars, mode, lesson, userId]);

  const startExam = () => {
    const useSeed = mode === "random" && hasStandard === false;
    onStart(diff, useSeed);
  };

  return (
    <section className="rv-page rv-review-setup">
      <div className="rv-hero">
        <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
        <div className="rv-hero-body">
          {mode === "bylesson" ? (
            <span className="rv-lesson-pill">{selectedLessons?.length || 1} bài đã chọn</span>
          ) : (
            <span className="rv-lesson-pill">Thi thử ngẫu nhiên</span>
          )}
          <h1 className="rv-title">{mode === "bylesson" ? "Ôn tập theo bài 📘" : "Thi thử 🎯"}</h1>
          <p className="rv-sub">
            {mode === "bylesson"
              ? "Chọn độ khó — hệ thống chỉ lấy câu hỏi trong đúng phạm vi bài bạn đã chọn."
              : "Đề được lấy ngẫu nhiên từ các bài đã học; sao càng cao thì phạm vi và số dạng câu càng lớn."}
          </p>
          <div className="rv-stat-row">
            {stats.map((s, i) => (
              <span key={i} className="rv-stat-pill">
                <s.icon size={14} color={s.color} /> <b>{s.count}</b> {s.label}
              </span>
            ))}
          </div>
        </div>
        <FcBunny />
      </div>

      <div className="rv-diff-card">
        <div className="rv-types-title"><Star size={14} fill="#F0C24E" color="#F0C24E" /> Chọn độ khó</div>
        <div className="rv-star-row">
          {REVIEW_DIFFICULTY.map((d) => (
            <button key={d.stars} className={`rv-star-btn ${stars === d.stars ? "on" : ""}`} onClick={() => setStars(d.stars)}>
              <span className="rv-star-icons">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill={i < d.stars ? "#F0C24E" : "none"} color={i < d.stars ? "#F0C24E" : "#DCD3F4"} />
                ))}
              </span>
              <span className="rv-star-label">{d.label}</span>
            </button>
          ))}
        </div>

        <div className="rv-diff-detail">
          <span className="rv-diff-qcount"><b>~{estimatedCount}</b> câu hỏi{isFull && " · bao phủ 100% bài học"}</span>
          <div className="rv-diff-types">
            <span className="rv-diff-type-chip"><BookOpen size={12} /> {diff.vocabCount} từ vựng</span>
            <span className="rv-diff-type-chip"><Headphones size={12} /> {diff.listeningCount} nghe hiểu</span>
            {diff.dialogueCount > 0 && <span className="rv-diff-type-chip"><MessageCircle size={12} /> {diff.dialogueCount} hội thoại</span>}
            {diff.grammarQuestions > 0 && <span className="rv-diff-type-chip"><NotebookPen size={12} /> {diff.grammarQuestions} ngữ pháp</span>}
            {diff.writingCount > 0 && <span className="rv-diff-type-chip on"><Type size={12} /> +{diff.writingCount} câu Ứng dụng (AI chấm)</span>}
            {diff.shadowingCount > 0 && <span className="rv-diff-type-chip on"><Mic size={12} /> +{diff.shadowingCount} Shadowing phản xạ</span>}
          </div>
        </div>

        {mode === "random" && (
          <div className={`rv-standard-note ${hasStandard === false ? "std" : "new"}`}>
            {hasStandard === null ? (
              "Đang kiểm tra..."
            ) : hasStandard === false ? (
              <><Target size={14} /> Lần đầu ở mức {stars}★ — bạn sẽ làm <b>Đề thi chuẩn</b>, giống hệt mọi người khác để thiết lập thang đo chung.</>
            ) : (
              <><Sparkles size={14} /> Bạn đã làm đề chuẩn mức {stars}★ rồi — lần này là <b>đề mới sinh ngẫu nhiên</b> để luyện phản xạ.</>
            )}
          </div>
        )}

        <button className="rv-start-btn rv-start-btn-full" onClick={startExam}>
          {mode === "random" && hasStandard === false ? "Làm đề thi chuẩn" : mode === "random" ? "Bắt đầu thi thử" : "Bắt đầu ôn bài"} <ChevronRight size={18} />
        </button>
      </div>

      <div className="rv-tip"><Lightbulb size={14} color="#E8A93D" /> Từ vựng chọn theo trọng số 70% hay sai / 20% chưa gặp / 10% đã thuộc. Nghe hiểu, hội thoại và ngữ pháp lấy đủ theo đúng phạm vi mức sao để không bỏ sót.</div>

      <div className="rv-types-card">
        <div className="rv-types-title"><Sparkles size={14} color="#7C6FE4" /> Ngân hàng câu hỏi</div>
        <p className="rv-types-count" style={{ marginTop: 0 }}>Hiện có <b>{poolSize}</b> câu hỏi khả dụng, sinh trực tiếp từ nội dung thật của Bài 1.</p>
      </div>
    </section>
  );
}

/* ---------- Màn 2: Làm bài ôn tập ---------- */
export function ReviewQuizView({ lesson, userId, difficulty, mode, seed, vocabulary = VOCAB_SAMPLE, grammar = GRAMMAR_SAMPLE, lines = SHADOW_LINES, exercises = [], isRecheck = false, onBack, onFinish, onChangeSet }) {
  const [history, setHistory] = useState(null);
  const [pool, setPool] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]); // { correct, category, key, label }
  const [phase, setPhase] = useState("mc"); // "mc" | "writing" | "shadowing"
  const [writingPrompts, setWritingPrompts] = useState(() => (difficulty.writingCount > 0 ? generateWritingPrompts(difficulty.stars).slice(0, difficulty.writingCount) : []));
  const [wIdx, setWIdx] = useState(0);
  const [wDraft, setWDraft] = useState("");
  const [wGrading, setWGrading] = useState(false);
  const [wResult, setWResult] = useState(null);
  const [writingResults, setWritingResults] = useState([]);
  const startTimeRef = useRef(Date.now());
  const audioRef = useRef(null);

  // ---- Shadowing phản xạ (đồng hồ đếm ngược) — chỉ có khi difficulty.shadowingCount > 0 ----
  const [shadowLines, setShadowLines] = useState(() => (difficulty.shadowingCount > 0 ? pickShadowingLines(difficulty.shadowingCount, seed) : []));
  const [sIdx, setSIdx] = useState(0);
  const [sPhaseState, setSPhaseState] = useState("intro"); // intro | counting | recording | grading | done | timeout | unsupported
  const [sTimeLeft, setSTimeLeft] = useState(0);
  const [sReflexResults, setSReflexResults] = useState([]); // { no, score, timeLeftAtDone, reflexLabel }
  const sAudioRef = useRef(null);
  const sTimerRef = useRef(null);
  const sRecognitionRef = useRef(null);
  const sReflexSecondsRef = useRef(0);
  const sTimeLeftRef = useRef(0); // giá trị THỜI GIAN CÒN LẠI luôn mới nhất, tránh đọc closure cũ trong callback nhận diện giọng nói

  useEffect(() => {
    let alive = true;
    loadReviewHistory(lesson, userId).then((h) => {
      if (!alive) return;
      const fullPool = buildReviewPool(vocabulary, grammar, lines, exercises);
      const selected = buildCoverageSelection(difficulty, fullPool, h, seed, vocabulary);
      setHistory(h);
      setPool(selected);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearInterval(sTimerRef.current), []);

  // Tự động phát câu mẫu khi vừa vào một câu Shadowing mới trong phiên phản xạ.
  // Đặt Ở ĐÂY (không đặt sau các return có điều kiện của giai đoạn mc/writing)
  // để hook luôn được gọi với đúng số lượng & thứ tự ở MỌI lần render.
  useEffect(() => {
    if (phase !== "shadowing" || sPhaseState !== "intro") return;
    const t = setTimeout(() => {
      const el = sAudioRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => { }); }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sIdx, sPhaseState]);

  if (!pool) {
    return (
      <section className="rv-page">
        <div className="rv-loading"><Sparkles size={22} color="#7C6FE4" /> Đang chọn câu hỏi phù hợp với bạn...</div>
      </section>
    );
  }

  const total = pool.length;
  const finishAll = async (finalAnswers, finalWriting, finalReflex) => {
    const newHistory = { ...history };
    finalAnswers.forEach((a) => {
      const cur = newHistory[a.key] || { wrong: 0, correct: 0, lastSeenAt: 0 };
      newHistory[a.key] = { wrong: cur.wrong + (a.correct ? 0 : 1), correct: cur.correct + (a.correct ? 1 : 0), lastSeenAt: Date.now() };
    });
    if (!isRecheck) {
      await saveReviewHistory(lesson, userId, newHistory);
      if (finalReflex && finalReflex.length) await saveReflexAttempts(lesson, userId, finalReflex);
      if (seed) await markStandardExamTaken(difficulty.stars, lesson, userId);
    }
    onFinish(finalAnswers, finalWriting, Date.now() - startTimeRef.current, finalReflex || []);
  };

  // "Đổi đề mới" — chỉ áp dụng cho Ôn tập ngẫu nhiên. Luôn sinh NGẪU NHIÊN
  // thật (không seed), và tính là đã "dùng hết" đề chuẩn của mức sao này.
  const regenerate = async () => {
    if (seed) await markStandardExamTaken(difficulty.stars, lesson, userId);
    const fullPool = buildReviewPool();
    const selected = buildCoverageSelection(difficulty, fullPool, history || {}, null);
    setPool(selected);
    setWritingPrompts(difficulty.writingCount > 0 ? generateWritingPrompts(difficulty.stars).slice(0, difficulty.writingCount) : []);
    setShadowLines(difficulty.shadowingCount > 0 ? pickShadowingLines(difficulty.shadowingCount, null) : []);
    setIdx(0); setPicked(null); setAnswers([]); setPhase("mc");
    setWIdx(0); setWDraft(""); setWResult(null); setWritingResults([]);
    setSIdx(0); setSPhaseState("intro"); setSReflexResults([]);
    startTimeRef.current = Date.now();
    onChangeSet && onChangeSet();
  };

  /* ---------- Giai đoạn 1: câu hỏi trắc nghiệm bao phủ kiến thức ---------- */
  if (phase === "mc") {
    const q = pool[idx];
    const typeLabel = { image: "Chọn hình đúng", meaning: "Chọn nghĩa đúng", listening: "Nghe hiểu", grammar: "Ngữ pháp", fillblank: "Điền từ", translate: "Dịch câu", dialogue: "Hội thoại" }[q.type];
    const playAudio = () => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => { }); } };
    const choose = (opt) => {
      if (picked) return;
      setPicked(opt);
      if (opt.correct) playCorrectSound();
      else playIncorrectSound();
      setAnswers((a) => [...a, { correct: opt.correct, category: q.category, key: q.key, label: q.label }]);
    };
    const next = () => {
      if (idx + 1 >= total) {
        if (writingPrompts.length > 0) { setPhase("writing"); setPicked(null); }
        else if (shadowLines.length > 0) { setPhase("shadowing"); setPicked(null); }
        else finishAll(answers, []);
        return;
      }
      setIdx((i) => i + 1);
      setPicked(null);
    };

    return (
      <section className="rv-page">
        <div className="rv-quiz-top">
          <button className="fc2-back" onClick={onBack} aria-label="Đóng"><XCircle size={20} /></button>
          <span className="rv-quiz-title">Ôn tập · {difficulty.label}</span>
          <span className="rv-quiz-count">{idx + 1} / {total}</span>
          {mode === "random" && <button className="rv-change-set-btn" onClick={regenerate}><RotateCcw size={13} /> Đổi đề mới</button>}
        </div>
        <div className="fc2-progress-bar"><div style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>

        <div className="rv-quiz-card">
          <div className="rv-quiz-tags">
            <span className="rv-tag-num">Câu {idx + 1}</span>
            <span className="rv-tag-type">{typeLabel}</span>
          </div>

          {q.type === "listening" ? (
            <>
              <audio ref={audioRef} src={q.audio} preload="none" />
              <button className="rv-listen-btn" onClick={playAudio}><Volume2 size={20} color="#fff" /> Nghe câu</button>
              <p className="rv-quiz-question">Câu vừa nghe nghĩa là gì?</p>
            </>
          ) : (
            <p className="rv-quiz-question" lang={(q.type === "image" || q.type === "meaning" || q.type === "fillblank" || q.type === "dialogue") ? "ko" : undefined}>
              {q.type === "grammar" ? `Điền vào chỗ trống: "${q.prompt}"` : q.type === "translate" ? `Từ nào có nghĩa: "${q.prompt}"?` : q.type === "dialogue" ? `Câu tiếp theo sau: "${q.prompt}" là gì?` : q.prompt}
              {(q.type === "image" || q.type === "meaning" || q.type === "dialogue") && (
                <button className="rv-mini-audio" onClick={() => speakKo(q.prompt)}><Volume2 size={12} color="#fff" /></button>
              )}
            </p>
          )}

          {q.type === "image" ? (
            <div className="rv-img-grid">
              {q.options.map((opt, i) => (
                <button key={i} className={`rv-img-opt ${picked ? (opt.correct ? "correct" : picked === opt ? "wrong" : "") : ""}`} onClick={() => choose(opt)} disabled={!!picked}>
                  <img src={opt.img} alt="" />
                  {picked && opt.correct && <CheckCircle2 className="rv-img-mark" size={20} color="#3FA95C" />}
                  {picked === opt && !opt.correct && <XCircle className="rv-img-mark" size={20} color="#D64545" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="rv-opt-list">
              {q.options.map((opt, i) => (
                <button key={i} className={`rv-opt-row ${picked ? (opt.correct ? "correct" : picked === opt ? "wrong" : "") : ""}`} onClick={() => choose(opt)} disabled={!!picked}>
                  <span className="rv-opt-letter">{String.fromCharCode(65 + i)}</span>
                  <span lang={(q.type === "grammar" || q.type === "translate" || q.type === "dialogue") ? "ko" : undefined}>{opt.text}</span>
                  {picked && opt.correct && <CheckCircle2 size={17} color="#3FA95C" />}
                  {picked === opt && !opt.correct && <XCircle size={17} color="#D64545" />}
                </button>
              ))}
            </div>
          )}

          {picked && (
            <div className={`rv-feedback ${picked.correct ? "ok" : "wrong"}`}>
              <span className="rv-feedback-face">{picked.correct ? "🐰" : "🤔"}</span>
              <span>{picked.correct ? "Chính xác! 🎉" : "Chưa đúng."}{q.correctExplain && ` (${q.correctExplain})`}</span>
              <button className="rv-next-btn" onClick={next}>
                {idx + 1 >= total ? (writingPrompts.length > 0 ? "Sang phần Ứng dụng" : "Xem kết quả") : "Câu tiếp theo"} <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ---------- Giai đoạn 2: Ứng dụng — tự viết câu, AI chấm ---------- */
  if (phase === "writing") {
    const wp = writingPrompts[wIdx];
    const submitWriting = async () => {
      if (!wDraft.trim() || wGrading) return;
      setWGrading(true);
      const graded = await gradeWriting(wp, wDraft.trim());
      if ((graded?.score || 0) >= 80) playCorrectSound();
      else playIncorrectSound();
      setWResult(graded);
      setWGrading(false);
    };
    const nextWriting = () => {
      const entry = { id: wp.id, instruction: wp.instruction, answer: wDraft.trim(), ...wResult };
      const updated = [...writingResults, entry];
      setWritingResults(updated);
      setWResult(null);
      setWDraft("");
      if (wIdx + 1 >= writingPrompts.length) {
        if (shadowLines.length > 0) { setPhase("shadowing"); return; }
        finishAll(answers, updated);
        return;
      }
      setWIdx((i) => i + 1);
    };

    return (
      <section className="rv-page">
        <div className="rv-quiz-top">
          <button className="fc2-back" onClick={onBack} aria-label="Đóng"><XCircle size={20} /></button>
          <span className="rv-quiz-title">Ứng dụng · Tự viết câu</span>
          <span className="rv-quiz-count">{wIdx + 1} / {writingPrompts.length}</span>
        </div>
        <div className="fc2-progress-bar"><div style={{ width: `${((wIdx + 1) / writingPrompts.length) * 100}%` }} /></div>

        <div className="rv-quiz-card">
          <div className="rv-quiz-tags">
            <span className="rv-tag-num">Ứng dụng {wIdx + 1}</span>
            <span className="rv-tag-type write">✍️ Tự viết — AI chấm</span>
          </div>

          <p className="rv-quiz-question">{renderKo(wp.instruction)}</p>
          <p className="rv-write-hint">Tự sáng tạo câu của riêng bạn — không sao chép nguyên câu trong sách nhé.</p>

          <textarea
            className="rv-write-textarea"
            lang="ko"
            placeholder="Gõ câu tiếng Hàn của bạn vào đây..."
            value={wDraft}
            onChange={(e) => setWDraft(e.target.value)}
            disabled={!!wResult || wGrading}
            rows={wp.dialogue ? 3 : 2}
          />

          {!wResult && (
            <button className="rv-write-submit" onClick={submitWriting} disabled={!wDraft.trim() || wGrading}>
              {wGrading ? "AI đang chấm..." : "Nộp câu trả lời"}
            </button>
          )}

          {wResult && (
            <div className="rv-write-result">
              <div className="rv-write-score-row">
                <span>Điểm AI chấm</span>
                <b className={wResult.score >= 80 ? "great" : wResult.score >= 60 ? "mid" : "bad"}>{wResult.score}/100</b>
              </div>
              <div className="rv-write-block ok"><CheckCircle2 size={14} color="#3FA95C" /> <b>Điểm mạnh:</b> {wResult.strengths}</div>
              <div className="rv-write-block warn"><Target size={14} color="#D64545" /> <b>Lỗi sai:</b> {wResult.errors}</div>
              {wResult.naturalVersion && wResult.naturalVersion !== wDraft && (
                <div className="rv-write-block natural"><Sparkles size={14} color="#7C6FE4" /> <b>Câu tự nhiên hơn:</b> <span lang="ko">{wResult.naturalVersion}</span></div>
              )}
              {wResult.explanation && <p className="rv-write-explain">📖 {wResult.explanation}</p>}
              <button className="rv-next-btn rv-write-next" onClick={nextWriting}>
                {wIdx + 1 >= writingPrompts.length ? (shadowLines.length > 0 ? "Sang phần Shadowing" : "Xem kết quả") : "Câu tiếp theo"} <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ---------- Giai đoạn 3: Shadowing phản xạ — đồng hồ đếm ngược ---------- */
  const sLine = shadowLines[sIdx];
  const speechSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startCountdown = (totalSeconds) => {
    sReflexSecondsRef.current = totalSeconds;
    sTimeLeftRef.current = totalSeconds;
    setSTimeLeft(totalSeconds);
    clearInterval(sTimerRef.current);
    const start = Date.now();
    sTimerRef.current = setInterval(() => {
      const left = Math.max(0, totalSeconds - (Date.now() - start) / 1000);
      sTimeLeftRef.current = left;
      setSTimeLeft(left);
      if (left <= 0) {
        clearInterval(sTimerRef.current);
        handleTimeout();
      }
    }, 100);
  };

  const onSampleEnded = () => {
    const dur = sAudioRef.current?.duration;
    const reflexSeconds = Math.round(((isFinite(dur) && dur > 0 ? dur : 3) + 2.5) * 10) / 10;
    setSPhaseState("counting");
    startCountdown(reflexSeconds);
  };

  const gradeReflexAttempt = async (said) => {
    const timeLeftAtDone = sTimeLeftRef.current;
    setSPhaseState("grading");
    let graded;
    try { graded = await gradeWithAI(sLine.ko, said, sLine.realPron); } catch (e) { graded = gradeLocally(sLine.ko, said); }
    if ((graded?.score || 0) >= 80) playCorrectSound();
    else playIncorrectSound();
    const reflexRatio = sReflexSecondsRef.current > 0 ? timeLeftAtDone / sReflexSecondsRef.current : 0;
    const reflexLabel = reflexRatio >= 0.5 ? "Tuyệt vời" : reflexRatio >= 0.25 ? "Khá" : reflexRatio > 0 ? "Kịp giờ" : "Sát giờ";
    setSReflexResults((r) => [...r, { no: sLine.no, score: graded.score, timeLeftAtDone: Math.round(timeLeftAtDone * 10) / 10, reflexLabel, timedOut: false }]);
    setSPhaseState("done");
  };

  const startShadowRecording = () => {
    if (!speechSupported) { clearInterval(sTimerRef.current); setSPhaseState("unsupported"); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "ko-KR"; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    setSPhaseState("recording");
    rec.onresult = (e) => {
      clearInterval(sTimerRef.current);
      const said = e.results?.[0]?.[0]?.transcript || "";
      gradeReflexAttempt(said);
    };
    rec.onerror = () => { clearInterval(sTimerRef.current); setSPhaseState("timeout"); };
    sRecognitionRef.current = rec;
    try { rec.start(); } catch (e) { clearInterval(sTimerRef.current); setSPhaseState("timeout"); }
  };

  // Hết giờ mà chưa đọc xong / chưa bấm ghi âm — tự ngắt mic, đánh dấu "Chưa
  // đạt (Quá thời gian)", cho thử lại đến khi người dùng muốn qua câu mới.
  const handleTimeout = () => {
    try { sRecognitionRef.current?.abort(); } catch (e) { }
    setSPhaseState("timeout");
  };
  const retryShadow = () => { setSPhaseState("intro"); };
  const nextShadow = () => {
    if (sIdx + 1 >= shadowLines.length) { finishAll(answers, writingResults, sReflexResults); return; }
    setSIdx((i) => i + 1);
    setSPhaseState("intro");
  };
  const skipShadow = () => {
    setSReflexResults((r) => [...r, { no: sLine.no, score: 0, timeLeftAtDone: 0, reflexLabel: "Bỏ qua", timedOut: true }]);
    nextShadow();
  };

  const timerColor = sTimeLeft <= 2 ? "red" : sTimeLeft <= sReflexSecondsRef.current * 0.4 ? "yellow" : "green";
  const lastReflex = sReflexResults[sReflexResults.length - 1];

  return (
    <section className="rv-page">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Đóng"><XCircle size={20} /></button>
        <span className="rv-quiz-title">Shadowing phản xạ</span>
        <span className="rv-quiz-count">{sIdx + 1} / {shadowLines.length}</span>
        {mode === "random" && <button className="rv-change-set-btn" onClick={regenerate}><RotateCcw size={13} /> Đổi đề mới</button>}
      </div>
      <div className="fc2-progress-bar"><div style={{ width: `${((sIdx + 1) / shadowLines.length) * 100}%` }} /></div>

      <div className="rv-quiz-card rv-reflex-card">
        <audio ref={sAudioRef} src={sLine.audio} preload="auto" onEnded={onSampleEnded} />
        <p className="rv-reflex-ko" lang="ko">{renderKo(sLine.ko)}</p>
        <p className="rv-reflex-vi">{sLine.vi}</p>

        {(sPhaseState === "counting" || sPhaseState === "recording") && (
          <div className={`rv-reflex-timer ${timerColor} ${sTimeLeft <= 2 ? "blink" : ""}`}>
            {sTimeLeft.toFixed(1)}s
          </div>
        )}

        {sPhaseState === "intro" && (
          <p className="rv-reflex-hint"><Volume2 size={14} color="#7C6FE4" /> Đang phát câu mẫu — chuẩn bị đọc theo nhé...</p>
        )}
        {sPhaseState === "counting" && (
          <button className="rv-reflex-mic-btn" onClick={startShadowRecording}>
            <Mic size={22} color="#fff" /> Bấm để đọc theo
          </button>
        )}
        {sPhaseState === "recording" && <p className="rv-reflex-hint rec">🔴 Đang nghe bạn đọc...</p>}
        {sPhaseState === "grading" && <p className="rv-reflex-hint"><Sparkles size={14} color="#7C6FE4" /> AI đang chấm...</p>}

        {sPhaseState === "timeout" && (
          <div className="rv-reflex-result timeout">
            <div className="rv-reflex-timeout-msg"><AlertTriangle size={16} color="#D64545" /> Chưa đạt (Quá thời gian)</div>
            <div className="rv-reflex-btn-row">
              <button className="rv-next-btn secondary" onClick={skipShadow}>Bỏ qua câu này</button>
              <button className="rv-next-btn" onClick={retryShadow}><RotateCcw size={14} /> Thử lại</button>
            </div>
          </div>
        )}
        {sPhaseState === "unsupported" && (
          <div className="rv-reflex-result timeout">
            <div className="rv-reflex-timeout-msg"><AlertTriangle size={16} color="#D64545" /> Trình duyệt/khung xem trước chưa hỗ trợ nhận diện giọng nói.</div>
            <button className="rv-next-btn" onClick={skipShadow}>Bỏ qua câu này <ChevronRight size={14} /></button>
          </div>
        )}
        {sPhaseState === "done" && lastReflex && (
          <div className="rv-reflex-result">
            <div className="rv-accuracy" style={{ alignSelf: "center" }}>
              <span>Độ chính xác phát âm</span>
              <b className={toneForScore(lastReflex.score)}>{lastReflex.score}%</b>
            </div>
            <div className="rv-reflex-speed">
              <Target size={13} /> Tốc độ phản xạ: <b>{lastReflex.reflexLabel}</b> (còn dư {Math.max(0, lastReflex.timeLeftAtDone)}s)
            </div>
            <button className="rv-next-btn" onClick={nextShadow}>
              {sIdx + 1 >= shadowLines.length ? "Xem kết quả" : "Câu tiếp theo"} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Màn 3: Kết quả ôn tập ---------- */
export function ReviewResultView({ answers, writingResults, elapsedMs, difficulty, reflexResults, mode, onRetry, onChangeSet, onHome }) {
  const [feedback, setFeedback] = useState(null);
  const mcTotal = answers.length;
  const mcCorrect = answers.filter((a) => a.correct).length;
  const mcAccuracy = mcTotal ? mcCorrect / mcTotal : 1;

  const writingScores = (writingResults || []).map((w) => w.score).filter((s) => typeof s === "number");
  const writingAvg = writingScores.length ? Math.round(writingScores.reduce((a, b) => a + b, 0) / writingScores.length) : null;

  // Điểm Shadowing phản xạ: độ chính xác phát âm trung bình + tốc độ phản xạ
  // trung bình (giây), đúng định dạng tài liệu yêu cầu.
  const reflexList = (reflexResults || []).filter((r) => !r.timedOut);
  const reflexAccuracy = reflexList.length ? Math.round(reflexList.reduce((s, r) => s + r.score, 0) / reflexList.length) : null;
  const reflexAvgTimeLeft = reflexList.length ? Math.round((reflexList.reduce((s, r) => s + r.timeLeftAtDone, 0) / reflexList.length) * 10) / 10 : null;
  const reflexAvgLabel = reflexAvgTimeLeft === null ? null : reflexAvgTimeLeft >= 2 ? "Tuyệt vời" : reflexAvgTimeLeft >= 0.8 ? "Khá" : "Sát giờ";

  const seconds = Math.round(elapsedMs / 1000);
  const timeLabel = seconds >= 60 ? `${Math.floor(seconds / 60)} phút ${seconds % 60} giây` : `${seconds} giây`;
  const expectedMs = mcTotal * 18000 + (writingResults?.length || 0) * 60000;
  const speedRatio = expectedMs > 0 ? Math.min(1.3, expectedMs / Math.max(elapsedMs, 1)) : 1;
  const speedFactor = Math.min(1, speedRatio * 0.85 + 0.15);

  const composite = writingAvg !== null
    ? mcAccuracy * 100 * 0.5 + writingAvg * 0.35 + speedFactor * 100 * 0.15
    : mcAccuracy * 100 * 0.8 + speedFactor * 100 * 0.2;
  const achievedStars = composite >= 90 ? 5 : composite >= 75 ? 4 : composite >= 60 ? 3 : composite >= 40 ? 2 : 1;
  const score = Math.round(composite) / 10;
  const grade = composite >= 90 ? { label: "Hoàn thành xuất sắc!", icon: "🏆" } : composite >= 75 ? { label: "Nắm vững!", icon: "👍" } : composite >= 60 ? { label: "Đạt yêu cầu!", icon: "🙂" } : composite >= 40 ? { label: "Cần ôn thêm!", icon: "💪" } : { label: "Nên học lại bài!", icon: "📖" };
  const xpEarned = Math.round(composite * 0.8);
  const gemEarned = Math.round(composite * 0.3);

  const byCategory = (cat) => {
    const items = answers.filter((a) => a.category === cat);
    if (!items.length) return null;
    return Math.round((items.filter((a) => a.correct).length / items.length) * 100);
  };
  const cats = [
    { key: "tuvung", label: "Từ vựng", icon: BookOpen, color: "#4A90E2", bg: "#EEF4FD" },
    { key: "nghehieu", label: "Nghe hiểu", icon: Headphones, color: "#8B7BE8", bg: "#F0EEFC" },
    { key: "hoithoai", label: "Hội thoại", icon: MessageCircle, color: "#E8912E", bg: "#FDF3E7" },
    { key: "nguphap", label: "Ngữ pháp", icon: NotebookPen, color: "#3FA95C", bg: "#EBF7EE" },
  ].map((c) => ({ ...c, pct: byCategory(c.key) })).filter((c) => c.pct !== null);
  if (writingAvg !== null) {
    cats.push({ key: "writing", label: "Viết (AI)", icon: Type, color: "#E5566B", bg: "#FDF0F2", pct: writingAvg });
  }

  const strengths = cats.filter((c) => c.pct >= 80);
  const weak = cats.filter((c) => c.pct < 60);
  const wrongLabels = [...new Set(answers.filter((a) => !a.correct).map((a) => a.label))];

  useEffect(() => {
    let alive = true;
    const writingNote = writingResults?.some((w) => w.errors && w.errors !== "Không có lỗi đáng kể")
      ? [`phần Ứng dụng: ${writingResults.find((w) => w.errors && w.errors !== "Không có lỗi đáng kể")?.errors || ""}`]
      : [];
    generateReviewFeedback([...wrongLabels, ...writingNote]).then((f) => { if (alive) setFeedback(f); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rv-page">
      <div className="rv-result-card">
        <div className="rv-result-trophy">{grade.icon}</div>
        <div className="rv-result-grade">{grade.label}</div>
        <div className="rv-result-score">{score}<span>/10</span></div>
        <div className="fc2-progress-bar rv-result-bar"><div style={{ width: `${(score / 10) * 100}%` }} /></div>

        <div className="rv-result-stars-row">
          <div className="rv-result-stars-col">
            <span className="rv-result-stars-label">Độ khó đã chọn</span>
            <span className="rv-result-stars-icons">
              {Array.from({ length: 5 }).map((_, i) => (<Star key={i} size={15} fill={i < difficulty.stars ? "#A9A3C6" : "none"} color="#A9A3C6" />))}
            </span>
          </div>
          <div className="rv-result-stars-col">
            <span className="rv-result-stars-label">Mức độ thành thạo đạt được</span>
            <span className="rv-result-stars-icons">
              {Array.from({ length: 5 }).map((_, i) => (<Star key={i} size={15} fill={i < achievedStars ? "#F0C24E" : "none"} color={i < achievedStars ? "#F0C24E" : "#DCD3F4"} />))}
            </span>
          </div>
        </div>

        <div className="rv-result-meta-row">
          <span><CheckCircle2 size={13} color="#3FA95C" /> {mcCorrect}/{mcTotal} câu đúng</span>
          {writingAvg !== null && <span><Type size={13} color="#E5566B" /> Viết {writingAvg}/100</span>}
          <span>⏱ {timeLabel}</span>
          <span><Star size={13} fill="#F0C24E" color="#F0C24E" /> +{xpEarned} XP</span>
          <span><DiamondIcon size={14} /> +{gemEarned}</span>
        </div>

        {reflexAccuracy !== null && (
          <div className="rv-reflex-summary">
            <Mic size={14} color="#7C6FE4" />
            Độ chính xác phát âm: <b>{reflexAccuracy}%</b> · Tốc độ phản xạ: <b>{reflexAvgLabel}</b> (còn dư trung bình {reflexAvgTimeLeft}s/câu)
          </div>
        )}

        <div className="rv-result-cats">
          {cats.map((c, i) => (
            <div key={i} className="rv-result-cat" style={{ background: c.bg }}>
              <c.icon size={16} color={c.color} />
              <span className="rv-result-cat-pct" style={{ color: c.color }}>{c.pct}%</span>
              <span className="rv-result-cat-label">{c.label}</span>
            </div>
          ))}
        </div>

        {(strengths.length > 0 || weak.length > 0) && (
          <div className={`rv-detail-card ${weak.length === 0 || strengths.length === 0 ? "single" : ""}`}>
            {strengths.length > 0 && (
              <div className="rv-detail-col ok">
                <div className="rv-detail-title"><Sparkles size={15} /> Điểm mạnh</div>
                <div className="rv-detail-items">
                  {strengths.map((c, i) => (<div key={i} className="rv-detail-item"><CheckCircle2 size={14} /> {c.label}</div>))}
                </div>
              </div>
            )}
            {weak.length > 0 && (
              <div className="rv-detail-col warn">
                <div className="rv-detail-title"><Target size={15} /> Cần ôn thêm</div>
                <div className="rv-detail-items">
                  {weak.map((c, i) => (<div key={i} className="rv-detail-item"><Target size={14} /> {c.label}</div>))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rv-result-msg">
          🐰 {feedback || <span className="rv-feedback-loading">AI đang phân tích bài làm của bạn...</span>}
        </div>
      </div>

      {writingResults && writingResults.length > 0 && (
        <div className="rv-writing-review">
          <div className="rv-types-title"><Type size={14} color="#E5566B" /> Chi tiết phần Ứng dụng</div>
          {writingResults.map((w, i) => (
            <div key={i} className="rv-writing-review-item">
              <p className="rv-writing-review-q">{renderKo(w.instruction)}</p>
              <p className="rv-writing-review-a" lang="ko">"{w.answer}"</p>
              <div className="rv-writing-review-score">{w.score}/100</div>
            </div>
          ))}
        </div>
      )}

      <div className="rv-result-actions">
        {mode === "random" && onChangeSet && (
          <button className="rv-retry-btn change" onClick={onChangeSet}><Sparkles size={16} /> Đổi đề mới</button>
        )}
        <button className="rv-retry-btn" onClick={onRetry}><RotateCcw size={16} /> Ôn lại lần nữa</button>
        <button className="rv-home-btn" onClick={onHome}><Home size={16} /> Hoàn thành</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CHI TIẾT BÀI HỌC — 4 hoạt động                                     */
/* ------------------------------------------------------------------ */
const ACTIVITIES = [
  {
    id: "tuvung", label: "Từ vựng & Ngữ pháp", icon: "book", color: "#4A90E2", bg: "#EEF4FD",
    desc: "Học thẻ từ mới và các điểm ngữ pháp trong bài", cta: "Học ngay",
  },
  {
    id: "nghechep", label: "Nghe chép chính tả", icon: "head", color: "#3FA95C", bg: "#EBF7EE",
    desc: "Nghe đoạn hội thoại và chép lại chính xác", cta: "Bắt đầu nghe",
  },
  {
    id: "shadowing", label: "Shadowing", icon: "mic", color: "#7C6FE4", bg: "#F0EEFC",
    desc: "Nghe và lặp lại theo người bản ngữ để luyện ngữ điệu", cta: "Bắt đầu luyện",
  },
  {
    id: "ontap", label: "Ôn tập", icon: "chat", color: "#F0912E", bg: "#FDF3E7",
    desc: "Củng cố kiến thức và tự đánh giá mức độ ghi nhớ", cta: "Ôn tập ngay",
  },
];

/* Tính % tiến độ THẬT cho từng thẻ hoạt động, đọc từ đúng dữ liệu đã lưu   */
/* qua window.storage — không còn bảng số cố định. "Ôn tập" tính theo tỉ lệ */
/* nội dung đã ôn "vững" (đúng nhiều hơn sai) trên tổng số mục có thể ôn.   */
async function loadActivityProgress(lesson, userId) {
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
    const r = await readScopedProgress(reviewHistoryKey(lesson, userId), legacyLessonProgressKey("review-history", lesson.no), userId);
    if (r?.value) {
      const hist = JSON.parse(r.value);
      const totalReviewable = VOCAB_SAMPLE.length + GRAMMAR_SAMPLE.reduce((s, g) => s + g.formula.length, 0) + SHADOW_LINES.length + (SHADOW_LINES.length - 1);
      const mastered = Object.values(hist).filter((h) => h.correct > 0 && h.correct >= h.wrong).length;
      out.ontap = Math.max(out.ontap, Math.round((mastered / totalReviewable) * 100));
    }
  } catch (e) { }
  try {
    const completed = await window.storage.get(activityCompletionKey(lesson, userId));
    if (completed?.value) {
      Object.keys(JSON.parse(completed.value)).forEach((activityId) => {
        if (Object.prototype.hasOwnProperty.call(out, activityId)) out[activityId] = 100;
      });
    }
  } catch (e) { }
  return out;
}

