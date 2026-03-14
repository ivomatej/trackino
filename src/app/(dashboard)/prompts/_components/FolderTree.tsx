'use client';

import { useState } from 'react';
import { MAX_DEPTH, type PromptFolder } from './types';

interface FolderTreeProps {
  folders: PromptFolder[];
  selectedId: string | null;
  expanded: Set<string>;
  onSelect: (id: string | null) => void;
  onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: PromptFolder) => void;
  onDelete: (f: PromptFolder) => void;
  onShare: (f: PromptFolder) => void;
  userId: string;
  items: { folder_id: string | null }[];
  depth?: number;
  parentId?: string | null;
}

export function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare, userId, items, depth = 0, parentId = null,
}: FolderTreeProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const children = folders.filter(f => f.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isExpanded = expanded.has(folder.id);
        const isSelected = selectedId === folder.id;
        const isOwner = folder.owner_id === userId;
        const itemCount = items.filter(p => p.folder_id === folder.id).length;
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 px-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSelected ? 'var(--bg-active)' : 'transparent' }}
              onClick={() => onSelect(folder.id)}
            >
              <button type="button" onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ color: 'var(--text-muted)', opacity: hasChildren ? 1 : 0 }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExpanded ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {folder.name}
              </span>
              {itemCount > 0 && (
                <span className="text-[10px] px-1.5 py-0 rounded-full flex-shrink-0 mr-1" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{itemCount}</span>
              )}
              {/* Mobil: ⋮ dropdown (fixed position = neklipuje se kontejnerem) */}
              <div className="sm:hidden flex-shrink-0" onClick={e => e.stopPropagation()}>
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
                  className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                  style={{ color: 'var(--text-muted)', background: openMenu === folder.id ? 'var(--bg-hover)' : 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {openMenu === folder.id && menuPos && (
                  <div className="fixed z-[9999] rounded-lg border shadow-lg py-1 min-w-[160px]"
                    style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    {depth < MAX_DEPTH - 1 && (
                      <button type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onAddSub(folder.id, depth + 1); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Přidat podsložku
                      </button>
                    )}
                    {isOwner && (
                      <>
                        <button type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onShare(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          Sdílet
                        </button>
                        <button type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onEdit(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Přejmenovat
                        </button>
                        <button type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: 'var(--danger)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onDelete(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
                          Smazat
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Desktop: ikonky na hover */}
              <div className="hidden sm:flex sm:opacity-0 sm:group-hover/folder:opacity-100 items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_DEPTH - 1 && (
                  <button type="button" title="Přidat podsložku" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {isOwner && (
                  <>
                    <button type="button" title="Sdílet" onClick={e => { e.stopPropagation(); onShare(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button type="button" title="Přejmenovat" onClick={e => { e.stopPropagation(); onEdit(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" title="Smazat" onClick={e => { e.stopPropagation(); onDelete(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--danger)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {isExpanded && (
              <FolderTree folders={folders} selectedId={selectedId} expanded={expanded}
                onSelect={onSelect} onToggle={onToggle} onAddSub={onAddSub}
                onEdit={onEdit} onDelete={onDelete} onShare={onShare}
                userId={userId} items={items} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}
