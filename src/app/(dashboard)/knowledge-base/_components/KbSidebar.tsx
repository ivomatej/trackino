'use client';

import type { KbFolder, KbPage, KbFolderShare } from '@/types/database';
import type { KbMember, ListFilter } from './types';
import { STATUS_CONFIG } from './types';
import { getInitials, getDepth } from './utils';
import KbFolderTree from './KbFolderTree';

// ── KB Sidebar (levý panel) ────────────────────────────────────────────────────

export interface KbSidebarProps {
  // Visibility
  leftOpen: boolean;
  setLeftOpen: (v: boolean) => void;

  // Data
  folders: KbFolder[];
  pages: KbPage[];
  members: KbMember[];
  favorites: Set<string>;

  // Navigation
  search: string;
  setSearch: (v: string) => void;
  listFilter: ListFilter | null;
  setListFilter: (v: ListFilter | null) => void;
  setSelectedPage: (v: null) => void;

  // Filter sections
  statusSectionExpanded: boolean;
  setStatusSectionExpanded: (v: (prev: boolean) => boolean) => void;
  mentionSectionExpanded: boolean;
  setMentionSectionExpanded: (v: (prev: boolean) => boolean) => void;

  // Folder tree
  expanded: Set<string>;
  setExpanded: (v: (prev: Set<string>) => Set<string>) => void;
  onAddFolder: () => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEditFolder: (f: KbFolder) => void;
  onDeleteFolder: (f: KbFolder) => void;
  onShareFolder: (f: KbFolder) => void;
  userId: string;

  // New page
  onNewPage: () => void;
}

export default function KbSidebar({
  leftOpen, setLeftOpen,
  folders, pages, members, favorites,
  search, setSearch, listFilter, setListFilter, setSelectedPage,
  statusSectionExpanded, setStatusSectionExpanded,
  mentionSectionExpanded, setMentionSectionExpanded,
  expanded, setExpanded,
  onAddFolder, onAddSub, onEditFolder, onDeleteFolder, onShareFolder, userId,
  onNewPage,
}: KbSidebarProps) {
  return (
    <aside className={`fixed lg:relative top-0 left-0 bottom-0 z-40 lg:z-auto flex flex-col border-r flex-shrink-0 transition-transform duration-200 ${leftOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{ width: 340, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>Znalostní báze</h2>
        <button type="button" onClick={() => setLeftOpen(false)} className="lg:hidden w-7 h-7 flex items-center justify-center rounded" style={{ color: 'var(--text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value.trim()) { setListFilter(null); setSelectedPage(null); } }} placeholder="Hledat stránky…" className="w-full pl-8 pr-7 py-1.5 rounded-lg border text-base sm:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded" style={{ color: 'var(--text-muted)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Nav shortcuts */}
        <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
          {/* Všechny stránky */}
          {(() => {
            const isActive = listFilter?.type === 'all' && !search;
            return (
              <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setListFilter({ type: 'all' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                <span className="flex-1 text-left">Všechny stránky</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{pages.length}</span>
              </button>
            );
          })()}
          {/* Oblíbené */}
          {favorites.size > 0 && (() => {
            const isActive = listFilter?.type === 'favorites' && !search;
            return (
              <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setListFilter({ type: 'favorites' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isActive ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span className="flex-1 text-left">Oblíbené</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{favorites.size}</span>
              </button>
            );
          })()}
          {/* Naposledy upravené */}
          {(() => {
            const isActive = listFilter?.type === 'recent' && !search;
            return (
              <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setListFilter({ type: 'recent' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="flex-1 text-left">Naposledy upravené</span>
              </button>
            );
          })()}
          {/* Nezařazené */}
          {(() => {
            const count = pages.filter(p => !p.folder_id).length;
            const isActive = listFilter?.type === 'unfiled' && !search;
            if (count === 0) return null;
            return (
              <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setListFilter({ type: 'unfiled' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="flex-1 text-left">Nezařazené</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{count}</span>
              </button>
            );
          })()}
        </div>

        {/* Filtry */}
        <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
          {/* Podle stavu */}
          <button type="button" className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors mb-0.5"
            onClick={() => setStatusSectionExpanded(v => !v)}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: statusSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}><path d="M3 2l4 3-4 3V2z"/></svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Podle stavu</span>
          </button>
          {statusSectionExpanded && (Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map(s => {
            const count = pages.filter(p => p.status === s).length;
            const isActive = listFilter?.type === 'status' && listFilter.value === s && !search;
            return (
              <button key={s} type="button" className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ paddingLeft: 20, background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setListFilter({ type: 'status', value: s }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_CONFIG[s].color }} />
                <span className="flex-1 text-left">{STATUS_CONFIG[s].label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{count}</span>
              </button>
            );
          })}

          {/* Podle zmínky */}
          {members.some(m => pages.some(p => p.content.includes(`data-user-id="${m.user_id}"`))) && (
            <>
              <button type="button" className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors mt-1 mb-0.5"
                onClick={() => setMentionSectionExpanded(v => !v)}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: mentionSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}><path d="M3 2l4 3-4 3V2z"/></svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Podle zmínky</span>
              </button>
              {mentionSectionExpanded && members.map(m => {
                const count = pages.filter(p => p.content.includes(`data-user-id="${m.user_id}"`)).length;
                if (count === 0) return null;
                const isActive = listFilter?.type === 'mention' && listFilter.userId === m.user_id && !search;
                return (
                  <button key={m.user_id} type="button" className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ paddingLeft: 20, background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setListFilter({ type: 'mention', userId: m.user_id }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white" style={{ background: m.avatar_color }}>{getInitials(m.display_name)}</div>
                    <span className="flex-1 text-left truncate">{m.display_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{count}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Folder tree */}
        <div className="p-2">
          <div className="flex items-center gap-1 px-2 py-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--text-muted)' }}>Složky</span>
            <button type="button" onClick={onAddFolder} title="Nová složka"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          {folders.filter(f => !f.parent_id).length === 0 ? (
            <p className="px-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Zatím žádné složky</p>
          ) : (
            <KbFolderTree folders={folders} pages={pages} selectedFolderId={listFilter?.type === 'folder' ? listFilter.folderId : null}
              expanded={expanded}
              onSelectFolder={id => {
                const newFilter: ListFilter = { type: 'folder', folderId: id };
                setListFilter(listFilter?.type === 'folder' && listFilter.folderId === id ? null : newFilter);
                setSearch(''); setSelectedPage(null); setLeftOpen(false);
              }}
              onToggle={id => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              onAddSub={onAddSub}
              onEditFolder={f => onEditFolder(f)}
              onDeleteFolder={onDeleteFolder}
              onShareFolder={onShareFolder}
              userId={userId} />
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={() => { onNewPage(); setLeftOpen(false); }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nová stránka
        </button>
      </div>
    </aside>
  );
}
