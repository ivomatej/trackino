'use client';

import type { Bookmark, BookmarkComment, Member } from './types';
import { getInitials, getDomain, getFaviconUrl } from './utils';

interface BookmarkCardProps {
  b: Bookmark;
  userId: string;
  likes: Record<string, string[]>;
  favorites: Set<string>;
  comments: BookmarkComment[];
  getMember: (uid: string) => Member | undefined;
  openComments: string | null;
  setOpenComments: (id: string | null) => void;
  newComment: string;
  setNewComment: (v: string) => void;
  addingComment: boolean;
  editingComment: { id: string; content: string } | null;
  setEditingComment: (v: { id: string; content: string } | null) => void;
  toggleLike: (bId: string) => void;
  toggleFavorite: (bId: string) => void;
  openBmModal: (editing: Bookmark | null) => void;
  deleteBm: (b: Bookmark) => void;
  addComment: (bId: string) => void;
  deleteComment: (commentId: string) => void;
  updateComment: () => void;
}

export default function BookmarkCard({
  b, userId, likes, favorites, comments, getMember,
  openComments, setOpenComments, newComment, setNewComment, addingComment,
  editingComment, setEditingComment,
  toggleLike, toggleFavorite, openBmModal, deleteBm,
  addComment, deleteComment, updateComment,
}: BookmarkCardProps) {
  const author = getMember(b.created_by);
  const myLike = (likes[b.id] ?? []).includes(userId);
  const likeCount = (likes[b.id] ?? []).length;
  const isFav = favorites.has(b.id);
  const isOwner = b.created_by === userId;
  const bComments = comments.filter(c => c.bookmark_id === b.id);
  const domain = getDomain(b.url);
  const favicon = getFaviconUrl(b.url);
  const isCommentsOpen = openComments === b.id;

  return (
    <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-3">
        {/* Favicon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
          {favicon ? (
            <img src={favicon} alt="" width={20} height={20} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <a href={b.url} target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-sm hover:underline flex-shrink-0 max-w-full" style={{ color: 'var(--primary)' }}>
                  {b.title}
                </a>
                {b.description && (
                  <span className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--text-muted)' }}>
                    {b.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <a href={domain} target="_blank" rel="noopener noreferrer"
                  className="text-xs truncate hover:underline" style={{ color: 'var(--text-muted)' }}>
                  {domain.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(b.created_at).toLocaleDateString('cs-CZ')}</span>
                {author?.display_name && <>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{author.display_name}</span>
                </>}
                {b.is_shared && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary)20', color: 'var(--primary)' }}>Sdílená</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-wrap sm:flex-shrink-0">
              {/* Copy URL */}
              <button onClick={() => { navigator.clipboard.writeText(b.url); }}
                title="Kopírovat URL"
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              {/* Comments */}
              <button onClick={() => { setOpenComments(isCommentsOpen ? null : b.id); setNewComment(''); setEditingComment(null); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ color: isCommentsOpen ? 'var(--primary)' : 'var(--text-muted)', background: isCommentsOpen ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {bComments.length}
              </button>
              {/* Like */}
              <button onClick={() => toggleLike(b.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ color: myLike ? 'var(--primary)' : 'var(--text-muted)', background: myLike ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={myLike ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {likeCount}
              </button>
              {/* Favorite */}
              <button onClick={() => toggleFavorite(b.id)} title={isFav ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: isFav ? '#f59e0b' : 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
              {/* Edit */}
              {isOwner && (
                <button onClick={() => openBmModal(b)} title="Upravit"
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}
              {/* Delete */}
              {isOwner && (
                <button onClick={() => deleteBm(b)} title="Smazat"
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Comments panel */}
          {isCommentsOpen && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              {bComments.map(c => {
                const cm = getMember(c.user_id);
                const isMyComment = c.user_id === userId;
                const isEditing = editingComment?.id === c.id;
                return (
                  <div key={c.id} className="flex gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: cm?.avatar_color ?? 'var(--primary)', fontSize: '10px' }}>
                      {getInitials(cm?.display_name ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{cm?.display_name ?? 'Uživatel'}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('cs-CZ')}</span>
                        {isMyComment && !isEditing && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button onClick={() => setEditingComment({ id: c.id, content: c.content })}
                              title="Upravit komentář"
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                              style={{ color: 'var(--text-muted)' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => deleteComment(c.id)}
                              title="Smazat komentář"
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                              style={{ color: 'var(--danger)' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-1">
                          <textarea
                            value={editingComment.content}
                            onChange={e => setEditingComment({ ...editingComment, content: e.target.value })}
                            rows={2}
                            className="w-full px-2 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                          />
                          <div className="flex gap-1.5 mt-1">
                            <button onClick={updateComment}
                              className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                              style={{ background: 'var(--primary)' }}>
                              Uložit
                            </button>
                            <button onClick={() => setEditingComment(null)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                              Zrušit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2 mt-2">
                <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Přidat komentář…"
                  onKeyDown={e => e.key === 'Enter' && addComment(b.id)}
                  className="flex-1 px-3 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <button onClick={() => addComment(b.id)} disabled={addingComment || !newComment.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>Odeslat</button>
                <button onClick={() => { setOpenComments(null); setNewComment(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
