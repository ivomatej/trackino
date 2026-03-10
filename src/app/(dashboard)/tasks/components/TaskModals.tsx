'use client';

import { supabase } from '@/lib/supabase';
import type { TaskColumn, TaskBoard, TaskPriority, TaskFolder } from '@/types/database';
import { PRIORITY_CONFIG, selectCls, SelectChevron } from '../types';
import type { Member, UserWorkspace, CwsBoardInfo, CwsColumnInfo } from '../types';
import { Avatar } from './Avatar';

// ── Board Settings Modal ──────────────────────────────────────────────────────

interface BoardSettingsModalProps {
  showBoardSettings: boolean;
  setShowBoardSettings: (v: boolean) => void;
  activeBoard: TaskBoard;
  sortedColumns: TaskColumn[];
  setColumns: React.Dispatch<React.SetStateAction<TaskColumn[]>>;
  saveBoardSettings: (settings: TaskBoard['settings']) => Promise<void>;
  updateColumnColor: (colId: string, color: string) => Promise<void>;
}

export function BoardSettingsModal({
  showBoardSettings, setShowBoardSettings, activeBoard, sortedColumns,
  setColumns, saveBoardSettings, updateColumnColor,
}: BoardSettingsModalProps) {
  if (!showBoardSettings) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => setShowBoardSettings(false)}>
      <div className="rounded-xl border p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Nastavení projektu</h3>
          <button onClick={() => setShowBoardSettings(false)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Auto-complete column */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Sloupec pro dokončené úkoly</label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Dokončené úkoly budou automaticky přesunuty do tohoto sloupce</p>
          <div className="relative">
            <select value={activeBoard.settings?.auto_complete_column_id ?? ''}
              onChange={e => saveBoardSettings({ ...activeBoard.settings, auto_complete_column_id: e.target.value || null })}
              className={selectCls} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              <option value="">Nepřesouvat</option>
              {sortedColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <SelectChevron />
          </div>
        </div>

        {/* Column order */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Pořadí sloupců</label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Změňte pořadí sloupců pomocí šipek</p>
          <div className="space-y-1">
            {sortedColumns.map((col, idx) => (
              <div key={col.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: col.color ?? '#9ca3af' }} />
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                <div className="flex gap-0.5">
                  <button disabled={idx === 0}
                    className="p-1 rounded transition-colors disabled:opacity-20"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { if (idx > 0) e.currentTarget.style.background = 'var(--bg-card)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={async () => {
                      if (idx === 0) return;
                      const prev = sortedColumns[idx - 1];
                      const prevOrder = prev.sort_order;
                      const curOrder = col.sort_order;
                      setColumns(old => old.map(c => c.id === col.id ? { ...c, sort_order: prevOrder } : c.id === prev.id ? { ...c, sort_order: curOrder } : c));
                      await supabase.from('trackino_task_columns').update({ sort_order: prevOrder }).eq('id', col.id);
                      await supabase.from('trackino_task_columns').update({ sort_order: curOrder }).eq('id', prev.id);
                    }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button disabled={idx === sortedColumns.length - 1}
                    className="p-1 rounded transition-colors disabled:opacity-20"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { if (idx < sortedColumns.length - 1) e.currentTarget.style.background = 'var(--bg-card)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={async () => {
                      if (idx === sortedColumns.length - 1) return;
                      const next = sortedColumns[idx + 1];
                      const nextOrder = next.sort_order;
                      const curOrder = col.sort_order;
                      setColumns(old => old.map(c => c.id === col.id ? { ...c, sort_order: nextOrder } : c.id === next.id ? { ...c, sort_order: curOrder } : c));
                      await supabase.from('trackino_task_columns').update({ sort_order: nextOrder }).eq('id', col.id);
                      await supabase.from('trackino_task_columns').update({ sort_order: curOrder }).eq('id', next.id);
                    }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column colors toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Podbarvení sloupců</label>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lehce podbarví sloupce v Kanbanu zvolenou barvou</p>
            </div>
            <button onClick={() => saveBoardSettings({ ...activeBoard.settings, column_colors_enabled: !activeBoard.settings?.column_colors_enabled })}
              className="w-10 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{ background: activeBoard.settings?.column_colors_enabled ? 'var(--primary)' : 'var(--border)' }}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                style={{ left: activeBoard.settings?.column_colors_enabled ? 20 : 4 }} />
            </button>
          </div>
        </div>

        {/* Column color pickers */}
        {activeBoard.settings?.column_colors_enabled && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>Barvy sloupců</label>
            {sortedColumns.map(col => (
              <div key={col.id} className="flex items-center gap-3">
                <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                <div className="flex gap-1">
                  {['#9ca3af', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6'].map(c => (
                    <button key={c} className="w-6 h-6 rounded-full border-2 transition-colors"
                      style={{ background: c, borderColor: col.color === c ? 'var(--text-primary)' : 'transparent' }}
                      onClick={() => updateColumnColor(col.id, c)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail panel size */}
        <div className="mb-2">
          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Šířka detailu úkolu</label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Nastavte šířku pravého panelu s detailem úkolu</p>
          <div className="flex gap-2">
            {([
              { value: 'compact' as const, label: 'Úzký', width: '400px' },
              { value: 'normal' as const, label: 'Střední', width: '520px' },
              { value: 'large' as const, label: 'Široký', width: '680px' },
            ]).map(opt => {
              const cur = activeBoard.settings?.detail_size ?? 'normal';
              return (
                <button key={opt.value}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{ background: cur === opt.value ? 'var(--primary)' : 'var(--bg-hover)', color: cur === opt.value ? '#fff' : 'var(--text-muted)', borderColor: cur === opt.value ? 'var(--primary)' : 'var(--border)' }}
                  onClick={() => saveBoardSettings({ ...activeBoard.settings, detail_size: opt.value })}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────

type ShareMode = 'none' | 'workspace' | 'users';

interface ShareModalProps {
  showShareModal: boolean;
  setShowShareModal: (v: boolean) => void;
  activeBoard: TaskBoard;
  shareMode: ShareMode;
  setShareMode: (v: ShareMode) => void;
  shareSelectedUsers: Set<string>;
  setShareSelectedUsers: React.Dispatch<React.SetStateAction<Set<string>>>;
  members: Member[];
  userId: string | undefined;
  saveBoardSharing: () => Promise<void>;
}

export function ShareModal({
  showShareModal, setShowShareModal, activeBoard, shareMode, setShareMode,
  shareSelectedUsers, setShareSelectedUsers, members, userId, saveBoardSharing,
}: ShareModalProps) {
  if (!showShareModal) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowShareModal(false)}>
      <div className="w-96 p-5 rounded-2xl border shadow-xl mx-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text-primary)' }}>Sdílet projekt „{activeBoard.name}"</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může projekt a jeho úkoly vidět</p>
        <div className="space-y-2 mb-4">
          {([
            { id: 'none' as const, label: 'Nesdílet s nikým', desc: 'Projekt zůstane soukromý' },
            { id: 'workspace' as const, label: 'Celý workspace', desc: 'Vidí všichni členové' },
            { id: 'users' as const, label: 'Konkrétní uživatelé', desc: 'Vybraní členové' },
          ]).map(opt => (
            <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
              style={{ borderColor: shareMode === opt.id ? 'var(--primary)' : 'var(--border)', background: shareMode === opt.id ? 'var(--bg-active, var(--bg-hover))' : 'transparent' }}>
              <input type="radio" checked={shareMode === opt.id} onChange={() => setShareMode(opt.id)} className="accent-[var(--primary)]" />
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
        {shareMode === 'users' && (
          <div className="mb-4 max-h-48 overflow-y-auto space-y-1 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
            {members.filter(m => m.user_id !== userId).length === 0 && (
              <p className="text-xs px-2 py-1" style={{ color: 'var(--text-muted)' }}>Žádní další členové workspace</p>
            )}
            {members.filter(m => m.user_id !== userId).map(m => {
              const isChecked = shareSelectedUsers.has(m.user_id);
              return (
                <label key={m.user_id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{ background: isChecked ? 'var(--bg-active, var(--bg-hover))' : 'transparent' }}
                  onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isChecked ? 'var(--bg-active, var(--bg-hover))' : 'transparent'; }}
                >
                  <input type="checkbox" checked={isChecked}
                    onChange={() => setShareSelectedUsers(prev => {
                      const next = new Set(prev);
                      next.has(m.user_id) ? next.delete(m.user_id) : next.add(m.user_id);
                      return next;
                    })}
                    className="accent-[var(--primary)] flex-shrink-0" />
                  <Avatar name={m.display_name} color={m.avatar_color} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.display_name}</div>
                    {m.email && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</div>}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setShowShareModal(false)} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
          <button onClick={saveBoardSharing} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
        </div>
      </div>
    </div>
  );
}

// ── Board Edit Modal ──────────────────────────────────────────────────────────

interface BoardEditModalProps {
  showBoardModal: boolean;
  setShowBoardModal: (v: boolean) => void;
  boardModalEditId: string | null;
  setBoardModalEditId: (v: string | null) => void;
  boardModalName: string;
  setBoardModalName: (v: string) => void;
  boardModalColor: string;
  setBoardModalColor: (v: string) => void;
  boardModalDesc: string;
  setBoardModalDesc: (v: string) => void;
  boardModalFolderId: string | null;
  setBoardModalFolderId: (v: string | null) => void;
  folders: TaskFolder[];
  deleteBoard: (id: string) => Promise<void>;
  createBoard: (name: string, folderId: string | null, color: string, desc: string) => Promise<void>;
  updateBoard: (id: string, data: Partial<TaskBoard>) => Promise<void>;
  setShowShareModal: (v: boolean) => void;
}

export function BoardEditModal({
  showBoardModal, setShowBoardModal, boardModalEditId, setBoardModalEditId,
  boardModalName, setBoardModalName, boardModalColor, setBoardModalColor,
  boardModalDesc, setBoardModalDesc, boardModalFolderId, setBoardModalFolderId,
  folders, deleteBoard, createBoard, updateBoard, setShowShareModal,
}: BoardEditModalProps) {
  if (!showBoardModal) return null;
  const close = () => { setShowBoardModal(false); setBoardModalEditId(null); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={close}>
      <div className="rounded-xl border p-6 max-w-md w-full mx-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{boardModalEditId ? 'Upravit projekt' : 'Nový projekt'}</h3>
          <button onClick={close} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Název</label>
            <input value={boardModalName} onChange={e => setBoardModalName(e.target.value)}
              className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full" autoFocus
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder="Název projektu..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Barva</label>
            <div className="flex gap-2">
              {['#6366f1', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'].map(c => (
                <button key={c} className="w-7 h-7 rounded-full border-2 transition-colors"
                  style={{ background: c, borderColor: boardModalColor === c ? 'var(--text-primary)' : 'transparent' }}
                  onClick={() => setBoardModalColor(c)} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Popis</label>
            <textarea value={boardModalDesc} onChange={e => setBoardModalDesc(e.target.value)}
              className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full min-h-[60px] resize-none"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              placeholder="Volitelný popis..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Složka</label>
            <div className="relative">
              <select value={boardModalFolderId ?? ''} onChange={e => setBoardModalFolderId(e.target.value || null)}
                className={selectCls} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Bez složky</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-between mt-5">
          <div>
            {boardModalEditId && (
              <button onClick={() => {
                if (confirm('Smazat tento projekt a všechny jeho úkoly?')) {
                  deleteBoard(boardModalEditId);
                  close();
                }
              }} className="px-3 py-2 rounded-lg text-sm font-medium transition-colors" style={{ color: '#ef4444' }}>
                Smazat
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {boardModalEditId && (
              <button onClick={() => { close(); setShowShareModal(true); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
                Sdílení
              </button>
            )}
            <button onClick={async () => {
              if (!boardModalName.trim()) return;
              if (boardModalEditId) {
                await updateBoard(boardModalEditId, { name: boardModalName.trim(), color: boardModalColor, description: boardModalDesc, folder_id: boardModalFolderId });
              } else {
                await createBoard(boardModalName.trim(), boardModalFolderId, boardModalColor, boardModalDesc);
              }
              close();
            }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
              {boardModalEditId ? 'Uložit' : 'Vytvořit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CWS New Task Modal ────────────────────────────────────────────────────────

interface CwsNewTaskModalProps {
  showCwsNewTask: boolean;
  setShowCwsNewTask: (v: boolean) => void;
  userWorkspaces: UserWorkspace[];
  cwsNewWsId: string;
  setCwsNewWsId: (v: string) => void;
  cwsNewBoardId: string;
  setCwsNewBoardId: (v: string) => void;
  cwsNewColId: string;
  setCwsNewColId: (v: string) => void;
  cwsNewTitle: string;
  setCwsNewTitle: (v: string) => void;
  cwsNewPriority: TaskPriority;
  setCwsNewPriority: (v: TaskPriority) => void;
  cwsNewDeadline: string;
  setCwsNewDeadline: (v: string) => void;
  cwsNewAssignee: string;
  setCwsNewAssignee: (v: string) => void;
  cwsNewSaving: boolean;
  cwsNewTaskBoards: CwsBoardInfo[];
  cwsNewTaskCols: CwsColumnInfo[];
  cwsNewTaskMembers: Member[];
  handleCreateCwsTask: () => Promise<void>;
}

export function CwsNewTaskModal({
  showCwsNewTask, setShowCwsNewTask, userWorkspaces,
  cwsNewWsId, setCwsNewWsId, cwsNewBoardId, setCwsNewBoardId,
  cwsNewColId, setCwsNewColId, cwsNewTitle, setCwsNewTitle,
  cwsNewPriority, setCwsNewPriority, cwsNewDeadline, setCwsNewDeadline,
  cwsNewAssignee, setCwsNewAssignee, cwsNewSaving,
  cwsNewTaskBoards, cwsNewTaskCols, cwsNewTaskMembers, handleCreateCwsTask,
}: CwsNewTaskModalProps) {
  if (!showCwsNewTask) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCwsNewTask(false)}>
      <div className="w-full max-w-md p-5 rounded-2xl border shadow-xl mx-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Nový úkol</h2>
          <button onClick={() => setShowCwsNewTask(false)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Workspace</label>
            <div className="relative">
              <select value={cwsNewWsId} onChange={e => setCwsNewWsId(e.target.value)}
                className={`${selectCls} w-full`} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Vyberte workspace...</option>
                {userWorkspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
              </select>
              <SelectChevron />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Projekt</label>
            <div className="relative">
              <select value={cwsNewBoardId} onChange={e => setCwsNewBoardId(e.target.value)}
                className={`${selectCls} w-full`} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                disabled={!cwsNewWsId || cwsNewTaskBoards.length === 0}>
                <option value="">Vyberte projekt...</option>
                {cwsNewTaskBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <SelectChevron />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Sloupec</label>
            <div className="relative">
              <select value={cwsNewColId} onChange={e => setCwsNewColId(e.target.value)}
                className={`${selectCls} w-full`} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                disabled={!cwsNewBoardId || cwsNewTaskCols.length === 0}>
                <option value="">Vyberte sloupec...</option>
                {cwsNewTaskCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <SelectChevron />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Název úkolu</label>
            <input value={cwsNewTitle} onChange={e => setCwsNewTitle(e.target.value)}
              placeholder="Název úkolu..."
              className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateCwsTask(); }}
              autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Priorita</label>
              <div className="relative">
                <select value={cwsNewPriority} onChange={e => setCwsNewPriority(e.target.value as TaskPriority)}
                  className={`${selectCls} w-full`} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Termín</label>
              <input type="date" value={cwsNewDeadline} onChange={e => setCwsNewDeadline(e.target.value)}
                className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          {cwsNewTaskMembers.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Řešitel</label>
              <div className="relative">
                <select value={cwsNewAssignee} onChange={e => setCwsNewAssignee(e.target.value)}
                  className={`${selectCls} w-full`} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">Nepřiřazeno</option>
                  {cwsNewTaskMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setShowCwsNewTask(false)}
            className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
          <button onClick={handleCreateCwsTask} disabled={!cwsNewWsId || !cwsNewBoardId || !cwsNewColId || !cwsNewTitle.trim() || cwsNewSaving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {cwsNewSaving ? 'Ukládám...' : 'Vytvořit'}
          </button>
        </div>
      </div>
    </div>
  );
}
