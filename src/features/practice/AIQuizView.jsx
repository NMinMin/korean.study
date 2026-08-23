import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { requestAIJson } from '../../services/aiService';
import { playCorrectSound, playIncorrectSound } from '../../services/audioService';
import { renderKo, shuffleArr } from '../../utils/textUtils';
import { VOCAB_SAMPLE, GRAMMAR_SAMPLE } from '../../data/fallbackData';

export async function generateAIQuestion() {
  const vocabSample = shuffleArr(VOCAB_SAMPLE).slice(0, 6).map((w) => `${w.word} (${w.meaningVi})`);
  const grammarSample = GRAMMAR_SAMPLE.map((g) => `${g.pattern} — ${g.context}`);
  const prompt = `Bạn là giáo viên tiếng Hàn sáng tạo bài tập cho người Việt học tiếng Hàn.

Một số từ vựng của bài học: ${vocabSample.join(', ')}
Ngữ pháp của bài học: ${grammarSample.join(' | ')}

Hãy TỰ SÁNG TẠO một câu hỏi trắc nghiệm HOÀN TOÀN MỚI (không sao chép câu có sẵn) để kiểm tra người học — tự chọn dạng phù hợp nhất: điền từ vào câu, chọn nghĩa đúng, chọn cách dùng ngữ pháp đúng, hoặc tìm lỗi sai trong câu.

Trả lời CHỈ bằng JSON, không markdown, không chữ nào khác:
{
  "questionType": "<tên dạng câu hỏi bạn chọn, tiếng Việt, ví dụ: Điền từ / Chọn nghĩa / Ngữ pháp / Tìm lỗi sai>",
  "question": "<nội dung câu hỏi, có thể chứa từ tiếng Hàn>",
  "options": ["<phương án A>", "<phương án B>", "<phương án C>", "<phương án D>"],
  "correctIndex": <số nguyên 0-3, vị trí đáp án đúng trong mảng options>,
  "explanation": "<1 câu tiếng Việt giải thích ngắn gọn vì sao đáp án đó đúng>"
}`;
  const { value: parsed } = await requestAIJson(prompt);
  if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) throw new Error('malformed');
  parsed.correctIndex = Math.max(0, Math.min(parsed.options.length - 1, Number(parsed.correctIndex) || 0));
  return parsed;
}

export default function AIQuizView({ onBack }) {
  const [q, setQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [picked, setPicked] = useState(null);
  const [count, setCount] = useState(0);

  const load = async () => {
    setLoading(true);
    setErrMsg('');
    setPicked(null);
    try {
      const question = await generateAIQuestion();
      setQ(question);
      setCount((c) => c + 1);
    } catch (e) {
      setErrMsg('AI chưa tạo được câu hỏi lúc này, thử lại nhé.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="rv-page">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
        <span className="rv-quiz-title">🤖 AI tự tạo câu hỏi</span>
        <span className="rv-quiz-count">Câu {count}</span>
      </div>
      <p className="cg-sub" style={{ marginTop: 0 }}>Mỗi câu hỏi ở đây do AI tự sáng tạo ngay lúc bạn bấm — không lấy từ ngân hàng có sẵn, luôn mới mỗi lần.</p>

      {loading ? (
        <div className="rv-loading"><Sparkles size={22} color="#7C6FE4" /> AI đang nghĩ câu hỏi...</div>
      ) : errMsg ? (
        <div className="rv-quiz-card">
          <div className="rv-unsupported-note">{errMsg}</div>
          <button className="rv-start-btn rv-start-btn-full" onClick={load}>Thử lại</button>
        </div>
      ) : q && (
        <div className="rv-quiz-card">
          <div className="rv-quiz-tags">
            <span className="rv-tag-type ai">✨ {q.questionType}</span>
          </div>
          <p className="rv-quiz-question">{renderKo(q.question)}</p>
          <div className="rv-opt-list">
            {q.options.map((opt, i) => (
              <button
                key={i}
                className={`rv-opt-row ${picked !== null ? (i === q.correctIndex ? 'correct' : picked === i ? 'wrong' : '') : ''}`}
                onClick={() => {
                  if (picked !== null) return;
                  setPicked(i);
                  if (i === q.correctIndex) playCorrectSound();
                  else playIncorrectSound();
                }}
                disabled={picked !== null}
              >
                <span className="rv-opt-letter">{String.fromCharCode(65 + i)}</span>
                <span lang="ko">{renderKo(opt)}</span>
                {picked !== null && i === q.correctIndex && <CheckCircle2 size={17} color="#3FA95C" />}
                {picked === i && i !== q.correctIndex && <XCircle size={17} color="#D64545" />}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className={`rv-feedback ${picked === q.correctIndex ? 'ok' : 'wrong'}`}>
              <span className="rv-feedback-face">{picked === q.correctIndex ? '🐰' : '🤔'}</span>
              <span>{picked === q.correctIndex ? 'Chính xác! 🎉' : 'Chưa đúng.'} {q.explanation}</span>
              <button className="rv-next-btn" onClick={load}>Câu tiếp theo <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
