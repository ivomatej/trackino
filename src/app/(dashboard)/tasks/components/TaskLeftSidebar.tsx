'use client';

import type { TaskBoard, TaskFolder } from '@/types/database';
import type { TaskView } from '../types';

interface TaskLeftSidebarProps {
  // Panel state
  leftOpen: boolean;
  setLeftOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  // Folder input
  addingFolder: boolean;
  setAddingFolder: (v: boolean) => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  // Board input
  addingBoard: boolean;
  setAddingBoard: (v: boolean) => void;
  newBoardName: string;
  setNewBoardName: (v: string) => void;
  addingBoardFolderId: string | null;
  // Navigation state
  activeBoardId: string | null;
  setActiveBoardId: (v: string | null) => void;
  expandedFolders: Set<string>;
  setExpandedFolders: (fn: (prev: Set<string>) => Set<string>) => void;
  crossWsMode: boolean;
  setCrossWsMode: (v: boolean) => void;
  myTasksMode: boolean;
  setMyTasksMode: (v: boolean) => void;
  setOnlyMine: (v: boolean) => void;
  setView: (v: TaskView) => void;
  setListSortBy: (v: 'default' | 'updated_at' | 'created_at' | 'deadline' | 'priority' | 'title') => void;
  fetchCrossWsData: () => void;
  // Computed data
  boards: TaskBoard[];
  favBoards: TaskBoard[];
  rootFolders: TaskFolder[];
  unfiledBoards: TaskBoard[];
  favoriteBoards: Set<string>;
  toggleFavoriteBoard: (id: string) => void;
  getFolderChildren: (id: string) => TaskFolder[];
  getBoardsInFolder: (id: string) => TaskBoard[];
  // Permissions
  canManage: boolean;
  // Folder actions
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  setFolderShareTargetId: (v: string) => void;
  setFolderShareMode: (v: 'none' | 'workspace' | 'users') => void;
  setShowFolderShareModal: (v: boolean) => void;
  // Board actions
  createBoard: (name: string, folderId: string | null) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  setBoardModalEditId: (v: string | null) => void;
  setBoardModalName: (v: string) => void;
  setBoardModalColor: (v: string) => void;
  setBoardModalDesc: (v: string) => void;
  setBoardModalFolderId: (v: string | null) => void;
  setShowBoardModal: (v: boolean) => void;
}

export function TaskLeftSidebar({
  leftOpen, setLeftOpen, sidebarCollapsed, setSidebarCollapsed,
  addingFolder, setAddingFolder, newFolderName, setNewFolderName,
  addingBoard, setAddingBoard, newBoardName, setNewBoardName, addingBoardFolderId,
  activeBoardId, setActiveBoardId, expandedFolders, setExpandedFolders,
  crossWsMode, setCrossWsMode, myTasksMode, setMyTasksMode, setOnlyMine, setView, setListSortBy, fetchCrossWsData,
  boards, favBoards, rootFolders, unfiledBoards, favoriteBoards, toggleFavoriteBoard,
  getFolderChildren, getBoardsInFolder, canManage,
  createFolder, deleteFolder, renameFolder,
  setFolderShareTargetId, setFolderShareMode, setShowFolderShareModal,
  createBoard, deleteBoard,
  setBoardModalEditId, setBoardModalName, setBoardModalColor, setBoardModalDesc, setBoardModalFolderId, setShowBoardModal,
}: TaskLeftSidebarProps) {

  const toggleFolder = (id: string) => setExpandedFolders(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const childFolders = parentId ? getFolderChildren(parentId) : rootFolders;
    const childBoards = parentId ? getBoardsInFolder(parentId) : [];
    if (depth > 4) return null;

    return (
      <>
        {childFolders.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderBoards = getBoardsInFolder(folder.id);
          return (
            <div key={folder.id}>
              <div className="flex items-center gap-1 py-1 px-2 rounded-lg cursor-pointer group/folder transition-colors"
                style={{ paddingLeft: depth * 12 + 8 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => toggleFolder(folder.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 transition-transform"
                  style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"
                  style={{ color: folder.is_shared ? '#3b82f6' : 'var(--text-muted)' }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{folder.name}</span>
                <span className="text-xs opacity-0 group-hover/folder:opacity-100 flex gap-0.5">
                  {canManage && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setFolderShareTargetId(folder.id); setFolderShareMode(folder.is_shared ? 'workspace' : 'none'); setShowFolderShareModal(true); }}
                        className="p-0.5 rounded" title="Sdílet" style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); const n = prompt('Přejmenovat složku:', folder.name); if (n?.trim()) renameFolder(folder.id, n.trim()); }}
                        className="p-0.5 rounded" title="Přejmenovat" style={{ color: 'var(--text-muted)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Smazat složku „${folder.name}"?`)) deleteFolder(folder.id); }}
                        className="p-0.5 rounded" title="Smazat" style={{ color: 'var(--text-muted)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </>
                  )}
                </span>
              </div>
              {isExpanded && (
                <>
                  {renderFolderTree(folder.id, depth + 1)}
                  {folderBoards.map(b => (
                    <BoardItem key={b.id} b={b} depth={depth + 1} activeBoardId={activeBoardId}
                      setActiveBoardId={setActiveBoardId} setMyTasksMode={setMyTasksMode}
                      setOnlyMine={setOnlyMine} setLeftOpen={setLeftOpen}
                      favoriteBoards={favoriteBoards} toggleFavoriteBoard={toggleFavoriteBoard}
                      canManage={canManage}
                      setBoardModalEditId={setBoardModalEditId} setBoardModalName={setBoardModalName}
                      setBoardModalColor={setBoardModalColor} setBoardModalDesc={setBoardModalDesc}
                      setBoardModalFolderId={setBoardModalFolderId} setShowBoardModal={setShowBoardModal}
                      deleteBoard={deleteBoard} />
                  ))}
                </>
              )}
            </div>
          );
        })}
        {parentId && childBoards.map(b => (
          <BoardItem key={b.id} b={b} depth={depth} activeBoardId={activeBoardId}
            setActiveBoardId={setActiveBoardId} setMyTasksMode={setMyTasksMode}
            setOnlyMine={setOnlyMine} setLeftOpen={setLeftOpen}
            favoriteBoards={favoriteBoards} toggleFavoriteBoard={toggleFavoriteBoard}
            canManage={false}
            setBoardModalEditId={setBoardModalEditId} setBoardModalName={setBoardModalName}
            setBoardModalColor={setBoardModalColor} setBoardModalDesc={setBoardModalDesc}
            setBoardModalFolderId={setBoardModalFolderId} setShowBoardModal={setShowBoardModal}
            deleteBoard={deleteBoard} />
        ))}
      </>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {leftOpen && <div className="fixed inset-0 z-20 bg-black/20 md:hidden" onClick={() => setLeftOpen(false)} />}
      <div className={`fixed md:relative z-30 md:z-auto top-0 bottom-0 left-0 flex-shrink-0 border-r flex flex-col transition-all duration-200 ${leftOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'md:w-0 md:overflow-hidden md:border-r-0 md:-translate-x-full' : 'md:w-[260px] md:translate-x-0'} w-[260px]`}
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        {/* Left panel header */}
        <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
          <span className="text-sm font-bold flex-1" style={{ color: 'var(--text-primary)' }}>Úkoly</span>
          {/* Desktop collapse button */}
          <button className="hidden md:flex p-1 rounded transition-colors" title="Skrýt panel"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            style={{ color: 'var(--text-muted)' }}
            onClick={() => { setSidebarCollapsed(true); localStorage.setItem('trackino_tasks_sidebar_collapsed', '1'); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          {canManage && (
            <>
              <button onClick={() => { setAddingBoard(true); setNewBoardName(''); }}
                className="p-1 rounded transition-colors" title="Nový projekt"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ color: 'var(--text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button onClick={() => { setAddingFolder(true); setNewFolderName(''); }}
                className="p-1 rounded transition-colors" title="Nová složka"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ color: 'var(--text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              </button>
            </>
          )}
        </div>

        {/* Navigation & tree */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-2">
          {/* New folder input */}
          {addingFolder && (
            <div className="mb-2">
              <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Název složky..." autoFocus
                className="text-base sm:text-sm rounded-lg border px-2 py-1.5 w-full"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newFolderName.trim()) { await createFolder(newFolderName.trim()); setAddingFolder(false); }
                  if (e.key === 'Escape') setAddingFolder(false);
                }}
                onBlur={() => { if (!newFolderName.trim()) setAddingFolder(false); }}
              />
            </div>
          )}

          {/* New board input */}
          {addingBoard && (
            <div className="mb-2">
              <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)} placeholder="Název projektu..." autoFocus
                className="text-base sm:text-sm rounded-lg border px-2 py-1.5 w-full"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newBoardName.trim()) { await createBoard(newBoardName.trim(), addingBoardFolderId); setAddingBoard(false); }
                  if (e.key === 'Escape') setAddingBoard(false);
                }}
                onBlur={() => { if (!newBoardName.trim()) setAddingBoard(false); }}
              />
            </div>
          )}

          {/* All tasks / My tasks / Cross-workspace nav */}
          <div className="mb-2 space-y-0.5">
            <button className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-sm transition-colors"
              style={{ color: !crossWsMode && !myTasksMode && !activeBoardId ? 'var(--primary)' : 'var(--text-primary)', background: !crossWsMode && !myTasksMode && !activeBoardId ? 'var(--primary)' + '08' : 'transparent' }}
              onMouseEnter={e => { if (crossWsMode || myTasksMode || activeBoardId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (crossWsMode || myTasksMode || activeBoardId) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { setCrossWsMode(false); setMyTasksMode(false); setOnlyMine(false); setActiveBoardId(boards[0]?.id ?? null); setLeftOpen(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Všechny úkoly
            </button>
            <button className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-sm transition-colors"
              style={{ color: !crossWsMode && myTasksMode ? 'var(--primary)' : 'var(--text-primary)', background: !crossWsMode && myTasksMode ? 'var(--primary)' + '08' : 'transparent' }}
              onMouseEnter={e => { if (crossWsMode || !myTasksMode) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (crossWsMode || !myTasksMode) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { setCrossWsMode(false); setMyTasksMode(true); setOnlyMine(true); setView('list'); setListSortBy('updated_at'); setActiveBoardId(null); setLeftOpen(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Moje úkoly
            </button>
            <button className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-sm transition-colors"
              style={{ color: crossWsMode ? 'var(--primary)' : 'var(--text-primary)', background: crossWsMode ? 'var(--primary)' + '08' : 'transparent' }}
              onMouseEnter={e => { if (!crossWsMode) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!crossWsMode) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { setCrossWsMode(true); setMyTasksMode(false); setActiveBoardId(null); fetchCrossWsData(); setLeftOpen(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Přehled workspace
            </button>
          </div>

          {/* ── OBLÍBENÉ ── */}
          {favBoards.length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 mt-1" style={{ color: 'var(--text-muted)' }}>Oblíbené</div>
              {favBoards.map(b => (
                <div key={b.id} className="flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors group/board"
                  style={{ background: activeBoardId === b.id ? 'var(--bg-hover)' : 'transparent' }}
                  onMouseEnter={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => { setMyTasksMode(false); setOnlyMine(false); setActiveBoardId(b.id); setLeftOpen(false); }}>
                  <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: b.color ?? '#6366f1' }} />
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: activeBoardId === b.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</span>
                  <button onClick={e => { e.stopPropagation(); toggleFavoriteBoard(b.id); }} className="opacity-0 group-hover/board:opacity-100 p-0.5 rounded transition-opacity flex-shrink-0" title="Odebrat z oblíbených" style={{ color: '#f59e0b' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── SLOŽKY ── */}
          {rootFolders.length > 0 && (
            <div className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 mt-1" style={{ color: 'var(--text-muted)' }}>Složky</div>
          )}

          {/* Folder tree */}
          {renderFolderTree(null, 0)}

          {/* ── NEZAŘAZENÉ ── */}
          {unfiledBoards.length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 mt-2" style={{ color: 'var(--text-muted)' }}>Nezařazené</div>
              {unfiledBoards.map(b => (
                <div key={b.id} className="flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors group/board"
                  style={{ background: activeBoardId === b.id ? 'var(--bg-hover)' : 'transparent' }}
                  onMouseEnter={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'transparent'; }}
                  onClick={() => { setMyTasksMode(false); setOnlyMine(false); setActiveBoardId(b.id); setLeftOpen(false); }}>
                  <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: b.color ?? '#6366f1' }} />
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: activeBoardId === b.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</span>
                  <button onClick={e => { e.stopPropagation(); toggleFavoriteBoard(b.id); }}
                    className={`p-0.5 rounded transition-opacity flex-shrink-0 ${favoriteBoards.has(b.id) ? 'opacity-80' : 'opacity-0 group-hover/board:opacity-100'}`}
                    title={favoriteBoards.has(b.id) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                    style={{ color: favoriteBoards.has(b.id) ? '#f59e0b' : 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={favoriteBoards.has(b.id) ? '#f59e0b' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </button>
                  {b.is_shared && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                  {canManage && (
                    <span className="opacity-0 group-hover/board:opacity-100 flex gap-0.5 flex-shrink-0 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setBoardModalEditId(b.id); setBoardModalName(b.name); setBoardModalColor(b.color ?? '#6366f1'); setBoardModalDesc(b.description ?? ''); setBoardModalFolderId(b.folder_id ?? null); setShowBoardModal(true); }}
                        className="p-0.5 rounded" title="Upravit" style={{ color: 'var(--text-muted)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Smazat projekt „${b.name}"?`)) deleteBoard(b.id); }}
                        className="p-0.5 rounded" title="Smazat" style={{ color: 'var(--text-muted)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Board list item (reusable in folder tree + unfiled) ──
interface BoardItemProps {
  b: TaskBoard;
  depth: number;
  activeBoardId: string | null;
  setActiveBoardId: (v: string | null) => void;
  setMyTasksMode: (v: boolean) => void;
  setOnlyMine: (v: boolean) => void;
  setLeftOpen: (v: boolean) => void;
  favoriteBoards: Set<string>;
  toggleFavoriteBoard: (id: string) => void;
  canManage: boolean;
  setBoardModalEditId: (v: string | null) => void;
  setBoardModalName: (v: string) => void;
  setBoardModalColor: (v: string) => void;
  setBoardModalDesc: (v: string) => void;
  setBoardModalFolderId: (v: string | null) => void;
  setShowBoardModal: (v: boolean) => void;
  deleteBoard: (id: string) => Promise<void>;
}

function BoardItem({ b, depth, activeBoardId, setActiveBoardId, setMyTasksMode, setOnlyMine, setLeftOpen, favoriteBoards, toggleFavoriteBoard, canManage, setBoardModalEditId, setBoardModalName, setBoardModalColor, setBoardModalDesc, setBoardModalFolderId, setShowBoardModal, deleteBoard }: BoardItemProps) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors group/board"
      style={{ paddingLeft: depth * 12 + 8, background: activeBoardId === b.id ? 'var(--bg-hover)' : 'transparent' }}
      onMouseEnter={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'transparent'; }}
      onClick={() => { setMyTasksMode(false); setOnlyMine(false); setActiveBoardId(b.id); setLeftOpen(false); }}>
      <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: b.color ?? '#6366f1' }} />
      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: activeBoardId === b.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</span>
      <button onClick={e => { e.stopPropagation(); toggleFavoriteBoard(b.id); }}
        className={`p-0.5 rounded transition-opacity flex-shrink-0 ${favoriteBoards.has(b.id) ? 'opacity-80' : 'opacity-0 group-hover/board:opacity-100'}`}
        title={favoriteBoards.has(b.id) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
        style={{ color: favoriteBoards.has(b.id) ? '#f59e0b' : 'var(--text-muted)' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill={favoriteBoards.has(b.id) ? '#f59e0b' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      {b.is_shared && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
      {canManage && (
        <span className="opacity-0 group-hover/board:opacity-100 flex gap-0.5 flex-shrink-0 transition-opacity">
          <button onClick={e => { e.stopPropagation(); setBoardModalEditId(b.id); setBoardModalName(b.name); setBoardModalColor(b.color ?? '#6366f1'); setBoardModalDesc(b.description ?? ''); setBoardModalFolderId(b.folder_id ?? null); setShowBoardModal(true); }}
            className="p-0.5 rounded" title="Upravit" style={{ color: 'var(--text-muted)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
          <button onClick={e => { e.stopPropagation(); if (confirm(`Smazat projekt „${b.name}"?`)) deleteBoard(b.id); }}
            className="p-0.5 rounded" title="Smazat" style={{ color: 'var(--text-muted)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </span>
      )}
    </div>
  );
}
