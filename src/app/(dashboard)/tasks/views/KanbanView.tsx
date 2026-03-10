'use client';

import {
  DndContext, DragOverlay, closestCorners,
  type DragStartEvent, type DragEndEvent, type SensorDescriptor, type SensorOptions,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TaskItem, TaskColumn, TaskBoard, TaskSubtask } from '@/types/database';
import type { Member } from '../types';
import { SortableCard } from '../components/SortableCard';
import { DroppableColumn, SortableColumnWrapper } from '../components/DragComponents';

interface KanbanViewProps {
  sortedColumns: TaskColumn[];
  filteredTasks: TaskItem[];
  activeBoard: TaskBoard | null;
  members: Member[];
  subtaskMap: Map<string, TaskSubtask[]>;
  commentCountMap: Map<string, number>;
  attachCountMap: Map<string, number>;
  selectedTask: TaskItem | null;
  canManage: boolean;
  isMobile: boolean;
  activeId: string | null;
  dragType: 'card' | 'column' | null;
  tasks: TaskItem[];
  editingColumnId: string | null;
  editColumnName: string;
  quickAddCol: string | null;
  quickAddTitle: string;
  addingColumn: boolean;
  newColumnName: string;
  sensors: SensorDescriptor<SensorOptions>[];
  setEditingColumnId: (v: string | null) => void;
  setEditColumnName: (v: string) => void;
  setQuickAddCol: (v: string | null) => void;
  setQuickAddTitle: (v: string) => void;
  setAddingColumn: (v: boolean) => void;
  setNewColumnName: (v: string) => void;
  openDetail: (task: TaskItem) => void;
  toggleComplete: (task: TaskItem) => Promise<void>;
  renameColumn: (id: string, name: string) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  createTask: (title: string, columnId: string) => Promise<TaskItem | undefined>;
  addColumn: (name: string) => Promise<void>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

export function KanbanView({
  sortedColumns, filteredTasks, activeBoard, members, subtaskMap,
  commentCountMap, attachCountMap, selectedTask, canManage, isMobile,
  activeId, dragType, tasks, editingColumnId, editColumnName, quickAddCol,
  quickAddTitle, addingColumn, newColumnName, sensors,
  setEditingColumnId, setEditColumnName, setQuickAddCol, setQuickAddTitle,
  setAddingColumn, setNewColumnName, openDetail, toggleComplete,
  renameColumn, deleteColumn, createTask, addColumn,
  handleDragStart, handleDragEnd,
}: KanbanViewProps) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 pb-4 overflow-x-auto md:flex-row flex-col kanban-scroll" style={{ minHeight: 200 }}>
        <SortableContext items={sortedColumns.map(c => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
          {sortedColumns.map(col => {
            const colTasks = filteredTasks.filter(t => t.column_id === col.id).sort((a, b) => a.sort_order - b.sort_order);
            const boardSettings = activeBoard?.settings ?? {};
            const colBg = boardSettings.column_colors_enabled && col.color ? col.color + '0d' : 'var(--bg-hover)';
            return (
              <SortableColumnWrapper key={col.id} id={col.id} canDrag={false} render={(dragListeners: Record<string, unknown>) => (
                <div className="rounded-xl p-3" style={{ background: colBg }}>
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 group/colheader" {...(canManage ? dragListeners : {})}>
                    {editingColumnId === col.id ? (
                      <input value={editColumnName} onChange={e => setEditColumnName(e.target.value)} autoFocus
                        className="text-base sm:text-sm font-semibold rounded border px-1 py-0.5 flex-1 min-w-0"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && editColumnName.trim()) { await renameColumn(col.id, editColumnName.trim()); setEditingColumnId(null); }
                          if (e.key === 'Escape') setEditingColumnId(null);
                        }}
                        onBlur={async () => { if (editColumnName.trim()) await renameColumn(col.id, editColumnName.trim()); setEditingColumnId(null); }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-sm font-semibold flex-1 min-w-0 truncate cursor-pointer" style={{ color: 'var(--text-primary)' }}
                        onDoubleClick={e => { e.stopPropagation(); if (canManage) { setEditingColumnId(col.id); setEditColumnName(col.name); } }}>
                        {col.name} <span className="inline-flex items-center justify-center text-[11px] font-semibold rounded-full ml-1" style={{ minWidth: '20px', height: '20px', padding: '0 5px', background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{colTasks.length}</span>
                      </span>
                    )}
                    {canManage && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setQuickAddCol(col.id); setQuickAddTitle(''); }} className="p-1 rounded transition-colors opacity-0 group-hover/colheader:opacity-100" title="Přidat úkol"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button onClick={e => { e.stopPropagation(); if (confirm(`Smazat sloupec „${col.name}"? Úkoly v něm budou odpojeny.`)) deleteColumn(col.id); }}
                          className="p-1 rounded transition-colors opacity-0 group-hover/colheader:opacity-100" title="Smazat sloupec"
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          style={{ color: 'var(--text-muted)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Cards wrapped in DroppableColumn for cross-column DnD */}
                  <DroppableColumn id={col.id}>
                    <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      {colTasks.map(task => (
                        <SortableCard key={task.id} task={task} members={members} subtaskMap={subtaskMap}
                          commentCountMap={commentCountMap} attachCountMap={attachCountMap}
                          onOpen={openDetail} canDrag={canManage && !isMobile} onToggleComplete={canManage ? toggleComplete : undefined}
                          isSelected={selectedTask?.id === task.id} />
                      ))}
                      {colTasks.length === 0 && <div className="py-4" />}
                    </SortableContext>
                  </DroppableColumn>

                  {/* Quick add input */}
                  {quickAddCol === col.id && canManage && (
                    <div className="mt-1">
                      <input value={quickAddTitle} onChange={e => setQuickAddTitle(e.target.value)}
                        placeholder="Název úkolu..." autoFocus
                        className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        onKeyDown={async e => {
                          if (e.key === 'Enter' && quickAddTitle.trim()) {
                            await createTask(quickAddTitle.trim(), col.id);
                            setQuickAddTitle('');
                            setQuickAddCol(null);
                          }
                          if (e.key === 'Escape') setQuickAddCol(null);
                        }}
                        onBlur={() => { if (!quickAddTitle.trim()) setQuickAddCol(null); }}
                      />
                    </div>
                  )}
                </div>
              )} />
            );
          })}
        </SortableContext>

        {/* Add column button */}
        {canManage && (
          <div className="md:w-[280px] md:min-w-[280px] flex-shrink-0">
            {addingColumn ? (
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
                <input value={newColumnName} onChange={e => setNewColumnName(e.target.value)} placeholder="Název sloupce..." autoFocus
                  className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full mb-2"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newColumnName.trim()) {
                      await addColumn(newColumnName.trim());
                      setNewColumnName('');
                      setAddingColumn(false);
                    }
                    if (e.key === 'Escape') setAddingColumn(false);
                  }} />
              </div>
            ) : (
              <button onClick={() => setAddingColumn(true)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl w-full text-sm font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Přidat sloupec
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId && (() => {
          if (dragType === 'column') {
            const colId = activeId.replace('col-', '');
            const col = sortedColumns.find(c => c.id === colId);
            if (!col) return null;
            return (
              <div className="rounded-xl p-3 shadow-lg opacity-80" style={{ background: 'var(--bg-hover)', width: 280 }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{col.name}</div>
              </div>
            );
          }
          const t = tasks.find(x => x.id === activeId);
          if (!t) return null;
          return (
            <div className="rounded-lg border p-3 shadow-lg" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 260 }}>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.title}</div>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}
