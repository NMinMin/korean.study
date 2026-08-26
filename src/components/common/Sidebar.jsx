import React from 'react';
import {
  BookOpen, NotebookPen, Target, Trophy, Settings, Home, Sparkles, ChevronRight, LogOut,
  MessageCircle
} from 'lucide-react';
import { DiamondIcon } from '../../data/fallbackData';
import { BunnyMascot } from './Mascots';

export const NAV_TILES = [
  { id: 'giaotrinh', label: 'Giáo trình', mobileLabel: 'Giáo trình', icon: BookOpen, color: '#4A90E2', bg: '#EEF4FD' },
  { id: 'nguphap', label: 'Từ vựng & Ngữ pháp', mobileLabel: 'Từ & Ngữ pháp', icon: NotebookPen, color: '#7C6FE4', bg: '#F0EEFC' },
  { id: 'thithu', label: 'Thi thử', mobileLabel: 'Thi thử', icon: Target, color: '#D15A87', bg: '#FBEAF2' },
  { id: 'xephanghub', label: 'Xếp hạng', mobileLabel: 'Xếp hạng', icon: Trophy, color: '#F0912E', bg: '#FDF3E7' },
  { id: 'congdong', label: 'Cộng đồng', mobileLabel: 'Cộng đồng', icon: MessageCircle, color: '#3FA95C', bg: '#EAF8EE' },
  { id: 'caidat', label: 'Cài đặt', mobileLabel: 'Cài đặt', icon: Settings, color: '#8B85AB', bg: '#F3F1FC' },
];

export default function Sidebar({ active, setActive, setView, goHome, onSignOut, isAdmin, gems = 0, onOpenShop, collapsed = false }) {
  const handleTileClick = (id) => {
    setActive(id);
    if (id === 'giaotrinh') setView('curriculum-hub');
    else if (id === 'nguphap') setView('nguphap-hub');
    else if (id === 'thithu') setView('mock-exam');
    else if (id === 'xephanghub') setView('xephang');
    else if (id === 'congdong') setView('congdong');
    else if (id === 'cuahang') { setView('cuahang'); onOpenShop?.(); }
    else if (id === 'caidat') setView('caidat');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="logo-row logo-row-btn" onClick={goHome} aria-label="Về trang chủ">
        <div className="logo-badge">한</div>
        <div className="logo-text">Korean <span>Study</span></div>
        <Sparkles size={16} color="#C9BCF2" />
      </button>

      <button className={`home-pill ${active === 'home' ? 'active' : ''}`} onClick={goHome} title="Trang chủ">
        <span className="home-pill-ico"><Home size={22} strokeWidth={2.2} /></span><span className="home-pill-label">Trang chủ</span>
      </button>

      <div className="nav-grid">
        {NAV_TILES.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button key={t.id} className={`nav-tile ${isActive ? 'active' : ''}`} onClick={() => handleTileClick(t.id)}>
              <span className="nav-tile-ico" style={{ background: isActive ? 'rgba(255,255,255,.25)' : t.bg }}>
                <Icon size={22} color={isActive ? '#fff' : t.color} />
              </span>
              <span className="nav-tile-label nav-label-desktop">{t.label}</span>
              <span className="nav-tile-label nav-label-mobile">{t.mobileLabel}</span>
            </button>
          );
        })}
        {isAdmin && (
          <button className="nav-tile admin-nav-button" onClick={() => { window.location.href = `${import.meta.env.BASE_URL}admin`; }}>
            <span className="nav-tile-ico"><Settings size={22} color="#8A5CF6" /></span>
            <span className="nav-tile-label">Quản trị</span>
          </button>
        )}
      </div>

      <div className="mascot"><BunnyMascot /></div>

      <button className={`gem-btn ${active === 'cuahang' ? 'active' : ''}`} onClick={() => { setActive('cuahang'); setView('cuahang'); onOpenShop?.(); }} aria-label={`Mở cửa hàng cây, hiện có ${gems} kim cương`}>
        <DiamondIcon size={18} />
        <span>{gems.toLocaleString('vi-VN')}</span>
        <ChevronRight size={16} className="gem-chev" />
      </button>
      <button className="sidebar-signout" onClick={onSignOut} aria-label="Đăng xuất khỏi tài khoản">
        <LogOut size={17} />
        <span>Đăng xuất</span>
      </button>
    </aside>
  );
}
