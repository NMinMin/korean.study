import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, Send, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../utils/timeAgo';
import { useAppDialog } from '../../components/common/AppDialog';

export function CommentItem({ comment, replies = [], currentUserId, onReply, onDelete, onLike, likedComments = {} }) {
  const isAuthor = comment.userId === currentUserId;
  const isLiked = Boolean(likedComments[comment.id]);
  const likesCount = (comment.comment_likes?.length || 0) + (isLiked && !comment.comment_likes?.some((l) => l.user_id === currentUserId) ? 1 : 0);

  return (
    <div className="fb-comment-item">
      <div className="fb-comment-main">
        <span className="fb-avatar">{(comment.author || '?')[0].toUpperCase()}</span>
        <div className="fb-comment-content-wrap">
          <div className="fb-comment-bubble">
            <b className="fb-comment-author">{comment.author}</b>
            <p className="fb-comment-text">{comment.content}</p>
          </div>
          <div className="fb-comment-actions">
            <span className="fb-comment-time">{timeAgo(comment.createdAt)}</span>
            <button className={`fb-action-link ${isLiked ? 'liked' : ''}`} onClick={() => onLike(comment)}>
              {isLiked ? 'Đã thích' : 'Thích'}
            </button>
            <button className="fb-action-link" onClick={() => onReply(comment)}>
              Trả lời
            </button>
            {likesCount > 0 && (
              <span className="fb-comment-like-badge">
                <ThumbsUp size={11} fill="#1877F2" color="#1877F2" /> {likesCount}
              </span>
            )}
            {isAuthor && (
              <button className="fb-action-link delete" onClick={() => onDelete(comment)}>
                Xoá
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="fb-replies-list">
          {replies.map((reply) => {
            const isReplyAuthor = reply.userId === currentUserId;
            const isReplyLiked = Boolean(likedComments[reply.id]);
            const replyLikesCount = (reply.comment_likes?.length || 0) + (isReplyLiked && !reply.comment_likes?.some((l) => l.user_id === currentUserId) ? 1 : 0);
            return (
              <div key={reply.id} className="fb-comment-item fb-reply-item">
                <div className="fb-comment-main">
                  <span className="fb-avatar small">{(reply.author || '?')[0].toUpperCase()}</span>
                  <div className="fb-comment-content-wrap">
                    <div className="fb-comment-bubble">
                      <b className="fb-comment-author">{reply.author}</b>
                      <p className="fb-comment-text">{reply.content}</p>
                    </div>
                    <div className="fb-comment-actions">
                      <span className="fb-comment-time">{timeAgo(reply.createdAt)}</span>
                      <button className={`fb-action-link ${isReplyLiked ? 'liked' : ''}`} onClick={() => onLike(reply)}>
                        {isReplyLiked ? 'Đã thích' : 'Thích'}
                      </button>
                      <button className="fb-action-link" onClick={() => onReply(comment, reply)}>
                        Trả lời
                      </button>
                      {replyLikesCount > 0 && (
                        <span className="fb-comment-like-badge">
                          <ThumbsUp size={11} fill="#1877F2" color="#1877F2" /> {replyLikesCount}
                        </span>
                      )}
                      {isReplyAuthor && (
                        <button className="fb-action-link delete" onClick={() => onDelete(reply)}>
                          Xoá
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CommentSection({ post, currentUserId, currentUserDisplayName, commentsLocked }) {
  const dialog = useAppDialog();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [likedComments, setLikedComments] = useState({});
  const replyInputRef = useRef(null);

  const loadComments = async () => {
    if (!supabase || !post.key) return;
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id, post_id, user_id, parent_id, content, created_at, profiles!comments_user_id_fkey(display_name), comment_likes(user_id)')
        .eq('post_id', post.key)
        .eq('status', 'visible')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const formatted = (data || []).map((c) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        parentId: c.parent_id,
        author: c.profiles?.display_name || 'Người học',
        content: c.content,
        createdAt: new Date(c.created_at).getTime(),
        comment_likes: c.comment_likes || [],
      }));
      setLikedComments(Object.fromEntries(formatted.filter((c) => c.comment_likes?.some((l) => l.user_id === currentUserId)).map((c) => [c.id, true])));
      setComments(formatted);
    } catch (e) { }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadComments();
    if (!supabase) return;
    const channel = supabase
      .channel(`post_comments_${post.key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.key}` }, () => {
        loadComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.key]);

  const handleAddComment = async (parentId = null, text = draft) => {
    if (!text.trim() || submitting || !supabase || !currentUserId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: post.key,
        user_id: currentUserId,
        parent_id: parentId,
        content: text.trim(),
      });
      if (error) throw error;
      if (parentId) {
        setReplyDraft('');
        setReplyingTo(null);
      } else {
        setDraft('');
      }
      await loadComments();
    } catch (e) { }
    finally { setSubmitting(false); }
  };

  const handleDeleteComment = async (comment) => {
    if (!supabase || !currentUserId || comment.userId !== currentUserId) return;
    const confirmed = await dialog.confirm({
      title: comment.parentId ? 'Xóa phản hồi?' : 'Xóa bình luận?',
      message: comment.parentId
        ? 'Phản hồi này sẽ bị xóa vĩnh viễn và không thể hoàn tác.'
        : 'Bình luận cùng các phản hồi bên dưới sẽ bị xóa vĩnh viễn và không thể hoàn tác.',
      variant: 'warning',
      confirmLabel: comment.parentId ? 'Xóa phản hồi' : 'Xóa bình luận',
      cancelLabel: 'Giữ lại',
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('comments').delete().eq('id', comment.id);
      if (error) throw error;
      setComments((list) => list.filter((c) => c.id !== comment.id && c.parentId !== comment.id));
    } catch (e) {
      await dialog.alert({
        title: 'Chưa thể xóa bình luận',
        message: 'Không thể xóa nội dung này lúc này. Vui lòng thử lại sau.',
        variant: 'error',
      });
    }
  };

  const handleToggleLikeComment = async (comment) => {
    if (!supabase || !currentUserId) return;
    const wasLiked = Boolean(likedComments[comment.id]);
    try {
      const query = wasLiked
        ? supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_id', currentUserId)
        : supabase.from('comment_likes').insert({ comment_id: comment.id, user_id: currentUserId });
      const { error } = await query;
      if (error) throw error;
      setLikedComments((curr) => ({ ...curr, [comment.id]: !wasLiked }));
    } catch (e) { }
  };

  const handleStartReply = (parentComment, targetReply = null) => {
    setReplyingTo({
      parentComment,
      replyAuthor: targetReply ? targetReply.author : parentComment.author,
    });
    setReplyDraft(targetReply ? `@${targetReply.author} ` : '');
    setTimeout(() => {
      replyInputRef.current?.focus();
    }, 50);
  };

  const rootComments = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map();
  for (const c of comments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) || [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }

  return (
    <div className="fb-comments-container">
      {/* List of comments */}
      {loading ? (
        <div className="fb-comments-loading">Đang tải bình luận...</div>
      ) : rootComments.length === 0 ? (
        <div className="fb-no-comments">Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ ý kiến!</div>
      ) : (
        <div className="fb-comments-list">
          {rootComments.map((comment) => (
            <div key={comment.id} className="fb-comment-thread">
              <CommentItem
                comment={comment}
                replies={repliesByParent.get(comment.id) || []}
                currentUserId={currentUserId}
                onReply={(parent, target) => handleStartReply(parent, target)}
                onDelete={handleDeleteComment}
                onLike={handleToggleLikeComment}
                likedComments={likedComments}
              />
              {/* Inline reply composer for this thread */}
              {replyingTo?.parentComment?.id === comment.id && !commentsLocked && (
                <div className="fb-reply-composer">
                  <span className="fb-avatar small">{(currentUserDisplayName || 'B')[0].toUpperCase()}</span>
                  <div className="fb-reply-input-wrap">
                    <div className="fb-reply-to-tag">
                      <span>Đang trả lời <b>{replyingTo.replyAuthor}</b></span>
                      <button className="fb-reply-cancel-btn" onClick={() => setReplyingTo(null)}>✕</button>
                    </div>
                    <div className="fb-input-row">
                      <input
                        ref={replyInputRef}
                        type="text"
                        className="fb-reply-input"
                        placeholder={`Trả lời ${replyingTo.replyAuthor}...`}
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(comment.id, replyDraft);
                          }
                        }}
                      />
                      <button
                        className="fb-send-btn"
                        disabled={!replyDraft.trim() || submitting}
                        onClick={() => handleAddComment(comment.id, replyDraft)}
                        aria-label="Gửi trả lời"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Comment Composer */}
      {commentsLocked ? (
        <div className="fb-comments-locked-notice">
          <Lock size={14} /> Bài viết này đã khóa tính năng bình luận.
        </div>
      ) : (
        <div className="fb-main-composer">
          <span className="fb-avatar">{(currentUserDisplayName || 'B')[0].toUpperCase()}</span>
          <div className="fb-main-input-wrap">
            <input
              type="text"
              className="fb-main-input"
              placeholder="Viết bình luận công khai..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment(null, draft);
                }
              }}
            />
            <button
              className="fb-send-btn"
              disabled={!draft.trim() || submitting}
              onClick={() => handleAddComment(null, draft)}
              aria-label="Gửi bình luận"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
