import React from 'react';
import { NotebookPen, ChevronLeft, BookOpen, ChevronDown, Check, Lock } from 'lucide-react';
import { FALLBACK_LESSONS } from '../../data/fallbackData';

export default function LessonsView({
  onBack,
  onSelect,
  onChangeTextbook,
  textbooks = [],
  activeTextbookId,
  continueLesson,
  lessons = FALLBACK_LESSONS,
  textbookTitle = 'Giáo trình tiếng Hàn',
  title = 'Từ vựng · Theo bài',
  backLabel = 'Quay lại'
}) {
  return (
    <section className="card page">
      <div className="card-title-row">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label={`Về ${backLabel}`}><ChevronLeft size={20} /></button>
          <div className="card-title"><NotebookPen size={19} color="#7C6FE4" /> {title}</div>
        </div>
      </div>
      <div className="lesson-book-tag">
        {textbooks.length > 1 ? (
          <label className="book-switcher">
            <BookOpen size={15} aria-hidden="true" />
            <select
              value={activeTextbookId || ''}
              onChange={(event) => onChangeTextbook?.(event.target.value)}
              aria-label="Chọn giáo trình"
            >
              {textbooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        ) : <span className="book-chip">{textbookTitle}</span>}
        <span className="lesson-count">{lessons.length} bài</span>
        {continueLesson && <span className="current-study-chip">Đang học · Bài {continueLesson.no}</span>}
      </div>
      <div className="lesson-list">
        {lessons.map((l) => {
          const isDone = l.status === 'done' || (l.progressPercent || 0) >= 100;
          return (
            <button
              key={l.no}
              className={`lesson-row ${isDone ? 'done' : l.status}`}
              disabled={l.status === 'locked'}
              onClick={() => onSelect(l)}
            >
              <span className="lesson-no">{l.no}과</span>
              <span className="lesson-main">
                <b>Bài {l.no}</b>
                <em>{l.title}</em>
              </span>
              <span className="lesson-words">{l.words} từ</span>
              {isDone && <span className="lesson-badge done-b"><Check size={11} /> Hoàn thành</span>}
              {!isDone && l.status === 'current' && <span className="lesson-badge cur-b">Đang học</span>}
              {!isDone && l.status === 'locked' && <span className="lesson-badge lock-b"><Lock size={11} /></span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ActivityLessonSelectView({
  title,
  icon: Icon,
  color,
  onBack,
  onSelect,
  lessons = FALLBACK_LESSONS,
  textbookTitle = 'Giáo trình tiếng Hàn',
  backLabel = 'Trang chủ'
}) {
  return (
    <section className="card page">
      <div className="card-title-row">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label={`Về ${backLabel}`}><ChevronLeft size={20} /></button>
          <div className="card-title"><Icon size={19} color={color} /> {title} · Chọn bài học</div>
        </div>
      </div>
      <p className="page-note" style={{ background: 'none', padding: 0, color: '#8B85AB' }}>
        Chọn bài học bạn muốn luyện — nội dung sẽ lấy đúng theo bài đó.
      </p>
      <div className="lesson-book-tag">
        <span className="book-chip">{textbookTitle}</span>
        <span className="lesson-count">{lessons.length} bài</span>
      </div>
      <div className="lesson-list">
        {lessons.map((l) => (
          <button
            key={l.no}
            className={`lesson-row ${l.status}`}
            disabled={l.status === 'locked'}
            onClick={() => onSelect(l)}
          >
            <span className="lesson-no">{l.no}과</span>
            <span className="lesson-main">
              <b>Bài {l.no}</b>
              <em>{l.title}</em>
            </span>
            {l.status === 'done' && <span className="lesson-badge done-b"><Check size={11} /> Hoàn thành</span>}
            {l.status === 'current' && <span className="lesson-badge cur-b">Đang học</span>}
            {l.status === 'locked' && <span className="lesson-badge lock-b"><Lock size={11} /> Chưa có nội dung</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
