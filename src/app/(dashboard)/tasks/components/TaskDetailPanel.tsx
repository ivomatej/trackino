'use client';

import { useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { TaskBoard, TaskColumn, TaskItem, TaskSubtask, TaskComment, TaskAttachment, TaskHistory, TaskPriority } from '@/types/database';
import { PRIORITY_CONFIG, selectCls, SelectChevron } from '../types';
import type { Member, UserWorkspace, CwsBoardInfo, CwsColumnInfo } from '../types';
import { Avatar } from './Avatar';

interface TaskDetailPanelProps {
  selectedTask: TaskItem | null;
  setSelectedTask: (fn: ((prev: TaskItem | null) => TaskItem | null) | TaskItem | null) => void;
  // Context for breadcrumb
  crossWsMode: boolean;
  cwsBoardsMap: Map<string, CwsBoardInfo>;
  userWorkspaces: UserWorkspace[];
  cwsColsMap: Map<string, CwsColumnInfo>;
  boards: TaskBoard[];
  sortedColumns: TaskColumn[];
  // Detail size
  activeBoard: TaskBoard | undefined;
  // Data
  members: Member[];
  canManage: boolean;
  // Completion
  toggleComplete: (task: TaskItem) => void;
  // Title editing
  editingTitle: boolean;
  setEditingTitle: (v: boolean) => void;
  editTitle: string;
  setEditTitle: (v: string) => void;
  saveTitle: () => void;
  // Description
  descRef: React.RefObject<HTMLDivElement | null>;
  saveDescription: () => void;
  // Subtasks
  detailSubtasks: TaskSubtask[];
  setDetailSubtasks: (fn: (prev: TaskSubtask[]) => TaskSubtask[]) => void;
  toggleSubtask: (id: string, done: boolean) => void;
  addSubtask: (title: string) => Promise<void>;
  deleteSubtask: (id: string) => void;
  newSubtaskText: string;
  setNewSubtaskText: (v: string) => void;
  // Attachments
  detailAttachments: TaskAttachment[];
  downloadAttachment: (att: TaskAttachment) => void;
  deleteAttachment: (att: TaskAttachment) => void;
  uploadFile: (f: File) => void;
  // Comments
  detailComments: TaskComment[];
  deleteComment: (id: string) => void;
  commentRef: React.RefObject<HTMLDivElement | null>;
  setNewComment: (v: string) => void;
  addComment: () => void;
  // History
  showAllHistory: boolean;
  setShowAllHistory: (v: boolean) => void;
  detailHistory: TaskHistory[];
  historyText: (h: TaskHistory) => string;
  // Actions
  deleteTask: (id: string) => void;
  updateTask: (id: string, data: Partial<TaskItem>, action?: string, oldVal?: string, newVal?: string) => void;
  moveTaskTo: (task: TaskItem, colId: string) => void;
  // Auth
  userId: string | undefined;
}

export function TaskDetailPanel({
  selectedTask, setSelectedTask,
  crossWsMode, cwsBoardsMap, userWorkspaces, cwsColsMap,
  boards, sortedColumns, activeBoard,
  members, canManage,
  toggleComplete,
  editingTitle, setEditingTitle, editTitle, setEditTitle, saveTitle,
  descRef, saveDescription,
  detailSubtasks, setDetailSubtasks, toggleSubtask, addSubtask, deleteSubtask,
  newSubtaskText, setNewSubtaskText,
  detailAttachments, downloadAttachment, deleteAttachment, uploadFile,
  detailComments, deleteComment, commentRef, setNewComment, addComment,
  showAllHistory, setShowAllHistory, detailHistory, historyText,
  deleteTask, updateTask, moveTaskTo,
  userId,
}: TaskDetailPanelProps) {
  if (!selectedTask) return null;

  const detailSize = crossWsMode ? 'normal' : (activeBoard?.settings?.detail_size ?? 'normal');
  const maxWidth = { compact: '400px', normal: '520px', large: '680px' }[detailSize] ?? '520px';

  return (
    <div className="fixed inset-0 z-50" onClick={e => { if (e.target === e.currentTarget) setSelectedTask(null); }}
      style={{ background: 'rgba(0,0,0,0.2)' }}>
      <div className="w-full flex-shrink-0 border-l overflow-y-auto fixed right-0 top-0 bottom-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', transition: 'transform 0.2s ease-out', maxWidth }} onClick={e => e.stopPropagation()}>
        <div className="p-4">
          {/* ── Top bar: breadcrumb + actions ── */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {crossWsMode ? (() => {
                const board = cwsBoardsMap.get(selectedTask.board_id);
                const ws = userWorkspaces.find(w => w.id === board?.workspace_id);
                const col = cwsColsMap.get(selectedTask.column_id ?? '');
                return `${ws?.name ?? ''}${board ? ` / ${board.name}` : ''}${col ? ` / ${col.name}` : ''}`;
              })() : (
                <>
                  {boards.find(b => b.id === selectedTask.board_id)?.name ?? ''}
                  {(() => { const col = sortedColumns.find(c => c.id === selectedTask.column_id); return col ? ` / ${col.name}` : ''; })()}
                </>
              )}
            </span>
            <div className="flex items-center gap-0.5">
              {canManage && (
                <button onClick={() => { if (confirm('Smazat úkol?')) deleteTask(selectedTask.id); }}
                  className="p-1.5 rounded transition-colors"
                  onMouseEnter={e => { e.currentTarget.style.background = '#ef444418'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Smazat úkol"
                  style={{ color: 'var(--text-muted)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              )}
              <button onClick={() => setSelectedTask(null)} className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* ── Completion circle + Title ── */}
          <div className="flex items-start gap-2.5 mb-3">
            <button
              className="mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={{ borderColor: selectedTask.is_completed ? '#22c55e' : 'var(--border)', background: selectedTask.is_completed ? '#22c55e' : 'transparent', cursor: canManage ? 'pointer' : 'default' }}
              onClick={() => { if (canManage) toggleComplete(selectedTask); }}
              title={selectedTask.is_completed ? 'Znovu otevřít' : 'Označit jako dokončené'}>
              {selectedTask.is_completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
            </button>
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus
                  className="text-base font-bold w-full rounded-lg border px-2 py-1"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setEditTitle(selectedTask.title); } }}
                  onBlur={saveTitle}
                />
              ) : (
                <h2 className="text-lg font-bold leading-snug" style={{ color: 'var(--text-primary)', textDecoration: selectedTask.is_completed ? 'line-through' : 'none', opacity: selectedTask.is_completed ? 0.6 : 1, cursor: canManage ? 'text' : 'default' }}
                  onClick={() => { if (canManage) { setEditingTitle(true); setEditTitle(selectedTask.title); } }}>
                  {selectedTask.title}
                </h2>
              )}
              {selectedTask.is_completed && (
                <span className="text-xs font-medium" style={{ color: '#22c55e' }}>Dokončeno</span>
              )}
            </div>
          </div>

          {/* ── Fields grid ── */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-2">
            {/* Status */}
            <div>
              <label className="text-[11px] font-medium mb-0.5 block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</label>
              <div className="relative">
                <select value={selectedTask.column_id ?? ''} disabled={!canManage}
                  onChange={e => { const cid = e.target.value; moveTaskTo(selectedTask, cid); setSelectedTask(prev => prev ? { ...prev, column_id: cid } : null); }}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {sortedColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[11px] font-medium mb-0.5 block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Priorita</label>
              <div className="relative">
                <select value={selectedTask.priority} disabled={!canManage}
                  onChange={e => {
                    const p = e.target.value as TaskPriority;
                    updateTask(selectedTask.id, { priority: p }, 'priority_changed', PRIORITY_CONFIG[selectedTask.priority].label, PRIORITY_CONFIG[p].label);
                    setSelectedTask(prev => prev ? { ...prev, priority: p } : null);
                  }}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-[11px] font-medium mb-0.5 block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Řešitel</label>
              <div className="relative">
                <select value={selectedTask.assigned_to ?? ''} disabled={!canManage}
                  onChange={e => {
                    const uid = e.target.value || null;
                    const name = uid ? members.find(m => m.user_id === uid)?.display_name ?? '' : 'Nepřiřazen';
                    updateTask(selectedTask.id, { assigned_to: uid }, 'assigned', members.find(m => m.user_id === selectedTask.assigned_to)?.display_name ?? 'Nepřiřazen', name);
                    setSelectedTask(prev => prev ? { ...prev, assigned_to: uid } : null);
                  }}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">Nepřiřazen</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>

            {/* Reviewer */}
            <div>
              <label className="text-[11px] font-medium mb-0.5 block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Zadavatel / Kontrolor</label>
              <div className="relative">
                <select value={selectedTask.reviewer_id ?? ''} disabled={!canManage}
                  onChange={e => {
                    const uid = e.target.value || null;
                    updateTask(selectedTask.id, { reviewer_id: uid } as Partial<TaskItem>);
                    setSelectedTask(prev => prev ? { ...prev, reviewer_id: uid } : null);
                  }}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">–</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="text-[11px] font-medium mb-0.5 block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Termín</label>
              <input type="date" value={selectedTask.deadline ?? ''} disabled={!canManage}
                onChange={e => {
                  const d = e.target.value || null;
                  updateTask(selectedTask.id, { deadline: d }, 'deadline_changed', selectedTask.deadline ?? '', d ?? '');
                  setSelectedTask(prev => prev ? { ...prev, deadline: d } : null);
                }}
                className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Time estimate */}
            <div>
              <label className="text-[11px] font-medium mb-0.5 block uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Časový odhad (min)</label>
              <input type="number" min="0" step="15" value={selectedTask.time_estimate ?? ''} disabled={!canManage}
                placeholder="–"
                onChange={e => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  updateTask(selectedTask.id, { time_estimate: val } as Partial<TaskItem>);
                  setSelectedTask(prev => prev ? { ...prev, time_estimate: val } : null);
                }}
                className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Created date */}
          <div className="mb-3 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Vytvořeno: {new Date(selectedTask.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {selectedTask.time_estimate != null && selectedTask.time_estimate > 0 && (
              <span className="ml-3">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-0.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Odhad: {selectedTask.time_estimate >= 60 ? `${Math.floor(selectedTask.time_estimate / 60)}h ${selectedTask.time_estimate % 60 > 0 ? `${selectedTask.time_estimate % 60}min` : ''}`.trim() : `${selectedTask.time_estimate}min`}
              </span>
            )}
          </div>

          {/* Description with rich text toolbar */}
          <div className="mb-4">
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Popis</label>
            {canManage ? (
              <>
                <div className="flex items-center gap-0.5 mb-1 rounded-t-lg border border-b-0 px-1 py-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                  {[
                    { cmd: 'bold', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>, title: 'Tučně' },
                    { cmd: 'italic', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>, title: 'Kurzíva' },
                    { cmd: 'underline', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>, title: 'Podtržení' },
                    { cmd: 'insertUnorderedList', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>, title: 'Odrážky' },
                    { cmd: 'insertOrderedList', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fill="currentColor" fontSize="8" fontWeight="600">1</text><text x="2" y="14" fill="currentColor" fontSize="8" fontWeight="600">2</text><text x="2" y="20" fill="currentColor" fontSize="8" fontWeight="600">3</text></svg>, title: 'Číslování' },
                  ].map(btn => (
                    <button key={btn.cmd} title={btn.title} className="p-1.5 rounded transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseDown={e => e.preventDefault()}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => document.execCommand(btn.cmd)}>
                      {btn.icon}
                    </button>
                  ))}
                </div>
                <div ref={descRef} contentEditable suppressContentEditableWarning
                  className="text-base sm:text-sm rounded-b-lg border px-3 py-2 min-h-[120px] focus:outline-none"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: selectedTask.description }}
                  onBlur={saveDescription}
                />
              </>
            ) : (
              <div className="text-sm px-3 py-2 rounded-lg min-h-[60px]" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: selectedTask.description || '<span style="color:var(--text-muted)">Bez popisu</span>' }} />
            )}
          </div>

          {/* Subtasks */}
          <div className="mb-4">
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Podúkoly {detailSubtasks.length > 0 && `(${detailSubtasks.filter(s => s.is_done).length}/${detailSubtasks.length})`}
            </label>
            {detailSubtasks.length > 0 && (
              <div className="h-1.5 rounded-full mb-2 overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(detailSubtasks.filter(s => s.is_done).length / detailSubtasks.length) * 100}%`, background: 'var(--primary)' }} />
              </div>
            )}
            <div className="space-y-1">
              {detailSubtasks.sort((a, b) => a.sort_order - b.sort_order).map(sub => {
                const subAssignee = members.find(m => m.user_id === sub.assigned_to);
                return (
                  <div key={sub.id} className="flex items-center gap-2 group/sub">
                    <input type="checkbox" checked={sub.is_done} onChange={e => toggleSubtask(sub.id, e.target.checked)}
                      className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: 'var(--primary)' }} />
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)', textDecoration: sub.is_done ? 'line-through' : 'none', opacity: sub.is_done ? 0.5 : 1 }}>{sub.title}</span>
                    {canManage && (
                      <select value={sub.assigned_to ?? ''} className="text-xs rounded border px-1 py-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity max-w-[100px]"
                        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        onChange={async e => {
                          const uid = e.target.value || null;
                          await supabase.from('trackino_task_subtasks').update({ assigned_to: uid }).eq('id', sub.id);
                          setDetailSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, assigned_to: uid } : s));
                        }}>
                        <option value="">–</option>
                        {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                      </select>
                    )}
                    {!canManage && subAssignee && <Avatar name={subAssignee.display_name} color={subAssignee.avatar_color} size={18} />}
                    {canManage && (
                      <button onClick={() => deleteSubtask(sub.id)} className="opacity-0 group-hover/sub:opacity-100 p-0.5 rounded transition-opacity"
                        style={{ color: 'var(--text-muted)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {canManage && (
              <div className="mt-2">
                <input value={newSubtaskText} onChange={e => setNewSubtaskText(e.target.value)} placeholder="+ Přidat podúkol"
                  className="text-base sm:text-sm rounded-lg border px-3 py-1.5 w-full"
                  style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newSubtaskText.trim()) {
                      await addSubtask(newSubtaskText.trim());
                      setNewSubtaskText('');
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="mb-4">
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Přílohy</label>
            {detailAttachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 py-1.5 group/att">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <button onClick={() => downloadAttachment(att)} className="text-sm flex-1 min-w-0 truncate text-left" style={{ color: 'var(--primary)' }}>{att.file_name}</button>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{(att.file_size / 1024).toFixed(0)} KB</span>
                {canManage && (
                  <button onClick={() => deleteAttachment(att)} className="opacity-0 group-hover/att:opacity-100 p-0.5 rounded transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            ))}
            {canManage && (
              <label className="flex items-center gap-2 mt-1 cursor-pointer text-sm py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Přidat soubor
                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.zip,.txt,.csv" />
              </label>
            )}
          </div>

          {/* Comments */}
          <div className="mb-4">
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Komentáře</label>
            <div className="space-y-3">
              {detailComments.map(c => {
                const author = members.find(m => m.user_id === c.user_id);
                return (
                  <div key={c.id} className="flex gap-2 group/com">
                    <Avatar name={author?.display_name ?? '?'} color={author?.avatar_color ?? '#6366f1'} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{author?.display_name ?? '?'}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {userId === c.user_id && (
                          <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover/com:opacity-100 p-0.5 rounded transition-opacity"
                            style={{ color: 'var(--text-muted)' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                      <div className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: c.content }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-0.5 rounded-t-lg border border-b-0 px-1 py-0.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                {[
                  { cmd: 'bold', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg> },
                  { cmd: 'italic', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg> },
                  { cmd: 'underline', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg> },
                ].map(btn => (
                  <button key={btn.cmd} className="p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                    onMouseDown={e => e.preventDefault()}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => document.execCommand(btn.cmd)}>
                    {btn.icon}
                  </button>
                ))}
              </div>
              <div className="flex flex-col">
                <div ref={commentRef} contentEditable suppressContentEditableWarning
                  className="text-base sm:text-sm rounded-b-lg border px-3 py-2 min-h-[80px] focus:outline-none"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  data-placeholder="Napsat komentář..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const html = commentRef.current?.innerHTML ?? ''; if (html.replace(/<[^>]*>/g, '').trim()) { setNewComment(html); setTimeout(() => addComment(), 0); } } }}
                />
                <div className="flex justify-end mt-2">
                  <button onClick={() => { const html = commentRef.current?.innerHTML ?? ''; if (html.replace(/<[^>]*>/g, '').trim()) { setNewComment(html); setTimeout(() => { addComment(); if (commentRef.current) commentRef.current.innerHTML = ''; }, 0); } }}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'var(--primary)', color: '#fff' }}>
                    Odeslat
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div>
            <button className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}
              onClick={() => setShowAllHistory(!showAllHistory)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showAllHistory ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}><polyline points="9 18 15 12 9 6"/></svg>
              Historie ({detailHistory.length})
            </button>
            {showAllHistory && (
              <div className="space-y-1.5 mt-1">
                {detailHistory.map(h => (
                  <div key={h.id} className="flex items-start gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {historyText(h)} – {new Date(h.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
