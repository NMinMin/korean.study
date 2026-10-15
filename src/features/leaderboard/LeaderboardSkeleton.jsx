import '../community/community-skeleton.css';

export default function LeaderboardSkeleton() {
  return (
    <div className="community-skeleton" role="status" aria-label="Đang tải bảng xếp hạng...">
      <span className="community-skeleton-status">Đang tải bảng xếp hạng...</span>
      <div className="lb-list single-col" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <div className="lb-row single-col-row community-skeleton-card" key={index}>
            <span className="community-skeleton-block leaderboard-skeleton-rank" />
            <span className="community-skeleton-block community-skeleton-avatar" />
            <div className="lb-user-info community-skeleton-copy">
              <span className="community-skeleton-block community-skeleton-name" />
              <span className="community-skeleton-block community-skeleton-meta" />
            </div>
            <span className="lb-xp-pill leaderboard-skeleton-xp"><span className="community-skeleton-block community-skeleton-action" /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
