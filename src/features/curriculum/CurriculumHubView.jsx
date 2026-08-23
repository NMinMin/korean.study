import React from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';

export default function CurriculumHubView({ onBack, onOpenBook, onAddBook, myBooks = [], availableBooks = [], addingBookId, notice }) {
  const renderBook = (book, mode) => (
    <article key={book.id} className={`gm-hub-card ${book.hasContent ? 'has' : 'soon'} ${mode === 'discover' ? 'discover' : ''}`}>
      <span className="gm-hub-badge" style={{ color: '#4A90E2', background: '#EEF4FD' }}>GIÁO TRÌNH</span>
      <b lang="ko">{book.title}</b>
      {mode === 'discover' && (
        <p className="gm-hub-description">
          {book.description || book.titleVi || 'Giáo trình luyện hội thoại tiếng Hàn theo từng bài học, phù hợp để học và ôn tập hằng ngày.'}
        </p>
      )}
      <span className="gm-hub-count">
        {book.lessonCount ? `${book.lessonCount} bài học` : 'Chưa có nội dung'}
      </span>
      {mode === 'mine' ? (
        <button className="gm-book-action" disabled={!book.hasContent} onClick={() => onOpenBook(book)}>
          {book.hasContent ? 'Mở giáo trình' : 'Đang biên soạn'}<ChevronRight size={15} />
        </button>
      ) : (
        <button className="gm-book-action add" disabled={addingBookId === book.id} onClick={() => onAddBook(book)}>
          {addingBookId === book.id ? 'Đang thêm...' : 'Thêm vào giáo trình của tôi'}<Plus size={15} />
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
      {myBooks.length ? <div className="gm-hub-grid">{myBooks.map((book) => renderBook(book, 'mine'))}</div> : (
        <div className="curriculum-empty">
          <BookOpen size={28} /><b>Chưa có giáo trình</b>
          <span>Chọn một giáo trình ở mục Khám phá bên dưới để bắt đầu học.</span>
          <button type="button" className="curriculum-empty-action" onClick={() => document.getElementById('discover-textbooks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <Plus size={15} /> Thêm giáo trình
          </button>
        </div>
      )}
      <div className="curriculum-section-head discover-head" id="discover-textbooks">
        <div><h2>Khám phá giáo trình</h2><p>Các giáo trình đã xuất bản và chưa có trong danh sách của bạn.</p></div>
        <span>{availableBooks.length} giáo trình</span>
      </div>
      {availableBooks.length ? <div className="gm-hub-grid">{availableBooks.map((book) => renderBook(book, 'discover'))}</div> : (
        <div className="curriculum-empty compact"><Sparkles size={24} /><span>Bạn đã thêm tất cả giáo trình hiện có.</span></div>
      )}
    </section>
  );
}
