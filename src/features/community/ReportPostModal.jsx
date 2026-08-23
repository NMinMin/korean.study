import React, { useState } from 'react';
import { Flag } from 'lucide-react';

export default function ReportPostModal({ post, onClose, onSubmit, submitting }) {
  const [category, setCategory] = useState('spam');
  const [detail, setDetail] = useState('');

  const reasons = [
    { key: 'spam', label: 'Spam, quảng cáo không phù hợp' },
    { key: 'inappropriate', label: 'Nội dung phản cảm, không lành mạnh' },
    { key: 'harassment', label: 'Quấy rối, công kích hoặc xúc phạm' },
    { key: 'off_topic', label: 'Nội dung không liên quan đến học tiếng Hàn' },
    { key: 'other', label: 'Lý do khác' },
  ];

  const handleConfirm = () => {
    const selectedLabel = reasons.find((r) => r.key === category)?.label || category;
    const finalReason = detail.trim() ? `${selectedLabel} — ${detail.trim()}` : selectedLabel;
    onSubmit(finalReason);
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div className="report-modal-title">
            <Flag size={19} color="#E5566B" />
            <span>Báo cáo bài viết</span>
          </div>
          <button className="report-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="report-modal-preview">
          <span className="cg-post-avatar small">{(post.author || '?')[0].toUpperCase()}</span>
          <div className="report-modal-preview-text">
            <b>{post.author}</b>
            <p>{post.content.length > 100 ? post.content.slice(0, 100) + '…' : post.content}</p>
          </div>
        </div>

        <div className="report-modal-body">
          <label className="report-modal-label">Lý do bạn báo cáo bài viết này:</label>
          <div className="report-reasons-list">
            {reasons.map((r) => (
              <label key={r.key} className={`report-reason-option ${category === r.key ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="reportReason"
                  value={r.key}
                  checked={category === r.key}
                  onChange={() => setCategory(r.key)}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>

          <label className="report-modal-label" style={{ marginTop: '12px' }}>
            Mô tả thêm (không bắt buộc):
          </label>
          <textarea
            className="report-modal-textarea"
            rows={3}
            placeholder="Cung cấp thêm chi tiết để đội ngũ kiểm duyệt xử lý..."
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>

        <div className="report-modal-footer">
          <button className="report-btn-cancel" onClick={onClose} disabled={submitting}>Huỷ</button>
          <button className="report-btn-submit" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
          </button>
        </div>
      </div>
    </div>
  );
}
