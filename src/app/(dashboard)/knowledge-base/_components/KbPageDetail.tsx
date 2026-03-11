'use client';

import type { KbPage, KbFolder, KbVersion, KbComment, KbReview, KbAccess, KbPageStatus } from '@/types/database';
import type { KbMember, PageTab } from './types';
import { STATUS_CONFIG } from './types';
import { getInitials, fmtDate, fmtDateTime, getFolderPath } from './utils';
import RichEditor from './RichEditor';
import PageViewer from './PageViewer';

// ── KB Page Detail (záhlaví + obsah + záložky) ────────────────────────────────

export interface KbPageDetailProps {
  selectedPage: KbPage;
  editing: boolean;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editContent: string;
  setEditContent: (v: string) => void;
  editStatus: KbPageStatus;
  setEditStatus: (v: KbPageStatus) => void;
  editFolderId: string | null;
  setEditFolderId: (v: string | null) => void;
  editRestricted: boolean;
  setEditRestricted: (v: (prev: boolean) => boolean) => void;
  saving: boolean;
  copiedPage: boolean;
  copiedPublicUrl: boolean;
  publishingPage: boolean;

  // Navigation
  listFilter: { type: string } | null;
  search: string;
  backToList: () => void;

  // Actions
  startEdit: (page: KbPage) => void;
  savePage: () => void;
  cancelEdit: () => void;
  deletePage: (id: string) => void;
  copyPageContent: () => void;
  togglePublish: (page: KbPage) => void;
  toggleFavorite: (pageId: string) => void;
  copyPublicUrl: (page: KbPage) => void;
  getPublicUrl: (page: KbPage) => string;
  handleChecklistToggle: (html: string) => void;
  canEditPage: (page: KbPage) => boolean;

  // Permissions
  canAdmin: boolean;

  // Data
  folders: KbFolder[];
  members: KbMember[];
  favorites: Set<string>;
  pages: KbPage[];

  // Tabs
  activeTab: PageTab;
  setActiveTab: (v: PageTab) => void;
  comments: KbComment[];
  versions: KbVersion[];
  reviews: KbReview[];
  access: KbAccess[];

  // Comment actions
  newComment: string;
  setNewComment: (v: string) => void;
  addComment: () => void;
  savingComment: boolean;
  editingComment: { id: string; content: string } | null;
  setEditingComment: (v: { id: string; content: string } | null) => void;
  updateComment: () => void;
  deleteComment: (id: string) => void;

  // Version + Review actions
  revertToVersion: (v: KbVersion) => void;
  toggleReviewDone: (id: string, done: boolean) => void;
  deleteReview: (id: string) => void;
  openReviewModal: () => void;

  // Access actions
  toggleUserAccess: (userId: string, canEdit: boolean) => void;
  setSelectedPage: React.Dispatch<React.SetStateAction<KbPage | null>>;
  setPages: React.Dispatch<React.SetStateAction<KbPage[]>>;

  // User info
  userId?: string;
  userDisplayName?: string;

  // Inline select for supabase
  onRestrictedToggle: (newVal: boolean) => void;

  // Page navigation
  onSelectPage: (id: string) => void;
}

export default function KbPageDetail({
  selectedPage, editing, editTitle, setEditTitle, editContent, setEditContent,
  editStatus, setEditStatus, editFolderId, setEditFolderId, editRestricted, setEditRestricted,
  saving, copiedPage, copiedPublicUrl, publishingPage,
  listFilter, search, backToList,
  startEdit, savePage, cancelEdit, deletePage, copyPageContent,
  togglePublish, toggleFavorite, copyPublicUrl, getPublicUrl,
  handleChecklistToggle, canEditPage,
  canAdmin, folders, members, favorites, pages,
  activeTab, setActiveTab, comments, versions, reviews, access,
  newComment, setNewComment, addComment, savingComment,
  editingComment, setEditingComment, updateComment, deleteComment,
  revertToVersion, toggleReviewDone, deleteReview, openReviewModal,
  toggleUserAccess, setSelectedPage, setPages,
  userId, userDisplayName,
  onRestrictedToggle,
  onSelectPage,
}: KbPageDetailProps) {
  const memberName = (uid: string) => members.find(m => m.user_id === uid)?.display_name ?? uid.slice(0, 8);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1 px-5 py-4 md:px-4 lg:px-8 lg:py-8 max-w-4xl w-full mx-auto">

        {/* Page header – actions row */}
        <div className="flex flex-col-reverse md:flex-row md:items-start gap-2 md:gap-3 mb-4 md:mb-6">
          {/* Title */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                onFocus={() => { if (selectedPage?.id.startsWith('__new__') && editTitle === 'Nová stránka') setEditTitle(''); }}
                className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 focus:outline-none pb-1 text-base sm:text-2xl"
                style={{ borderColor: 'var(--primary)', color: 'var(--text-primary)' }}
                placeholder="Název stránky" />
            ) : (
              <h1 className="text-xl md:text-2xl font-bold break-words" style={{ color: 'var(--text-primary)' }}>{selectedPage.title}</h1>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-auto">
            {/* Back to list */}
            {(listFilter !== null || search.trim()) && !selectedPage.id.startsWith('__new__') && (
              <button type="button" onClick={backToList} title="Zpět na seznam"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                <span className="hidden sm:inline">Zpět</span>
              </button>
            )}
            {/* Copy content */}
            {!selectedPage.id.startsWith('__new__') && !editing && (
              <button type="button" onClick={copyPageContent} title="Kopírovat obsah stránky"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: copiedPage ? '#22c55e' : 'var(--text-muted)' }}>
                {copiedPage ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            )}
            {/* Publish */}
            {canAdmin && !selectedPage.id.startsWith('__new__') && !editing && (
              <button type="button" onClick={() => togglePublish(selectedPage)} title={selectedPage.public_token ? 'Zrušit publikaci' : 'Publikovat veřejně'} disabled={publishingPage}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                style={{ color: selectedPage.public_token ? '#22c55e' : 'var(--text-muted)', opacity: publishingPage ? 0.5 : 1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </button>
            )}
            {/* Star */}
            {!selectedPage.id.startsWith('__new__') && (
              <button type="button" onClick={() => toggleFavorite(selectedPage.id)} title="Oblíbené" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill={favorites.has(selectedPage.id) ? '#f59e0b' : 'none'} stroke={favorites.has(selectedPage.id) ? '#f59e0b' : 'currentColor'} strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            )}
            {/* Edit / Save / Cancel */}
            {!editing ? (
              canEditPage(selectedPage) && !selectedPage.id.startsWith('__new__') && (
                <button type="button" onClick={() => startEdit(selectedPage)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Upravit
                </button>
              )
            ) : (
              <>
                <button type="button" onClick={savePage} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '...' : 'Uložit'}
                </button>
                <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>Zrušit</button>
              </>
            )}
            {/* Delete */}
            {canAdmin && !selectedPage.id.startsWith('__new__') && (
              <button type="button" onClick={() => deletePage(selectedPage.id)} title="Smazat stránku"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors" style={{ color: '#ef4444' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Meta row */}
        {editing ? (
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status select */}
              <div className="relative">
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as KbPageStatus)}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-xs font-medium text-base sm:text-sm"
                  style={{ borderColor: STATUS_CONFIG[editStatus].color, color: STATUS_CONFIG[editStatus].color, background: 'var(--bg-hover)' }}>
                  {(Object.keys(STATUS_CONFIG) as KbPageStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: STATUS_CONFIG[editStatus].color }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {/* Složka select */}
              <div className="relative">
                <select value={editFolderId ?? ''} onChange={e => setEditFolderId(e.target.value || null)}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-xs text-base sm:text-sm"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <option value="">Bez složky</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Status badge */}
            <span className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: STATUS_CONFIG[selectedPage.status].color, color: STATUS_CONFIG[selectedPage.status].color }}>
              {STATUS_CONFIG[selectedPage.status].label}
            </span>
            {/* Current folder */}
            {selectedPage.folder_id && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {getFolderPath(selectedPage.folder_id, folders)}
              </span>
            )}
            {/* Last modified */}
            {!selectedPage.id.startsWith('__new__') && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Upraveno {fmtDate(selectedPage.updated_at)}{selectedPage.updated_by ? ` · ${memberName(selectedPage.updated_by)}` : ''}
              </span>
            )}
          </div>
        )}

        {/* Public URL strip */}
        {!editing && selectedPage.public_token && !selectedPage.id.startsWith('__new__') && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border" style={{ borderColor: '#22c55e44', background: '#22c55e0a' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: '#22c55e' }}>
              Veřejně dostupná
            </span>
            <button type="button" onClick={() => copyPublicUrl(selectedPage)} title="Kopírovat veřejný odkaz"
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{ background: '#22c55e18', color: '#22c55e' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#22c55e28')}
              onMouseLeave={e => (e.currentTarget.style.background = '#22c55e18')}>
              {copiedPublicUrl ? (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Zkopírováno</>
              ) : (
                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Kopírovat odkaz</>
              )}
            </button>
            <button type="button" onClick={() => window.open(getPublicUrl(selectedPage), '_blank')} title="Otevřít veřejnou stránku"
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{ background: '#22c55e18', color: '#22c55e' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#22c55e28')}
              onMouseLeave={e => (e.currentTarget.style.background = '#22c55e18')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Otevřít
            </button>
          </div>
        )}

        {/* Restricted access toggle (admin only, edit mode) */}
        {editing && canAdmin && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
            <button type="button" onClick={() => setEditRestricted(v => !v)}
              className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
              style={{ background: editRestricted ? 'var(--primary)' : 'var(--border)' }}>
              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: editRestricted ? 'translateX(16px)' : 'translateX(0)' }} />
            </button>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Omezený přístup</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {editRestricted ? 'Stránku mohou upravovat jen správci a přidaní uživatelé' : 'Stránku může upravovat kdokoliv'}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mb-8">
          {editing ? (
            <RichEditor value={editContent} onChange={setEditContent} members={members} pages={pages} />
          ) : (
            <>
              {selectedPage.content
                ? <PageViewer page={selectedPage} onChecklistToggle={handleChecklistToggle} onPageLinkClick={onSelectPage} />
                : <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Stránka je prázdná. Klikněte Upravit a začněte psát.</p>
              }
            </>
          )}
        </div>

        {/* Tabs (only for saved pages) */}
        {!editing && !selectedPage.id.startsWith('__new__') && (
          <div className="border-t pt-6 pb-32" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              {((() => {
                const backlinksCount = pages.filter(p => p.id !== selectedPage.id && p.content.includes(`data-page-id="${selectedPage.id}"`)).length;
                const pendingReviews = reviews.filter(r => !r.is_done).length;
                return [
                  { id: 'comments', label: `Komentáře (${comments.length})` },
                  { id: 'history', label: `Historie (${versions.length})` },
                  canAdmin ? { id: 'access', label: 'Přístupy' } : null,
                  { id: 'backlinks', label: `Odkazující (${backlinksCount})` },
                  { id: 'reviews', label: `Revize${pendingReviews > 0 ? ` (${pendingReviews})` : ''}` },
                ].filter(Boolean) as { id: string; label: string }[];
              })()).map(tab => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as PageTab)}
                  className="px-3 md:px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
                  style={{ borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent', color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)', background: 'transparent' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Comments */}
            {activeTab === 'comments' && (
              <div>
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: members.find(m => m.user_id === c.user_id)?.avatar_color ?? '#6366f1' }}>
                      {getInitials(memberName(c.user_id))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{memberName(c.user_id)}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(c.created_at)}</span>
                      </div>
                      {editingComment?.id === c.id ? (
                        <div className="flex gap-2">
                          <input value={editingComment.content} onChange={e => setEditingComment(editingComment ? { ...editingComment, content: e.target.value } : null)}
                            className="flex-1 px-3 py-1.5 rounded-lg border text-base md:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                          <button type="button" onClick={updateComment} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Uložit</button>
                          <button type="button" onClick={() => setEditingComment(null)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.content}</p>
                      )}
                    </div>
                    {c.user_id === userId && !editingComment && (
                      <div className="flex items-start gap-1 flex-shrink-0">
                        <button type="button" onClick={() => setEditingComment({ id: c.id, content: c.content })} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" onClick={() => deleteComment(c.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" style={{ color: '#ef4444' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {/* New comment */}
                <div className="flex gap-3 mt-3 pb-8 md:pb-0">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: members.find(m => m.user_id === userId)?.avatar_color ?? '#6366f1' }}>
                    {getInitials(userDisplayName ?? '?')}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <input value={newComment} onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                      placeholder="Přidat komentář…" className="flex-1 px-3 py-2 rounded-xl border text-base md:text-sm"
                      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <button type="button" onClick={addComment} disabled={!newComment.trim() || savingComment}
                      className="px-4 py-2 rounded-xl text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: (!newComment.trim() || savingComment) ? 0.5 : 1 }}>
                      Odeslat
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div>
                {versions.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné verze v historii</p>}
                {versions.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {fmtDateTime(v.created_at)} · {memberName(v.edited_by)}
                      </p>
                    </div>
                    {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>Aktuální</span>}
                    {i > 0 && canEditPage(selectedPage) && (
                      <button type="button"
                        onClick={() => revertToVersion(v)}
                        className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                        Obnovit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Access */}
            {activeTab === 'access' && canAdmin && (
              <div>
                <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                  <button type="button" onClick={() => onRestrictedToggle(!selectedPage.is_restricted)}
                    className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                    style={{ background: selectedPage.is_restricted ? 'var(--primary)' : 'var(--border)' }}>
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: selectedPage.is_restricted ? 'translateX(16px)' : 'translateX(0)' }} />
                  </button>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Omezený přístup k úpravám</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedPage.is_restricted ? 'Jen správci a níže přidaní uživatelé mohou upravovat' : 'Může upravovat kdokoliv'}</p>
                  </div>
                </div>
                {selectedPage.is_restricted && (
                  <div>
                    <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>EDITAČNÍ PŘÍSTUP PRO UŽIVATELE</p>
                    {members.map(m => {
                      const hasAccess = access.some(a => a.user_id === m.user_id && a.can_edit);
                      return (
                        <div key={m.user_id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: m.avatar_color }}>{getInitials(m.display_name)}</div>
                          <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{m.display_name}</span>
                          <button type="button" onClick={() => toggleUserAccess(m.user_id, !hasAccess)}
                            className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                            style={{ background: hasAccess ? 'var(--primary)' : 'var(--border)' }}>
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: hasAccess ? 'translateX(16px)' : 'translateX(0)' }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Backlinks */}
            {activeTab === 'backlinks' && (
              <div>
                {(() => {
                  const linking = pages.filter(p => p.id !== selectedPage.id && p.content.includes(`data-page-id="${selectedPage.id}"`));
                  if (linking.length === 0) {
                    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádná stránka na tuto stránku neodkazuje.</p>;
                  }
                  return linking.map(p => {
                    const path = getFolderPath(p.folder_id, folders);
                    return (
                      <div key={p.id} className="flex items-center gap-3 py-3 border-b cursor-pointer hover:bg-[var(--bg-hover)] rounded-lg px-2 transition-colors" style={{ borderColor: 'var(--border)' }}
                        onClick={() => onSelectPage(p.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                          {path && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{path}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[p.status].color }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{STATUS_CONFIG[p.status].label}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Reviews */}
            {activeTab === 'reviews' && (
              <div>
                {reviews.length === 0 && !canAdmin && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné revize</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {reviews.map(r => {
                    const overdue = !r.is_done && new Date(r.review_date + 'T23:59:59') < new Date();
                    return (
                      <div key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs" style={{
                        borderColor: overdue && !r.is_done ? '#ef4444' : 'var(--border)',
                        color: r.is_done ? 'var(--text-muted)' : overdue ? '#ef4444' : 'var(--text-secondary)',
                        opacity: r.is_done ? 0.55 : 1,
                        background: 'var(--bg-hover)',
                      }}>
                        <button type="button" onClick={() => toggleReviewDone(r.id, !r.is_done)}
                          className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                          style={{ borderColor: r.is_done ? 'var(--primary)' : 'currentColor', background: r.is_done ? 'var(--primary)' : 'transparent' }}>
                          {r.is_done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                        <span>{memberName(r.assigned_to)} · {new Date(r.review_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                        {r.note && (
                          <span title={r.note} className="opacity-70 flex items-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                          </span>
                        )}
                        {canAdmin && (
                          <button type="button" onClick={() => deleteReview(r.id)} className="hover:opacity-70 flex items-center" style={{ color: 'inherit' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {canAdmin && (
                  <button type="button" onClick={openReviewModal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium hover:bg-[var(--bg-hover)] transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Přidat revizi
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
