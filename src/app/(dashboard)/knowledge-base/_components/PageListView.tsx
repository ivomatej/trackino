'use client';

import type { KbFolder, KbPage, KbReview, KbPageStatus } from '@/types/database';
import type { KbMember } from './types';
import { getInitials, getFolderPath } from './utils';
import { STATUS_CONFIG } from './types';

// ── Page List View ────────────────────────────────────────────────────────────

export default function PageListView({ pages, folders, members, favorites, allReviews, filterLabel, filterIcon, onSelectPage, onNewPage }: {
  pages: KbPage[]; folders: KbFolder[]; members: KbMember[];
  favorites: Set<string>; allReviews: Pick<KbReview, 'page_id' | 'review_date' | 'is_done'>[]; filterLabel: string; filterIcon: React.ReactNode;
  onSelectPage: (id: string) => void; onNewPage: () => void;
}) {
  const sc = STATUS_CONFIG;
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-4 lg:p-6 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-hover)' }}>
              {filterIcon}
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{filterLabel}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pages.length} {pages.length === 1 ? 'stránka' : pages.length < 5 ? 'stránky' : 'stránek'}</p>
            </div>
          </div>
          <button type="button" onClick={onNewPage}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="hidden sm:inline">Nová stránka</span>
            <span className="sm:hidden">Nová</span>
          </button>
        </div>

        {/* Page list */}
        {pages.length === 0 ? (
          <div className="rounded-xl border px-6 py-14 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <svg className="mx-auto mb-3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné stránky</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            {pages.map((p, i) => {
              const path = getFolderPath(p.folder_id, folders);
              const author = members.find(m => m.user_id === (p.updated_by ?? p.created_by));
              const pageReviews = allReviews.filter(r => r.page_id === p.id && r.is_done && r.review_date);
              const lastReview = pageReviews.sort((a, b) => b.review_date!.localeCompare(a.review_date!))[0];
              return (
                <div key={p.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{ borderBottom: i < pages.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => onSelectPage(p.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
                      {favorites.has(p.id) && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" style={{ flexShrink: 0 }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {path && (
                        <span className="text-[11px] truncate flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          {path}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc[p.status].color }} />
                      <span className="text-[11px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>{sc[p.status].label}</span>
                    </div>
                    {author && (
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white hidden md:flex" style={{ background: author.avatar_color }}>
                        {getInitials(author.display_name)}
                      </div>
                    )}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {lastReview && (
                        <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)', opacity: 0.7 }} title="Datum poslední revize">
                          revize {new Date(lastReview.review_date!).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
