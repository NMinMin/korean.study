import './community-skeleton.css';

export default function CommunitySkeleton({ variant = 'feed', label = 'Đang tải bảng tin...' }) {
  const isFeed = variant === 'feed';

  return (
    <div className="community-skeleton" role="status" aria-label={label}>
      <span className="community-skeleton-status">{label}</span>
      <div className={isFeed ? 'cg-feed' : 'cl-list'} aria-hidden="true">
        {Array.from({ length: isFeed ? 3 : 2 }, (_, index) => (
          isFeed ? (
            <div className="cg-post community-skeleton-card" key={index}>
              <div className="cg-post-head">
                <span className="community-skeleton-block community-skeleton-avatar" />
                <div className="cg-post-meta community-skeleton-copy">
                  <span className="community-skeleton-block community-skeleton-name" />
                  <span className="community-skeleton-block community-skeleton-meta" />
                </div>
              </div>
              <div className="community-skeleton-copy community-skeleton-body">
                <span className="community-skeleton-block community-skeleton-line" />
                <span className="community-skeleton-block community-skeleton-line" />
                <span className="community-skeleton-block community-skeleton-short" />
              </div>
              <div className="community-skeleton-actions">
                <span className="community-skeleton-block community-skeleton-action" />
                <span className="community-skeleton-block community-skeleton-action" />
              </div>
            </div>
          ) : (
            <div className="cl-item community-skeleton-card" key={index}>
              <div className="cl-item-body community-skeleton-copy">
                <span className="community-skeleton-block community-skeleton-title" />
                <span className="community-skeleton-block community-skeleton-short" />
              </div>
              <div className="cl-item-actions">
                <span className="community-skeleton-block community-skeleton-button" />
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
