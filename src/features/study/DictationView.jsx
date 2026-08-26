import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Volume2, Sparkles, CheckCircle2, RotateCcw, AlertTriangle,
  Lightbulb, XCircle, Check, Link2, Image as ImageIcon,
  BookMarked, BookOpen, Eraser, Headphones, Play, Square, Star, Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { requestAIJson } from '../../services/aiService';
import { speakKo, playCorrectSound, playIncorrectSound, playCelebrationSound } from '../../services/audioService';
import { renderKo, shuffleArr } from '../../utils/textUtils';
import { MiniBear, SwBunnyEmpty, BunnyMascot } from '../../components/common/Mascots';
import { VOCAB_SAMPLE, SHADOW_LINES, DiamondIcon, UserGemCount, UserXpCount } from '../../data/fallbackData';
import {
  dictationProgressKey,
  legacyDictationProgressKey,
  readScopedProgress,
  saveScopedProgress
} from '../../services/storageShim';
import { loadRemoteActivityProgress, saveRemoteActivityProgress } from '../../lib/activityProgress';
import { correctDictationResults } from '../dashboard/progressService';
import { SkillCompletionView } from '../review/ReviewViews';

const FILL_BLANK_ITEMS = [
  { word: '꽃다발', pre: '생일이라 친구에게 예쁜 ', post: ' 선물했어요.', hint: '을/를', particle: '을' },
  { word: '만년필', pre: '졸업 선물로 ', post: ' 받았어요.', hint: '을/를', particle: '을' },
  { word: '목도리', pre: '날씨가 추워서 ', post: ' 했어요.', hint: '을/를', particle: '를' },
  { word: '상품권', pre: '백화점에서 쓸 수 있는 ', post: ' 선물했어요.', hint: '을/를', particle: '을' },
  { word: '향수', pre: '', post: ' 너무 좋아서 하나 더 샀어요.', hint: '이/가', particle: '가' },
];

const MATCH_ITEMS = [
  { word: '꽃다발', meaning: 'Bó hoa' },
  { word: '만년필', meaning: 'Bút máy' },
  { word: '목도리', meaning: 'Khăn quàng cổ' },
  { word: '상품권', meaning: 'Phiếu mua hàng' },
  { word: '향수', meaning: 'Nước hoa' },
];

const buildImageQuizItems = () => VOCAB_SAMPLE.map((word, index) => {
  const distractors = shuffleArr(VOCAB_SAMPLE.filter((_, candidateIndex) => candidateIndex !== index)).slice(0, 3);
  return {
    answer: word.word,
    options: shuffleArr([word, ...distractors]).map((option) => ({ word: option.word, img: option.img })),
  };
});

export function FillBlankListenView({ onBack }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const total = FILL_BLANK_ITEMS.length;

  const setAns = (i, val) => setAnswers((a) => ({ ...a, [i]: val }));
  const score = FILL_BLANK_ITEMS.filter((it, i) => (answers[i] || "").trim() === it.word).length;

  const retry = () => { setAnswers({}); setChecked(false); };

  return (
    <section className="qz-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Headphones size={18} color="#7C6FE4" /> Điền vào chỗ trống [Nghe]</span>
        </div>
      </div>

      <div className="qz-card">
        <div className="qz-progress-line">Câu 1 / {total}</div>
        <div className="qz-fb-list">
          {FILL_BLANK_ITEMS.map((it, i) => {
            const val = answers[i] || "";
            const isCorrect = checked && val.trim() === it.word;
            const isWrong = checked && !isCorrect;
            return (
              <div key={i} className={`qz-fb-row ${isCorrect ? "ok" : isWrong ? "wrong" : ""}`}>
                <span className="qz-num">{i + 1}</span>
                <div className="qz-fb-body">
                  <p className="qz-fb-sentence" lang="ko">
                    {it.pre}
                    <input
                      className="qz-fb-input"
                      value={val}
                      disabled={checked}
                      onChange={(e) => setAns(i, e.target.value)}
                      lang="ko"
                    />
                    <small className="qz-fb-hint">({it.hint})</small>
                    {it.post}
                    <button
                      className="qz-mini-audio"
                      onClick={() => speakKo(`${it.pre}${it.word}${it.particle}${it.post}`)}
                      aria-label="Nghe câu"
                    >
                      <Volume2 size={12} color="#fff" />
                    </button>
                  </p>
                  {checked && (
                    isCorrect
                      ? <span className="qz-fb-feedback ok"><CheckCircle2 size={14} /> Chính xác!</span>
                      : <span className="qz-fb-feedback wrong">Đáp án đúng: <b lang="ko">{it.word}</b></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="qz-tip">
          <Lightbulb size={16} color="#E8A93D" fill="#F7D98B" />
          Mẹo: Nghe kỹ và điền chính xác từ bạn vừa học nhé!
        </div>

        {!checked ? (
          <button className="qz-check-btn purple" onClick={() => {
            setChecked(true);
            if (FILL_BLANK_ITEMS.every((item, index) => (answers[index] || "").trim() === item.word)) playCorrectSound();
            else playIncorrectSound();
          }}>Kiểm tra đáp án</button>
        ) : (
          <div className="qz-result-row">
            <span className="qz-score">Bạn đúng {score}/{total} câu</span>
            <button className="qz-check-btn purple" onClick={retry}>Làm lại</button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DẠNG 2 — GHÉP CẶP                                                   */
/* ------------------------------------------------------------------ */
export function MatchPairsView({ onBack }) {
  const [order] = useState(() => shuffleArr(MATCH_ITEMS.map((_, i) => i)));
  const [selected, setSelected] = useState(null);
  const [pairs, setPairs] = useState({});
  const [wrongFlash, setWrongFlash] = useState(null);
  const total = MATCH_ITEMS.length;

  const isLeftDone = (i) => pairs[i] !== undefined;
  const isRightDone = (pos) => Object.values(pairs).includes(pos);
  const allDone = Object.keys(pairs).length === total;

  const pickLeft = (i) => { if (!isLeftDone(i)) setSelected(i); };
  const pickRight = (pos) => {
    if (selected === null || isRightDone(pos)) return;
    const ok = MATCH_ITEMS[selected].meaning === MATCH_ITEMS[order[pos]].meaning;
    if (ok) {
      playCorrectSound();
      setPairs((p) => ({ ...p, [selected]: pos }));
      setSelected(null);
    } else {
      playIncorrectSound();
      setWrongFlash({ left: selected, right: pos });
      setTimeout(() => setWrongFlash(null), 500);
      setSelected(null);
    }
  };

  return (
    <section className="qz-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Link2 size={18} color="#3FA95C" /> Ghép cặp</span>
        </div>
      </div>

      <div className="qz-card">
        <div className="qz-progress-line">Đã ghép {Object.keys(pairs).length} / {total}</div>
        <div className="qz-match-grid">
          <div className="qz-match-col">
            {MATCH_ITEMS.map((it, i) => (
              <button
                key={i}
                className={`qz-match-item left ${isLeftDone(i) ? "done" : ""} ${selected === i ? "sel" : ""} ${wrongFlash?.left === i ? "wrong" : ""}`}
                onClick={() => pickLeft(i)}
                disabled={isLeftDone(i)}
              >
                <span className="qz-match-tag">{i + 1}</span>
                <span lang="ko" className="qz-match-word">{it.word}</span>
                <span className="qz-match-audio" onClick={(e) => { e.stopPropagation(); speakKo(it.word); }}>
                  <Volume2 size={12} color={isLeftDone(i) ? "#fff" : "#3FA95C"} />
                </span>
              </button>
            ))}
          </div>
          <div className="qz-match-mid" />
          <div className="qz-match-col">
            {order.map((origIdx, pos) => (
              <button
                key={pos}
                className={`qz-match-item right ${isRightDone(pos) ? "done" : ""} ${wrongFlash?.right === pos ? "wrong" : ""}`}
                onClick={() => pickRight(pos)}
                disabled={isRightDone(pos)}
              >
                <span className="qz-match-tag">{String.fromCharCode(65 + pos)}</span>
                {MATCH_ITEMS[origIdx].meaning}
              </button>
            ))}
          </div>
        </div>

        <div className="qz-tip">
          <Lightbulb size={16} color="#E8A93D" fill="#F7D98B" />
          Mẹo: Hãy nhớ nghĩa của từ để ghép đúng nhé!
        </div>

        <button className="qz-check-btn green" disabled={!allDone} onClick={onBack}>
          {allDone ? "Hoàn thành! 🎉" : "Kiểm tra đáp án"}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DẠNG 3 — CHỌN HÌNH                                                  */
/* ------------------------------------------------------------------ */
export function ChooseImageView({ onBack }) {
  const [items] = useState(buildImageQuizItems);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const total = items.length;
  const item = items[idx];

  const pick = (word) => {
    if (picked) return;
    setPicked(word);
    if (word === item.answer) playCorrectSound();
    else playIncorrectSound();
  };
  const next = () => {
    if (idx < total - 1) { setIdx(idx + 1); setPicked(null); }
    else onBack();
  };

  return (
    <section className="qz-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><ImageIcon size={18} color="#4A90E2" /> Chọn hình</span>
        </div>
      </div>

      <div className="qz-card">
        <div className="qz-progress-line">Câu {idx + 1} / {total}</div>
        <button className="qz-play-audio" onClick={() => speakKo(item.answer)}>
          <Play size={15} fill="#fff" color="#fff" /> Nghe từ
        </button>

        <div className="qz-img-grid">
          {item.options.map((o, i) => {
            const isPicked = picked === o.word;
            const isRight = o.word === item.answer;
            const showState = picked && (isPicked || isRight);
            return (
              <button
                key={i}
                className={`qz-img-opt ${showState ? (isRight ? "correct" : "wrong") : ""}`}
                onClick={() => pick(o.word)}
                disabled={!!picked}
              >
                <span className="qz-img-letter">{String.fromCharCode(65 + i)}</span>
                <img src={o.img} alt="" />
              </button>
            );
          })}
        </div>

        <div className="qz-tip">
          <Lightbulb size={16} color="#E8A93D" fill="#F7D98B" />
          Mẹo: Nghe từ và chọn hình đúng nhất nhé!
        </div>

        {picked && (
          <button className="qz-check-btn blue" onClick={next}>
            {idx === total - 1 ? "Hoàn thành" : "Câu tiếp"} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  NGHE CHÉP CHÍNH TẢ — dùng audio thật (4 câu 1과.mp3 đã cắt sẵn      */
/*  cho Shadowing), gợi ý hé lộ từng ký tự khi trả lời sai              */
/* ------------------------------------------------------------------ */
export default function DictationView({ lesson, userId, lines = SHADOW_LINES, vocabulary = VOCAB_SAMPLE, initialMode = "practice", onBack, onFinish, onGoVocab, onProgress }) {
  const mode = initialMode;
  const [orderedLines] = useState(() => shuffleArr([...lines]));
  const [idx, setIdx] = useState(0);
  const [inputs, setInputs] = useState({});
  const [status, setStatus] = useState({});
  const [verified, setVerified] = useState({}); // chỉ câu đúng trong phần Kiểm tra mới tính tiến độ
  const [checkedValues, setCheckedValues] = useState({}); // giá trị đã gõ TẠI THỜI ĐIỂM bấm Kiểm tra, dùng để bôi màu đúng/sai từng từ
  const [reveal, setReveal] = useState({});
  const [hintUses, setHintUses] = useState({});
  const [hintTexts, setHintTexts] = useState({});
  const [listensLeft, setListensLeft] = useState({});
  const [showTrans, setShowTrans] = useState({});
  const [attempted, setAttempted] = useState({});
  const [duration, setDuration] = useState(0);
  const [curTime, setCurTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [retryQueue, setRetryQueue] = useState([]);
  const [wrongAttempts, setWrongAttempts] = useState({});
  const [retryRound, setRetryRound] = useState(0);
  const [retryNotice, setRetryNotice] = useState("");
  const [showCompletion, setShowCompletion] = useState(false);
  const [isRecheck, setIsRecheck] = useState(false);
  const audioRef = useRef(null);
  const autoAdvanceRef = useRef(null);

  const total = orderedLines.length;
  const line = orderedLines[idx];
  const target = line.ko.replace(/\*\*/g, "");
  const leftCount = mode === "practice" ? Infinity : listensLeft[idx] ?? 2;
  const curReveal = reveal[idx] || 0;
  const maxReveal = target.replace(/\s/g, "").length;
  const value = inputs[idx] || "";
  const st = status[idx];
  const questionLocked = st === "correct" || (mode === "test" && st === "failed");
  const storageKey = dictationProgressKey(lesson, userId);
  const itemIdentity = (item, index) => item?.no ?? lines.indexOf(item) ?? index;
  const progressKey = (route, item = line, index = idx) => `${route}:${itemIdentity(item, index)}`;
  const hintLimit = mode === "practice" ? 3 : 1;

  useEffect(() => {
    let alive = true;
    Promise.all([
      readScopedProgress(storageKey, legacyDictationProgressKey(lesson), userId),
      loadRemoteActivityProgress(lesson?.id),
    ]).then(([res, remoteRows]) => {
      if (!alive) return;
      const localRaw = res?.value ? JSON.parse(res.value) : {};
      const remoteSaved = remoteRows.find((row) => row.activityType === "nghechep")?.completedItems || {};
      const rawSaved = { ...localRaw, ...remoteSaved };
      const saved = {};
      Object.entries(rawSaved).forEach(([key, savedValue]) => {
        const correct = savedValue === "correct" || (typeof savedValue === "object" && savedValue?.correct === true);
        if (!correct) return;
        if (key.startsWith("practice:") || key.startsWith("test:")) saved[key] = "correct";
        else if (/^\d+$/.test(key)) {
          const oldIndex = Number(key);
          const oldLine = lines[oldIndex];
          if (oldLine) saved[progressKey("test", oldLine, oldIndex)] = "correct";
        }
      });
      if (!Object.keys(saved).length) return;
      window.storage.set(storageKey, JSON.stringify(saved)).catch(() => { });
      setVerified(saved);
      const routeStatus = Object.fromEntries(orderedLines.map((item, questionIndex) => {
        const key = progressKey(mode, item, questionIndex);
        return [questionIndex, saved[key] === "correct" ? "correct" : undefined];
      }).filter(([, value]) => value));
      setStatus(routeStatus);
      const completedIndexes = Object.keys(routeStatus);
      if (completedIndexes.length) {
        const firstPending = Array.from({ length: total }).findIndex((_, questionIndex) => routeStatus[questionIndex] !== "correct");
        if (firstPending < 0) setShowCompletion(true);
        else setIdx(firstPending);
      }
      setAttempted((a) => {
        const next = { ...a };
        Object.keys(saved).forEach((k) => { next[k] = true; });
        return next;
      });
    }).catch(() => { });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storageKey, total, lesson, userId, orderedLines]);

  useEffect(() => {
    clearTimeout(autoAdvanceRef.current);
    setCurTime(0);
    setPlaying(false);
  }, [idx]);
  useEffect(() => () => clearTimeout(autoAdvanceRef.current), []);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = speed; }, [speed, idx]);
  const consumeListen = () => {
    if (mode === "practice") return;
    setListensLeft((current) => ({
      ...current,
      [idx]: Math.max(0, (current[idx] ?? 2) - 1),
    }));
  };

  // Mỗi lần bắt đầu nghe (kể cả phát tiếp) đều dùng một lượt ở tuyến kiểm tra.
  const playFromStart = () => {
    if (leftCount <= 0) return;
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.playbackRate = speed;
    el.play().catch(() => { });
    consumeListen();
  };

  // Nhấn khi đang phát chỉ tạm dừng; nhấn Play để phát/phát tiếp sẽ dùng một lượt.
  const togglePause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    if (leftCount <= 0) return;
    if (curTime > 0 && curTime < duration) {
      el.playbackRate = speed;
      el.play().catch(() => { });
      consumeListen();
    } else {
      playFromStart();
    }
  };

  const fmt = (s) => {
    if (!isFinite(s)) return "00:00";
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const setVal = (v) => setInputs((o) => ({ ...o, [idx]: v }));

  const normalizeDictation = (text) => text
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    // Chấp nhận các cách nói tương đương thường gặp trong hội thoại.
    // Bài mẫu dùng "함께 뭘", trong khi audio/người học có thể dùng
    // "같이 뭐"; khác biệt này không làm thay đổi nghĩa của câu.
    .replace(/함께/g, "같이")
    .replace(/뭘/g, "뭐")
    .replace(/[\p{P}\p{S}\s]+/gu, "");

  const check = () => {
    if (questionLocked) return;
    const ok = normalizeDictation(value) === normalizeDictation(target);
    if (ok) playCorrectSound();
    else playIncorrectSound();
    const nextWrongCount = ok ? (wrongAttempts[idx] || 0) : (wrongAttempts[idx] || 0) + 1;
    const failed = mode === "test" && !ok && nextWrongCount >= 3;
    const newStatus = { ...status, [idx]: ok ? "correct" : failed ? "failed" : "wrong" };
    setStatus(newStatus);
    if (!ok) setWrongAttempts((current) => ({ ...current, [idx]: nextWrongCount }));
    setCheckedValues((c) => ({ ...c, [idx]: value }));
    setAttempted((a) => ({ ...a, [idx]: true }));
    setRetryQueue((queue) => ok ? queue.filter((item) => item !== idx) : (queue.includes(idx) ? queue : [...queue, idx]));
    const nextVerified = ok ? { ...verified, [progressKey(mode)]: "correct" } : verified;
    if (ok) {
      setVerified(nextVerified);
      const fullyCorrect = orderedLines.every((item, questionIndex) => nextVerified[progressKey(mode, item, questionIndex)] === "correct");
      if (!isRecheck) {
        window.storage.set(storageKey, JSON.stringify(nextVerified)).catch(() => { });
        saveRemoteActivityProgress(lesson.textbookId, lesson.id, "nghechep", nextVerified, total * 2)
          .then((percent) => onProgress?.("nghechep", percent))
          .catch(() => { });
      }
    }
    if (ok) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = window.setTimeout(() => goNext(newStatus, nextVerified), 800);
    }
  };

  // So khớp theo từng từ để bôi xanh (đúng) / đỏ (sai hoặc thiếu) — dùng đúng
  // nội dung đã gõ TẠI LÚC bấm Kiểm tra, không đổi theo khi gõ tiếp sau đó.
  const diffWords = () => {
    const targetWords = target.replace(/[\p{P}\p{S}]+/gu, " ").split(/\s+/).filter(Boolean);
    const userWords = (checkedValues[idx] || "").replace(/[\p{P}\p{S}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
    return Array.from({ length: Math.max(targetWords.length, userWords.length) }, (_, index) => {
      const expected = targetWords[index] || "";
      const entered = userWords[index] || "";
      const correct = Boolean(expected && entered) && normalizeDictation(entered) === normalizeDictation(expected);
      return { word: entered || expected, expected, correct, missing: !entered && Boolean(expected) };
    });
  };

  const hint = () => {
    if ((hintUses[idx] || 0) >= hintLimit) return;
    setHintUses((current) => ({ ...current, [idx]: (current[idx] || 0) + 1 }));
    const targetWords = target.trim().split(/\s+/).filter(Boolean);
    const enteredWords = value.trim().split(/\s+/).filter(Boolean);
    let correctPrefixLength = 0;
    while (
      correctPrefixLength < enteredWords.length
      && correctPrefixLength < targetWords.length
      && normalizeDictation(enteredWords[correctPrefixLength]) === normalizeDictation(targetWords[correctPrefixLength])
    ) {
      correctPrefixLength += 1;
    }
    const nextWord = targetWords[Math.min(correctPrefixLength, targetWords.length - 1)] || "";
    setHintTexts((current) => ({ ...current, [idx]: nextWord }));
    setAttempted((a) => ({ ...a, [idx]: true }));
  };

  const goto = (i) => setIdx(i);
  const goNext = (statusSnapshot = status, verifiedSnapshot = verified) => {
    const currentDone = statusSnapshot[idx] === "correct" || statusSnapshot[idx] === "failed";
    if (!currentDone) return;
    const nextIndex = mode === "test"
      ? Array.from({ length: total }).findIndex((_, questionIndex) => questionIndex > idx && verifiedSnapshot[progressKey(mode, orderedLines[questionIndex], questionIndex)] !== "correct")
      : idx < total - 1 ? idx + 1 : -1;
    if (nextIndex >= 0) { goto(nextIndex); return; }
    const pending = mode === "test"
      ? Array.from({ length: total }, (_, questionIndex) => questionIndex).filter((questionIndex) => verifiedSnapshot[progressKey(mode, orderedLines[questionIndex], questionIndex)] !== "correct")
      : retryQueue.filter((questionIndex) => statusSnapshot[questionIndex] !== "correct");
    if (pending.length) {
      if (mode === "test") {
        if (retryRound >= 1) {
          setRetryNotice(`Đã kết thúc lượt làm lại. ${pending.length} câu chưa đúng không được cộng vào tiến trình.`);
          setShowCompletion(true);
          return;
        }
        setRetryRound((round) => round + 1);
        setRetryNotice(`Bạn đã đi hết lượt. Có ${pending.length} câu chưa đúng — bắt đầu lượt làm lại.`);
        setStatus((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setInputs((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setCheckedValues((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setReveal((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setHintUses((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setHintTexts((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setShowTrans((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setAttempted((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setWrongAttempts((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
        setListensLeft((current) => {
          const next = { ...current };
          pending.forEach((questionIndex) => { delete next[questionIndex]; });
          return next;
        });
      }
      goto(pending[0]);
      return;
    }
    setShowCompletion(true);
  };

  const clearCurrentAnswer = () => {
    if (questionLocked) return;
    setVal("");
    setCheckedValues((current) => { const next = { ...current }; delete next[idx]; return next; });
    setStatus((current) => { const next = { ...current }; delete next[idx]; return next; });
  };

  const skipCurrentQuestion = () => {
    if (questionLocked) return;
    playIncorrectSound();
    const nextStatus = { ...status, [idx]: "failed" };
    setStatus(nextStatus);
    setAttempted((current) => ({ ...current, [idx]: true }));
    setRetryQueue((queue) => queue.includes(idx) ? queue : [...queue, idx]);
    window.setTimeout(() => goNext(nextStatus, verified), 250);
  };

  const retryDictation = () => {
    setShowCompletion(false);
    setIsRecheck(true);
    setIdx(0);
    setInputs({});
    setStatus({});
    setCheckedValues({});
    setAttempted({});
    setHintUses({});
    setHintTexts({});
    setRetryQueue([]);
    setListensLeft({});
    setWrongAttempts({});
    setRetryRound(0);
    setRetryNotice("");
  };

  if (showCompletion) {
    const correctCount = orderedLines.filter((item, questionIndex) => verified[progressKey(mode, item, questionIndex)] === "correct").length;
    const routePercent = total ? Math.round((correctCount / total) * 100) : 0;
    return (
      <SkillCompletionView
        title={mode === "test" ? "Bạn đã hoàn thành Kiểm tra nghe chép!" : "Bạn đã hoàn thành Luyện tập nghe chép!"}
        description={mode === "test"
          ? correctCount === total
            ? "Bạn đã hoàn thành cả hai tuyến Nghe chép chính tả. Bạn có muốn kiểm tra lại không?"
            : `Bạn hoàn thành đúng ${correctCount}/${total} câu (${routePercent}%) ở tuyến Kiểm tra. Các câu chưa đúng không được cộng vào tiến trình.`
          : "Luyện tập đã hoàn thành và tuyến Kiểm tra đã được mở."}
        retryLabel={mode === "test" ? "Kiểm tra lại" : "Luyện lại"}
        onBack={mode === "test" && !isRecheck ? (onFinish || onBack) : onBack}
        onRetry={retryDictation}
      />
    );
  }

  return (
    <section className="dc-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Headphones size={18} color="#7C6FE4" /> Nghe chép chính tả</span>
          <span className="dc-lesson-pill"><BookOpen size={13} /> Bài {lesson.no}</span>
        </div>
        <div className="fc2-top-mid"><span className="fc2-progress-text">Câu {idx + 1} / {total}</span></div>
        <div className="fc2-top-right">
          <span className="fc2-pill xp"><Star size={13} fill="#F0C24E" color="#F0C24E" /> <UserXpCount /> XP</span>
          <span className="fc2-pill gem"><DiamondIcon size={14} /> <UserGemCount /></span>
        </div>
      </div>

      <div className={`dc-route-banner ${mode}`}>
        {mode === "practice" ? <Headphones size={15} /> : <Target size={15} />}
        <strong>{mode === "practice" ? "Tuyến Luyện tập" : "Tuyến Kiểm tra"}</strong>
        <span>{mode === "practice" ? "Gợi ý tối đa 3 lần · chiếm 50% tiến trình" : "Tối đa 2 lượt nghe và 1 gợi ý/câu · chiếm 50% tiến trình"}</span>
      </div>
      {retryNotice && (
        <div className="dc-retry-notice"><RotateCcw size={15} /> <span>{retryNotice}</span><small>Lượt làm lại {retryRound}</small></div>
      )}

      <div className="dc-body">
        <div className="dc-main">
          <audio
            key={idx}
            ref={audioRef}
            src={line.audio}
            preload="none"
            onTimeUpdate={() => setCurTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <div className="dc-player">
            <button className="dc-play-btn" onClick={togglePause} disabled={!playing && leftCount <= 0} aria-label={playing ? "Tạm dừng" : leftCount <= 0 ? "Đã hết lượt nghe" : "Nghe"}>
              {playing ? <Square size={17} fill="#fff" color="#fff" /> : <Play size={20} fill="#fff" color="#fff" />}
            </button>
            <div className={`dc-wave ${playing ? "is-playing" : ""}`} aria-hidden="true">
              {Array.from({ length: 26 }).map((_, i) => (
                <span key={i} style={{ "--h": `${22 + ((i * 37) % 55)}%`, "--d": `${(i % 7) * 0.07}s` }} />
              ))}
            </div>
            <div className="dc-time">{fmt(curTime)} / {fmt(duration)}</div>
            <div className={`dc-listen-counter ${mode === "test" && leftCount <= 0 ? "empty" : ""}`} aria-live="polite">
              <Headphones size={14} />
              {mode === "practice" ? "Không giới hạn lượt nghe" : `Còn ${leftCount} / 2 lượt nghe`}
            </div>
          </div>
          <div className="dc-speed-row">
            <span className="dc-speed-label">Tốc độ:</span>
            {[0.75, 1, 1.25].map((s) => (
              <button key={s} className={`dc-speed-chip ${speed === s ? "on" : ""}`} onClick={() => setSpeed(s)}>{s}x</button>
            ))}
          </div>
          <p className="dc-instruction"><Volume2 size={15} color="#7C6FE4" /> Nghe đoạn hội thoại và nhập chính xác câu bạn nghe được.</p>

          <div className="dc-input-row">
            <textarea
              className={`dc-textarea ${st === "correct" ? "ok" : st === "wrong" || st === "failed" ? "wrong" : ""}`}
              placeholder="Nhập câu tiếng Hàn tại đây..."
              value={value}
              onChange={(e) => {
                setVal(e.target.value);
                if (st === "wrong") setStatus((current) => ({ ...current, [idx]: undefined }));
              }}
              disabled={questionLocked}
              lang="ko"
            />
            <div className="dc-side-btns">
              <button className="dc-hint-btn" onClick={hint} disabled={(hintUses[idx] || 0) >= hintLimit}>
                <Lightbulb size={15} /> Gợi ý ({Math.max(0, hintLimit - (hintUses[idx] || 0))})
              </button>
              <button
                className={`dc-trans-btn unlocked ${showTrans[idx] ? "active" : ""}`}
                onClick={() => setShowTrans((current) => ({ ...current, [idx]: !current[idx] }))}
                aria-expanded={Boolean(showTrans[idx])}
              >
                <BookMarked size={15} /> {showTrans[idx] ? "Ẩn bản dịch" : "Hiện bản dịch"}
              </button>
            </div>
          </div>

          {hintTexts[idx] && (
            <div className="dc-hint-line">
              <Lightbulb size={15} />
              <strong>Từ tiếp theo:</strong>
              <span lang="ko">{hintTexts[idx]}</span>
            </div>
          )}
          {showTrans[idx] && (
            <div className={`dc-trans-line ${line.vi ? "" : "is-empty"}`}>
              <BookMarked size={15} />
              <strong>Bản dịch:</strong>
              <span>{line.vi || "Câu này chưa có bản dịch tiếng Việt."}</span>
            </div>
          )}
          {st && (
            <div className={`dc-feedback ${st === "correct" ? "ok" : "wrong"}`}>
              {st === "correct" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {st === "correct"
                ? "Chính xác! Làm tốt lắm."
                : st === "failed"
                  ? "Đã sai lần thứ 3 — câu này được đánh dấu sai. Hãy làm tiếp và quay lại ở lượt cuối."
                  : mode === "test"
                    ? `Chưa đúng — bạn còn ${Math.max(0, 3 - (wrongAttempts[idx] || 0))} lần trả lời cho câu này.`
                    : "Chưa đúng — xem đối chiếu từng từ bên dưới:"}
            </div>
          )}
          {(st === "wrong" || st === "failed") && (
            <div className="dc-diff-line" lang="ko">
              {diffWords().map((d, i) => (
                <span key={i} className={`dc-diff-word ${d.correct ? "correct" : "wrong"} ${d.missing ? "missing" : ""}`} title={!d.correct && d.expected ? `Đúng: ${d.expected}` : undefined}>
                  {d.correct ? d.word : d.missing ? (
                    <><span>Thiếu:</span><b>{d.expected}</b></>
                  ) : (
                    <><del>{d.word}</del><span className="dc-diff-arrow">→</span><b>{d.expected}</b></>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="dc-actions">
            <button className="dc-act-btn" onClick={skipCurrentQuestion} disabled={questionLocked}><ChevronRight size={15} /> Bỏ qua câu</button>
            <button className="dc-act-btn primary" onClick={check} disabled={!value.trim() || questionLocked}><CheckCircle2 size={15} /> {questionLocked ? "Đã hoàn thành" : "Kiểm tra"}</button>
          </div>
        </div>

        <div className="dc-side">
          <div className="dc-tip-box">
            <div className="dc-tip-title"><Star size={15} fill="#F0C24E" color="#F0C24E" /> Mẹo</div>
            <ul>
              <li>{mode === "practice" ? "Luyện tập chiếm 50% tiến trình và có tối đa 3 gợi ý mỗi câu." : "Kiểm tra chiếm 50% tiến trình, tối đa 2 lượt nghe và 1 gợi ý mỗi câu."}</li>
              <li>Dấu câu và khoảng trắng nhỏ không bị tính sai.</li>
              <li>Nghe theo cụm từ.</li>
            </ul>
            <div className="dc-tip-bunny"><BunnyMascot /></div>
          </div>
          <button className="dc-vocab-box" onClick={onGoVocab}>
            <div className="dc-vocab-title"><BookOpen size={15} /> Từ vựng xuất hiện trong bài</div>
            <div className="dc-vocab-count-wrap">
              <span className="dc-vocab-ico"><BookMarked size={22} color="#7C6FE4" /></span>
              <b>{vocabulary.length}</b>
              <small>từ vựng</small>
            </div>
          </button>
        </div>
      </div>

      <div className="dc-nav">
        <button className="fc-nav-btn" disabled={idx === 0} onClick={() => goto(idx - 1)}>
          <ChevronLeft size={18} /> Câu trước
        </button>
        <div className="fc-dots">
          {orderedLines.map((_, i) => (
            <button
              key={i}
              className={`fc-dot ${i === idx ? "on" : ""} ${status[i] === "correct" ? "rated-good" : status[i] === "wrong" || status[i] === "failed" ? "rated-forgot" : ""}`}
              onClick={() => (i === idx || status[i] === "correct") && goto(i)}
              disabled={i !== idx && status[i] !== "correct"}
              aria-label={`Câu ${i + 1}`}
            />
          ))}
        </div>
        <button className="fc-nav-btn primary" disabled={status[idx] !== "correct" && status[idx] !== "failed"} onClick={() => goNext()}>
          {idx === total - 1 && retryQueue.some((questionIndex) => status[questionIndex] !== "correct") ? "Làm lại câu sai" : idx === total - 1 ? "Hoàn thành" : "Câu tiếp"} <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  APP                                                                */
/* ------------------------------------------------------------------ */
const IMMERSIVE_VIEWS = [
  "lesson-detail", "flashcards", "flashcards-grammar", "flashcards-notebook", "vocab-list",
  "vocab-test-select", "vocab-test-fillblank", "vocab-test-match", "vocab-test-image",
  "shadowing", "dictation", "dictation-mode-select",
  "review-intro", "review-quiz", "review-result", "aiquiz", "study-custom-lesson", "test-custom-lesson",
];

