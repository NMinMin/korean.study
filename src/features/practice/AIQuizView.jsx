import { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, NotebookPen, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { requestAIJson } from '../../services/aiService';
import { playCorrectSound, playIncorrectSound } from '../../services/audioService';
import { renderKo } from '../../utils/textUtils';

const AI_ENHANCED_QUESTION_COUNT = 6;
const compactText = (value, maxLength = 220) => String(value || '').trim().slice(0, maxLength);

function compactLessonSources(vocabulary = [], grammar = []) {
  const vocabSources = vocabulary.map((word) => ({
    id: String(word.id || `vocab:${word.word}`),
    type: 'vocabulary',
    word: compactText(word.word, 80),
    meaningVi: compactText(word.meaningVi, 120),
    partOfSpeech: compactText(word.type, 50),
    example: word.example ? { ko: compactText(word.example.ko), vi: compactText(word.example.vi) } : undefined,
    dialogue: Array.isArray(word.dialogue) ? word.dialogue.slice(0, 1).map((line) => ({ ko: compactText(line.ko), vi: compactText(line.vi) })) : undefined,
  })).filter((item) => item.word && item.meaningVi);
  const grammarSources = grammar.map((item) => ({
    id: String(item.id || `grammar:${item.pattern}`),
    type: 'grammar',
    pattern: compactText(item.pattern, 100),
    meaningVi: compactText(item.meaningVi || item.translation),
    context: compactText(item.context || item.usageVi),
    conjugation: compactText(item.conjugationVi, 300),
    note: compactText(item.notesVi),
  })).filter((item) => item.pattern);
  return [...vocabSources, ...grammarSources];
}

function normalizeQuestion(raw, sourceMap, index) {
  if (!raw || typeof raw !== 'object') return null;
  const sourceId = String(raw.sourceId || '').trim();
  const source = sourceMap.get(sourceId);
  const question = String(raw.question || '').trim();
  const options = Array.isArray(raw.options) ? raw.options.map((option) => String(option || '').trim()).filter(Boolean) : [];
  const correctIndex = Number(raw.correctIndex);
  if (!source || !question || options.length !== 4 || new Set(options).size !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
  return {
    id: `${sourceId}:${index}:${question}`,
    sourceId,
    sourceType: source.type,
    sourceLabel: source.type === 'vocabulary' ? source.word : source.pattern,
    questionType: String(raw.questionType || (source.type === 'vocabulary' ? 'Từ vựng' : 'Ngữ pháp')).trim(),
    question,
    options,
    correctIndex,
    explanation: String(raw.explanation || '').trim(),
  };
}

function shuffleQuestions(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildOptions(correct, candidates, korean = false) {
  const fallback = korean
    ? ['없습니다', '모르겠습니다', '해당하지 않습니다', '사용하지 않습니다']
    : ['Không có nghĩa này', 'Không phù hợp', 'Không sử dụng trong trường hợp này', 'Không có đáp án'];
  const distractors = shuffleQuestions([...candidates, ...fallback])
    .map((item) => compactText(item, 220))
    .filter((item, index, all) => item && item !== correct && all.indexOf(item) === index)
    .slice(0, 3);
  const options = shuffleQuestions([correct, ...distractors]);
  return { options, correctIndex: options.indexOf(correct) };
}

function buildLocalQuestion(source, sources, previousSet, index) {
  const vocabulary = sources.filter((item) => item.type === 'vocabulary');
  const grammar = sources.filter((item) => item.type === 'grammar');
  let variants;
  if (source.type === 'vocabulary') {
    const meaningOptions = () => buildOptions(source.meaningVi, vocabulary.map((item) => item.meaningVi));
    const wordOptions = () => buildOptions(source.word, vocabulary.map((item) => item.word), true);
    variants = [
      () => ({ questionType: 'Chọn nghĩa', question: `Từ “${source.word}” có nghĩa là gì?`, ...meaningOptions() }),
      () => ({ questionType: 'Chọn từ', question: `Chọn từ tiếng Hàn có nghĩa là “${source.meaningVi}”.`, ...wordOptions() }),
      () => ({ questionType: 'Ghi nhớ từ vựng', question: `Trong bài học này, từ nào tương ứng với nghĩa “${source.meaningVi}”?`, ...wordOptions() }),
    ];
    const exampleKo = source.example?.ko || source.dialogue?.[0]?.ko;
    if (exampleKo) {
      const boldTarget = exampleKo.match(/\*\*(.+?)\*\*/)?.[1];
      const target = boldTarget || source.word;
      const blanked = boldTarget ? exampleKo.replace(/\*\*(.+?)\*\*/, '_____') : exampleKo.replace(source.word, '_____');
      if (blanked !== exampleKo) variants.push(() => ({ questionType: 'Điền từ', question: `Điền từ phù hợp: ${blanked}`, ...buildOptions(target, vocabulary.map((item) => item.word), true) }));
    }
  } else {
    const description = source.meaningVi || source.context || source.note || `Cách dùng của ${source.pattern}`;
    const descriptions = grammar.map((item) => item.meaningVi || item.context || item.note).filter(Boolean);
    variants = [
      () => ({ questionType: 'Chọn ngữ pháp', question: `Chọn mẫu ngữ pháp phù hợp với cách dùng: “${description}”.`, ...buildOptions(source.pattern, grammar.map((item) => item.pattern), true) }),
      () => ({ questionType: 'Ý nghĩa ngữ pháp', question: `Mẫu ngữ pháp “${source.pattern}” được dùng với ý nghĩa nào?`, ...buildOptions(description, descriptions) }),
      () => ({ questionType: 'Cách dùng ngữ pháp', question: `Cách giải thích nào đúng nhất cho cấu trúc “${source.pattern}”?`, ...buildOptions(description, descriptions) }),
    ];
  }
  const candidates = shuffleQuestions(variants.map((create) => create()));
  const selected = candidates.find((question) => !previousSet.has(question.question.toLocaleLowerCase('vi'))) || candidates[0];
  return {
    id: `local:${source.id}:${index}:${Date.now()}`,
    sourceId: source.id,
    sourceType: source.type,
    sourceLabel: source.type === 'vocabulary' ? source.word : source.pattern,
    explanation: source.type === 'vocabulary'
      ? `“${source.word}” có nghĩa là “${source.meaningVi}”.`
      : `${source.pattern}: ${source.meaningVi || source.context || source.note || 'hãy ghi nhớ cách dùng trong bài'}.`,
    ...selected,
  };
}

function pickAISources(sources) {
  const vocabulary = shuffleQuestions(sources.filter((source) => source.type === 'vocabulary'));
  const grammar = shuffleQuestions(sources.filter((source) => source.type === 'grammar'));
  const picked = [...vocabulary.slice(0, 4), ...grammar.slice(0, 2)];
  if (picked.length < AI_ENHANCED_QUESTION_COUNT) {
    const pickedIds = new Set(picked.map((source) => source.id));
    picked.push(...shuffleQuestions(sources.filter((source) => !pickedIds.has(source.id))).slice(0, AI_ENHANCED_QUESTION_COUNT - picked.length));
  }
  return shuffleQuestions(picked);
}

async function generateAIQuestionBatch({ lesson, sources, previousQuestions }) {
  const sessionNonce = `${Date.now()}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`;
  const prompt = `Bạn là giáo viên tiếng Hàn tạo một BỘ câu hỏi luyện tập mới cho học viên người Việt.

PHẠM VI BẮT BUỘC:
- Chỉ kiểm tra đúng từ vựng và ngữ pháp trong dữ liệu của bài học bên dưới.
- Mỗi câu phải ghi sourceId đúng nguyên văn từ dữ liệu. Không được bịa sourceId.
- Có thể sáng tạo ngữ cảnh/câu ví dụ mới, nhưng đáp án phải dựa trực tiếp trên sourceId đã chọn.
- Phân bố cả từ vựng và ngữ pháp nếu bài có đủ hai loại. Không hỏi kiến thức ngoài bài.
- Tạo đúng ${sources.length} câu: MỖI sourceId trong dữ liệu phải xuất hiện đúng một lần.
- Trộn các dạng phù hợp: chọn nghĩa, điền từ, chọn câu đúng, chọn cách dùng ngữ pháp, tìm lỗi sai.
- Mỗi câu có đúng 4 phương án khác nhau và chỉ một đáp án đúng.
- Không lặp lại câu hỏi trong cùng bộ hoặc các câu của lượt trước.

Bài học: Bài ${lesson?.no || ''} — ${lesson?.title || ''}
Mã lượt mới để thay đổi ngữ cảnh: ${sessionNonce}
Dữ liệu nguồn: ${JSON.stringify(sources)}
Các câu lượt trước cần tránh: ${JSON.stringify(previousQuestions.slice(-100))}

Trả về CHỈ một JSON object theo mẫu:
{
  "questions": [
    {
      "sourceId": "<id có trong dữ liệu nguồn>",
      "questionType": "<tên dạng bằng tiếng Việt>",
      "question": "<câu hỏi>",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "<giải thích ngắn bằng tiếng Việt, nhắc lại kiến thức nguồn>"
    }
  ]
}`;
  const { value: parsed, model } = await requestAIJson(prompt, { temperature: 0.8 });
  return { questions: Array.isArray(parsed?.questions) ? parsed.questions : [], model };
}

export async function generateAIQuestionSet({ lesson, vocabulary = [], grammar = [], previousQuestions = [] }) {
  const sources = compactLessonSources(vocabulary, grammar);
  if (!sources.length) throw new Error('LESSON_HAS_NO_AI_SOURCES');
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const previousSet = new Set(previousQuestions.map((question) => compactText(question, 500).toLocaleLowerCase('vi')));
  const localQuestions = sources.map((source, index) => buildLocalQuestion(source, sources, previousSet, index));
  const questionsBySource = new Map(localQuestions.map((question) => [question.sourceId, question]));
  let model = null;
  let aiEnhancedCount = 0;
  let usedFallback = false;
  try {
    const aiSources = pickAISources(sources);
    const generated = await generateAIQuestionBatch({ lesson, sources: aiSources, previousQuestions });
    model = generated.model;
    const validAIQuestions = generated.questions
      .map((question, index) => normalizeQuestion(question, sourceMap, index))
      .filter((question) => question && !previousSet.has(compactText(question.question, 500).toLocaleLowerCase('vi')));
    validAIQuestions.forEach((question) => questionsBySource.set(question.sourceId, question));
    aiEnhancedCount = validAIQuestions.length;
    usedFallback = validAIQuestions.length === 0;
  } catch {
    usedFallback = true;
  }
  const completeSet = sources.map((source) => questionsBySource.get(source.id));
  return { questions: shuffleQuestions(completeSet), model, sourceCount: sources.length, aiEnhancedCount, usedFallback };
}

export default function AIQuizView({ lesson, vocabulary = [], grammar = [], onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [setNumber, setSetNumber] = useState(0);
  const previousQuestionsRef = useRef([]);
  const requestSequenceRef = useRef(0);
  const autoAdvanceRef = useRef(null);

  const loadSet = async () => {
    const requestSequence = ++requestSequenceRef.current;
    window.clearTimeout(autoAdvanceRef.current);
    setLoading(true);
    setErrMsg('');
    setQuestions([]);
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setFinished(false);
    try {
      const result = await generateAIQuestionSet({ lesson, vocabulary, grammar, previousQuestions: previousQuestionsRef.current });
      if (requestSequence !== requestSequenceRef.current) return;
      previousQuestionsRef.current = [...previousQuestionsRef.current, ...result.questions.map((question) => question.question)].slice(-200);
      setQuestions(result.questions);
      setSetNumber((current) => current + 1);
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) return;
      setErrMsg(error instanceof Error && error.message === 'LESSON_HAS_NO_AI_SOURCES'
        ? 'Bài học này chưa có dữ liệu từ vựng hoặc ngữ pháp để AI tạo câu hỏi.'
        : 'AI chưa tạo được bộ câu hỏi hợp lệ lúc này. Bạn hãy thử tạo lại.');
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadSet();
    return () => {
      requestSequenceRef.current += 1;
      window.clearTimeout(autoAdvanceRef.current);
    };
    // Mỗi lần mở màn hình là một lượt luyện mới; dữ liệu đã được giới hạn theo bài ở App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const currentQuestion = questions[index];
  const choose = (optionIndex) => {
    if (picked !== null || !currentQuestion) return;
    setPicked(optionIndex);
    if (optionIndex === currentQuestion.correctIndex) {
      setCorrectCount((current) => current + 1);
      playCorrectSound();
      autoAdvanceRef.current = window.setTimeout(() => next(), 950);
    } else {
      playIncorrectSound();
    }
  };
  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
    setPicked(null);
  };

  return (
    <section className="rv-page ai-quiz-session">
      <div className="rv-quiz-top">
        <button className="fc2-back" onClick={onBack} aria-label="Về bài học"><ChevronLeft size={20} /></button>
        <span className="rv-quiz-title">AI luyện tập · Bài {lesson?.no || '—'}</span>
        <span className="rv-quiz-count">{finished ? `Bộ ${setNumber}` : questions.length ? `${index + 1} / ${questions.length}` : 'Bộ mới'}</span>
      </div>
      <p className="cg-sub ai-quiz-scope"><Sparkles size={15} /> Mỗi lượt là một bộ mới, chỉ dùng {vocabulary.length} từ vựng và {grammar.length} điểm ngữ pháp của bài này.</p>

      {loading ? (
        <div className="rv-loading"><Sparkles size={22} color="#7C6FE4" /> AI đang tạo bộ câu hỏi mới theo nội dung bài...</div>
      ) : errMsg ? (
        <div className="rv-quiz-card ai-quiz-error">
          <div className="rv-unsupported-note">{errMsg}</div>
          <div className="ai-quiz-error-actions"><button className="fc-nav-btn" onClick={onBack}><ChevronLeft size={17} /> Về bài học</button><button className="rv-start-btn" onClick={() => void loadSet()}><RotateCcw size={16} /> Thử tạo lại</button></div>
        </div>
      ) : finished ? (
        <div className="rv-quiz-card ai-quiz-result">
          <span className="ai-quiz-result-icon"><Sparkles size={28} /></span>
          <span className="rv-tag-type ai">HOÀN THÀNH BỘ {setNumber}</span>
          <h2>{correctCount}/{questions.length} câu đúng</h2>
          <p>{correctCount === questions.length ? 'Xuất sắc! Bạn đã nắm chắc kiến thức của bài.' : 'Bạn có thể tạo một bộ mới để luyện thêm với ngữ cảnh khác.'}</p>
          <div className="ai-quiz-result-actions"><button className="fc-nav-btn" onClick={onBack}><ChevronLeft size={17} /> Về bài học</button><button className="rv-start-btn" onClick={() => void loadSet()}><Sparkles size={17} /> AI tạo bộ mới</button></div>
        </div>
      ) : currentQuestion && (
        <div className="rv-quiz-card">
          <div className="rv-quiz-tags">
            <span className="rv-tag-type ai">✨ {currentQuestion.questionType}</span>
            <span className="rv-tag-type">{currentQuestion.sourceType === 'vocabulary' ? <BookOpen size={13} /> : <NotebookPen size={13} />} {currentQuestion.sourceLabel}</span>
          </div>
          <p className="rv-quiz-question">{renderKo(currentQuestion.question)}</p>
          <div className="rv-opt-list">
            {currentQuestion.options.map((option, optionIndex) => (
              <button
                key={`${currentQuestion.id}:${optionIndex}`}
                className={`rv-opt-row ${picked !== null ? (optionIndex === currentQuestion.correctIndex ? 'correct' : picked === optionIndex ? 'wrong' : '') : ''}`}
                onClick={() => choose(optionIndex)}
                disabled={picked !== null}
              >
                <span className="rv-opt-letter">{String.fromCharCode(65 + optionIndex)}</span>
                <span lang="ko">{renderKo(option)}</span>
                {picked !== null && optionIndex === currentQuestion.correctIndex && <CheckCircle2 size={17} color="#3FA95C" />}
                {picked === optionIndex && optionIndex !== currentQuestion.correctIndex && <XCircle size={17} color="#D64545" />}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className={`rv-feedback ${picked === currentQuestion.correctIndex ? 'ok' : 'wrong'}`}>
              <span className="rv-feedback-face">{picked === currentQuestion.correctIndex ? '🐰' : '🤔'}</span>
              <span><b>{picked === currentQuestion.correctIndex ? 'Chính xác!' : 'Chưa đúng.'}</b> {currentQuestion.explanation}</span>
              {picked !== currentQuestion.correctIndex
                ? <button className="rv-next-btn" onClick={next}>{index + 1 >= questions.length ? 'Xem kết quả' : 'Câu tiếp theo'} <ChevronRight size={16} /></button>
                : <small className="ai-quiz-auto-next">{index + 1 >= questions.length ? 'Đang mở kết quả…' : 'Đang chuyển sang câu tiếp theo…'}</small>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
