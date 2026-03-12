'use client';

import type { BookmarkFolder, Bookmark, Member, BookmarkFilter } from './types';
import { getInitials } from './utils';
import FolderTree from './FolderTree';

interface BookmarksLeftPanelProps {
  folders: BookmarkFolder[];
  bookmarks: Bookmark[];
  favorites: Set<string>;
  members: Member[];
  selectedFolder: string | null;
  setSelectedFolder: (id: string | null) => void;
  listFilter: BookmarkFilter;
  setListFilter: (f: BookmarkFilter) => void;
  expanded: Set<string>;
  toggle: (id: string) => void;
  authorSectionExpanded: boolean;
  setAuthorSectionExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  searchQ: string;
  setSearchQ: (v: string) => void;
  showFolderPanel: boolean;
  setShowFolderPanel: (v: boolean | ((prev: boolean) => boolean)) => void;
  openFolderModal: (parentId?: string | null, editing?: BookmarkFolder | null) => void;
  deleteFolder: (f: BookmarkFolder) => void;
  openShare: (f: BookmarkFolder) => void;
  userId: string;
}

export default function BookmarksLeftPanel({
  folders, bookmarks, favorites, members,
  selectedFolder, setSelectedFolder,
  listFilter, setListFilter,
  expanded, toggle,
  authorSectionExpanded, setAuthorSectionExpanded,
  searchQ, setSearchQ,
  showFolderPanel, setShowFolderPanel,
  openFolderModal, deleteFolder, openShare,
  userId,
}: BookmarksLeftPanelProps) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {showFolderPanel && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setShowFolderPanel(false)} />}

      {/* Left Panel */}
      <div className={`fixed md:static inset-y-0 left-0 z-40 md:z-auto flex flex-col border-r overflow-hidden transition-transform duration-200 flex-shrink-0
        ${showFolderPanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: 340, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Záložky</h1>
        </div>

        {/* Search */}
        <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Hledat záložky…"
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border text-xs outline-none text-base sm:text-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        {/* Nav */}
        <div className="px-2 py-2 border-b flex-shrink-0 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
          {/* Všechny záložky */}
          {(() => { const active = !selectedFolder && !listFilter; return (
            <button onClick={() => { setSelectedFolder(null); setListFilter(null); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              Všechny záložky
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{bookmarks.length}</span>
            </button>
          ); })()}
          {/* Oblíbené */}
          {favorites.size > 0 && (() => { const active = listFilter?.type === 'favorites'; return (
            <button onClick={() => { setSelectedFolder(null); setListFilter({ type: 'favorites' }); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: active ? 'var(--bg-active)' : 'transparent', color: '#f59e0b' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Oblíbené
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{favorites.size}</span>
            </button>
          ); })()}
          {/* Sdílené */}
          {bookmarks.some(b => b.is_shared) && (() => { const active = listFilter?.type === 'shared'; return (
            <button onClick={() => { setSelectedFolder(null); setListFilter({ type: 'shared' }); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: active ? 'var(--bg-active)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-secondary)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Sdílené záložky
            </button>
          ); })()}
          {/* Naposledy přidané */}
          {(() => { const active = listFilter?.type === 'recent'; return (
            <button onClick={() => { setSelectedFolder(null); setListFilter({ type: 'recent' }); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Naposledy přidané
            </button>
          ); })()}
          {/* Nezařazené */}
          {(() => { const unfiledCount = bookmarks.filter(b => !b.folder_id).length; const active = listFilter?.type === 'unfiled'; return unfiledCount > 0 ? (
            <button onClick={() => { setSelectedFolder(null); setListFilter({ type: 'unfiled' }); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Nezařazené
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{unfiledCount}</span>
            </button>
          ) : null; })()}

          {/* Podle autora – collapsible */}
          <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }} />
          <button onClick={() => setAuthorSectionExpanded(v => !v)}
            className="w-full text-left flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ flexShrink: 0, transform: authorSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M3 2l4 3-4 3V2z"/>
            </svg>
            Podle autora
          </button>
          {authorSectionExpanded && members.map(m => {
            const count = bookmarks.filter(b => b.created_by === m.user_id).length;
            if (count === 0) return null;
            const active = listFilter?.type === 'author' && listFilter.userId === m.user_id;
            return (
              <button key={m.user_id} onClick={() => { setSelectedFolder(null); setListFilter({ type: 'author', userId: m.user_id }); }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                  {getInitials(m.display_name)}
                </div>
                <span className="truncate">{m.display_name}</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Složky */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Složky</span>
            <button onClick={() => openFolderModal()} title="Nová složka"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <FolderTree folders={folders} selectedId={selectedFolder} expanded={expanded}
            onSelect={id => { setSelectedFolder(id); setListFilter(null); }}
            onToggle={toggle} onAddSub={(pid) => openFolderModal(pid)}
            onEdit={f => openFolderModal(null, f)} onDelete={deleteFolder}
            onShare={openShare} userId={userId} items={bookmarks} />
        </div>
      </div>
    </>
  );
}
