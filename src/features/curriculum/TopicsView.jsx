import React from 'react';
import { Type, ChevronLeft, Lightbulb, BookMarked, Plus } from 'lucide-react';

export default function TopicsView({ onBack }) {
  const placeholders = Array.from({ length: 6 });
  return (
    <section className="card page">
      <div className="card-title-row">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <div className="card-title"><Type size={19} color="#7C6FE4" /> Từ vựng · Theo chủ đề</div>
        </div>
      </div>
      <div className="page-note">
        <Lightbulb size={16} color="#E8A93D" fill="#F7D98B" />
        Danh sách chủ đề đang được biên soạn. Các chủ đề bạn thêm vào sẽ hiển thị ở đây.
      </div>
      <div className="topics-grid">
        {placeholders.map((_, i) => (
          <div key={i} className="topic-slot">
            <span className="topic-slot-ico"><BookMarked size={20} color="#C9BCF2" /></span>
            Chủ đề {i + 1}
            <small>Sắp ra mắt</small>
          </div>
        ))}
        <button className="add-book topic-add">
          <span className="add-circle"><Plus size={16} /></span>
          Thêm chủ đề
        </button>
      </div>
    </section>
  );
}
