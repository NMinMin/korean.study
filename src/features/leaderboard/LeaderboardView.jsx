import React, { useState, useEffect } from 'react';
import {
  Trophy, BookOpen, ChevronLeft, ChevronRight, Crown, Medal, Flame, Sparkles
} from 'lucide-react';
import AppCombobox from '../../components/common/AppCombobox';
import { computeLeaderboard } from './leaderboardApi';

export default function LeaderboardView({ profile, onBack, hideHeader, textbooks = [] }) {
  const [selectedTextbookId, setSelectedTextbookId] = useState('');
  const [page, setPage] = useState(1);
  const [lb, setLb] = useState(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await computeLeaderboard(profile, selectedTextbookId || null, page, pageSize);
      setLb(res);
    } catch (e) {
      setLb({ rows: [], myRank: null, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile, selectedTextbookId, page]);

  const totalPages = Math.max(1, Math.ceil((lb?.total || 0) / pageSize));

  const textbookOptions = [
    { value: '', label: 'Tất cả giáo trình' },
    ...textbooks.map((b) => ({ value: b.id, label: b.title })),
  ];

  return (
    <div className="leaderboard-view-container">
      {!hideHeader && (
        <div className="fc2-topbar">
          <div className="fc2-top-left">
            <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
            <span className="fc2-title"><Trophy size={18} color="#F0912E" /> Bảng xếp hạng</span>
          </div>
        </div>
      )}

      {/* Filter and selector */}
      <div className="lb-header-bar">
        <div className="lb-selector-wrap">
          <label className="lb-selector-label">
            <BookOpen size={16} color="#7C6FE4" />
            <span>Giáo trình:</span>
          </label>
          <AppCombobox
            value={selectedTextbookId}
            options={textbookOptions}
            onChange={(val) => { setSelectedTextbookId(val); setPage(1); }}
          />
        </div>
        {lb && (
          <div className="lb-summary-count">
            Tổng cộng <b>{lb.total || 0}</b> học viên có XP
          </div>
        )}
      </div>

      <p className="cg-sub" style={{ marginTop: '4px', marginBottom: '16px' }}>
        Xếp hạng theo điểm kinh nghiệm (XP) tích luỹ từ bài học thật · 10 học viên / trang.
      </p>

      {/* My Rank Highlight if available */}
      {lb?.myRank && (
        <div className="lb-my-rank-card">
          <div className="lb-my-rank-badge">
            <Trophy size={18} color="#F0912E" />
            <span>Vị trí của bạn: <b>Hạng #{lb.myRank}</b></span>
          </div>
        </div>
      )}

      {loading && !lb ? (
        <div className="cg-loading"><Sparkles size={18} color="#7C6FE4" /> Đang tải bảng xếp hạng...</div>
      ) : !lb || lb.rows.length === 0 ? (
        <div className="cg-empty">
          <Trophy size={36} color="#C9BCF2" />
          <p>Chưa có học viên nào có điểm XP trong bảng xếp hạng này.</p>
        </div>
      ) : (
        <>
          <div className="lb-list single-col">
            {lb.rows.map((u, i) => {
              const isMe = u.userId === profile?.id;
              const rankNum = u.rank || (page - 1) * pageSize + i + 1;
              return (
                <div key={u.userId || u.displayName + i} className={`lb-row single-col-row ${isMe ? 'me' : ''} ${rankNum <= 3 ? `top-${rankNum}` : ''}`}>
                  <span className={`lb-rank-badge ${rankNum <= 3 ? `badge-top-${rankNum}` : ''}`}>
                    {rankNum === 1 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Crown size={15} color="#E58A00" /> 1</span>
                    ) : rankNum === 2 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Medal size={15} color="#6D758F" /> 2</span>
                    ) : rankNum === 3 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Medal size={15} color="#B35E17" /> 3</span>
                    ) : (
                      `#${rankNum}`
                    )}
                  </span>
                  <div className="lb-avatar-circle">
                    {(u.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div className="lb-user-info">
                    <span className="lb-name">
                      {u.displayName}
                      {isMe && <span className="lb-me-tag">bạn</span>}
                    </span>
                    <span className="lb-streak">
                      <Flame size={13} color="#F0642E" fill="#F79A5E" /> {u.streak} ngày liên tiếp
                    </span>
                  </div>
                  <div className="lb-xp-pill">
                    <Sparkles size={14} color="#7C6FE4" />
                    <b>{u.xp.toLocaleString('vi-VN')}</b> XP
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="lb-pagination">
              <button
                className="lb-page-btn nav"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Trang trước
              </button>

              <div className="lb-page-numbers">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <React.Fragment key={pageNum}>
                        {prev && pageNum - prev > 1 && <span className="lb-page-dots">...</span>}
                        <button
                          className={`lb-page-btn num ${page === pageNum ? 'active' : ''}`}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                className="lb-page-btn nav"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Trang sau <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
