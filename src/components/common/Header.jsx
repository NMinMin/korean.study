import React, { useState, useEffect } from 'react';
import { Flame, Bell, Hexagon, Star } from 'lucide-react';
import { Avatar } from './Mascots';
import { Bar } from './ProgressBar';
import { hasNewCommunityActivity } from '../../features/settings/studyPlanService';
import dashboardCardBackgroundUrl from '../../../UIUX/backgroundcard.png';
import dashboardCardMobileBackgroundUrl from '../../../UIUX/backgroundcard_mobile.png';

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function Header({ profile, stats, onOpenNotif }) {
  const [hasNotif, setHasNotif] = useState(false);

  const handleOpenNotifications = () => {
    setHasNotif(false);
    onOpenNotif?.();
  };

  useEffect(() => {
    let alive = true;
    if (!profile) return;
    hasNewCommunityActivity(profile.id).then((v) => { if (alive) setHasNotif(v); });
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => {
    const receive = () => setHasNotif(true);
    window.addEventListener('kstudy:notification-received', receive);
    return () => window.removeEventListener('kstudy:notification-received', receive);
  }, []);

  const xp = stats?.xp ?? 0;
  const xpMax = Math.max(200, Math.ceil((xp + 1) / 200) * 200);
  const level = Math.max(1, Math.floor(xp / 200) + 1);
  const xpPct = xpMax ? ((xp % 200) / 200) * 100 : 0;
  const streak = stats?.streak ?? 0;
  const name = profile?.displayName || 'bạn';

  return (
    <section
      className="header"
      style={{
        '--dashboard-card-background': `url("${dashboardCardBackgroundUrl}")`,
        '--dashboard-card-mobile-background': `url("${dashboardCardMobileBackgroundUrl}")`,
      }}
    >
      <div className="avatar-btn avatar-display" aria-label="Ảnh đại diện">
        <Avatar />
      </div>
      <div className="hello">
        <h1>{getGreeting()}, <span>{name}!</span> 👋</h1>
        <p>Hôm nay học một chút,<br />ngày mai tiến bộ hơn nhé! 💜</p>
        <div className="chips">
          <div className="chip">
            <div className="chip-ico" style={{ background: '#FDEDE3' }}><Flame size={20} color="#F0642E" fill="#F79A5E" /></div>
            <div><b>{streak}</b><small>Ngày streak</small></div>
          </div>
          <button className="chip chip-btn" onClick={handleOpenNotifications} aria-label={hasNotif ? 'Mở thông báo mới' : 'Mở thông báo'}>
            <div className="chip-ico" style={{ background: '#EBF4FD', position: 'relative' }}>
              <Bell size={20} color="#4A90E2" />
              {hasNotif && <span className="notif-dot notif-dot-sm" />}
            </div>
            <div><b>{hasNotif ? 'Mới' : '—'}</b><small>Thông báo</small></div>
          </button>
        </div>
      </div>
      <div className="level-card">
        <div className="level-top">
          <div className="hex">
            <Hexagon size={44} color="#7C6FE4" fill="#8B7BE8" strokeWidth={1.4} />
            <Star size={17} color="#fff" fill="#fff" className="hex-star" />
          </div>
          <div className="level-info">
            <b>Lv. {level}</b>
            <span className="xp-num">{xp.toLocaleString('vi-VN')} XP</span>
          </div>
        </div>
        <Bar pct={xpPct} color="#8B7BE8" h={9} />
        <div className="level-sub">Học viên chăm chỉ</div>
      </div>
    </section>
  );
}
