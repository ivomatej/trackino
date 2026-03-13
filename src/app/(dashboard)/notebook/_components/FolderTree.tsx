'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { NoteFolder } from './types';
import { MAX_DEPTH, getDescendantFolderIds } from './utils';

export function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare, onMoveUp, onMoveDown, userId, items, folderSortOrder = 'manual', depth = 0, parentId = null,
}: {
  folders: NoteFolder[]; selectedId: string | null; expanded: Set<string>;
  onSelect: (id: string) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: NoteFolder) => void; onDelete: (f: NoteFolder) => void;
  onShare: (f: NoteFolder) => void;
  onMoveUp?: (id: string) => void; onMoveDown?: (id: string) => void;
  userId: string;
  items: { folder_id: string | null; is_archived: boolean }[];
  folderSortOrder?: 'name' | 'created' | 'manual';
  depth?: number; parentId?: string | null;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const children = folders.filter(f => f.parent_id === parentId).sort((a, b) => {
    if (folderSortOrder === 'name') return a.name.localeCompare(b.name, 'cs');
    if (folderSortOrder === 'created') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.sort_order - b.sort_order;
  });
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isExpanded = expanded.has(folder.id);
        const isSelected = selectedId === folder.id;
        const isOwner = folder.owner_id === userId;
        const descendantIds = getDescendantFolderIds(folder.id, folders);
        const itemCount = items.filter(b => b.folder_id && descendantIds.includes(b.folder_id) && !b.is_archived).length;
        return (
          <div key={folder.id}>
            <div className="group/folder relative flex items-center gap-1 py-1 px-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSelected ? 'var(--bg-active)' : 'transparent' }}
              onClick={() => onSelect(folder.id)}>
              <button type="button" onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ color: 'var(--text-muted)', opacity: hasChildren ? 1 : 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExpanded ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {folder.name}
              </span>
              {itemCount > 0 && (
                <span className="ml-auto mr-1 text-[10px] flex-shrink-0 sm:group-hover/folder:opacity-0 transition-opacity" style={{ color: 'var(--text-muted)' }}>{itemCount}</span>
              )}
              {/* Tři tečky: na mobilu v toku (vždy viditelné), na desktopu absolutně (hover) – nezabírá místo v layoutu */}
              <div
                className="flex-shrink-0 sm:absolute sm:right-1 sm:top-1/2 sm:-translate-y-1/2 sm:opacity-0 sm:group-hover/folder:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}>
                <button type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (openMenu === folder.id) { setOpenMenu(null); setMenuPos(null); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const openUpward = spaceBelow < 180;
                      setMenuPos({
                        top: openUpward ? undefined : rect.bottom + 4,
                        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                        right: window.innerWidth - rect.right,
                      });
                      setOpenMenu(folder.id);
                    }
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md"
                  style={{ color: 'var(--text-muted)', background: openMenu === folder.id ? 'var(--bg-hover)' : 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
              </div>
            </div>
            {/* Dropdown přes portál – unikne z transformovaného left panelu na document.body */}
            {openMenu === folder.id && menuPos && typeof document !== 'undefined' && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={e => { e.stopPropagation(); setOpenMenu(null); setMenuPos(null); }} />
                <div className="fixed z-[9999] rounded-lg border shadow-lg py-1 min-w-[160px]"
                  style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  onClick={e => e.stopPropagation()}>
                  {depth < MAX_DEPTH - 1 && (
                    <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={e => { e.stopPropagation(); setOpenMenu(null); onAddSub(folder.id, depth + 1); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Přidat podsložku
                    </button>
                  )}
                  {folderSortOrder === 'manual' && (
                    <>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onMoveUp?.(folder.id); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        Posunout nahoru
                      </button>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onMoveDown?.(folder.id); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        Posunout dolů
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onShare(folder); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        Sdílet
                      </button>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onEdit(folder); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Přejmenovat
                      </button>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--danger)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onDelete(folder); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
                        Smazat
                      </button>
                    </>
                  )}
                </div>
              </>,
              document.body
            )}
            {isExpanded && (
              <FolderTree folders={folders} selectedId={selectedId} expanded={expanded}
                onSelect={onSelect} onToggle={onToggle} onAddSub={onAddSub}
                onEdit={onEdit} onDelete={onDelete} onShare={onShare}
                onMoveUp={onMoveUp} onMoveDown={onMoveDown}
                userId={userId} items={items} folderSortOrder={folderSortOrder}
                depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}
