import React, { useState, useEffect } from 'react';
import {
  MessageCircle, MessageSquare, BookOpen, ChevronLeft, Plus, Sparkles,
  Heart, MessageCircle as MessageCircleIcon, Flag, Trash2, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../utils/timeAgo';
import { SwBunnyEmpty } from '../../components/common/Mascots';
import CommentSection from './CommentSection';
import ReportPostModal from './ReportPostModal';
import { CustomLessonHub } from './CustomLessons';

export default function CommunityView({ profile, onBack, onStudyCustomLesson, hideHeader }) {
  const [tab, setTab] = useState('feed'); // 'feed' | 'lessons'
  const [posts, setPosts] = useState(null);
  const [liked, setLiked] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [reportingPost, setReportingPost] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => { setToastMessage(''); }, 4000);
  };

  const loadPosts = async () => {
    try {
      if (!supabase) throw new Error('Supabase chưa được cấu hình');
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);
      const { data, error } = await supabase
        .from('posts')
        .select('id, user_id, content, created_at, comments_locked, profiles!posts_user_id_fkey(display_name), post_likes(user_id), comments(id)')
        .eq('status', 'visible')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLiked(Object.fromEntries((data || []).filter((post) => post.post_likes?.some((like) => like.user_id === session?.user?.id)).map((post) => [post.id, true])));
      setPosts((data || []).map((post) => ({
        key: post.id,
        userId: post.user_id,
        author: post.profiles?.display_name || 'Người học',
        content: post.content,
        createdAt: new Date(post.created_at).getTime(),
        likes: post.post_likes?.length || 0,
        commentCount: post.comments?.length || 0,
        commentsLocked: post.comments_locked,
        source: 'supabase',
      })));
    } catch (e) { setPosts([]); }
  };

  useEffect(() => {
    loadPosts();
    if (!supabase) return;
    const channel = supabase
      .channel('community_feed_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        loadPosts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const submitPost = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      if (!supabase) throw new Error('Supabase chưa được cấu hình');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      const { error } = await supabase.from('posts').insert({ user_id: session.user.id, content: draft.trim() });
      if (error) throw error;
      setDraft('');
      setShowCompose(false);
      await loadPosts();
    } catch (e) { }
    setPosting(false);
  };

  const toggleLike = async (post) => {
    try {
      if (!supabase || !currentUserId) throw new Error('Phiên đăng nhập đã hết hạn');
      const wasLiked = Boolean(liked[post.key]);
      const query = wasLiked
        ? supabase.from('post_likes').delete().eq('post_id', post.key).eq('user_id', currentUserId)
        : supabase.from('post_likes').insert({ post_id: post.key, user_id: currentUserId });
      const { error } = await query;
      if (error) throw error;
      setLiked((current) => ({ ...current, [post.key]: !wasLiked }));
      setPosts((current) => current.map((item) => item.key === post.key
        ? { ...item, likes: Math.max(0, (item.likes || 0) + (wasLiked ? -1 : 1)) }
        : item));
    } catch (e) { }
  };

  const toggleComments = (postKey) => {
    setOpenComments((curr) => ({ ...curr, [postKey]: !curr[postKey] }));
  };

  const deletePost = async (post) => {
    if (deletingKey) return;
    setDeletingKey(post.key);
    try {
      if (!supabase) throw new Error('Supabase chưa được cấu hình');
      const { error } = await supabase.from('posts').delete().eq('id', post.key);
      if (error) throw error;
      setPosts((ps) => ps.filter((p) => p.key !== post.key));
    } catch (e) { }
    setDeletingKey(null);
  };

  const handleReportSubmit = async (reason) => {
    if (!reportingPost || submittingReport) return;
    setSubmittingReport(true);
    try {
      if (!supabase) throw new Error('Supabase chưa được cấu hình');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Phiên đăng nhập đã hết hạn');
      const { error } = await supabase.from('content_reports').insert({
        reporter_id: session.user.id,
        post_id: reportingPost.key,
        reason: reason.trim(),
      });
      if (error) throw error;
      setReportingPost(null);
      showToast('✅ Đã gửi báo cáo bài viết đến quản trị viên.');
    } catch (e) {
      showToast('❌ ' + (e?.message || 'Không thể gửi báo cáo lúc này.'));
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="community-view-container">
      {!hideHeader ? (
        <div className="fc2-topbar">
          <div className="fc2-top-left">
            <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
            <span className="fc2-title"><MessageCircle size={18} color="#7C6FE4" /> Cộng đồng</span>
          </div>
        </div>
      ) : null}

      <div className="cg-tabs sub-community-tabs">
        <button className={`cg-tab ${tab === 'feed' ? 'on' : ''}`} onClick={() => setTab('feed')}>
          <MessageSquare size={16} /> <span>Bảng tin</span>
        </button>
        <button className={`cg-tab ${tab === 'lessons' ? 'on' : ''}`} onClick={() => setTab('lessons')}>
          <BookOpen size={16} /> <span>Bài học tự tạo</span>
        </button>
      </div>

      {tab === 'feed' ? (
        <>
          <p className="cg-sub">Nơi mọi người học chia sẻ câu hay, mẹo nhớ, hay trải nghiệm học tập — mọi người dùng app đều thấy chung một bảng tin.</p>

          {!showCompose ? (
            <div className="cg-thread-starter">
              <span className="cg-post-avatar">{(profile?.displayName || '?')[0].toUpperCase()}</span>
              <button className="cg-thread-prompt" onClick={() => setShowCompose(true)}>
                <b>{profile?.displayName || 'Bạn'}</b>
                <span>Bạn đang nghĩ gì? Chia sẻ cùng cộng đồng...</span>
              </button>
              <button className="cg-new-btn" onClick={() => setShowCompose(true)}>
                <Plus size={15} /> Đăng bài
              </button>
            </div>
          ) : (
            <div className="cg-compose">
              <div className="cg-compose-main">
                <span className="cg-post-avatar">{(profile?.displayName || '?')[0].toUpperCase()}</span>
                <div className="cg-compose-body">
                  <div className="cg-compose-author">{profile?.displayName || 'Bạn'}</div>
                  <textarea
                    autoFocus
                    className="cg-compose-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Chia sẻ một câu tiếng Hàn, mẹo học hay trải nghiệm của bạn..."
                    rows={4}
                  />
                </div>
              </div>
              <div className="cg-compose-actions">
                <span className="cg-compose-spacer" />
                <button className="cg-cancel-btn" onClick={() => { setShowCompose(false); setDraft(''); }}>Huỷ</button>
                <button className="cg-post-btn" onClick={submitPost} disabled={!draft.trim() || posting}>
                  {posting ? 'Đang đăng...' : 'Đăng bài'}
                </button>
              </div>
            </div>
          )}

          {posts === null ? (
            <div className="cg-loading"><Sparkles size={18} color="#7C6FE4" /> Đang tải bảng tin...</div>
          ) : posts.length === 0 ? (
            <div className="cg-empty">
              <SwBunnyEmpty />
              <p>Chưa có bài viết nào — hãy là người đầu tiên chia sẻ!</p>
            </div>
          ) : (
            <div className="cg-feed">
              {posts.map((p) => {
                const isCommentsOpen = openComments[p.key] ?? true;
                return (
                  <div key={p.key} className="cg-post">
                    <div className="cg-post-head">
                      <span className="cg-post-avatar">{(p.author || '?')[0].toUpperCase()}</span>
                      <div className="cg-post-meta">
                        <b>{p.author}</b>
                        <span className="cg-post-time">{timeAgo(p.createdAt)}</span>
                      </div>
                    </div>
                    <p className="cg-post-body">{p.content}</p>

                    <div className="cg-post-actions">
                      <button className={`cg-like-btn ${liked[p.key] ? 'on' : ''}`} onClick={() => toggleLike(p)}>
                        <Heart size={14} fill={liked[p.key] ? '#E5566B' : 'none'} color={liked[p.key] ? '#E5566B' : 'currentColor'} /> {p.likes || 0}
                      </button>
                      <button className={`cg-comment-btn ${isCommentsOpen ? 'on' : ''}`} onClick={() => toggleComments(p.key)}>
                        <MessageCircleIcon size={14} /> {p.commentCount || 0}
                      </button>
                      {currentUserId && p.userId !== currentUserId && (
                        <button className="cg-report-btn" onClick={() => setReportingPost(p)} title="Báo cáo vi phạm">
                          <Flag size={13} /> Báo cáo
                        </button>
                      )}
                      {currentUserId && p.userId === currentUserId && (
                        <button className="cg-report-btn delete-post-btn" onClick={() => deletePost(p)} disabled={deletingKey === p.key} title="Xoá bài viết của bạn">
                          <Trash2 size={13} /> {deletingKey === p.key ? 'Đang xoá...' : 'Xoá'}
                        </button>
                      )}
                      {p.commentsLocked && (
                        <span className="cg-comments-locked"><Lock size={12} /> Đã khoá bình luận</span>
                      )}
                    </div>

                    {isCommentsOpen && (
                      <CommentSection
                        post={p}
                        currentUserId={currentUserId}
                        currentUserDisplayName={profile?.displayName}
                        commentsLocked={p.commentsLocked}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <CustomLessonHub profile={profile} onStudy={onStudyCustomLesson} />
      )}

      {toastMessage && (
        <div className="cg-toast-popup">
          <CheckCircle2 size={16} color="#3FA95C" />
          <span>{toastMessage}</span>
        </div>
      )}

      {reportingPost && (
        <ReportPostModal
          post={reportingPost}
          onClose={() => setReportingPost(null)}
          onSubmit={handleReportSubmit}
          submitting={submittingReport}
        />
      )}
    </div>
  );
}
