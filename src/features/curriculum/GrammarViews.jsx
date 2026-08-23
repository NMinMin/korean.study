import React from 'react';
import { NotebookPen, ChevronLeft, ChevronRight, BookOpen, Plus } from 'lucide-react';
import { GRAMMAR_SAMPLE, FALLBACK_LESSONS } from '../../data/fallbackData';

export function GrammarHubView({ onBack, onOpenBook, onAddBook, books = [] }) {
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
      ) : (
        <div className="grammar-catalog-list">
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
        </div>
      )}
    </section>
  );
}

export function GrammarBookView({ onBack, onSelectLesson, lessons = FALLBACK_LESSONS, grammar = GRAMMAR_SAMPLE, textbookTitle = 'Giáo trình tiếng Hàn' }) {
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
          const hasContent = l.status !== 'locked' && count > 0;
          return (
            <button
              key={l.no}
              className={`gm-lesson-row ${hasContent ? 'has' : 'soon'}`}
              onClick={() => hasContent && onSelectLesson(i)}
              disabled={!hasContent}
            >
              <span className="gm-lesson-no">{l.no}</span>
              <div className="gm-lesson-body">
                <b>Bài {l.no}</b>
                <span lang="ko">{l.title}</span>
              </div>
              <span className="gm-lesson-count">
                {hasContent ? `${count} mẫu ngữ pháp` : 'Chưa có nội dung'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
