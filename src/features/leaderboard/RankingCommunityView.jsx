import React, { useState } from 'react';
import { ChevronLeft, Trophy, MessageCircle } from 'lucide-react';
import LeaderboardView from './LeaderboardView';
import CommunityView from '../community/CommunityView';

export default function RankingCommunityView({ profile, onBack, onStudyCustomLesson, initialTab, textbooks = [] }) {
  const [tab, setTab] = useState(initialTab || 'xephang'); // 'xephang' | 'congdong'

  return (
    <section className="cg-page rank-community-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Trophy size={18} color="#F0912E" /> Xếp hạng & Cộng đồng</span>
        </div>
      </div>
      <div className="cg-tabs main-rank-comm-tabs">
        <button className={`cg-tab ${tab === 'xephang' ? 'on' : ''}`} onClick={() => setTab('xephang')}>
          <Trophy size={16} /> <span>Xếp hạng</span>
        </button>
        <button className={`cg-tab ${tab === 'congdong' ? 'on' : ''}`} onClick={() => setTab('congdong')}>
          <MessageCircle size={16} /> <span>Cộng đồng</span>
        </button>
      </div>
      <div className="rank-comm-body">
        {tab === 'xephang' ? (
          <LeaderboardView profile={profile} textbooks={textbooks} hideHeader />
        ) : (
          <CommunityView profile={profile} onStudyCustomLesson={onStudyCustomLesson} hideHeader />
        )}
      </div>
    </section>
  );
}
