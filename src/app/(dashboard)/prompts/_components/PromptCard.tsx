'use client';

import type { Prompt, Member } from './types';

interface PromptCardProps {
  p: Prompt;
  author: Member | undefined;
  myLike: boolean;
  likeCount: number;
  isFav: boolean;
  isOwner: boolean;
  codes: string[];
  commentCount: number;
  copied: string | null;
  onLike: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (text: string, key: string) => void;
}

export function PromptCard({
  p, author, myLike, likeCount, isFav, isOwner, codes, commentCount, copied, onLike, onFavorite, onEdit, onDelete, onCopy,
}: PromptCardProps) {
  return (
    <div key={p.id} className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm cursor-pointer hover:underline break-words" style={{ color: 'var(--text-primary)' }}
                onClick={onEdit}>
                {p.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('cs-CZ')}</span>
                {author?.display_name && <>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{author.display_name}</span>
                </>}
                {p.is_shared && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary)20', color: 'var(--primary)' }}>Sdílený</span>}
                {commentCount > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>💬 {commentCount}</span>}
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1 flex-wrap sm:flex-shrink-0">
              {/* Copy first code block */}
              {codes.length > 0 && (
                <button title="Kopírovat kód promptu" onClick={() => onCopy(codes[0], `code-${p.id}`)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                  style={{ color: copied === `code-${p.id}` ? 'var(--success)' : 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                  {copied === `code-${p.id}` ? '✓' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                  Kód
                </button>
              )}
              {/* Like */}
              <button onClick={onLike}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ color: myLike ? 'var(--primary)' : 'var(--text-muted)', background: myLike ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill={myLike ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {likeCount}
              </button>
              {/* Favorite */}
              <button onClick={onFavorite} title={isFav ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: isFav ? '#f59e0b' : 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
              {/* Edit */}
              {isOwner && (
                <button onClick={onEdit} title="Upravit"
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}
              {/* Delete */}
              {isOwner && (
                <button onClick={onDelete} title="Smazat"
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
        </div>
      </div>
    </div>
  );
}
