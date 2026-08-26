import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Volume2, Star, BookOpen, Headphones, Mic, Sparkles,
  BookMarked, Lightbulb, CheckCircle2, RotateCcw, Plus, XCircle, ArrowLeft, ArrowRight,
  Play, RotateCw, Check, Link2, Image as ImageIcon, NotebookPen,
  AlertTriangle, Bot, Flame, MessageCircle, MessageSquare, PencilLine, Settings, Target, Type
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { speakKo, playVocabularyAudio, playIncorrectSound, playCelebrationSound } from '../../services/audioService';
import { renderKo } from '../../utils/textUtils';
import { todayStr } from '../../utils/streakUtils';
import { FcBunny, SwBunnyEmpty, MiniBear } from '../../components/common/Mascots';
import { Bar, ProgressIcon } from '../../components/common/ProgressBar';
import { VOCAB_SAMPLE, GRAMMAR_SAMPLE, SHADOW_LINES, FALLBACK_LESSONS, DiamondIcon, UserGemCount, UserXpCount, UserStreakCount } from '../../data/fallbackData';
import {
  vocabProgressKey,
  legacyVocabProgressKey,
  vocabNotebookKey,
  legacyVocabNotebookKey,
  readScopedProgress,
  saveScopedProgress
} from '../../services/storageShim';
import { markRemoteActivityCompleted, saveRemoteActivityProgress } from '../../lib/activityProgress';
import { ACTIVITIES, loadActivityProgress as loadLessonActivityProgress, mergeVocabStates } from './activityHelpers';
import { SkillCompletionView } from '../review/ReviewViews';
import {
  loadRemoteVocabularyState,
  loadRemoteVocabularyStateForWords,
  loadRemoteFlashcardSession,
  saveRemoteVocabularyState,
  saveRemoteVocabularyStateForWords,
  saveRemoteFlashcardSession,
} from '../../lib/vocabularyProgress';

const cleanKo = (text) => String(text || '').replace(/\*\*/g, '').replaceAll('[', '').replaceAll(']', '');

const vocabularyStateDelta = (local = {}, remote = {}, merged = {}) => Object.fromEntries(
  Object.keys(local)
    .filter((word) => {
      const localItem = local[word] || {};
      const remoteItem = remote[word] || {};
      return (localItem.timesReviewed || 0) > (remoteItem.timesReviewed || 0)
        || (Object.prototype.hasOwnProperty.call(localItem, 'starred') && localItem.starred !== remoteItem.starred)
        || (Object.prototype.hasOwnProperty.call(localItem, 'note') && localItem.note !== remoteItem.note);
    })
    .map((word) => [word, merged[word]])
);

export function LessonDetailView({ lesson, userId, textbookTitle, onBack, onStartActivity, onProgressChange }) {
  const [pcts, setPcts] = useState({ tuvung: 0, shadowing: 0, nghechep: 0, ontap: 0 });

  useEffect(() => {
    let alive = true;
    loadLessonActivityProgress(lesson, userId).then((p) => {
      if (!alive) return;
      setPcts(p);
    });
    return () => { alive = false; };
    // Hydration is read-only. Calling onProgressChange here updated the parent
    // catalog, created a new lesson object, and mounted this effect again in a
    // request loop. Progress aggregation is performed when a skill is changed.
  }, [lesson?.id, lesson?.textbookId, userId]);

  return (
    <section className="card page">
      <div className="card-title-row">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label="Về danh sách bài"><ChevronLeft size={20} /></button>
          <div className="card-title">
            <NotebookPen size={19} color="#7C6FE4" /> Bài {lesson.no} · {textbookTitle}
          </div>
        </div>
      </div>

      <div className="lesson-hero">
        <span className="lesson-no big">{lesson.no}과</span>
        <div className="lesson-hero-info">
          <b>Bài {lesson.no}</b>
          <em>{lesson.title}</em>
          <span className="lesson-hero-words">{lesson.words} từ vựng · 4 hoạt động</span>
        </div>
        {(lesson.status === "done" || (lesson.progressPercent || 0) >= 100 || (ACTIVITIES.length > 0 && ACTIVITIES.every((a) => (pcts[a.id] ?? 0) >= 100))) ? (
          <span className="lesson-badge done-b">✓ Hoàn thành</span>
        ) : (
          <span className="lesson-badge cur-b">Đang học</span>
        )}
      </div>

      <div className="activity-grid">
        {ACTIVITIES.map((a) => {
          const pct = pcts[a.id] ?? 0;
          return (
            <div key={a.id} className="activity-card" style={{ background: a.bg }}>
              <div className="activity-top">
                <ProgressIcon type={a.icon} color={a.color} bg="#fff" />
                <div className="activity-head">
                  <span className="activity-label" style={{ color: a.color }}>{a.label}</span>
                  <span className="activity-pct">{pct}<i>%</i></span>
                </div>
              </div>
              <p className="activity-desc">{a.desc}</p>
              <Bar pct={pct} color={a.color} h={8} track="rgba(255,255,255,.9)" />
              <button
                className="activity-btn"
                style={{ background: a.color }}
                onClick={() => onStartActivity(a.id)}
              >
                <Play size={14} fill="#fff" />
                {pct === 100 ? "Học lại" : pct > 0 ? "Tiếp tục" : a.cta}
              </button>
            </div>
          );
        })}
      </div>

      <button className="ai-bonus-card" onClick={() => onStartActivity("aiquiz")}>
        <span className="ai-bonus-ico"><Bot size={25} /><Sparkles className="ai-bonus-spark" size={13} /></span>
        <div className="ai-bonus-body">
          <span className="ai-bonus-kicker"><Sparkles size={12} /> LUYỆN TẬP VỚI AI</span>
          <b>AI tự tạo bộ câu hỏi mới</b>
          <span>Câu hỏi được tạo theo đúng từ vựng và ngữ pháp của Bài 1, thay đổi ở mỗi lượt luyện.</span>
          <span className="ai-bonus-meta"><i>Không lặp đề</i><i>Đúng phạm vi bài</i><i>Không tính điểm hạng</i></span>
        </div>
        <span className="ai-bonus-cta">Tạo câu hỏi <ChevronRight size={17} /></span>
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  THẺ TỪ VỰNG (theo thiết kế mẫu)                                    */
/* ------------------------------------------------------------------ */
export function AudioBtn({ text, spk = "A", size = 40 }) {
  return (
    <button
      className="audio-btn"
      style={{ width: size, height: size }}
      onClick={() => speakKo(text, { spk })}
      aria-label={`Nghe phát âm: ${text}`}
    >
      <Volume2 size={size * 0.48} color="#fff" />
    </button>
  );
}

/* Ảnh minh họa: dùng ảnh thật nếu có (card.img), không thì hiện placeholder */
function CardIllustration({ src, word }) {
  if (src) {
    return (
      <div className="fc-illus">
        <img src={src} alt={`Minh họa: ${word}`} className="fc-illus-img" />
      </div>
    );
  }
  return (
    <div className="fc-illus">
      <svg viewBox="0 0 220 200" width="100%" aria-hidden="true">
        <rect width="220" height="200" rx="16" fill="#EDE7FA" />
        <rect x="18" y="18" width="70" height="80" rx="8" fill="#DFF0FB" />
        <path d="M18 70 q20-14 35-6 q18 9 35-4 v38 h-70z" fill="#CBE6F6" />
        <circle cx="40" cy="40" r="9" fill="#fff" opacity=".9" />
        {/* thought bubble + bulb */}
        <ellipse cx="150" cy="42" rx="34" ry="26" fill="#fff" />
        <circle cx="120" cy="66" r="6" fill="#fff" />
        <circle cx="110" cy="76" r="3.5" fill="#fff" />
        <circle cx="150" cy="38" r="12" fill="#F7D663" />
        <rect x="145" y="49" width="10" height="6" rx="2" fill="#E0B84A" />
        <path d="M150 20 v-6 M136 26 l-4-4 M164 26 l4-4" stroke="#F0C24E" strokeWidth="3" strokeLinecap="round" />
        {/* girl */}
        <path d="M62 150 C58 112 78 96 108 96 C138 96 158 112 154 150 L156 200 L60 200 Z" fill="#6B4A3A" />
        <ellipse cx="108" cy="126" rx="30" ry="28" fill="#FBE8DC" />
        <path d="M78 122 C78 96 90 88 108 88 C126 88 138 96 138 122 C128 108 122 104 108 104 C94 104 88 108 78 122 Z" fill="#7A5544" />
        <ellipse cx="97" cy="126" rx="4.6" ry="5.6" fill="#3B2A22" />
        <ellipse cx="119" cy="126" rx="4.6" ry="5.6" fill="#3B2A22" />
        <ellipse cx="88" cy="136" rx="5" ry="3" fill="#F6C6C0" />
        <ellipse cx="128" cy="136" rx="5" ry="3" fill="#F6C6C0" />
        <path d="M102 140 Q108 145 114 140" stroke="#B5645B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M70 200 C72 172 86 162 108 162 C130 162 144 172 146 200 Z" fill="#F5D67A" />
        <path d="M118 190 l40-8 6 14 -40 8z" fill="#fff" />
        <path d="M158 182 l26-5 5 12 -26 5z" fill="#F3EDDA" />
        <path d="M30 176 c0-12-8-16-12-22 c10 2 12 10 12 16 c1-8 4-14 12-18 c-4 10-9 14-10 24z" fill="#4E9E5F" />
        <path d="M22 178 h18 l-3 16 h-12z" fill="#E8B98B" />
      </svg>
      <span className="fc-illus-note">Ảnh minh họa</span>
    </div>
  );
}

// Chu kỳ 1–3–7 là các ngày tính từ lần học đầu tiên. Vì vậy khoảng
// cách thực tế giữa các lượt là +1, rồi +2 (đến ngày 3), rồi +4
// (đến ngày 7). Sau khi qua đủ chu kỳ, duy trì ôn mỗi 7 ngày.
const BOX_INTERVAL_DAYS = { 1: 1, 2: 2, 3: 4, 4: 7 };

const RATINGS = [
  { id: "vague", label: "Ôn lại sau", Icon: RotateCcw, color: "#8B85AB" },
  { id: "forgot", label: "Chưa nhớ", Icon: XCircle, color: "#D64545" },
  { id: "good", label: "Đã nhớ", Icon: CheckCircle2, color: "#3FA95C" },
];

const nextBox = (curBox, rating) => {
  // Box biểu diễn mốc ôn vừa đạt: 1 ngày -> 3 ngày -> 7 ngày.
  // Từ mới bắt đầu ở box 0 để lần "Đã nhớ" đầu tiên lên box 1,
  // tránh bỏ qua mốc ôn sau 1 ngày và nhảy thẳng tới 3 ngày.
  const box = Number(curBox) || 0;
  if (rating === "forgot") return 1;
  if (rating === "good") return Math.min(4, box + 1);
  return Math.max(1, box);
};

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const WORD_CLASS_VI = {
  "명사": "Danh từ", "동사": "Động từ", "형용사": "Tính từ",
  "부사": "Trạng từ", "관형사": "Định từ", "감탄사": "Thán từ",
};
const wordClassVi = (t) => WORD_CLASS_VI[t] || "";

function GirlAvatar() {
  return (
    <svg viewBox="0 0 60 60" width="38" height="38" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r="28" fill="#F0EEFC" />
      <path d="M14 34 C13 20 20 12 30 12 C40 12 47 20 46 34 L47 48 L13 48 Z" fill="#6B4A3A" />
      <ellipse cx="30" cy="30" rx="14" ry="13" fill="#FBE8DC" />
      <path d="M17 28 C17 16 23 13 30 13 C37 13 43 16 43 28 C38 21 34 19 30 19 C26 19 22 21 17 28Z" fill="#7A5544" />
      <circle cx="25" cy="31" r="2.2" fill="#3B2A22" />
      <circle cx="35" cy="31" r="2.2" fill="#3B2A22" />
      <path d="M27 37 Q30 39.5 33 37" stroke="#B5645B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BoyAvatar() {
  return (
    <svg viewBox="0 0 60 60" width="38" height="38" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r="28" fill="#FDF0F2" />
      <path d="M15 40 C14 26 20 14 30 14 C40 14 46 26 45 40 L47 50 L13 50 Z" fill="#2B2320" />
      <ellipse cx="30" cy="30" rx="13.5" ry="12.5" fill="#F2D9BC" />
      <path d="M17 25 C19 16 24 14 30 14 C36 14 41 16 43 25 C41 21 36 20 30 20 C24 20 19 21 17 25Z" fill="#2B2320" />
      <circle cx="25" cy="31" r="2.1" fill="#3B2A22" />
      <circle cx="35" cy="31" r="2.1" fill="#3B2A22" />
      <path d="M27 37 Q30 39 33 37" stroke="#A8735A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
/* ------------------------------------------------------------------ */
/*  BÀI TẬP TỪ VỰNG — dữ liệu cho 3 dạng: Điền chỗ trống / Ghép cặp /   */
/*  Chọn hình. Dùng chung nguồn 5 từ trong VOCAB_SAMPLE.                */
/* ------------------------------------------------------------------ */
const shuffleArr = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* pre + word + particle + post = câu đầy đủ để phát âm thanh */
const FILL_BLANK_ITEMS = [
  {
    word: "꽃다발", pre: "생일이라 친구에게 예쁜 ", post: " 선물했어요.", hint: "을/를", particle: "을",
    vi: "Vì là sinh nhật nên tôi đã tặng bạn một bó hoa đẹp."
  },
  {
    word: "만년필", pre: "졸업 선물로 ", post: " 받았어요.", hint: "을/를", particle: "을",
    vi: "Tôi đã nhận được bút máy làm quà tốt nghiệp."
  },
  {
    word: "목도리", pre: "날씨가 추워서 ", post: " 했어요.", hint: "을/를", particle: "를",
    vi: "Vì trời lạnh nên tôi đã quàng khăn."
  },
  {
    word: "상품권", pre: "백화점에서 쓸 수 있는 ", post: " 선물했어요.", hint: "을/를", particle: "을",
    vi: "Tôi đã tặng phiếu mua hàng có thể dùng ở trung tâm thương mại."
  },
  {
    word: "향수", pre: "", post: " 너무 좋아서 하나 더 샀어요.", hint: "이/가", particle: "가",
    vi: "Vì nước hoa quá thích nên tôi đã mua thêm một cái."
  },
];

const MATCH_ITEMS = [
  { word: "꽃다발", meaning: "Bó hoa" },
  { word: "만년필", meaning: "Bút máy" },
  { word: "목도리", meaning: "Khăn quàng cổ" },
  { word: "상품권", meaning: "Phiếu mua hàng" },
  { word: "향수", meaning: "Nước hoa" },
];

const buildImageQuizItems = () =>
  VOCAB_SAMPLE.map((v, i) => {
    const pool = VOCAB_SAMPLE.filter((_, j) => j !== i);
    const distractors = shuffleArr(pool).slice(0, 3);
    const options = shuffleArr([v, ...distractors]).map((o) => ({ word: o.word, img: o.img }));
    return { answer: v.word, options };
  });

const TEST_MODES = [
  { id: "fillblank", label: "Điền vào chỗ trống", tag: "[Nghe]", desc: "Nghe câu và điền từ còn thiếu", color: "#7C6FE4", bg: "#F0EEFC", Icon: Headphones },
  { id: "match", label: "Ghép cặp", tag: null, desc: "Chọn để ghép từ với nghĩa phù hợp", color: "#3FA95C", bg: "#EBF7EE", Icon: Link2 },
  { id: "image", label: "Chọn hình", tag: null, desc: "Nghe từ và chọn hình phù hợp nhất", color: "#4A90E2", bg: "#EEF4FD", Icon: ImageIcon },
];


/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  NGỮ PHÁP — trang tổng hợp: chọn giáo trình → chọn bài → xem các    */
/*  mẫu ngữ pháp của bài đó. Ngữ pháp của tất cả các bài được gom về   */
/*  một chỗ duy nhất (mục Ngữ pháp) thay vì nằm rải rác trong "Bài học".*/
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  TỪ VỰNG & BÀI HỌC — hub gộp chung: Từ vựng, Nghe chép chính tả,     */
/*  Shadowing, Ôn tập (đúng theo yêu cầu gộp mục sidebar).              */
/* ------------------------------------------------------------------ */
function StudyHubView({ onBack, onVocab, onDictation, onShadowing, onReview }) {
  const items = [
    { label: "Từ vựng", desc: "Danh sách từ, thẻ ghi nhớ, sổ tay cá nhân", icon: Type, color: "#7C6FE4", bg: "#F0EEFC", onClick: onVocab },
    { label: "Nghe chép chính tả", desc: "Nghe và chép lại chính xác từng câu", icon: Headphones, color: "#3FA95C", bg: "#EBF7EE", onClick: onDictation },
    { label: "Shadowing", desc: "Nghe và lặp lại theo người bản ngữ", icon: Mic, color: "#E8912E", bg: "#FDF3E7", onClick: onShadowing },
    { label: "Ôn tập", desc: "Củng cố kiến thức theo bài hoặc ngẫu nhiên", icon: PencilLine, color: "#4A90E2", bg: "#EEF4FD", onClick: onReview },
  ];
  return (
    <section className="cg-page wide-page study-wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Type size={18} color="#3FA95C" /> Từ vựng & bài học</span>
        </div>
      </div>
      <div className="study-hub-grid">
        {items.map((it) => (
          <button key={it.label} className="study-hub-card" onClick={it.onClick}>
            <span className="study-hub-ico" style={{ background: it.bg }}><it.icon size={26} color={it.color} /></span>
            <div className="study-hub-body">
              <b>{it.label}</b>
              <span>{it.desc}</span>
            </div>
            <ChevronRight size={18} color="#C9BCF2" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  GIÁO TRÌNH — chọn GIÁO TRÌNH (quyển sách) trước, khác với "Từ vựng  */
/*  & bài học" (đi thẳng vào nội dung học). Đây là bước chọn SÁCH.     */
/* ------------------------------------------------------------------ */
function CurriculumHubView({ onBack, onOpenBook, onAddBook, myBooks = [], availableBooks = [], addingBookId, notice }) {
  const renderBook = (book, mode) => (
    <article key={book.id} className={`gm-hub-card ${book.hasContent ? "has" : "soon"} ${mode === "discover" ? "discover" : ""}`}>
      <span className="gm-hub-badge" style={{ color: "#4A90E2", background: "#EEF4FD" }}>GIÁO TRÌNH</span>
      <b lang="ko">{book.title}</b>
      {mode === "discover" && (
        <p className="gm-hub-description">
          {book.description || book.titleVi || "Giáo trình luyện hội thoại tiếng Hàn theo từng bài học, phù hợp để học và ôn tập hằng ngày."}
        </p>
      )}
      <span className="gm-hub-count">
        {book.lessonCount ? `${book.lessonCount} bài học` : "Chưa có nội dung"}
      </span>
      {mode === "mine" ? (
        <button className="gm-book-action" disabled={!book.hasContent} onClick={() => onOpenBook(book)}>
          {book.hasContent ? "Mở giáo trình" : "Đang biên soạn"}<ChevronRight size={15} />
        </button>
      ) : (
        <button className="gm-book-action add" disabled={addingBookId === book.id} onClick={() => onAddBook(book)}>
          {addingBookId === book.id ? "Đang thêm..." : "Thêm vào giáo trình của tôi"}<Plus size={15} />
        </button>
      )}
    </article>
  );
  return (
    <section className="cg-page curriculum-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><BookOpen size={18} color="#4A90E2" /> Giáo trình</span>
        </div>
      </div>
      {notice && <div className={`catalog-notice ${notice.type}`}>{notice.message}</div>}
      <div className="curriculum-section-head">
        <div><h2>Giáo trình của tôi</h2><p>Chỉ hiển thị những giáo trình bạn đã thêm.</p></div>
        <span>{myBooks.length} giáo trình</span>
      </div>
      {myBooks.length ? <div className="gm-hub-grid">{myBooks.map((book) => renderBook(book, "mine"))}</div> : (
        <div className="curriculum-empty">
          <BookOpen size={28} /><b>Chưa có giáo trình</b>
          <span>Chọn một giáo trình ở mục Khám phá bên dưới để bắt đầu học.</span>
          <button type="button" className="curriculum-empty-action" onClick={() => document.getElementById("discover-textbooks")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Plus size={15} /> Thêm giáo trình
          </button>
        </div>
      )}
      <div className="curriculum-section-head discover-head" id="discover-textbooks">
        <div><h2>Khám phá giáo trình</h2><p>Các giáo trình đã xuất bản và chưa có trong danh sách của bạn.</p></div>
        <span>{availableBooks.length} giáo trình</span>
      </div>
      {availableBooks.length ? <div className="gm-hub-grid">{availableBooks.map((book) => renderBook(book, "discover"))}</div> : (
        <div className="curriculum-empty compact"><Sparkles size={24} /><span>Bạn đã thêm tất cả giáo trình hiện có.</span></div>
      )}
    </section>
  );
}

function GrammarHubView({ onBack, onOpenBook, onAddBook, books = [] }) {
  return (
    <section className="cg-page wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><NotebookPen size={18} color="#3FA95C" /> Ngữ pháp</span>
        </div>
      </div>
      <p className="cg-sub" style={{ marginTop: 0 }}>Danh sách các mẫu ngữ pháp thuộc những giáo trình bạn đã thêm.</p>
      {!books.length ? (
        <div className="curriculum-empty grammar-empty">
          <NotebookPen size={28} />
          <b>Bạn chưa có giáo trình</b>
          <span>Thêm giáo trình trước để xem ngữ pháp theo đúng nội dung đang học.</span>
          <button type="button" className="curriculum-empty-action" onClick={onAddBook}><Plus size={15} /> Thêm giáo trình</button>
        </div>
      ) : <div className="grammar-catalog-list">
        {books.flatMap((book) => GRAMMAR_SAMPLE.map((grammar, index) => (
          <button key={`${book.id || book.title}-${grammar.no}`} className="grammar-catalog-card" onClick={() => onOpenBook(book)}>
            <span className="grammar-catalog-number">{index + 1}</span>
            <span className="grammar-catalog-content">
              <b lang="ko">{grammar.pattern}</b>
              <small>{grammar.translation}</small>
              <span>{grammar.context}</span>
            </span>
            <span className="grammar-catalog-book"><BookOpen size={13} /> {book.title}</span>
            <ChevronRight size={18} />
          </button>
        )))}
      </div>}
    </section>
  );
}

function GrammarBookView({ onBack, onSelectLesson, lessons = FALLBACK_LESSONS, grammar = GRAMMAR_SAMPLE, textbookTitle = "Giáo trình tiếng Hàn" }) {
  return (
    <section className="cg-page wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về danh sách giáo trình"><ChevronLeft size={20} /></button>
          <span className="fc2-title" lang="ko"><NotebookPen size={18} color="#3FA95C" /> {textbookTitle} — Ngữ pháp</span>
        </div>
      </div>
      <p className="cg-sub" style={{ marginTop: 0 }}>Chọn bài để xem các mẫu ngữ pháp được tổng hợp trong bài đó.</p>
      <div className="gm-lesson-list">
        {lessons.map((l, i) => {
          const count = grammar.filter((item) => item.lessonId ? item.lessonId === l.id : i === 0).length;
          const hasContent = l.status !== "locked" && count > 0;
          return (
            <button
              key={l.no}
              className={`gm-lesson-row ${hasContent ? "has" : "soon"}`}
              onClick={() => hasContent && onSelectLesson(i)}
              disabled={!hasContent}
            >
              <span className="gm-lesson-no">{l.no}</span>
              <div className="gm-lesson-body">
                <b>Bài {l.no}</b>
                <span lang="ko">{l.title}</span>
              </div>
              <span className="gm-lesson-count">
                {hasContent ? `${count} mẫu ngữ pháp` : "Chưa có nội dung"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DANH SÁCH TỪ VỰNG — mỗi dòng: Từ Hàn - Nghĩa Việt, có Loa + Ngôi sao */
/* ------------------------------------------------------------------ */
export function VocabListView({ lesson, userId, onBack, onStudy, onReviewStart, reviewingSession = false, vocabulary = VOCAB_SAMPLE, grammar = GRAMMAR_SAMPLE }) {
  const [progress, setProgress] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [reviewing, setReviewing] = useState(reviewingSession);
  const storageKey = vocabProgressKey(lesson, userId);

  useEffect(() => {
    let alive = true;
    (async () => {
      let local = {};
      try { const res = await readScopedProgress(storageKey, legacyVocabProgressKey(lesson), userId); if (res?.value) local = JSON.parse(res.value); } catch (e) { }
      const remote = await loadRemoteVocabularyState(lesson, userId);
      const merged = remote ? mergeVocabStates(local, remote) : local;
      if (alive) setProgress(merged);
      if (remote) {
        await saveScopedProgress(storageKey, JSON.stringify(merged));
        const delta = vocabularyStateDelta(local, remote, merged);
        if (Object.keys(delta).length) void saveRemoteVocabularyState(lesson, userId, delta);
      }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [storageKey, lesson.no, userId]);

  const toggleStar = (word) => {
    const cur = progress[word];
    const updated = { ...progress, [word]: { ...cur, starred: !cur?.starred } };
    setProgress(updated);
    void saveScopedProgress(storageKey, JSON.stringify(updated));
    void saveRemoteVocabularyState(lesson, userId, updated);
  };

  const completed = loaded && vocabulary.length > 0 && vocabulary.every((word) => progress[word.word]?.lastRating === "good");

  if (completed && !reviewing) {
    return (
      <SkillCompletionView
        title="Bạn đã hoàn thành Từ vựng & Ngữ pháp!"
        description="Bạn đã học thuộc toàn bộ nội dung của bài. Bạn có muốn ôn lại từ đầu không?"
        retryLabel="Ôn lại"
        onBack={onBack}
        onRetry={() => {
          setReviewing(true);
          onReviewStart?.();
        }}
      />
    );
  }

  return (
    <section className="cg-page wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về bài học"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Type size={18} color="#7C6FE4" /> Từ vựng & Ngữ pháp · Bài {lesson.no}</span>
        </div>
        <button className="cg-post-btn" onClick={() => onStudy(reviewing)}><Play size={13} fill="#fff" /> {reviewing ? "Ôn lại bằng Flashcard" : "Học bằng Flashcard"}</button>
      </div>
      <div className="vl-list">
        {vocabulary.map((w) => {
          const starred = !!progress[w.word]?.starred;
          return (
            <div key={w.word} className="vl-row">
              <div className="vl-main">
                <span className="vl-ko" lang="ko">{w.word}</span>
                <span className="vl-vi">{w.meaningVi}</span>
              </div>
              <button className="vl-audio" onClick={() => playVocabularyAudio(w)} aria-label={`Nghe phát âm ${w.word}`}>
                <Volume2 size={15} color="#7C6FE4" />
              </button>
              <button
                className={`vl-star ${starred ? "on" : ""}`}
                onClick={() => toggleStar(w.word)}
                aria-label={starred ? "Bỏ đánh dấu từ khó" : "Đánh dấu từ khó"}
              >
                <Star size={16} fill={starred ? "#F0C24E" : "none"} color={starred ? "#F0C24E" : "#C9BCF2"} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="vl-grammar-section">
        <div className="vl-section-heading"><NotebookPen size={18} /> Ngữ pháp trong bài <span>{grammar.length} mẫu</span></div>
        <div className="vl-grammar-grid">
          {grammar.map((item) => (
            <article className="vl-grammar-card" key={item.id || item.no}>
              <div><b lang="ko">{item.pattern}</b><span>{item.translation}</span></div>
              <p>{item.context}</p>
              {item.examples?.[0] && <small><span lang="ko">{cleanKo(item.examples[0].ko)}</span> — {item.examples[0].vi}</small>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SỔ TAY TỪ VỰNG CÁ NHÂN — tổng hợp mọi từ đã đánh dấu ★, ôn riêng    */
/* ------------------------------------------------------------------ */
export function VocabNotebookView({ lesson, userId, onBack, onReview, vocabulary = VOCAB_SAMPLE }) {
  const [progress, setProgress] = useState({});
  const [loaded, setLoaded] = useState(false);
  const storageKey = vocabProgressKey(lesson, userId);

  const load = async () => {
    let local = {};
    try { const res = await readScopedProgress(storageKey, legacyVocabProgressKey(lesson), userId); if (res?.value) local = JSON.parse(res.value); } catch (e) { }
    const remote = await loadRemoteVocabularyState(lesson, userId);
    const merged = remote ? mergeVocabStates(local, remote) : local;
    setProgress(merged);
    if (remote) {
      await saveScopedProgress(storageKey, JSON.stringify(merged));
      const delta = vocabularyStateDelta(local, remote, merged);
      if (Object.keys(delta).length) void saveRemoteVocabularyState(lesson, userId, delta);
    }
    setLoaded(true);
  };
  useEffect(() => { void load(); }, [storageKey, lesson.no, userId]);

  const starredWords = vocabulary.filter((w) => progress[w.word]?.starred);

  const toggleStar = (word) => {
    const cur = progress[word];
    const updated = { ...progress, [word]: { ...cur, starred: !cur?.starred } };
    setProgress(updated);
    void saveScopedProgress(storageKey, JSON.stringify(updated));
    void saveRemoteVocabularyState(lesson, userId, updated);
  };

  return (
    <section className="cg-page wide-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Star size={18} color="#F0C24E" fill="#F0C24E" /> Sổ tay từ vựng cá nhân</span>
        </div>
      </div>
      <p className="cg-sub" style={{ marginTop: 0 }}>
        Những từ bạn đã đánh dấu ★ khi học Flashcard hoặc trong Danh sách từ vựng — ôn lại riêng những từ khó này bất cứ lúc nào.
      </p>
      {!loaded ? (
        <div className="cg-empty">Đang tải...</div>
      ) : starredWords.length === 0 ? (
        <div className="cg-empty">Chưa có từ nào được đánh dấu. Bấm biểu tượng ★ khi học để lưu từ khó vào đây.</div>
      ) : (
        <>
          <button className="primary-btn" style={{ alignSelf: "flex-start" }} onClick={() => onReview(starredWords)}>
            <Play size={16} fill="#fff" /> Ôn tập {starredWords.length} từ khó
          </button>
          <div className="vl-list">
            {starredWords.map((w) => (
              <div key={w.word} className="vl-row">
                <div className="vl-main">
                  <span className="vl-ko" lang="ko">{w.word}</span>
                  <span className="vl-vi">{w.meaningVi}</span>
                </div>
                <button className="vl-audio" onClick={() => playVocabularyAudio(w)} aria-label={`Nghe phát âm ${w.word}`}>
                  <Volume2 size={15} color="#7C6FE4" />
                </button>
                <button className="vl-star on" onClick={() => toggleStar(w.word)} aria-label="Bỏ đánh dấu từ khó">
                  <Star size={16} fill="#F0C24E" color="#F0C24E" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  TỪ VỰNG CỦA NGÀY — widget nhỏ trên Trang chủ, đổi mỗi ngày         */
/* ------------------------------------------------------------------ */
export function WordOfDayWidget({ onOpen, vocabulary = VOCAB_SAMPLE }) {
  const word = useMemo(() => {
    const d = todayStr();
    let seed = 0;
    for (let i = 0; i < d.length; i++) seed = (seed * 31 + d.charCodeAt(i)) >>> 0;
    return vocabulary[seed % vocabulary.length] || VOCAB_SAMPLE[0];
  }, [vocabulary]);
  return (
    <div className="wod-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}>
      <div className="wod-label"><Sparkles size={13} color="#F0912E" /> Từ vựng của ngày</div>
      <div className="wod-body">
        <span className="wod-ko" lang="ko">{word.word}</span>
        <span className="wod-vi">{word.meaningVi}</span>
      </div>
      <button className="wod-audio" onClick={(e) => { e.stopPropagation(); playVocabularyAudio(word); }} aria-label={`Nghe phát âm ${word.word}`}>
        <Volume2 size={16} color="#fff" />
      </button>
    </div>
  );
}


export function FlashcardView({ lesson, userId, onBack, onFinish, onProgress, initialTab, deckWords, deckTitle, vocabulary = VOCAB_SAMPLE, grammar = GRAMMAR_SAMPLE, includeMastered = false }) {
  const [contentTab, setContentTab] = useState(initialTab || "vocab"); // "vocab" | "grammar"
  const [grammarIdx, setGrammarIdx] = useState(0);
  const [grammarFlipped, setGrammarFlipped] = useState(false);
  const deck = deckWords && deckWords.length ? deckWords : vocabulary;
  const isIdentifiedDeck = Boolean(deckWords?.length && deckWords.every((word) => word.id && word.lessonId && word.textbookId));
  // Hàng đợi phiên học: mảng chỉ số vào `deck`. "Chưa thuộc" đẩy từ đó xuống
  // cuối hàng đợi để lặp lại trong CÙNG phiên, cho đến khi được "Đã thuộc".
  const [queue, setQueue] = useState(() => deck.map((_, i) => i));
  const [masteredCount, setMasteredCount] = useState(0);
  const [turn, setTurn] = useState(0); // tăng mỗi lần chuyển thẻ — dùng để reset mặt lật kể cả khi thẻ bị đẩy lại ngay (hàng đợi chỉ còn 1 từ)
  const [progress, setProgress] = useState({});   // { [word]: { box, lastRating, dueAt, timesReviewed, starred, note } }
  const [loaded, setLoaded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isRecheck, setIsRecheck] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef({ active: false, startX: 0 });
  const loadedDeckRef = useRef("");
  const total = deck.length;
  const card = deck[queue[0]];
  const storageKey = vocabProgressKey(lesson, userId);
  // Phiên đang học cũng phải theo tài khoản và đồng bộ thiết bị. Tiền tố
  // `progress:` khiến storage shim lưu vào user_progress_states (Supabase),
  // thay vì localStorage của trình duyệt.
  const sessionKey = `progress:flashcard-session:${lesson?.textbookId || "textbook"}:${lesson?.id || lesson?.no || "lesson"}:${userId || "anonymous"}`;
  const hasRemoteVocabulary = Boolean(userId && lesson?.id && lesson?.textbookId);
  const cardProgress = card ? progress[card.word] : null;
  const gram = grammar[grammarIdx];

  useEffect(() => { setGrammarFlipped(false); }, [grammarIdx]);

  useEffect(() => {
    const deckLoadKey = `${storageKey}:${includeMastered ? "all" : "remaining"}:${isIdentifiedDeck ? "identified" : "lesson"}`;
    if (loadedDeckRef.current === deckLoadKey) return undefined;
    loadedDeckRef.current = deckLoadKey;
    let alive = true;
    (async () => {
      try {
        const res = await readScopedProgress(storageKey, legacyVocabProgressKey(lesson), userId);
        const localSaved = res?.value ? JSON.parse(res.value) : {};
        const remoteSaved = isIdentifiedDeck
          ? await loadRemoteVocabularyStateForWords(deckWords, userId)
          : await loadRemoteVocabularyState(lesson, userId);
        // A real lesson has one canonical source: vocabulary_progress. Keeping
        // another full copy in user_progress_states allowed slower, older
        // upserts to overwrite newer card ratings when the learner navigated
        // quickly. Local scoped data is retained only for sample/fallback decks.
        const saved = remoteSaved !== null ? remoteSaved : localSaved;
        if (alive) {
          let sessionState = {};
          try {
            sessionState = await loadRemoteFlashcardSession(sessionKey, userId) || {};
          } catch (e) { }

          let remaining = deck
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => includeMastered || saved[item.word]?.lastRating !== "good")
            .map(({ index }) => index);

          if (!includeMastered && Array.isArray(sessionState.words) && sessionState.words.length) {
            const remainingByWord = new Map(remaining.map((index) => [deck[index].word, index]));
            const restored = sessionState.words.map((word) => remainingByWord.get(word)).filter((index) => index !== undefined);
            const restoredSet = new Set(restored);
            remaining = [...restored, ...remaining.filter((index) => !restoredSet.has(index))];
          }

          setProgress(saved);
          setQueue(remaining);
          setMasteredCount(deck.filter((item) => saved[item.word]?.lastRating === "good").length);
          if (sessionState.contentTab === "grammar" && grammar.length) setContentTab("grammar");
          if (Number.isInteger(sessionState.grammarIdx) && grammar.length) {
            setGrammarIdx(Math.min(Math.max(sessionState.grammarIdx, 0), grammar.length - 1));
          }
        }
      } catch (e) {
        /* chưa có dữ liệu lưu trước đó — dùng mặc định rỗng */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [storageKey, sessionKey, userId, includeMastered, isIdentifiedDeck, hasRemoteVocabulary]);

  useEffect(() => {
    if (!loaded) return;
    void saveRemoteFlashcardSession(sessionKey, userId, {
      words: queue.map((index) => deck[index]?.word).filter(Boolean),
      contentTab,
      grammarIdx,
    });
  }, [loaded, contentTab, grammarIdx, sessionKey, userId]);

  // Mỗi khi chuyển thẻ (kể cả khi cùng 1 từ bị đẩy lại ngay do "Chưa thuộc"
  // và hàng đợi chỉ còn 1 từ): quay về mặt trước + nạp ghi chú đã lưu.
  useEffect(() => {
    setFlipped(false);
    setDragX(0);
    if (card) setNoteDraft(progress[card.word]?.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, loaded]);

  const persist = async (updated) => {
    setProgress(updated);
    try {
      const changed = card ? { [card.word]: updated[card.word] } : updated;
      if (isIdentifiedDeck) {
        await saveRemoteVocabularyStateForWords(deckWords, userId, changed);
      } else if (hasRemoteVocabulary) {
        await saveRemoteVocabularyState(lesson, userId, changed);
      } else {
        await saveScopedProgress(storageKey, JSON.stringify(updated));
      }
    } catch (e) {
      /* lưu thất bại — tiến trình vẫn hiển thị tạm trong phiên này */
    }
  };

  const rateAndAdvance = (ratingId) => {
    if (!card) return;
    const cur = progress[card.word];
    const box = nextBox(cur?.box, ratingId);
    const updated = {
      ...progress,
      [card.word]: {
        ...cur,
        box,
        lastRating: ratingId,
        dueAt: addDays(BOX_INTERVAL_DAYS[box]),
        timesReviewed: (cur?.timesReviewed || 0) + 1,
      },
    };
    if (ratingId !== "good") playIncorrectSound();
    if (isRecheck) setProgress(updated);
    else persist(updated);
    const wordIdx = queue[0];
    const nextQueue = ratingId === "good" ? queue.slice(1) : [...queue.slice(1), wordIdx];
    if (ratingId === "good") {
      if (!isRecheck && !deckTitle) {
        const completedItems = Object.fromEntries(
          deck
            .filter((item) => updated[item.word]?.lastRating === "good")
            .map((item) => [item.id || item.word, "correct"]),
        );
        saveRemoteActivityProgress(lesson?.textbookId, lesson?.id, "tuvung", completedItems, total)
          .then((percent) => onProgress?.("tuvung", percent))
          .catch(() => { });
      }
      if (isRecheck) setMasteredCount((c) => c + 1);
      else setMasteredCount(deck.filter((item) => updated[item.word]?.lastRating === "good").length);
    } else {
      // "Chưa thuộc" — đẩy xuống cuối hàng đợi để lặp lại trong cùng phiên
    }
    setQueue(nextQueue);
    void saveRemoteFlashcardSession(sessionKey, userId, {
      words: nextQueue.map((index) => deck[index].word),
      contentTab,
      grammarIdx,
    });
    setTurn((t) => t + 1);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1400);
  };
  const markKnown = () => rateAndAdvance("good");     // "Đã thuộc"
  const markUnknown = () => rateAndAdvance("forgot");  // "Chưa thuộc"

  const toggleStar = () => {
    if (!card) return;
    const cur = progress[card.word];
    persist({ ...progress, [card.word]: { ...cur, starred: !cur?.starred } });
  };

  const saveNote = () => {
    if (!card) return;
    const cur = progress[card.word];
    if ((cur?.note || "") === noteDraft) return;
    persist({ ...progress, [card.word]: { ...cur, note: noteDraft } });
  };

  // Vuốt thẻ sang trái (Chưa thuộc) / phải (Đã thuộc) — chỉ kích hoạt sau khi
  // đã lật thẻ, giữ nút bấm làm cách thao tác chính, vuốt là tuỳ chọn thêm.
  const SWIPE_THRESHOLD = 90;
  const onDragStart = (e) => {
    if (!flipped) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current = { active: true, startX: x };
  };
  const onDragMove = (e) => {
    if (!dragRef.current.active) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setDragX(x - dragRef.current.startX);
  };
  const onDragEnd = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (dragX > SWIPE_THRESHOLD) markKnown();
    else if (dragX < -SWIPE_THRESHOLD) markUnknown();
    setDragX(0);
  };

  const starred = !!cardProgress?.starred;

  return (
    <section className="fc2-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về bài học">
            <ChevronLeft size={20} />
          </button>
          <span className="fc2-title"><BookOpen size={18} color="#7C6FE4" /> Từ vựng & Ngữ pháp</span>
        </div>
        <div className="fc2-top-mid">
          <span className="fc2-progress-text">{contentTab === "vocab" ? `Đã thuộc ${masteredCount} / ${total}` : `${grammar.length} điểm`}</span>
          <div className="fc2-progress-bar">{contentTab === "vocab" && <div style={{ width: `${(masteredCount / total) * 100}%` }} />}</div>
        </div>
        <div className="fc2-top-right">
          <span className="fc2-pill xp"><Star size={13} fill="#F0C24E" color="#F0C24E" /> <UserXpCount /> XP</span>
          <span className="fc2-pill gem"><DiamondIcon size={14} /> <UserGemCount /></span>
          <button className="fc2-gear" aria-label="Cài đặt"><Settings size={17} /></button>
        </div>
      </div>

      <div className="fc2-content-tabs">
        <button className={`fc2-content-tab ${contentTab === "vocab" ? "on" : ""}`} onClick={() => setContentTab("vocab")}>
          <BookOpen size={14} /> <span>Từ vựng</span> <span className="fc2-content-tab-count">{deck.length}</span>
        </button>
        <button className={`fc2-content-tab ${contentTab === "grammar" ? "on" : ""}`} onClick={() => setContentTab("grammar")}>
          <NotebookPen size={14} /> <span>Ngữ pháp</span> <span className="fc2-content-tab-count">{grammar.length}</span>
        </button>
      </div>

      {contentTab === "grammar" ? (
        <>
          <div className="fc2-flip-label">{grammarFlipped ? "Mặt sau" : "Mặt trước"}</div>

          <div className="fc2-flip-outer">
            <div className={`fc2-flip-inner ${grammarFlipped ? "is-flipped" : ""}`}>
              {/* MẶT TRƯỚC */}
              <div className="fc2-face front gm-front" onClick={() => setGrammarFlipped(true)}>
                <span className="gm-badge" style={{ background: gram.color }}>
                  <Star size={12} fill="#fff" color="#fff" /> NGỮ PHÁP {String(gram.no).padStart(2, "0")}
                </span>
                <h2 className="gm-pattern" style={{ color: gram.color }} lang="ko">{gram.pattern}</h2>
                {gram.img && <img className="gm-illus" src={gram.img} alt={`Minh hoạ ${gram.pattern}`} />}
                <button className="fc2-flip-hint" onClick={(e) => { e.stopPropagation(); setGrammarFlipped(true); }}>
                  <RotateCcw size={13} /> Lật thẻ
                </button>
              </div>

              {/* MẶT SAU */}
              <div
                className="fc2-face back"
                onClick={(e) => {
                  if (!e.target.closest("button, textarea, input, a")) setGrammarFlipped(false);
                }}
              >
                <div className="fc2-back-scroll">
                  <div className="gm-top-row">
                    <div className="gm-box">
                      <div className="gm-box-title"><Target size={14} color={gram.color} /> BỐI CẢNH</div>
                      <p>{gram.context}</p>
                    </div>
                    <div className="gm-box">
                      <div className="gm-box-title"><MessageCircle size={14} color={gram.color} /> TẠM DỊCH</div>
                      <p>{gram.translation}</p>
                    </div>
                  </div>

                  <div className="fc2-section">
                    <div className="fc2-sec-title">🧩 CÔNG THỨC</div>
                    <div className="gm-formula">
                      {gram.formula.map((f, i) => (
                        <div key={i} className="gm-formula-row">
                          <div className="gm-formula-left">
                            {f.subject && <span className="gm-formula-subj">{f.subject}</span>}
                            <span>{f.condition}</span>
                          </div>
                          <span className="gm-formula-plus">+</span>
                          <span className="gm-formula-form" style={{ color: gram.color }} lang="ko">{f.form}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fc2-section">
                    <div className="fc2-sec-title">💡 VÍ DỤ</div>
                    <div className="gm-examples">
                      {gram.examples.map((ex, i) => (
                        <div key={i} className="gm-example-row">
                          <div className="gm-example-text">
                            <p className="gm-example-ko" lang="ko">{renderKo(ex.ko)}</p>
                            <p className="gm-example-vi">{ex.vi}</p>
                          </div>
                          <button className="gm-example-audio" onClick={() => speakKo(ex.ko)} aria-label="Nghe câu">
                            <Volume2 size={11} color="#fff" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fc2-section">
                    <div className="fc2-sec-title">⭐ LƯU Ý</div>
                    <ul className="gm-notes">
                      {gram.notes.map((n, i) => (<li key={i}>{n}</li>))}
                    </ul>
                  </div>

                  {gram.tip && (
                    <div className="gm-tip-box">
                      <div className="gm-tip-title">💡 MẸO NHỎ</div>
                      <p>{gram.tip.rule}</p>
                      <div className="gm-tip-example" lang="ko">{gram.tip.example}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="fc-nav">
            <button className="fc-nav-btn" disabled={grammarIdx === 0} onClick={() => setGrammarIdx((i) => i - 1)}>
              <ChevronLeft size={18} /> Trước
            </button>
            <div className="fc-dots">
              {grammar.map((_, i) => (
                <button key={i} className={`fc-dot ${i === grammarIdx ? "on" : ""}`} onClick={() => setGrammarIdx(i)} aria-label={`Ngữ pháp ${i + 1}`} />
              ))}
            </div>
            <button className="fc-nav-btn primary" disabled={grammarIdx === grammar.length - 1} onClick={() => setGrammarIdx((i) => i + 1)}>
              Tiếp <ChevronRight size={18} />
            </button>
          </div>
        </>
      ) : queue.length === 0 ? (
        <div className="fc2-session-done">
          <div className="fc2-session-done-emoji">🎉</div>
          <h3>Đã thuộc hết {total} từ!</h3>
          <p>Bạn đã học xong toàn bộ {deckTitle ? deckTitle : "bộ thẻ"} trong phiên này. Bạn có muốn kiểm tra lại không?</p>
          <div className="fc2-session-done-actions">
            <button className="fc2-act-btn" onClick={onFinish}><ChevronLeft size={16} /> Về bài học</button>
            <button className="fc2-act-btn primary" onClick={() => { setIsRecheck(true); setQueue(deck.map((_, index) => index)); setMasteredCount(0); setTurn((value) => value + 1); }}>
              <RotateCcw size={16} /> Kiểm tra lại
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="fc2-flip-label">{flipped ? "Mặt sau" : "Mặt trước"}</div>

          <div
            className="fc2-flip-outer"
            style={{ transform: dragX ? `translateX(${dragX}px) rotate(${dragX / 20}deg)` : undefined }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerLeave={onDragEnd}
          >
            <div className={`fc2-flip-inner ${flipped ? "is-flipped" : ""}`}>
              {/* ================= MẶT TRƯỚC ================= */}
              <div className="fc2-face front" onClick={() => setFlipped(true)}>
                <button
                  className={`fc2-star ${starred ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleStar(); }}
                  aria-label="Đánh dấu quan trọng"
                >
                  <Star size={18} fill={starred ? "#F0C24E" : "none"} color={starred ? "#F0C24E" : "#C9BCF2"} />
                </button>
                {loaded && cardProgress?.box && <span className="fc2-box-pill">Hộp {cardProgress.box}/5</span>}

                <div className="fc2-word-line">
                  <h2 className="fc2-word" lang="ko">{card.word}</h2>
                  <button
                    className="fc2-audio-round"
                    onClick={(e) => { e.stopPropagation(); playVocabularyAudio(card); }}
                    aria-label={`Nghe phát âm ${card.word}`}
                  >
                    <Volume2 size={18} color="#fff" />
                  </button>
                </div>

                <div className="fc2-pill-row">
                  <span className="fc2-tag-pill">
                    <span lang="ko">{card.type}</span> <small>({wordClassVi(card.type)})</small>
                  </span>
                  <span className="fc2-tag-pill pron">
                    <span lang="ko">{card.pron}</span>
                  </span>
                </div>

                <div className="fc2-illus-holder"><CardIllustration src={card.img} word={card.word} /></div>

                {card.mnemonic && (
                  <>
                    <div className="fc2-divider" />
                    <div className="fc2-mnemonic">
                      💡 <b>Mẹo nhớ:</b> <span lang="ko">{card.mnemonic}</span>
                    </div>
                  </>
                )}

                <button className="fc2-flip-hint" onClick={(e) => { e.stopPropagation(); setFlipped(true); }}>
                  <RotateCcw size={13} /> Lật thẻ
                </button>
              </div>

              {/* ================= MẶT SAU ================= */}
              <div
                className="fc2-face back"
                onClick={(e) => {
                  if (!e.target.closest("button, textarea, input, a")) setFlipped(false);
                }}
              >
                <button
                  className={`fc2-star ${starred ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleStar(); }}
                  aria-label="Đánh dấu quan trọng"
                >
                  <Star size={18} fill={starred ? "#F0C24E" : "none"} color={starred ? "#F0C24E" : "#C9BCF2"} />
                </button>

                <div className="fc2-back-scroll">
                  <div className="fc2-meaning">
                    <span className="fc2-ribbon"><Star size={12} fill="#fff" color="#fff" /> Nghĩa</span>
                    <p className="fc2-meaning-text">{card.meaningVi}</p>
                    {card.noteVi && <p className="fc2-meaning-tip"><AlertTriangle size={13} color="#F59E0B" /> {card.noteVi}</p>}
                    <FcBunny />
                  </div>

                  {card.collocations && (
                    <div className="fc2-section">
                      <div className="fc2-sec-title"><Link2 size={13} color="#7C6FE4" /> Cụm từ hay đi chung</div>
                      <ul className="fc2-colloc-list">
                        {card.collocations.map((c, i) => (
                          <li key={i}>
                            <span lang="ko">{c.ko}</span> <span className="fc2-sep">:</span> {c.vi}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {card.dialogue && (
                    <div className="fc2-section">
                      <div className="fc2-sec-title">
                        <MessageSquare size={14} color="#7C6FE4" /> Ví dụ minh họa <small>(Câu giao tiếp thường dùng)</small>
                      </div>
                      <div className="fc2-dialog-list">
                        {card.dialogue.map((d, i) => (
                          <div key={i} className={`fc2-bubble-row ${d.spk === "B" ? "b" : ""}`}>
                            {d.spk === "A" ? <GirlAvatar /> : <BoyAvatar />}
                            <div className="fc2-bubble">
                              <p className="fc2-bubble-ko" lang="ko">{renderKo(d.ko)}</p>
                              <p className="fc2-bubble-vi">{d.vi}</p>
                              <button
                                className="fc2-bubble-audio"
                                onClick={() => speakKo(d.ko, { spk: d.spk })}
                                aria-label="Nghe câu"
                              >
                                <Volume2 size={11} color="#fff" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {card.example && (
                    <div className="fc2-section">
                      <div className="fc2-sec-title">💬 Ví dụ</div>
                      <div className="fc2-simple-example">
                        <p className="fc2-simple-ko" lang="ko">{renderKo(card.example.ko)}</p>
                        <p className="fc2-simple-vi">{card.example.vi}</p>
                        <button
                          className="fc2-simple-audio"
                          onClick={() => speakKo(card.example.ko)}
                          aria-label="Nghe câu ví dụ"
                        >
                          <Volume2 size={12} color="#fff" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="fc2-section note-sec">
                    <div className="fc2-sec-title">📝 Ghi chú của bạn</div>
                    <textarea
                      className="fc2-note"
                      placeholder="Nhấn để thêm ghi chú..."
                      value={noteDraft}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      onBlur={saveNote}
                      rows={2}
                    />
                  </div>
                </div>

                <button className="fc2-flip-hint back" onClick={() => setFlipped(false)}>
                  <RotateCcw size={13} /> Quay lại mặt trước
                </button>
              </div>
            </div>
          </div>

          {flipped ? (
            <div className="fc2-actions fc2-actions-2">
              <button className="fc2-act-btn known" onClick={markUnknown}>
                <XCircle size={17} /> Chưa thuộc
              </button>
              <button className="fc2-act-btn known primary" onClick={markKnown}>
                <CheckCircle2 size={17} /> Đã thuộc
              </button>
            </div>
          ) : (
            <p className="fc2-flip-prompt">Chạm vào thẻ (hoặc vuốt sau khi lật) để đánh giá bạn đã thuộc từ này chưa.</p>
          )}

          {justSaved && <div className="fc2-toast"><CheckCircle2 size={13} /> Đã lưu tiến trình</div>}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  MÀN CHỌN DẠNG BÀI TẬP TỪ VỰNG                                       */
/* ------------------------------------------------------------------ */
export function VocabTestSelectView({ lesson, onBack, onPick }) {
  return (
    <section className="qz-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về bài học">
            <ChevronLeft size={20} />
          </button>
          <div>
            <span className="fc2-title"><PencilLine size={18} color="#7C6FE4" /> Bài tập từ vựng</span>
            <div className="qz-subtitle">Chọn dạng bài tập bạn muốn luyện</div>
          </div>
        </div>
        <div className="fc2-top-right">
          <span className="fc2-pill"><Flame size={13} color="#F0642E" fill="#F79A5E" /> <UserStreakCount /></span>
          <span className="fc2-pill xp"><Star size={13} fill="#F0C24E" color="#F0C24E" /> <UserXpCount /> XP</span>
          <span className="fc2-pill gem"><DiamondIcon size={14} /> <UserGemCount /></span>
        </div>
      </div>

      <div className="qz-mode-grid">
        {TEST_MODES.map((m) => (
          <button
            key={m.id}
            className="qz-mode-card"
            style={{ "--mc": m.color, "--mbg": m.bg }}
            onClick={() => onPick(m.id)}
          >
            <span className="qz-mode-ico"><m.Icon size={24} color={m.color} /></span>
            <div className="qz-mode-head">
              <b>{m.label}</b>
              {m.tag && <span className="qz-mode-tag">{m.tag}</span>}
            </div>
            <p>{m.desc}</p>
            <span className="qz-mode-cta">Bắt đầu <ChevronRight size={14} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  DẠNG 1 — ĐIỀN VÀO CHỖ TRỐNG [NGHE]                                  */
/* ------------------------------------------------------------------ */
