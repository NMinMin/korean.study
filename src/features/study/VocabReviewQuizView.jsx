import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  BookOpen,
  Award,
  CalendarCheck,
  Check,
  X,
} from 'lucide-react';
import {
  speakKo,
  playCorrectSound,
  playIncorrectSound,
  playCelebrationSound,
} from '../../services/audioService';
import { requestAIJson } from '../../services/aiService';
import { saveVocabularyReviewResult } from '../../lib/reviewSchedule';

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuizQuestions(words, catalogVocabulary = []) {
  if (!words || !words.length) return [];

  // Tạo pool các từ khác để làm distractors
  const allPool = [...words];
  if (catalogVocabulary && catalogVocabulary.length) {
    catalogVocabulary.forEach((cv) => {
      if (!allPool.some((w) => (w.word || w.word_ko) === (cv.word || cv.word_ko))) {
        allPool.push({
          word: cv.word || cv.word_ko,
          meaningVi: cv.meaning || cv.meaningVi || cv.meaning_vi,
          pron: cv.pronunciation || cv.pron,
          audio: cv.audio || cv.audio_url,
          type: cv.partOfSpeech || cv.part_of_speech || cv.type,
          mnemonic: cv.mnemonic,
        });
      }
    });
  }

  const questions = [];

  words.forEach((w, i) => {
    const wordKo = w.word || w.word_ko || '';
    const meaningVi = w.meaningVi || w.meaning_vi || w.meaning || '';
    if (!wordKo || !meaningVi) return;

    // Chọn kiểu câu hỏi: luân phiên hoặc ngẫu nhiên
    // 0: Nghĩa tiếng Việt (từ tiếng Hàn -> chọn nghĩa)
    // 1: Từ tiếng Hàn (nghĩa tiếng Việt -> chọn từ tiếng Hàn)
    // 2: Nghe phát âm -> chọn nghĩa tiếng Việt
    const mode = i % 3;

    if (mode === 0 || mode === 2) {
      // Dạng chọn nghĩa tiếng Việt
      const otherMeanings = shuffle(
        allPool
          .map((item) => item.meaningVi || item.meaning_vi || item.meaning)
          .filter((m) => m && m.trim() !== meaningVi.trim())
      );
      const wrongOptions = otherMeanings.slice(0, 3);
      const options = shuffle([meaningVi, ...wrongOptions]);

      questions.push({
        id: `q-${i}-${w.id || wordKo}`,
        sourceId: String(w.id || wordKo),
        type: mode === 2 ? 'listening' : 'meaning',
        instruction: mode === 2 ? 'Nghe phát âm và chọn nghĩa đúng:' : 'Chọn nghĩa tiếng Việt của từ:',
        targetWord: wordKo,
        pron: w.pron || w.pronunciation || '',
        audio: w.audio || w.audio_url || '',
        mnemonic: w.mnemonic || '',
        pos: w.type || w.part_of_speech || '',
        correct: meaningVi,
        options,
      });
    } else {
      // Dạng chọn từ tiếng Hàn
      const otherWords = shuffle(
        allPool
          .map((item) => item.word || item.word_ko)
          .filter((word) => word && word.trim() !== wordKo.trim())
      );
      const wrongOptions = otherWords.slice(0, 3);
      const options = shuffle([wordKo, ...wrongOptions]);

      questions.push({
        id: `q-${i}-${w.id || wordKo}`,
        sourceId: String(w.id || wordKo),
        type: 'word',
        instruction: 'Chọn từ tiếng Hàn mang nghĩa:',
        promptVi: meaningVi,
        targetWord: wordKo,
        pron: w.pron || w.pronunciation || '',
        audio: w.audio || w.audio_url || '',
        mnemonic: w.mnemonic || '',
        pos: w.type || w.part_of_speech || '',
        correct: wordKo,
        options,
      });
    }
  });

  return shuffle(questions);
}

async function buildAIQuizQuestions(words, catalogVocabulary) {
  const fallback = buildQuizQuestions(words, catalogVocabulary);
  const sourceMap = new Map(words.map((word) => [String(word.id || word.word), word]));
  const sources = words.map((word) => ({
    id: String(word.id || word.word),
    word: word.word,
    meaningVi: word.meaningVi,
    partOfSpeech: word.type || '',
  }));
  const prompt = `Bạn là giáo viên tiếng Hàn. Hãy tạo đúng ${sources.length} câu trắc nghiệm mới để kiểm tra các từ trong danh sách.
- Mỗi sourceId xuất hiện đúng một lần.
- Chỉ dùng kiến thức trong danh sách, không bịa nghĩa.
- Trộn dạng chọn nghĩa, chọn từ, điền từ và ngữ cảnh ngắn.
- Mỗi câu có đúng 4 lựa chọn khác nhau, chỉ một đáp án đúng.
- Trả về duy nhất JSON: {"questions":[{"sourceId":"id","type":"meaning|word|context","instruction":"hướng dẫn","question":"nội dung","options":["A","B","C","D"],"correctIndex":0}]}.
Dữ liệu: ${JSON.stringify(sources)}`;
  try {
    const { value } = await requestAIJson(prompt, { temperature: 0.75 });
    const aiBySource = new Map();
    for (const [index, raw] of (Array.isArray(value?.questions) ? value.questions : []).entries()) {
      const sourceId = String(raw?.sourceId || '');
      const source = sourceMap.get(sourceId);
      const options = Array.isArray(raw?.options) ? raw.options.map((item) => String(item || '').trim()).filter(Boolean) : [];
      const correctIndex = Number(raw?.correctIndex);
      if (!source || !String(raw?.question || '').trim() || options.length !== 4 || new Set(options).size !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
      aiBySource.set(sourceId, {
        id: `ai-review-${sourceId}-${index}-${Date.now()}`,
        isAI: true,
        sourceId,
        type: raw.type === 'word' ? 'word' : 'meaning',
        instruction: String(raw.instruction || 'Chọn đáp án đúng:'),
        question: String(raw.question).trim(),
        targetWord: source.word,
        promptVi: source.meaningVi,
        pron: source.pron || '',
        audio: source.audio || '',
        mnemonic: source.mnemonic || '',
        pos: source.type || '',
        correct: options[correctIndex],
        options,
      });
    }
    return shuffle(fallback.map((question) => aiBySource.get(question.sourceId) || question));
  } catch {
    return fallback;
  }
}

function fallbackEvaluation(correctCount, totalCount) {
  const score = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
  const rating = score === 100 ? 'Perfect' : score >= 70 ? 'Good' : 'Bad';
  return {
    rating,
    score,
    correctCount,
    totalCount,
    feedback: rating === 'Perfect'
      ? 'Bạn ghi nhớ rất chắc toàn bộ nhóm từ hôm nay.'
      : rating === 'Good'
        ? 'Bạn nhớ khá tốt, hãy ôn lại những từ trả lời sai.'
        : 'Bạn cần ôn lại nhóm từ này sớm để củng cố trí nhớ.',
    completedAt: new Date().toISOString(),
  };
}

async function buildAIEvaluation(answers) {
  const correctCount = answers.filter((answer) => answer.correct).length;
  const base = fallbackEvaluation(correctCount, answers.length);
  const prompt = `Bạn là giáo viên tiếng Hàn đánh giá một lượt ôn từ vựng.
Quy ước bắt buộc: 100% = Perfect; từ 70% đến dưới 100% = Good; dưới 70% = Bad.
Hãy nhận xét ngắn bằng tiếng Việt dựa trên kết quả và trả về duy nhất JSON {"rating":"Bad|Good|Perfect","feedback":"một câu nhận xét"}.
Kết quả: ${JSON.stringify(answers.map(({ targetWord, correct }) => ({ word: targetWord, correct })))}`;
  try {
    const { value } = await requestAIJson(prompt, { temperature: 0.3 });
    return { ...base, feedback: String(value?.feedback || base.feedback).trim() };
  } catch {
    return base;
  }
}

export default function VocabReviewQuizView({
  words = [],
  catalogVocabulary = [],
  userId,
  reviewDateKey,
  onBack,
  onFinish,
}) {
  const [selectedWords] = useState(() => shuffle(words).slice(0, 10));
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answersHistory, setAnswersHistory] = useState([]); // [{ questionId, word, correct: bool }]
  const [isDone, setIsDone] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saveError, setSaveError] = useState('');

  const currentQ = questions[currentIndex];

  useEffect(() => {
    let alive = true;
    setLoading(true);
    buildAIQuizQuestions(selectedWords, catalogVocabulary).then((result) => {
      if (alive) setQuestions(result);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [selectedWords, catalogVocabulary]);

  // Phát âm từ hiện tại
  const playWordAudio = (word, audioUrl) => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => {
        speakKo(word);
        setIsPlayingAudio(false);
      };
      audio.play().catch(() => {
        speakKo(word);
        setIsPlayingAudio(false);
      });
    } else {
      speakKo(word);
      setTimeout(() => setIsPlayingAudio(false), 900);
    }
  };

  // Tự động phát âm ở câu hỏi nghe
  useEffect(() => {
    if (currentQ && currentQ.type === 'listening' && !selectedOption) {
      const timer = setTimeout(() => {
        playWordAudio(currentQ.targetWord, currentQ.audio);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentQ?.id]);

  // Âm thanh ăn mừng khi xong
  useEffect(() => {
    if (isDone) {
      const correctCount = answersHistory.filter((a) => a.correct).length;
      if (correctCount >= Math.ceil(questions.length * 0.7)) {
        playCelebrationSound();
      }
    }
  }, [isDone]);

  // Chọn đáp án
  const handleSelectOption = (opt) => {
    if (selectedOption !== null || !currentQ) return;
    setSelectedOption(opt);
    const isCorrect = opt === currentQ.correct;

    if (isCorrect) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }

    setAnswersHistory((prev) => [
      ...prev,
      {
        questionId: currentQ.id,
        sourceId: currentQ.sourceId,
        targetWord: currentQ.targetWord,
        meaning: currentQ.type === 'word' ? currentQ.promptVi : currentQ.correct,
        correct: isCorrect,
      },
    ]);
  };

  // Chuyển sang câu tiếp theo
  const handleNext = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((idx) => idx + 1);
      setSelectedOption(null);
    } else {
      try {
        setEvaluating(true);
        setSaveError('');
        const result = await buildAIEvaluation(answersHistory);
        await saveVocabularyReviewResult(userId, reviewDateKey || new Date().toISOString().slice(0, 10), selectedWords, answersHistory, result);
        setEvaluation(result);
        setIsDone(true);
      } catch {
        setSaveError('Chưa lưu được đánh giá vào lịch. Vui lòng thử lại.');
      } finally {
        setEvaluating(false);
      }
    }
  };

  // Làm lại bài kiểm tra
  const handleRestart = async () => {
    setLoading(true);
    setQuestions(await buildAIQuizQuestions(selectedWords, catalogVocabulary));
    setLoading(false);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswersHistory([]);
    setIsDone(false);
    setEvaluation(null);
    setSaveError('');
  };

  if (loading) {
    return <section className="rv-page"><div className="rv-loading"><Sparkles size={22} color="#7C6FE4" /> AI đang tạo bài kiểm tra từ {selectedWords.length} từ đến lịch ôn...</div></section>;
  }

  if (!questions.length) {
    return (
      <section className="rv-page">
        <div className="rv-quiz-top">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại">
            <ChevronLeft size={20} />
          </button>
          <span className="rv-quiz-title">Kiểm tra ôn tập từ vựng</span>
        </div>
        <div className="cg-empty" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <BookOpen size={48} color="#7C6FE4" style={{ marginBottom: 16 }} />
          <h3>Không có từ vựng nào để ôn</h3>
          <p>Hôm nay bạn chưa có từ nào đến lịch ôn ngắt quãng.</p>
          <button className="fc-nav-btn primary" onClick={onBack} style={{ marginTop: 20 }}>
            Về trang chủ
          </button>
        </div>
      </section>
    );
  }

  // Màn hình kết quả sau khi hoàn thành
  if (isDone) {
    const totalCount = questions.length;
    const correctCount = answersHistory.filter((a) => a.correct).length;
    const pct = Math.round((correctCount / totalCount) * 100);

    return (
      <section className="rv-page" style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
        <div className="rv-quiz-top" style={{ marginBottom: 20 }}>
          <button className="fc2-back" onClick={onFinish} aria-label="Về trang chủ">
            <ChevronLeft size={20} />
          </button>
          <span className="rv-quiz-title">Kết quả kiểm tra ôn tập</span>
        </div>

        <div className="rv-result-card" style={{ textAlign: 'center', padding: '36px 24px', background: '#fff', borderRadius: 24, boxShadow: '0 8px 30px rgba(124,111,228,0.12)' }}>
          <div style={{ display: 'inline-flex', padding: 18, borderRadius: '50%', background: pct >= 70 ? '#EDFBF3' : '#FFF4ED', color: pct >= 70 ? '#32905a' : '#F0912E', marginBottom: 16 }}>
            {pct >= 70 ? <Trophy size={42} /> : <Sparkles size={42} />}
          </div>
          <h2 className="rv-result-grade" style={{ fontSize: 26, color: '#1F1B36', marginBottom: 8 }}>
            {evaluation?.rating || (pct === 100 ? 'Perfect' : pct >= 70 ? 'Good' : 'Bad')}
          </h2>
          {evaluation?.feedback && <p style={{ color: '#6A6385', margin: '-2px 0 14px' }}>{evaluation.feedback}</p>}
          <p className="rv-result-score" style={{ fontSize: 20, color: '#6A6385', marginBottom: 20 }}>
            Đúng <b style={{ color: '#7C6FE4' }}>{correctCount}</b> / {totalCount} từ <span>({pct}%)</span>
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 30 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#EDFBF3', color: '#27834E', fontWeight: 700, fontSize: 13 }}>
              <CheckCircle2 size={16} /> {correctCount} từ nhớ tốt
            </span>
            {totalCount - correctCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#FDEEEE', color: '#D9383A', fontWeight: 700, fontSize: 13 }}>
                <XCircle size={16} /> {totalCount - correctCount} từ cần ôn lại
              </span>
            )}
          </div>

          <div style={{ textAlign: 'left', marginTop: 24, borderTop: '1px solid #ECE7F6', paddingTop: 20 }}>
            <h4 style={{ margin: '0 0 14px', color: '#312B4F', fontSize: 15 }}>Chi tiết các từ vừa kiểm tra:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {answersHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: item.correct ? '#F6FCF8' : '#FEF8F8',
                    border: `1px solid ${item.correct ? '#D2F3DF' : '#FBDCDC'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: item.correct ? '#2CA35D' : '#E04747' }}>
                      {item.correct ? <Check size={16} /> : <X size={16} />}
                    </span>
                    <div>
                      <strong lang="ko" style={{ fontSize: 15, color: '#1F1B36', marginRight: 8 }}>{item.targetWord}</strong>
                      <span style={{ fontSize: 13, color: '#6A6385' }}>{item.meaning}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => playWordAudio(item.targetWord)}
                    style={{ border: 'none', background: 'transparent', color: '#7C6FE4', cursor: 'pointer', padding: 4 }}
                    title="Nghe phát âm"
                  >
                    <Volume2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fc-nav" style={{ marginTop: 24 }}>
          <button className="fc-nav-btn" onClick={handleRestart} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={16} /> Làm lại bài kiểm tra
          </button>
          <button className="fc-nav-btn primary" onClick={onFinish} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarCheck size={16} /> Về trang chủ
          </button>
        </div>
      </section>
    );
  }

  // Màn hình làm câu hỏi kiểm tra
  return (
    <section className="rv-page" style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
      {/* Top bar */}
      <div className="rv-quiz-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại">
            <ChevronLeft size={20} />
          </button>
          <div>
            <span className="rv-quiz-title" style={{ fontSize: 17, fontWeight: 700, color: '#252042' }}>
              Kiểm tra ôn từ vựng
            </span>
            <small style={{ display: 'block', color: '#8881A2', fontSize: 12 }}>
              Lặp lại ngắt quãng · Không ảnh hưởng bài học
            </small>
          </div>
        </div>
        <span className="rv-quiz-count" style={{ fontWeight: 700, color: '#7C6FE4', fontSize: 14 }}>
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="fc2-progress-bar" style={{ height: 6, borderRadius: 3, marginBottom: 24, background: '#EAE6F8', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((currentIndex + 1) / questions.length) * 100}%`,
            background: 'linear-gradient(90deg, #7C6FE4, #9E8CFC)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Question Card */}
      <div className="qz-question-card" style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(124,111,228,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p className="qz-instruction" style={{ margin: 0, color: '#827B9E', fontWeight: 700, fontSize: 13 }}>
            {currentQ.instruction}
          </p>
          {currentQ.pos && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: '#F0EEFC', color: '#7C6FE4', fontWeight: 600 }}>
              {currentQ.pos}
            </span>
          )}
        </div>

        {/* Nội dung câu hỏi */}
        {currentQ.isAI && <h2 className="qz-prompt-ko" style={{ margin: '14px 0 10px', fontSize: 24, color: '#1B1736' }}>{currentQ.question}</h2>}

        {!currentQ.isAI && currentQ.type === 'meaning' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 10px' }}>
            <h2 className="qz-prompt-ko" lang="ko" style={{ margin: 0, fontSize: 32, color: '#1B1736' }}>
              {currentQ.targetWord}
            </h2>
            {currentQ.pron && (
              <span style={{ color: '#8B85AB', fontSize: 15, fontWeight: 500 }}>
                [{currentQ.pron}]
              </span>
            )}
            <button
              type="button"
              className="qz-listen-btn"
              onClick={() => playWordAudio(currentQ.targetWord, currentQ.audio)}
              aria-label="Nghe phát âm"
              style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 12 }}
            >
              <Volume2 size={16} /> Nghe
            </button>
          </div>
        )}

        {!currentQ.isAI && currentQ.type === 'word' && (
          <div style={{ margin: '14px 0 10px' }}>
            <h2 style={{ margin: 0, fontSize: 26, color: '#7C6FE4', fontWeight: 800 }}>
              “{currentQ.promptVi}”
            </h2>
          </div>
        )}

        {!currentQ.isAI && currentQ.type === 'listening' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <button
              type="button"
              className="qz-listen-btn"
              onClick={() => playWordAudio(currentQ.targetWord, currentQ.audio)}
              style={{
                padding: '16px 28px',
                borderRadius: 20,
                fontSize: 16,
                fontWeight: 700,
                background: isPlayingAudio ? '#7C6FE4' : '#F0EEFC',
                color: isPlayingAudio ? '#fff' : '#7C6FE4',
                boxShadow: isPlayingAudio ? '0 6px 20px rgba(124,111,228,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Volume2 size={22} className={isPlayingAudio ? 'spin' : ''} />
              {isPlayingAudio ? 'Đang phát âm…' : 'Bấm để nghe từ'}
            </button>
            <span style={{ fontSize: 13, color: '#9790B5' }}>Bấm vào nút loa để nghe lại âm thanh</span>
          </div>
        )}

        {/* Các phương án lựa chọn */}
        <div className="qz-options" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentQ.options.map((opt, optIdx) => {
            const isPicked = opt === selectedOption;
            const isCorrect = opt === currentQ.correct;

            let borderStyle = '1.5px solid #E3DEF4';
            let bgStyle = '#fff';
            let colorStyle = '#2E2A4A';

            if (selectedOption !== null) {
              if (isCorrect) {
                borderStyle = '1.5px solid #32905a';
                bgStyle = '#EDFBF3';
                colorStyle = '#246D43';
              } else if (isPicked) {
                borderStyle = '1.5px solid #E04747';
                bgStyle = '#FEF2F2';
                colorStyle = '#B32626';
              }
            }

            return (
              <button
                key={optIdx}
                className="qz-option"
                disabled={selectedOption !== null}
                onClick={() => handleSelectOption(opt)}
                style={{
                  border: borderStyle,
                  background: bgStyle,
                  color: colorStyle,
                  borderRadius: 14,
                  padding: '14px 18px',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  cursor: selectedOption !== null ? 'default' : 'pointer',
                }}
                lang={currentQ.type === 'word' ? 'ko' : undefined}
              >
                <span>{opt}</span>
                {selectedOption !== null && isCorrect && (
                  <CheckCircle2 size={18} color="#27834E" />
                )}
                {selectedOption !== null && isPicked && !isCorrect && (
                  <XCircle size={18} color="#D9383A" />
                )}
              </button>
            );
          })}
        </div>

        {/* Phần giải thích & Nút chuyển tiếp */}
        {selectedOption !== null && (
          <div
            style={{
              marginTop: 20,
              padding: '16px 18px',
              borderRadius: 16,
              background: '#F8F7FD',
              border: '1px solid #ECE7F8',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong lang="ko" style={{ fontSize: 18, color: '#1B1736', marginRight: 8 }}>
                  {currentQ.targetWord}
                </strong>
                {currentQ.pron && <span style={{ color: '#8881A2', fontSize: 14 }}>[{currentQ.pron}]</span>}
                <span style={{ marginLeft: 10, color: '#3A3358', fontWeight: 600, fontSize: 14 }}>
                  → {currentQ.type === 'word' ? currentQ.promptVi : currentQ.correct}
                </span>
              </div>
              <button
                type="button"
                onClick={() => playWordAudio(currentQ.targetWord, currentQ.audio)}
                style={{ border: 'none', background: 'transparent', color: '#7C6FE4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
              >
                <Volume2 size={16} /> Nghe lại
              </button>
            </div>

            {currentQ.mnemonic && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#686085' }}>
                💡 <b>Mẹo nhớ:</b> {currentQ.mnemonic}
              </p>
            )}

            <button
              type="button"
              className="fc-nav-btn primary"
              onClick={handleNext}
              disabled={evaluating}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '13px 20px',
                borderRadius: 13,
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {evaluating ? 'AI đang đánh giá...' : currentIndex + 1 >= questions.length ? 'Xem kết quả kiểm tra' : 'Câu tiếp theo'} <ChevronRight size={18} />
            </button>
            {saveError && <p style={{ margin: '10px 0 0', color: '#D64545', fontSize: 13, textAlign: 'center' }}>{saveError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
