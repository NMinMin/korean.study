import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Headphones, Target, Volume2, Mic, Sparkles, Lightbulb, CheckCircle2, RotateCcw, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { requestAIJson, transcribeShadowRecording, parseAIJson } from '../../services/aiService';
import { speakKo, playCorrectSound, playIncorrectSound, playCelebrationSound } from '../../services/audioService';
import { renderKo } from '../../utils/textUtils';
import { SwBunnyEmpty, MiniBear } from '../../components/common/Mascots';
import { SHADOW_LINES } from '../../data/fallbackData';
import {
  shadowProgressKey,
  legacyShadowProgressKey,
  readScopedProgress,
  saveScopedProgress
} from '../../services/storageShim';
import { markRemoteActivityCompleted } from '../../lib/activityProgress';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export function DictationModeSelectView({ lesson, onBack, onSelect }) {
  return (
    <section className="card page dictation-mode-page">
      <div className="page-back-heading">
        <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
        <div>
          <div className="card-title"><Headphones size={19} color="#3FA95C" /> Nghe chép chính tả · Bài {lesson.no}</div>
          <p className="dictation-mode-note">Chọn tuyến học phù hợp. Chỉ kết quả trong tuyến Kiểm tra được lưu vào tiến trình.</p>
        </div>
      </div>
      <div className="dictation-mode-grid">
        <button className="dictation-mode-card practice" onClick={() => onSelect("practice")}>
          <span className="dictation-mode-icon"><Headphones size={27} /></span>
          <strong>Luyện tập</strong>
          <p>Nghe không giới hạn, dùng gợi ý và luyện từng câu. Không ảnh hưởng tiến trình.</p>
          <span>Bắt đầu luyện <ChevronRight size={16} /></span>
        </button>
        <button className="dictation-mode-card test" onClick={() => onSelect("test")}>
          <span className="dictation-mode-icon"><Target size={27} /></span>
          <strong>Kiểm tra</strong>
          <p>Mỗi câu chỉ được nghe tối đa 2 lần. Câu đúng được lưu để tiếp tục ở lần sau.</p>
          <span>Vào kiểm tra <ChevronRight size={16} /></span>
        </button>
      </div>
    </section>
  );
}





/* Worker AI chấm transcript tiếng Hàn; lỗi mạng sẽ dùng bộ chấm cục bộ. */
async function gradeWithAI(target, said, realPron, timing = {}) {
  const prompt = `Bạn là giáo viên tiếng Hàn chấm bài luyện nói (shadowing) cho người Việt học tiếng Hàn.

Câu mẫu (đáp án đúng): "${target}"
${realPron ? `Cách đọc thực tế đúng chuẩn (có biến âm/liên âm): "${realPron}"\n` : ""}Transcript nhận diện từ giọng học viên: "${said}"
Thời gian phản xạ: ${Math.round((timing.elapsed || 0) * 10) / 10} giây; giới hạn: ${timing.limit || "không có"} giây.

Chấm dựa trên độ khớp transcript, độ đầy đủ và thời gian phản xạ. Không được khẳng định đã phân tích âm sắc/acoustic vì đầu vào là transcript.

Phân tích và trả lời CHỈ bằng JSON theo đúng cấu trúc sau, không thêm markdown hay chữ nào khác ngoài JSON:
{
  "score": <số nguyên 0-100, mức độ chính xác so với câu mẫu>,
  "words": [{"word": "<từng từ trong câu mẫu, đúng thứ tự>", "status": "ok" hoặc "missing" hoặc "wrong"}],
  "strength": "<1 câu ngắn, tiếng Việt, khen cụ thể điều học viên làm tốt>",
  "tip": "<1-2 câu gợi ý cụ thể để cải thiện, tiếng Việt, giọng khích lệ, nhẹ nhàng. Nếu có thể, liên hệ đúng quy tắc biến âm/liên âm ở cách đọc thực tế phía trên. Nếu lỗi rơi vào các điểm người Việt hay nhầm khi học tiếng Hàn (phụ âm căng ㄲㄸㅃㅆㅉ so với thường/bật hơi, phụ âm cuối 받침 không được đọc bật hơi, độ dài nguyên âm), hãy chỉ rõ đúng điểm đó thay vì nói chung chung.">
}`;

  const { value: parsed, model } = await requestAIJson(prompt);
  if (typeof parsed.score !== "number" || !Array.isArray(parsed.words)) throw new Error("malformed AI response");
  const statuses = new Set(["ok", "missing", "wrong"]);
  return {
    ...parsed,
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    words: parsed.words.map((word) => ({ ...word, status: statuses.has(word.status) ? word.status : "wrong" })),
    source: "worker-ai",
    model,
  };
}

/* Rơi về khi API lỗi — vẫn cho kết quả hữu ích, chỉ đơn giản hơn */
function gradeLocally(target, said) {
  const cmp = compareSpeech(target, said);
  const fb = feedbackFor(cmp.score, cmp.wordResults.some((w) => w.ok) || cmp.extraWords.length > 0);
  return {
    score: cmp.score,
    words: cmp.wordResults.map((w) => ({ word: w.word, status: w.ok ? "ok" : "missing" })),
    strength: cmp.score >= 70 ? "Bạn nói đúng phần lớn từ trong câu." : "Bạn đã thử nói theo câu mẫu — cứ tiếp tục luyện tập nhé.",
    tip: fb.msg,
    source: "local",
  };
}

/* Đánh giá năng lực tổng quan — tổng hợp điểm nhịp điệu (mọi lúc đều có,
   không cần mic) và điểm chính xác từ (nếu người dùng có dùng Bước 2 AI
   chấm) thành 1 nhận xét trình độ tổng thể, giống tính năng AI feedback
   của app 4You nhưng dựa trên cả 2 nguồn dữ liệu thay vì chỉ phát âm. */
async function assessAbility(sessionLog) {
  const summary = sessionLog
    .map((s, i) => `Câu ${i + 1}: nhịp điệu ${s.rhythmScore}%` + (s.accuracyScore != null ? `, độ chính xác từ ${s.accuracyScore}%` : " (chưa dùng AI chấm chi tiết)"))
    .join("\n");

  const prompt = `Bạn là giáo viên tiếng Hàn, nhận xét năng lực nói/shadowing của một học viên người Việt dựa trên kết quả luyện tập sau:

${summary}

Trả lời CHỈ bằng JSON, không thêm markdown hay chữ nào khác ngoài JSON:
{
  "level": "<một trong: Mới bắt đầu / Sơ cấp / Trung cấp / Khá tốt / Tốt>",
  "summary": "<2-3 câu tiếng Việt nhận xét tổng quan năng lực, giọng khích lệ, dựa trên số liệu thật>",
  "focus": "<1-2 câu gợi ý cụ thể nên tập trung luyện gì tiếp theo>"
}`;

  const { value: parsed } = await requestAIJson(prompt);
  if (!parsed.level || !parsed.summary) throw new Error("malformed ability response");
  return parsed;
}

/* ------------------------------------------------------------------ */
/*  SHADOWING VIEW                                                     */
/* ------------------------------------------------------------------ */


const correctDictationResults = (saved = {}) => Object.fromEntries(
  Object.entries(saved).filter(([, value]) => value === "correct"),
);
const activityCompletionKey = (lesson, userId) =>
  lessonProgressKey("activity-completion", lesson, userId);

async function markActivityCompleted(lesson, userId, activityId) {
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

async function isActivityMarkedCompleted(lesson, userId, activityId) {
  try {
    const saved = await window.storage.get(activityCompletionKey(lesson, userId));
    return !!(saved?.value && JSON.parse(saved.value)?.[activityId]);
  } catch (e) { return false; }
}


/* ------------------------------------------------------------------ */
/*  SHADOWING — thiết kế theo mẫu: câu + dịch, Nghe câu/Mic/Ghi âm lại, */
/*  kết quả mới nhất (waveform + Accuracy + chip từng từ + gợi ý AI),   */
/*  và panel "Hỗ trợ học tập" (Ngắt nhịp / Phát âm thực tế / Chú ý).    */
/* ------------------------------------------------------------------ */
const swFormatTime = (s) => {
  if (!isFinite(s) || s < 0) return "00:00";
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

function SwWaveBars() {
  const heights = [6, 10, 16, 9, 22, 13, 19, 10, 25, 15, 21, 12, 8, 17, 23, 14, 10, 19, 15, 7, 20, 12, 17, 9, 14, 22, 10, 15, 19, 7];
  return (
    <svg viewBox="0 0 300 28" width="100%" height="28" preserveAspectRatio="none" aria-hidden="true">
      {heights.map((h, i) => (
        <rect key={i} x={i * 10} y={14 - h / 2} width="5" height={h} rx="2" fill="#C9BCF2" />
      ))}
    </svg>
  );
}



export default function ShadowingView({ lesson, userId, lines = SHADOW_LINES, onBack, onFinish, onProgress }) {
  const [idx, setIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | recording | grading | done | error | unsupported
  const [results, setResults] = useState({});
  const [history, setHistory] = useState([]);
  const [errMsg, setErrMsg] = useState("");
  const [helpPanel, setHelpPanel] = useState(null); // null | "break" | "pron" | "tips"
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordedUrls, setRecordedUrls] = useState({}); // { [idx]: blob url } — bản ghi âm THẬT của người dùng để nghe lại
  const [recordedDurations, setRecordedDurations] = useState({});
  const [showCompletion, setShowCompletion] = useState(false);
  const [finalAssessment, setFinalAssessment] = useState(null);
  const [assessingFinal, setAssessingFinal] = useState(false);
  const [isRecheck, setIsRecheck] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false); // getUserMedia bị chặn (thường do khung xem trước) — chỉ ảnh hưởng phần ghi âm để nghe lại, không chặn chấm điểm AI
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const autoPlayTimer = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordedUrlsRef = useRef({});
  const mediaStreamRef = useRef(null);
  const recordingBlobPromiseRef = useRef(null);
  const recordingBlobResolveRef = useRef(null);
  const myRecAudioRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const recordingIntervalRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  const recognizedTextRef = useRef("");
  const recognitionBaseTextRef = useRef("");
  const recognitionRestartTimerRef = useRef(null);
  const recordingFinishingRef = useRef(false);

  const line = lines[idx];
  const total = lines.length;
  const result = results[idx];
  const shadowQuestionDone = result?.score >= 80;
  // Cho người học thêm 3 giây so với thời lượng câu mẫu để lấy hơi và kết câu.
  // Audio chưa tải metadata thì ước lượng theo độ dài câu, tránh giới hạn bằng 0.
  const estimatedSampleDuration = Math.max(2, line.ko.length / 6);
  const recordingLimit = Math.max(4, Math.ceil((audioDuration || estimatedSampleDuration) + 3));

  const speechSupported =
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    let active = true;
    Promise.all([
      readScopedProgress(shadowProgressKey(lesson, userId), legacyShadowProgressKey(lesson), userId),
      loadRemoteActivityProgress(lesson?.id),
    ]).then(([saved, remoteRows]) => {
      if (!active) return;
      try {
        const localResults = saved?.value ? JSON.parse(saved.value) : {};
        const remoteResults = remoteRows.find((row) => row.activityType === "shadowing")?.completedItems || {};
        const restored = Object.fromEntries(
          Object.entries({ ...localResults, ...remoteResults }).filter(([, item]) => item?.score >= 80),
        );
        if (!Object.keys(restored).length) return;
        window.storage.set(shadowProgressKey(lesson, userId), JSON.stringify(restored)).catch(() => { });
        setResults(restored);
        setHistory(Object.entries(restored).map(([key, item]) => ({
          no: lines[Number(key)]?.no || Number(key) + 1,
          ko: lines[Number(key)]?.ko || "",
          score: item.score,
        })).reverse().slice(0, 12));
        if (lines.every((_, questionIndex) => restored[questionIndex]?.score >= 80)) finishAndAssess(restored);
      } catch (error) { /* dữ liệu cũ không hợp lệ thì bắt đầu phiên mới */ }
    });
    return () => { active = false; };
  }, [lesson, userId]);

  useEffect(() => {
    setErrMsg("");
    setStatus("idle");
    setHelpPanel(null);
    setAudioTime(0);
    setRecordingElapsed(0);
    clearInterval(recordingIntervalRef.current);
    clearTimeout(recordingTimeoutRef.current);
    clearTimeout(autoAdvanceRef.current);
    clearTimeout(recognitionRestartTimerRef.current);
    recordingFinishingRef.current = false;
    recognizedTextRef.current = "";
    recognitionBaseTextRef.current = "";
  }, [idx]);

  useEffect(() => () => {
    clearInterval(recordingIntervalRef.current);
    clearTimeout(recordingTimeoutRef.current);
    clearTimeout(autoAdvanceRef.current);
    clearTimeout(recognitionRestartTimerRef.current);
    try { recognitionRef.current?.abort(); } catch (e) { }
    Object.values(recordedUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // Tự động phát khi bật "Tự động phát" và mỗi khi chuyển câu
  useEffect(() => {
    if (!autoPlay) return;
    clearTimeout(autoPlayTimer.current);
    autoPlayTimer.current = setTimeout(() => {
      const el = audioRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => { }); }
    }, 350);
    return () => clearTimeout(autoPlayTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, autoPlay]);

  const playNative = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => { });
  };

  const playMyRecording = () => {
    const url = recordedUrls[idx];
    if (!url) return;
    if (!myRecAudioRef.current) myRecAudioRef.current = new Audio();
    myRecAudioRef.current.src = url;
    myRecAudioRef.current.currentTime = 0;
    myRecAudioRef.current.play().catch(() => { });
  };

  // Ghi âm THẬT giọng người dùng (khác với nhận diện giọng nói để AI chấm
  // điểm bên dưới) — để họ có thể tự nghe lại và so sánh với giọng mẫu.
  const startMediaRecording = async () => {
    if (!window.isSecureContext) {
      setMicBlocked(true);
      setErrMsg("Micro chỉ hoạt động trên HTTPS hoặc localhost. Hãy mở bản deploy HTTPS của ứng dụng.");
      setStatus("error");
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicBlocked(true);
      setErrMsg("Trình duyệt này chưa hỗ trợ ghi âm. Hãy cập nhật trình duyệt hoặc kiểm tra quyền Microphone.");
      setStatus("unsupported");
      return false;
    }
    try {
      // Xin quyền và khởi động recorder xong trước khi bật SpeechRecognition.
      // Nếu không chờ bước này, recognition có thể kết thúc trong lúc hộp cấp
      // quyền micro vẫn đang mở, khiến recorder khởi động muộn và không lưu file.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      recordingBlobPromiseRef.current = new Promise((resolve) => { recordingBlobResolveRef.current = resolve; });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported?.(type));
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const recordedDuration = Math.max(0, (Date.now() - recordingStartedAtRef.current) / 1000);
          setRecordedUrls((prev) => {
            if (prev[idx]) URL.revokeObjectURL(prev[idx]);
            const next = { ...prev, [idx]: url };
            recordedUrlsRef.current = next;
            return next;
          });
          setRecordedDurations((prev) => ({ ...prev, [idx]: recordedDuration }));
        }
        stream.getTracks().forEach((t) => t.stop());
        if (mediaStreamRef.current === stream) mediaStreamRef.current = null;
        if (mediaRecorderRef.current === mr) mediaRecorderRef.current = null;
        recordingBlobResolveRef.current?.(blob);
        recordingBlobResolveRef.current = null;
      };
      mr.onerror = () => {
        setErrMsg("Không thể lưu bản ghi âm. Hãy kiểm tra micro rồi thử lại.");
        setStatus("error");
        stream.getTracks().forEach((track) => track.stop());
        recordingBlobResolveRef.current?.(null);
        recordingBlobResolveRef.current = null;
      };
      mediaRecorderRef.current = mr;
      mr.start(250);
      setMicBlocked(false);
      return true;
    } catch (e) {
      setMicBlocked(true);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const permissionDenied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      const noDevice = e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError";
      setErrMsg(permissionDenied
        ? "Ứng dụng chưa được cấp quyền micro. Hãy cho phép Microphone trong cài đặt trang rồi tải lại trang."
        : noDevice
          ? "Không tìm thấy micro trên thiết bị. Hãy kết nối micro rồi thử lại."
          : `Không thể mở micro${e?.message ? `: ${e.message}` : ". Hãy thử lại."}`);
      setStatus("error");
      recordingBlobResolveRef.current?.(null);
      recordingBlobResolveRef.current = null;
      return false;
    }
  };
  const stopMediaRecording = () => {
    const recorder = mediaRecorderRef.current;
    try {
      if (recorder?.state === "recording" || recorder?.state === "paused") recorder.stop();
    } catch (e) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingBlobResolveRef.current?.(null);
      recordingBlobResolveRef.current = null;
    }
    return recordingBlobPromiseRef.current || Promise.resolve(null);
  };

  const releaseRecordedAudio = () => {
    setRecordedUrls((current) => {
      Object.values(current).forEach((url) => { try { URL.revokeObjectURL(url); } catch (error) { } });
      return {};
    });
    recordedChunksRef.current = [];
    try { myRecAudioRef.current?.pause(); } catch (error) { }
    if (myRecAudioRef.current) myRecAudioRef.current.src = "";
  };

  const finishAndAssess = async (completedResults) => {
    setShowCompletion(true);
    setAssessingFinal(true);
    setFinalAssessment(null);
    try {
      const assessment = await assessAbility(lines.map((_, questionIndex) => ({
        rhythmScore: completedResults[questionIndex]?.score || 0,
        accuracyScore: completedResults[questionIndex]?.score || 0,
      })));
      setFinalAssessment(assessment);
    } catch (error) {
      const average = Math.round(Object.values(completedResults).reduce((sum, item) => sum + (item.score || 0), 0) / total);
      setFinalAssessment({
        level: average >= 90 ? "Khá tốt" : "Đạt yêu cầu",
        summary: `Bạn đã hoàn thành toàn bộ ${total} câu với điểm trung bình ${average}%.`,
        focus: "Hãy nghe lại giọng mẫu định kỳ để giữ nhịp và phát âm ổn định.",
      });
    } finally {
      setAssessingFinal(false);
      releaseRecordedAudio();
    }
  };

  useEffect(() => () => {
    stopMediaRecording();
    Object.values(recordedUrls).forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitForGrading = async (said) => {
    setStatus("grading");
    setErrMsg("");
    let graded;
    try {
      graded = await gradeWithAI(line.ko, said, line.realPron, {
        elapsed: recordingElapsed,
        limit: recordingLimit,
      });
    } catch (e) {
      graded = gradeLocally(line.ko, said);
      graded.warning = "Dịch vụ AI đang bận nên kết quả này được chấm dự phòng trên thiết bị.";
    }
    const gradedResult = { transcript: said, ...graded, recordingDuration: recordingElapsed, gradedAt: new Date().toISOString() };
    const nextResults = { ...results, [idx]: gradedResult };
    if (graded.score >= 80 && !(results[idx]?.score >= 80)) playCorrectSound();
    else if (graded.score < 80) playIncorrectSound();
    setResults((current) => {
      const next = { ...current, [idx]: gradedResult };
      if (graded.score >= 80) {
        const passed = Object.fromEntries(Object.entries(next).filter(([, item]) => item.score >= 80));
        if (!isRecheck || Object.keys(passed).length === total) {
          window.storage.set(shadowProgressKey(lesson, userId), JSON.stringify(passed)).catch(() => { });
          saveRemoteActivityProgress(lesson.textbookId, lesson.id, "shadowing", passed, total)
            .then((percent) => onProgress?.("shadowing", percent))
            .catch(() => { });
        }
      }
      return next;
    });
    setHistory((h) => [{ no: line.no, ko: line.ko, score: graded.score }, ...h].slice(0, 12));
    setStatus("done");
    if (graded.score >= 80) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = window.setTimeout(() => {
        if (idx < total - 1) {
          setIdx(idx + 1);
        } else if (lines.every((_, questionIndex) => nextResults[questionIndex]?.score >= 80)) {
          finishAndAssess(nextResults);
        }
      }, 900);
    }
  };

  const finishRecording = async (reason = "manual") => {
    if (recordingFinishingRef.current) return;
    recordingFinishingRef.current = true;
    clearInterval(recordingIntervalRef.current);
    clearTimeout(recordingTimeoutRef.current);
    clearTimeout(recognitionRestartTimerRef.current);
    if (reason === "timeout") setRecordingElapsed(recordingLimit);
    const recordingBlobPromise = stopMediaRecording();
    try { recognitionRef.current?.stop(); } catch (e) { }
    setStatus("grading");

    // Chờ recorder đóng file và SpeechRecognition trả nốt transcript. Bản ghi
    // luôn được gửi qua backend để Chrome, Edge và Safari có cùng kết quả.
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    const recordingBlob = await recordingBlobPromise;
    let said = recognizedTextRef.current.trim();
    if (recordingBlob?.size) {
      try {
        const cloudResult = await transcribeShadowRecording(recordingBlob);
        if (cloudResult?.transcript?.trim()) said = cloudResult.transcript.trim();
      } catch (error) {
        if (!said) {
          setErrMsg(error?.message || "Không thể nhận diện bản ghi âm. Hãy thử lại nhé.");
          setStatus("error");
          return;
        }
      }
    }
    if (!said) {
      setErrMsg(reason === "timeout"
        ? "Đã hết thời gian nhưng chưa nhận được giọng nói. Hãy thử lại và nói gần micro hơn nhé."
        : "Chưa nhận được giọng nói. Hãy thử lại và nói gần micro hơn nhé.");
      setStatus("error");
      return;
    }
    await submitForGrading(said);
  };

  const startRecordingClock = () => {
    setErrMsg("");
    setRecordingElapsed(0);
    recognizedTextRef.current = "";
    recognitionBaseTextRef.current = "";
    recordingFinishingRef.current = false;
    setStatus("recording");
    recordingStartedAtRef.current = Date.now();
    recordingIntervalRef.current = window.setInterval(() => {
      const elapsed = Math.min(recordingLimit, (Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordingElapsed(elapsed);
    }, 100);
    recordingTimeoutRef.current = window.setTimeout(() => finishRecording("timeout"), recordingLimit * 1000);
  };

  const startRecording = () => {
    if (!speechSupported) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;

    rec.onresult = (e) => {
      let sessionText = "";
      for (let i = 0; i < e.results.length; i += 1) {
        sessionText += `${e.results[i]?.[0]?.transcript || ""} `;
      }
      recognizedTextRef.current = `${recognitionBaseTextRef.current} ${sessionText}`.trim();
    };
    rec.onerror = (e) => {
      if (recordingFinishingRef.current || e.error === "aborted") return;
      // Chrome thường phát no-speech khi người học lấy hơi hoặc bắt đầu nói
      // chậm. Không kết thúc cả bản ghi; onend bên dưới sẽ mở lại nhận diện.
      if (e.error === "no-speech") return;
      // Web Speech chỉ là lớp nhận diện nhanh tùy chọn. Nếu trình duyệt không
      // hỗ trợ hoặc dịch vụ của trình duyệt lỗi, MediaRecorder vẫn tiếp tục và
      // backend sẽ nhận dạng bản ghi khi người học dừng.
      rec.onend = null;
      recognitionRef.current = null;
    };
    rec.onend = () => {
      if (recordingFinishingRef.current) return;
      // Chrome tự đóng SpeechRecognition khi có một khoảng lặng. Recorder vẫn
      // đang chạy nên nối lại nhận diện cho tới lúc người học bấm dừng hoặc hết
      // giới hạn, đồng thời giữ phần transcript đã nhận ở phiên trước.
      recognitionBaseTextRef.current = recognizedTextRef.current.trim();
      const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000;
      if (elapsed < recordingLimit - 0.25) {
        clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = window.setTimeout(() => {
          if (recordingFinishingRef.current) return;
          try { rec.start(); }
          catch (error) { finishRecording("browser"); }
        }, 120);
        return;
      }
      finishRecording("timeout");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      return true;
    } catch (err) {
      return false;
    }
  };

  /* Nút mic dùng chung cho cả bắt đầu, dừng+chấm điểm, VÀ ghi âm lại —
     bấm khi đang ghi thì dừng (tự động chấm điểm), bấm khi đã có kết quả
     thì xoá kết quả cũ và ghi âm lại từ đầu, không cần nút riêng. */
  const handleMicClick = async () => {
    if (status === "recording") { finishRecording("manual"); return; }
    if (shadowQuestionDone) return;
    if (result) setResults((r) => { const n = { ...r }; delete n[idx]; return n; });
    setErrMsg("");
    setStatus("requesting");
    const mediaStarted = await startMediaRecording();
    if (!mediaStarted) return;
    startRecordingClock();
    startRecording();
  };

  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };
  const goNext = () => {
    if (!result || result.score < 80) return;
    if (idx < total - 1) { setIdx(idx + 1); return; }
    if (lines.every((_, questionIndex) => results[questionIndex]?.score >= 80)) finishAndAssess(results);
  };

  const retryShadowing = () => {
    setShowCompletion(false);
    setIsRecheck(true);
    setFinalAssessment(null);
    setResults({});
    setHistory([]);
    setIdx(0);
    setStatus("idle");
  };

  if (showCompletion) {
    return (
      <SkillCompletionView
        title="Bạn đã hoàn thành Shadowing!"
        description="Tất cả câu đã đạt mức chính xác yêu cầu. Bạn có muốn luyện kiểm tra lại không?"
        assessment={finalAssessment}
        loading={assessingFinal}
        onBack={isRecheck ? onBack : (onFinish || onBack)}
        onRetry={retryShadowing}
      />
    );
  }

  return (
    <section className="sw-page">
      <div className="sw-topbar">
        <button className="fc2-back" onClick={onBack} aria-label="Về bài học"><ChevronLeft size={20} /></button>
        <span className="fc2-title"><Headphones size={18} color="#7C6FE4" /> Shadowing</span>
        <span className="sw-lesson-pill"><BookOpen size={13} /> Bài {String(lesson.no).padStart(2, "0")}</span>
        <div className="sw-top-progress">
          <span className="sw-progress-text">Câu {idx + 1} / {total}</span>
          <div className="fc2-progress-bar"><div style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>
        </div>
        <span className="fc2-pill"><Flame size={13} color="#F0642E" fill="#F79A5E" /> <UserStreakCount /></span>
        <span className="fc2-pill gem"><DiamondIcon size={14} /> <UserGemCount /></span>
      </div>

      <div className="sw-body">
        {/* ===== CỘT CHÍNH ===== */}
        <div className="sw-main">
          <audio
            key={idx}
            ref={audioRef}
            src={line.audio}
            preload="metadata"
            onTimeUpdate={(e) => setAudioTime(e.target.currentTime)}
            onLoadedMetadata={(e) => setAudioDuration(e.target.duration)}
          />

          <div className="sw-card">
            <div className="sw-card-top">
              <button className={`sw-autoplay ${autoPlay ? "on" : ""}`} onClick={() => setAutoPlay((a) => !a)}>
                <Volume2 size={13} /> Tự động phát
              </button>
            </div>

            <div className="sw-sentence-row">
              <h2 className="sw-ko" lang="ko">{line.ko}</h2>
              <button className="sw-mini-play" onClick={playNative} aria-label="Nghe câu">
                <Volume2 size={16} color="#fff" />
              </button>
            </div>
            <p className="sw-vi">{line.vi}</p>

            <div className="sw-divider" />

            <div className="sw-controls">
              <button className="sw-side-ctrl" onClick={playNative}>
                <Volume2 size={20} color="#7C6FE4" />
                <span>Nghe câu</span>
              </button>
              <button
                className={`sw-mic-btn ${status === "recording" ? "rec" : ""} ${status === "requesting" ? "requesting" : ""}`}
                onClick={handleMicClick}
                disabled={status === "grading" || status === "requesting" || shadowQuestionDone}
                aria-label={status === "requesting" ? "Đang xin quyền micro" : status === "recording" ? "Dừng và chấm điểm" : shadowQuestionDone ? "Câu đã hoàn thành" : result ? "Ghi âm lại" : "Bắt đầu ghi âm"}
              >
                {status === "recording" ? (
                  <Square size={22} color="#fff" fill="#fff" />
                ) : shadowQuestionDone ? (
                  <CheckCircle2 size={25} color="#fff" />
                ) : result ? (
                  <RotateCcw size={24} color="#fff" />
                ) : (
                  <Mic size={26} color="#fff" />
                )}
              </button>
              <button className="sw-side-ctrl" onClick={playMyRecording} disabled={!recordedUrls[idx]} aria-label={recordedUrls[idx] ? "Nghe lại bản ghi của tôi" : "Chưa có bản ghi của tôi"}>
                <Mic size={20} color="#7C6FE4" />
                <span>Nghe lại</span>
              </button>
            </div>
            <p className="sw-mic-caption">
              {status === "requesting"
                ? "Đang mở micro..."
                : status === "recording"
                  ? "Đang ghi âm... bấm lại để dừng & chấm điểm"
                  : status === "grading"
                    ? "AI đang chấm điểm..."
                    : shadowQuestionDone
                      ? "Câu đã hoàn thành — hãy sang câu tiếp theo"
                      : result
                        ? "Bấm mic để ghi âm lại"
                        : "Nhấn mic rồi nói theo câu trên"}
            </p>
            <p className={`sw-timer ${status === "recording" ? "is-recording" : ""} ${status === "recording" && recordingLimit - recordingElapsed <= 2 ? "is-ending" : ""}`}>
              {swFormatTime(recordingElapsed)} / {swFormatTime(recordingLimit)}
            </p>

            {status === "unsupported" && (
              <div className="sw-unsupported">
                <AlertTriangle size={16} color="#E8912E" />
                Trình duyệt này chưa hỗ trợ nhận diện giọng nói — cần dùng Chrome/Edge trên máy tính.
              </div>
            )}
            {status === "error" && (
              <div className="sw-unsupported err"><AlertTriangle size={16} color="#D64545" />{errMsg}</div>
            )}

            {result && status !== "grading" && (
              <div className="sw-result">
                <div className="sw-result-head"><Sparkles size={14} color="#7C6FE4" /> Kết quả mới nhất</div>
                <div className="sw-result-row">
                  <button className="sw-result-play" onClick={playNative} aria-label="Nghe lại câu mẫu">
                    <Play size={16} fill="#fff" color="#fff" />
                  </button>
                  <div className="sw-result-wave"><SwWaveBars /></div>
                  <span className="sw-result-time">{swFormatTime(audioDuration)}</span>
                  <div className="sw-accuracy">
                    <span>Độ khớp câu</span>
                    <b className={toneForScore(result.score)}>{result.score}%</b>
                  </div>
                </div>
                <div className="sw-ai-feedback">
                  <div className="sw-ai-meta">
                    <span className={`sw-ai-badge ${result.source === "worker-ai" ? "" : "fallback"}`}>
                      <Sparkles size={12} /> {result.source === "worker-ai" ? "AI chấm điểm" : "Chấm dự phòng"}
                    </span>
                    {result.source === "worker-ai" && result.model && <span className="sw-ai-model">{result.model}</span>}
                  </div>
                  <p><strong>AI nhận diện:</strong> <span lang="ko">{result.transcript}</span></p>
                  {result.strength && <p><strong>Điểm tốt:</strong> {result.strength}</p>}
                  {result.warning && <p className="sw-ai-warning">{result.warning}</p>}
                </div>
                <div className="sw-compare-row">
                  <button className="sw-compare-btn" onClick={playNative}>
                    <Volume2 size={14} /> Giọng mẫu
                  </button>
                  <button className="sw-compare-btn mine" onClick={playMyRecording} disabled={!recordedUrls[idx]}>
                    <Mic size={14} /> {recordedUrls[idx] ? "Giọng của tôi" : micBlocked ? "Không có quyền micro để ghi lại" : "Chưa có bản ghi"}
                  </button>
                </div>
                <div className="sw-word-chips">
                  {(result.words || []).map((w, i) => (
                    <span key={i} className={`sw-chip ${w.status}`}>
                      {w.word} {w.status === "ok" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    </span>
                  ))}
                </div>
                <div className={`sw-score-state ${toneForScore(result.score)}`}>
                  {result.score >= 80
                    ? <><CheckCircle2 size={15} /> Chính xác — bạn có thể sang câu tiếp theo.</>
                    : result.score >= 60
                      ? <><AlertTriangle size={15} /> Gần đúng — nghe lại và ghi âm thêm một lần nhé.</>
                      : <><XCircle size={15} /> Chưa đúng — đối chiếu các từ màu đỏ rồi thử lại.</>}
                </div>
                <p className="sw-tip"><Lightbulb size={14} color="#E8A93D" fill="#F7D98B" /> {result.tip}</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== CỘT PHỤ ===== */}
        <div className="sw-side">
          <div className="sw-help-card">
            <div className="sw-help-title">Hỗ trợ học tập</div>
            <div className="sw-help-btns">
              <button className={helpPanel === "break" ? "on" : ""} onClick={() => setHelpPanel((p) => (p === "break" ? null : "break"))}>
                <span className="sw-help-ico"><Scissors size={18} color="#7C6FE4" /></span>
                Ngắt nhịp
              </button>
              <button className={helpPanel === "pron" ? "on" : ""} onClick={() => setHelpPanel((p) => (p === "pron" ? null : "pron"))}>
                <span className="sw-help-ico blue"><Smile size={18} color="#4A90E2" /></span>
                Phát âm thực tế
              </button>
              <button className={helpPanel === "tips" ? "on" : ""} onClick={() => setHelpPanel((p) => (p === "tips" ? null : "tips"))}>
                <span className="sw-help-ico gold"><Lightbulb size={18} color="#E8912E" /></span>
                Chú ý Shadowing
              </button>
            </div>
            {helpPanel === null && <p className="sw-help-hint">Chọn một mục ở trên để xem nội dung ↗</p>}
            {helpPanel === "break" && <p className="sw-help-content" lang="ko">{line.rhythmBreak}</p>}
            {helpPanel === "pron" && <p className="sw-help-content" lang="ko">{line.realPron}</p>}
            {helpPanel === "tips" && (
              <ul className="sw-tips-list">
                {line.tips.map((t, i) => (<li key={i}>{renderKo(t)}</li>))}
              </ul>
            )}
          </div>

          <div className="sw-history-card">
            <div className="sw-help-title"><Sparkles size={14} color="#7C6FE4" /> Lịch sử kết quả</div>
            {history.length === 0 ? (
              <div className="sw-history-empty">
                <SwBunnyEmpty />
                <p>Luyện tập vài câu để xem lịch sử kết quả tại đây nhé</p>
              </div>
            ) : (
              <div className="sw-history-list">
                {history.map((h, i) => (
                  <div key={i} className="sw-history-item">
                    <span className="sw-history-ko" lang="ko">{h.ko}</span>
                    <span className={`sw-history-score ${toneForScore(h.score)}`}>{h.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fc-nav">
        <button className="fc-nav-btn" disabled={idx === 0} onClick={goPrev}><ChevronLeft size={18} /> Câu trước</button>
        <div className="fc-dots">
          {lines.map((l, i) => (
            <button
              key={l.no}
              className={`fc-dot ${i === idx ? "on" : ""} ${results[i] ? (results[i].score >= 80 ? "rated-good" : results[i].score >= 60 ? "rated-vague" : "rated-forgot") : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Câu ${i + 1}`}
            />
          ))}
        </div>
        <button
          className="fc-nav-btn primary"
          disabled={!result || result.score < 80 || status === "grading" || status === "recording"}
          title={!result || result.score < 80 ? "Hãy ghi âm lại đến khi câu đạt từ 80 điểm" : undefined}
          onClick={goNext}
        >
          {idx === total - 1 ? "Hoàn thành" : "Câu tiếp"} <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  ÔN TẬP CUỐI BÀI — ngân hàng câu hỏi tạo từ chính dữ liệu thật của   */
/*  bài học (28 từ vựng + 2 ngữ pháp + 6 câu Shadowing). Mỗi lần vào    */
/*  ôn tập sẽ xáo trộn & chọn ngẫu nhiên 10 câu trong ngân hàng này,     */
/*  nên "mỗi lần một khác" dù nội dung gốc không đổi.                   */
/* ------------------------------------------------------------------ */
