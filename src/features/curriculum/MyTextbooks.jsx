import React from 'react';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';
import { Bar } from '../../components/common/ProgressBar';

export default function MyTextbooks({ onOpenBook, onAddBook, books = [] }) {
  return (
    <section className="card">
      <div className="card-title-row">
        <div className="card-title"><BookOpen size={19} color="#7C6FE4" /> Giáo trình của tôi</div>
        <button className="link-btn" onClick={onAddBook}>Quản lý <ChevronRight size={15} /></button>
      </div>
      <div className="books-grid">
        {!books.length && (
          <div className="my-books-empty">
            <BookOpen size={22} />
            <span>Bạn chưa thêm giáo trình nào.</span>
          </div>
        )}
        {books.slice(0, 3).map((b, index) => {
          const pct = b.progressPercent ?? b.pct ?? 0;
          const isDone = pct >= 100 || b.userStatus === 'completed';
          return (
            <div
              key={b.id}
              className={`book-card ${b.hasContent ? 'clickable' : ''}`}
              onClick={b.hasContent ? () => onOpenBook(b) : undefined}
              role={b.hasContent ? 'button' : undefined}
              tabIndex={b.hasContent ? 0 : undefined}
            >
              <div className="book-3d small" style={{ '--bk': b.color || ['#7C6FE4', '#E5566B', '#4A90E2'][index] }}>
                세종<br />회화 {b.tag || b.slug?.split('-').slice(-2).join('-')}
              </div>
              <div className="book-meta">
                <b>{b.name || b.title}</b>
                <span className="studying">{isDone ? 'Đã hoàn thành' : b.userStatus === 'paused' ? 'Tạm dừng' : 'Đang học'}</span>
                <div className="book-bar">
                  <Bar pct={pct} color={b.color || '#7C6FE4'} h={7} />
                  <em>{pct}%</em>
                </div>
              </div>
            </div>
          );
        })}
        <button className="add-book" onClick={onAddBook}>
          <span className="add-circle"><Plus size={16} /></span>
          Thêm giáo trình
        </button>
      </div>
    </section>
  );
}
