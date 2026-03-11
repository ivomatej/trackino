'use client';

import type { KbFolder, KbPage } from '@/types/database';
import { MAX_FOLDER_DEPTH } from './types';

// ── Folder Tree ───────────────────────────────────────────────────────────────

export default function KbFolderTree({ folders, pages, selectedFolderId, expanded, onSelectFolder, onToggle, onAddSub, onEditFolder, onDeleteFolder, onShareFolder, userId, depth = 0, parentId = null }: {
  folders: KbFolder[]; pages: KbPage[]; selectedFolderId: string | null;
  expanded: Set<string>; onSelectFolder: (id: string) => void;
  onToggle: (id: string) => void; onAddSub: (parentId: string, depth: number) => void;
  onEditFolder: (f: KbFolder) => void; onDeleteFolder: (f: KbFolder) => void;
  onShareFolder: (f: KbFolder) => void;
  userId: string; depth?: number; parentId?: string | null;
}) {
  const children = folders.filter(f => f.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const isExp = expanded.has(folder.id);
        const isSel = selectedFolderId === folder.id;
        const pageCount = pages.filter(p => p.folder_id === folder.id).length;
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSel ? 'var(--bg-active)' : 'transparent' }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { onSelectFolder(folder.id); onToggle(folder.id); }}>
              <button type="button" onClick={e => { e.stopPropagation(); onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transition: 'transform 0.15s', transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <path d="M3 2l4 3-4 3V2z"/>
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: folder.is_shared ? 'var(--primary)' : (isSel ? 'var(--primary)' : 'var(--text-muted)'), flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSel ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isSel ? 600 : 400 }}>{folder.name}</span>
              {pageCount > 0 && <span className="text-[10px] px-1 mr-1 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>{pageCount}</span>}
              <div className="opacity-100 md:opacity-0 md:group-hover/folder:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_FOLDER_DEPTH - 1 && (
                  <button type="button" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }} title="Přidat podsložku"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]" style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {folder.owner_id === userId && (
                  <>
                    <button type="button" onClick={e => { e.stopPropagation(); onShareFolder(folder); }} title="Sdílet složku"
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]"
                      style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); onEditFolder(folder); }} title="Přejmenovat"
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]" style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); onDeleteFolder(folder); }} title="Smazat složku"
                      className="w-5 h-5 flex items-center justify-center rounded" style={{ color: '#ef4444' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Subfolders only */}
            {isExp && (
              <KbFolderTree folders={folders} pages={pages} selectedFolderId={selectedFolderId}
                expanded={expanded} onSelectFolder={onSelectFolder} onToggle={onToggle}
                onAddSub={onAddSub} onEditFolder={onEditFolder} onDeleteFolder={onDeleteFolder}
                onShareFolder={onShareFolder}
                userId={userId} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}
