import React from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import LeaderboardView from './LeaderboardView';

export default function RankingCommunityView({ profile, onBack, textbooks = [] }) {
  return (
    <section className="cg-page rank-community-page">
      <div className="fc2-topbar">
        <div className="fc2-top-left">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <span className="fc2-title"><Trophy size={18} color="#F0912E" /> Xếp hạng</span>
        </div>
      </div>
      <div className="rank-comm-body">
        <LeaderboardView profile={profile} textbooks={textbooks} hideHeader />
      </div>
    </section>
  );
}
