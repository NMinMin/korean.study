import React from 'react';
import { PencilLine, Trophy, Settings, ChevronLeft } from 'lucide-react';

export const COMING_SOON = {
  ontap: { label: 'Ôn tập', icon: PencilLine, desc: 'Tổng hợp từ vựng và ngữ pháp đã học, giúp bạn tự đánh giá mức độ ghi nhớ.' },
  xephang: { label: 'Xếp hạng', icon: Trophy, desc: 'Bảng xếp hạng học viên chăm chỉ — thi đua cùng bạn bè và cộng đồng.' },
  caidat: { label: 'Cài đặt', icon: Settings, desc: 'Tuỳ chỉnh tài khoản, thông báo và các thiết lập khác của ứng dụng.' },
};

export default function ComingSoonView({ modeId, onBack }) {
  const info = COMING_SOON[modeId] || COMING_SOON.ontap;
  const Icon = info.icon;
  return (
    <section className="card page soon-page">
      <div className="card-title-row">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label="Quay lại"><ChevronLeft size={20} /></button>
          <div className="card-title"><Icon size={19} color="#7C6FE4" /> {info.label}</div>
        </div>
      </div>
      <div className="soon-box">
        <div className="soon-ico"><Icon size={38} color="#7C6FE4" /></div>
        <h3>Tính năng đang được phát triển</h3>
        <p>{info.desc}</p>
        <button className="primary-btn" onClick={onBack}>Về trang chủ</button>
      </div>
    </section>
  );
}
