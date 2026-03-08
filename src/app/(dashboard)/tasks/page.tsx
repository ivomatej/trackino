'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { TaskBoard, TaskColumn, TaskItem, TaskSubtask, TaskComment, TaskAttachment, TaskHistory, TaskPriority } from '@/types/database';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Priority helpers ──
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgentní', color: '#ef4444', dot: '#ef4444' },
  high:   { label: 'Vysoká',   color: '#f97316', dot: '#f97316' },
  medium: { label: 'Střední',  color: '#3b82f6', dot: '#3b82f6' },
  low:    { label: 'Nízká',    color: '#9ca3af', dot: '#9ca3af' },
  none:   { label: 'Žádná',    color: 'var(--text-muted)', dot: 'transparent' },
};

type TaskView = 'list' | 'kanban' | 'table';
type DeadlineFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'this_month' | 'no_deadline';

interface Member {
  user_id: string;
  display_name: string;
  avatar_color: string;
}

// ── Inline Avatar ──
function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: color, color: '#fff', fontSize: size * 0.4, fontWeight: 600, lineHeight: 1 }}>
      {initials}
    </div>
  );
}

// ── Sortable Kanban Card ──
function SortableCard({ task, members, subtaskMap, commentCountMap, attachCountMap, onOpen, canDrag }: {
  task: TaskItem; members: Member[]; subtaskMap: Map<string, TaskSubtask[]>; commentCountMap: Map<string, number>;
  attachCountMap: Map<string, number>; onOpen: (t: TaskItem) => void; canDrag: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, disabled: !canDrag,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const assignee = members.find(m => m.user_id === task.assigned_to);
  const subs = subtaskMap.get(task.id) ?? [];
  const doneSubs = subs.filter(s => s.is_done).length;
  const commentCount = commentCountMap.get(task.id) ?? 0;
  const attachCount = attachCountMap.get(task.id) ?? 0;
  const pc = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();

  return (
    <div ref={setNodeRef} {...attributes} {...(canDrag ? listeners : {})}
      className="rounded-lg border p-3 mb-2 cursor-pointer transition-colors"
      onClick={() => onOpen(task)}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(task); }}
      style={{ ...style, background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {/* Priority strip */}
      {task.priority !== 'none' && <div className="rounded-t-lg -mx-3 -mt-3 mb-2" style={{ height: 3, background: pc.color }} />}
      <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{task.title}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {task.deadline && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isOverdue ? '#ef444418' : 'var(--bg-hover)', color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
            {new Date(task.deadline).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
          </span>
        )}
        {subs.length > 0 && (
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/></svg>
            {doneSubs}/{subs.length}
          </span>
        )}
        {commentCount > 0 && (
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {commentCount}
          </span>
        )}
        {attachCount > 0 && (
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            {attachCount}
          </span>
        )}
        <div className="flex-1" />
        {assignee && <Avatar name={assignee.display_name} color={assignee.avatar_color} size={22} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ██  MAIN PAGE COMPONENT
// ══════════════════════════════════════
function TasksContent() {
  const { user, profile } = useAuth();
  const { currentWorkspace, currentMembership, hasModule } = useWorkspace();
  const isMasterAdmin = profile?.is_master_admin ?? false;
  const isAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const canManage = isMasterAdmin || isAdmin || (currentMembership?.can_manage_tasks ?? false);

  // ── Data state ──
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [view, setView] = useState<TaskView>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('trackino_tasks_view') as TaskView) || 'kanban';
    return 'kanban';
  });
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterDeadline, setFilterDeadline] = useState<DeadlineFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ── Detail panel state ──
  const [detailSubtasks, setDetailSubtasks] = useState<TaskSubtask[]>([]);
  const [detailComments, setDetailComments] = useState<TaskComment[]>([]);
  const [detailAttachments, setDetailAttachments] = useState<TaskAttachment[]>([]);
  const [detailHistory, setDetailHistory] = useState<TaskHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  // Quick add in kanban
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // New column
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Sort for table
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'deadline' | 'created_at' | 'assigned_to'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const wsId = currentWorkspace?.id;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Active board (first one) ──
  const activeBoard = boards[0] ?? null;

  // ── Sorted columns ──
  const sortedColumns = useMemo(() => {
    if (!activeBoard) return [];
    return columns.filter(c => c.board_id === activeBoard.id).sort((a, b) => a.sort_order - b.sort_order);
  }, [columns, activeBoard]);

  const doneColumnId = useMemo(() => {
    return sortedColumns.find(c => c.name.toLowerCase().includes('hotovo'))?.id ?? null;
  }, [sortedColumns]);

  // ── Subtask map ──
  const subtaskMap = useMemo(() => {
    const map = new Map<string, TaskSubtask[]>();
    for (const s of subtasks) {
      const arr = map.get(s.task_id) ?? [];
      arr.push(s);
      map.set(s.task_id, arr);
    }
    return map;
  }, [subtasks]);

  // Comment & attachment count maps
  const commentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) map.set(c.task_id, (map.get(c.task_id) ?? 0) + 1);
    return map;
  }, [comments]);
  const attachCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attachments) map.set(a.task_id, (map.get(a.task_id) ?? 0) + 1);
    return map;
  }, [attachments]);

  // ── Filtered tasks ──
  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q));
    }
    if (onlyMine && user) list = list.filter(t => t.assigned_to === user.id);
    if (filterAssignee === 'unassigned') list = list.filter(t => !t.assigned_to);
    else if (filterAssignee !== 'all') list = list.filter(t => t.assigned_to === filterAssignee);
    if (filterPriority !== 'all') list = list.filter(t => t.priority === filterPriority);
    if (hideCompleted && doneColumnId) list = list.filter(t => t.column_id !== doneColumnId);
    if (filterDeadline !== 'all') {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (filterDeadline === 'overdue') list = list.filter(t => t.deadline && t.deadline < today);
      else if (filterDeadline === 'today') list = list.filter(t => t.deadline === today);
      else if (filterDeadline === 'this_week') {
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
        list = list.filter(t => t.deadline && t.deadline >= today && t.deadline <= weekEnd.toISOString().slice(0, 10));
      } else if (filterDeadline === 'this_month') {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        list = list.filter(t => t.deadline && t.deadline >= today && t.deadline <= monthEnd);
      } else if (filterDeadline === 'no_deadline') list = list.filter(t => !t.deadline);
    }
    return list;
  }, [tasks, search, onlyMine, filterAssignee, filterPriority, filterDeadline, hideCompleted, doneColumnId, user]);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!wsId || !user) return;
    setLoading(true);
    const [bRes, mRes] = await Promise.all([
      supabase.from('trackino_task_boards').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true }),
      (async () => {
        const { data: wm } = await supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId);
        if (!wm || wm.length === 0) return [];
        const uids = wm.map(m => m.user_id);
        const { data: profiles } = await supabase.from('trackino_profiles').select('id, display_name, avatar_color').in('id', uids);
        return (profiles ?? []).map(p => ({ user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1' }));
      })(),
    ]);
    const boardList = (bRes.data ?? []) as TaskBoard[];
    setBoards(boardList);
    setMembers(mRes as Member[]);

    // Auto-create first board
    let board = boardList[0];
    if (!board && canManage) {
      const { data: nb } = await supabase.from('trackino_task_boards').insert({ workspace_id: wsId, name: 'Hlavní board', created_by: user.id }).select().single();
      if (nb) {
        board = nb as TaskBoard;
        setBoards([board]);
        // Create default columns
        const defaults = [
          { name: 'K řešení', color: '#9ca3af', sort_order: 0 },
          { name: 'Rozpracováno', color: '#3b82f6', sort_order: 1 },
          { name: 'Ve schvalování', color: '#f97316', sort_order: 2 },
          { name: 'Hotovo', color: '#22c55e', sort_order: 3 },
        ];
        const { data: cols } = await supabase.from('trackino_task_columns').insert(defaults.map(d => ({ ...d, board_id: board!.id }))).select();
        if (cols) setColumns(cols as TaskColumn[]);
      }
    }

    if (board) {
      const [colRes, taskRes, subRes, comRes, attRes] = await Promise.all([
        supabase.from('trackino_task_columns').select('*').eq('board_id', board.id).order('sort_order'),
        supabase.from('trackino_task_items').select('*').eq('board_id', board.id).order('sort_order'),
        supabase.from('trackino_task_subtasks').select('*').in('task_id', []),
        supabase.from('trackino_task_comments').select('*').in('task_id', []),
        supabase.from('trackino_task_attachments').select('*').in('task_id', []),
      ]);
      setColumns((colRes.data ?? []) as TaskColumn[]);
      const tList = (taskRes.data ?? []) as TaskItem[];
      setTasks(tList);

      // Fetch subtasks, comments, attachments for all tasks
      if (tList.length > 0) {
        const tids = tList.map(t => t.id);
        const [sRes, cRes, aRes] = await Promise.all([
          supabase.from('trackino_task_subtasks').select('*').in('task_id', tids).order('sort_order'),
          supabase.from('trackino_task_comments').select('*').in('task_id', tids).order('created_at', { ascending: true }),
          supabase.from('trackino_task_attachments').select('*').in('task_id', tids).order('created_at'),
        ]);
        setSubtasks((sRes.data ?? []) as TaskSubtask[]);
        setComments((cRes.data ?? []) as TaskComment[]);
        setAttachments((aRes.data ?? []) as TaskAttachment[]);
      }
    }
    setLoading(false);
  }, [wsId, user, canManage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Save view preference
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('trackino_tasks_view', view);
  }, [view]);

  // ── Task CRUD ──
  const createTask = useCallback(async (title: string, columnId: string) => {
    if (!wsId || !user || !activeBoard) return;
    const colTasks = tasks.filter(t => t.column_id === columnId);
    const maxOrder = colTasks.length > 0 ? Math.max(...colTasks.map(t => t.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_items').insert({
      workspace_id: wsId, board_id: activeBoard.id, column_id: columnId,
      title, sort_order: maxOrder, created_by: user.id,
    }).select().single();
    if (data) {
      const t = data as TaskItem;
      setTasks(prev => [...prev, t]);
      await supabase.from('trackino_task_history').insert({ task_id: t.id, user_id: user.id, action: 'created' });
      return t;
    }
  }, [wsId, user, activeBoard, tasks]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<TaskItem>, historyAction?: string, oldVal?: string, newVal?: string) => {
    await supabase.from('trackino_task_items').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (historyAction && user) {
      await supabase.from('trackino_task_history').insert({ task_id: taskId, user_id: user.id, action: historyAction, old_value: oldVal ?? null, new_value: newVal ?? null });
    }
  }, [user]);

  const deleteTask = useCallback(async (taskId: string) => {
    await supabase.from('trackino_task_items').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
  }, []);

  // ── Column CRUD ──
  const addColumn = useCallback(async (name: string) => {
    if (!activeBoard) return;
    const maxOrder = sortedColumns.length > 0 ? Math.max(...sortedColumns.map(c => c.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_columns').insert({ board_id: activeBoard.id, name, sort_order: maxOrder }).select().single();
    if (data) setColumns(prev => [...prev, data as TaskColumn]);
  }, [activeBoard, sortedColumns]);

  const renameColumn = useCallback(async (colId: string, name: string) => {
    await supabase.from('trackino_task_columns').update({ name }).eq('id', colId);
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, name } : c));
  }, []);

  const deleteColumn = useCallback(async (colId: string) => {
    await supabase.from('trackino_task_columns').delete().eq('id', colId);
    setColumns(prev => prev.filter(c => c.id !== colId));
    setTasks(prev => prev.map(t => t.column_id === colId ? { ...t, column_id: null } : t));
  }, []);

  // ── DnD handlers ──
  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !user) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    // Is it a column id or a task id?
    const overTask = tasks.find(t => t.id === overId);
    const targetColId = overTask ? overTask.column_id : (sortedColumns.find(c => c.id === overId)?.id ?? null);

    if (!targetColId) return;

    const oldCol = sortedColumns.find(c => c.id === task.column_id);
    const newCol = sortedColumns.find(c => c.id === targetColId);

    // Same column reorder
    if (task.column_id === targetColId) {
      const colTasks = tasks.filter(t => t.column_id === targetColId).sort((a, b) => a.sort_order - b.sort_order);
      const oldIdx = colTasks.findIndex(t => t.id === taskId);
      const newIdx = overTask ? colTasks.findIndex(t => t.id === overId) : colTasks.length - 1;
      if (oldIdx === newIdx) return;
      const reordered = arrayMove(colTasks, oldIdx, newIdx);
      const updates = reordered.map((t, i) => ({ ...t, sort_order: i }));
      setTasks(prev => {
        const other = prev.filter(t => t.column_id !== targetColId);
        return [...other, ...updates];
      });
      for (const u of updates) {
        await supabase.from('trackino_task_items').update({ sort_order: u.sort_order }).eq('id', u.id);
      }
    } else {
      // Cross column move
      const newColTasks = tasks.filter(t => t.column_id === targetColId && t.id !== taskId).sort((a, b) => a.sort_order - b.sort_order);
      const insertIdx = overTask ? newColTasks.findIndex(t => t.id === overId) : newColTasks.length;
      const finalIdx = insertIdx === -1 ? newColTasks.length : insertIdx;
      newColTasks.splice(finalIdx, 0, { ...task, column_id: targetColId });
      const updates = newColTasks.map((t, i) => ({ ...t, sort_order: i, column_id: targetColId }));
      setTasks(prev => {
        const other = prev.filter(t => t.column_id !== targetColId && t.id !== taskId);
        return [...other, ...updates];
      });
      for (const u of updates) {
        await supabase.from('trackino_task_items').update({ sort_order: u.sort_order, column_id: u.column_id }).eq('id', u.id);
      }
      if (oldCol && newCol && oldCol.id !== newCol.id) {
        await supabase.from('trackino_task_history').insert({ task_id: taskId, user_id: user.id, action: 'moved', old_value: oldCol.name, new_value: newCol.name });
      }
    }
  };

  // ── Detail open ──
  const openDetail = useCallback(async (task: TaskItem) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditingTitle(false);
    setShowAllHistory(false);
    setNewComment('');
    setNewSubtaskText('');
    // Fetch detail data
    const [sRes, cRes, aRes, hRes] = await Promise.all([
      supabase.from('trackino_task_subtasks').select('*').eq('task_id', task.id).order('sort_order'),
      supabase.from('trackino_task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('trackino_task_attachments').select('*').eq('task_id', task.id).order('created_at'),
      supabase.from('trackino_task_history').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
    ]);
    setDetailSubtasks((sRes.data ?? []) as TaskSubtask[]);
    setDetailComments((cRes.data ?? []) as TaskComment[]);
    setDetailAttachments((aRes.data ?? []) as TaskAttachment[]);
    setDetailHistory((hRes.data ?? []) as TaskHistory[]);
  }, []);

  // ── Detail actions ──
  const saveTitle = useCallback(async () => {
    if (!selectedTask || !editTitle.trim()) return;
    setEditingTitle(false);
    await updateTask(selectedTask.id, { title: editTitle.trim() }, 'title_changed', selectedTask.title, editTitle.trim());
    setSelectedTask(prev => prev ? { ...prev, title: editTitle.trim() } : null);
  }, [selectedTask, editTitle, updateTask]);

  const saveDescription = useCallback(async () => {
    if (!selectedTask) return;
    setSavingDesc(true);
    const html = descRef.current?.innerHTML ?? '';
    await updateTask(selectedTask.id, { description: html }, 'description_changed');
    setSelectedTask(prev => prev ? { ...prev, description: html } : null);
    setSavingDesc(false);
  }, [selectedTask, updateTask]);

  const addSubtask = useCallback(async (text: string) => {
    if (!selectedTask || !text.trim()) return;
    const maxOrder = detailSubtasks.length > 0 ? Math.max(...detailSubtasks.map(s => s.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_subtasks').insert({ task_id: selectedTask.id, title: text.trim(), sort_order: maxOrder }).select().single();
    if (data) {
      setDetailSubtasks(prev => [...prev, data as TaskSubtask]);
      setSubtasks(prev => [...prev, data as TaskSubtask]);
    }
  }, [selectedTask, detailSubtasks]);

  const toggleSubtask = useCallback(async (subId: string, done: boolean) => {
    await supabase.from('trackino_task_subtasks').update({ is_done: done }).eq('id', subId);
    setDetailSubtasks(prev => prev.map(s => s.id === subId ? { ...s, is_done: done } : s));
    setSubtasks(prev => prev.map(s => s.id === subId ? { ...s, is_done: done } : s));
  }, []);

  const deleteSubtask = useCallback(async (subId: string) => {
    await supabase.from('trackino_task_subtasks').delete().eq('id', subId);
    setDetailSubtasks(prev => prev.filter(s => s.id !== subId));
    setSubtasks(prev => prev.filter(s => s.id !== subId));
  }, []);

  const addComment = useCallback(async () => {
    if (!selectedTask || !user || !newComment.trim()) return;
    const { data } = await supabase.from('trackino_task_comments').insert({ task_id: selectedTask.id, user_id: user.id, content: newComment.trim() }).select().single();
    if (data) {
      setDetailComments(prev => [...prev, data as TaskComment]);
      setComments(prev => [...prev, data as TaskComment]);
      setNewComment('');
      await supabase.from('trackino_task_history').insert({ task_id: selectedTask.id, user_id: user.id, action: 'comment_added' });
    }
  }, [selectedTask, user, newComment]);

  const deleteComment = useCallback(async (cId: string) => {
    await supabase.from('trackino_task_comments').delete().eq('id', cId);
    setDetailComments(prev => prev.filter(c => c.id !== cId));
    setComments(prev => prev.filter(c => c.id !== cId));
  }, []);

  // File upload
  const uploadFile = useCallback(async (file: File) => {
    if (!selectedTask || !wsId || !user) return;
    const ext = file.name.split('.').pop() ?? '';
    const path = `${wsId}/${selectedTask.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('trackino-task-attachments').upload(path, file);
    if (error) { alert('Chyba nahrávání: ' + error.message); return; }
    const { data } = await supabase.from('trackino_task_attachments').insert({
      task_id: selectedTask.id, file_path: path, file_name: file.name, file_size: file.size, file_mime: file.type, uploaded_by: user.id,
    }).select().single();
    if (data) {
      setDetailAttachments(prev => [...prev, data as TaskAttachment]);
      setAttachments(prev => [...prev, data as TaskAttachment]);
      await supabase.from('trackino_task_history').insert({ task_id: selectedTask.id, user_id: user.id, action: 'attachment_added', new_value: file.name });
    }
  }, [selectedTask, wsId, user]);

  const deleteAttachment = useCallback(async (att: TaskAttachment) => {
    await supabase.storage.from('trackino-task-attachments').remove([att.file_path]);
    await supabase.from('trackino_task_attachments').delete().eq('id', att.id);
    setDetailAttachments(prev => prev.filter(a => a.id !== att.id));
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    if (user && selectedTask) {
      await supabase.from('trackino_task_history').insert({ task_id: selectedTask.id, user_id: user.id, action: 'attachment_removed', old_value: att.file_name });
    }
  }, [user, selectedTask]);

  const downloadAttachment = useCallback(async (att: TaskAttachment) => {
    const { data } = await supabase.storage.from('trackino-task-attachments').createSignedUrl(att.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }, []);

  // Move task to column (mobile)
  const moveTaskTo = useCallback(async (task: TaskItem, colId: string) => {
    const oldCol = sortedColumns.find(c => c.id === task.column_id);
    const newCol = sortedColumns.find(c => c.id === colId);
    const colTasks = tasks.filter(t => t.column_id === colId);
    const maxOrder = colTasks.length > 0 ? Math.max(...colTasks.map(t => t.sort_order)) + 1 : 0;
    await updateTask(task.id, { column_id: colId, sort_order: maxOrder }, 'moved', oldCol?.name, newCol?.name);
    if (selectedTask?.id === task.id) setSelectedTask(prev => prev ? { ...prev, column_id: colId } : null);
  }, [sortedColumns, tasks, updateTask, selectedTask]);

  // ── History helper ──
  const historyText = (h: TaskHistory) => {
    const actor = members.find(m => m.user_id === h.user_id)?.display_name ?? '?';
    switch (h.action) {
      case 'created': return `${actor} vytvořil(a) úkol`;
      case 'moved': return `${actor} přesunul(a) z „${h.old_value}" do „${h.new_value}"`;
      case 'assigned': return `${actor} přiřadil(a) řešitele: ${h.new_value || 'Nepřiřazen'}`;
      case 'priority_changed': return `${actor} změnil(a) prioritu: ${h.new_value}`;
      case 'deadline_changed': return `${actor} změnil(a) termín: ${h.new_value || 'odstraněn'}`;
      case 'comment_added': return `${actor} přidal(a) komentář`;
      case 'attachment_added': return `${actor} přidal(a) soubor: ${h.new_value}`;
      case 'attachment_removed': return `${actor} odebral(a) soubor: ${h.old_value}`;
      case 'title_changed': return `${actor} přejmenoval(a): „${h.old_value}" → „${h.new_value}"`;
      case 'description_changed': return `${actor} upravil(a) popis`;
      default: return `${actor}: ${h.action}`;
    }
  };

  // ── Chevron SVG for selects ──
  const selectCls = 'appearance-none pr-8 text-base sm:text-sm rounded-lg border px-3 py-2 w-full';
  const SelectChevron = () => (
    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );

  if (!hasModule('tasks')) return <DashboardLayout><div /></DashboardLayout>;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      </DashboardLayout>
    );
  }

  // ══════════════════════════════════════
  // ██  RENDER
  // ══════════════════════════════════════
  return (
    <DashboardLayout>
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Úkoly</h1>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* View switcher */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {(['list', 'kanban', 'table'] as TaskView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors"
                style={{ background: view === v ? 'var(--primary)' : 'var(--bg-card)', color: view === v ? '#fff' : 'var(--text-muted)' }}>
                {v === 'list' ? 'Seznam' : v === 'kanban' ? 'Kanban' : 'Tabulka'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Only mine toggle */}
          <button onClick={() => setOnlyMine(!onlyMine)}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors"
            style={{ background: onlyMine ? 'var(--primary)' : 'var(--bg-card)', color: onlyMine ? '#fff' : 'var(--text-muted)', borderColor: onlyMine ? 'var(--primary)' : 'var(--border)' }}>
            Moje úkoly
          </button>

          {/* Hide completed toggle */}
          <button onClick={() => setHideCompleted(!hideCompleted)}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors"
            style={{ background: hideCompleted ? 'var(--bg-hover)' : 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {hideCompleted ? 'Skrýt hotové' : 'Zobrazit vše'}
          </button>

          {/* New task button */}
          {canManage && (
            <button onClick={async () => {
              const firstCol = sortedColumns[0];
              if (!firstCol) return;
              const t = await createTask('Nový úkol', firstCol.id);
              if (t) openDetail(t);
            }}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              + Nový úkol
            </button>
          )}
        </div>
      </div>

      {/* ── Filters row ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat úkol..."
            className="text-base sm:text-sm rounded-lg border pl-8 pr-3 py-2 w-full" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        </div>

        {/* Assignee filter */}
        <div className="relative">
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 130 }}>
            <option value="all">Všichni</option>
            <option value="unassigned">Nepřiřazené</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
          <SelectChevron />
        </div>

        {/* Priority filter */}
        <div className="relative">
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')}
            className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 110 }}>
            <option value="all">Priorita</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <SelectChevron />
        </div>

        {/* Deadline filter */}
        <div className="relative">
          <select value={filterDeadline} onChange={e => setFilterDeadline(e.target.value as DeadlineFilter)}
            className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 120 }}>
            <option value="all">Termín</option>
            <option value="overdue">Po termínu</option>
            <option value="today">Dnes</option>
            <option value="this_week">Tento týden</option>
            <option value="this_month">Tento měsíc</option>
            <option value="no_deadline">Bez termínu</option>
          </select>
          <SelectChevron />
        </div>
      </div>

      {/* ══════════════════════════════════ */}
      {/* ██  VIEWS                         */}
      {/* ══════════════════════════════════ */}

      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className={`flex-1 min-w-0 overflow-auto ${selectedTask ? 'hidden md:block' : ''}`}>

          {/* ── LIST VIEW ── */}
          {view === 'list' && (
            <div className="space-y-4">
              {sortedColumns.map(col => {
                const colTasks = filteredTasks.filter(t => t.column_id === col.id).sort((a, b) => a.sort_order - b.sort_order);
                if (hideCompleted && col.id === doneColumnId && colTasks.length === 0) return null;
                return (
                  <div key={col.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: col.color }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{colTasks.length}</span>
                    </div>
                    {colTasks.map(task => {
                      const assignee = members.find(m => m.user_id === task.assigned_to);
                      const subs = subtaskMap.get(task.id) ?? [];
                      const doneSubs = subs.filter(s => s.is_done).length;
                      const pc = PRIORITY_CONFIG[task.priority];
                      const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-colors"
                          onClick={() => openDetail(task)} role="button" tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter') openDetail(task); }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          style={{ background: 'transparent' }}>
                          {/* Done checkbox */}
                          {canManage && doneColumnId && (
                            <button className="flex-shrink-0" onClick={e => { e.stopPropagation(); moveTaskTo(task, col.id === doneColumnId ? sortedColumns[0].id : doneColumnId); }}>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: col.id === doneColumnId ? '#22c55e' : 'var(--border)', background: col.id === doneColumnId ? '#22c55e' : 'transparent' }}>
                                {col.id === doneColumnId && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                              </div>
                            </button>
                          )}
                          <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)', textDecoration: col.id === doneColumnId ? 'line-through' : 'none', opacity: col.id === doneColumnId ? 0.5 : 1 }}>{task.title}</span>
                          {task.priority !== 'none' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: pc.color + '18', color: pc.color }}>{pc.label}</span>
                          )}
                          {subs.length > 0 && (
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{doneSubs}/{subs.length}</span>
                          )}
                          {task.deadline && (
                            <span className="text-xs flex-shrink-0" style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                              {new Date(task.deadline).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                            </span>
                          )}
                          {assignee ? <Avatar name={assignee.display_name} color={assignee.avatar_color} size={22} /> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>}
                        </div>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="text-xs py-2 px-3" style={{ color: 'var(--text-muted)' }}>Žádné úkoly</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── KANBAN VIEW ── */}
          {view === 'kanban' && (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {/* Desktop: horizontal scroll */}
              <div className="flex gap-4 pb-4 overflow-x-auto md:flex-row flex-col" style={{ minHeight: 200 }}>
                {sortedColumns.map(col => {
                  const colTasks = filteredTasks.filter(t => t.column_id === col.id).sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <div key={col.id} className="md:w-[280px] md:min-w-[280px] flex-shrink-0 rounded-xl p-3" style={{ background: 'var(--bg-hover)' }}>
                      {/* Column header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: col.color }} />
                        <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>{colTasks.length}</span>
                        {canManage && (
                          <button onClick={() => { setQuickAddCol(col.id); setQuickAddTitle(''); }} className="p-1 rounded transition-colors" title="Přidat úkol"
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        )}
                      </div>

                      {/* Cards */}
                      <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy} id={col.id}>
                        <div className="min-h-[40px]" data-column-id={col.id}>
                          {colTasks.map(task => (
                            <SortableCard key={task.id} task={task} members={members} subtaskMap={subtaskMap}
                              commentCountMap={commentCountMap} attachCountMap={attachCountMap}
                              onOpen={openDetail} canDrag={canManage} />
                          ))}
                        </div>
                      </SortableContext>

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
                  );
                })}

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
          )}

          {/* ── TABLE VIEW ── */}
          {view === 'table' && (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)' }}>
                    {[
                      { key: 'title', label: 'Název' },
                      { key: 'status', label: 'Status' },
                      { key: 'assigned_to', label: 'Řešitel' },
                      { key: 'priority', label: 'Priorita' },
                      { key: 'deadline', label: 'Termín' },
                      { key: 'created_at', label: 'Vytvořeno' },
                    ].map(col => (
                      <th key={col.key} className="text-left px-3 py-2.5 text-xs font-semibold cursor-pointer select-none"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => { if (sortBy === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col.key as typeof sortBy); setSortDir('asc'); } }}>
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortBy === col.key && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points={sortDir === 'asc' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...filteredTasks].sort((a, b) => {
                    let cmp = 0;
                    if (sortBy === 'title') cmp = a.title.localeCompare(b.title, 'cs');
                    else if (sortBy === 'priority') {
                      const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                      cmp = order[a.priority] - order[b.priority];
                    } else if (sortBy === 'deadline') cmp = (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
                    else if (sortBy === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
                    else if (sortBy === 'assigned_to') cmp = (a.assigned_to ?? '').localeCompare(b.assigned_to ?? '');
                    return sortDir === 'asc' ? cmp : -cmp;
                  }).map(task => {
                    const col = sortedColumns.find(c => c.id === task.column_id);
                    const assignee = members.find(m => m.user_id === task.assigned_to);
                    const pc = PRIORITY_CONFIG[task.priority];
                    const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();
                    const subs = subtaskMap.get(task.id) ?? [];
                    return (
                      <tr key={task.id} className="border-t cursor-pointer transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                        onClick={() => openDetail(task)}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-3 py-2.5 font-medium">{task.title}
                          {subs.length > 0 && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{subs.filter(s => s.is_done).length}/{subs.length}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {col && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: col.color + '20', color: col.color }}>{col.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {assignee ? <div className="flex items-center gap-1.5"><Avatar name={assignee.display_name} color={assignee.avatar_color} size={20}/><span className="text-xs">{assignee.display_name}</span></div> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {task.priority !== 'none' && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: pc.color + '18', color: pc.color }}>{pc.label}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {task.deadline ? <span className="text-xs" style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>{new Date(task.deadline).toLocaleDateString('cs-CZ')}</span> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(task.created_at).toLocaleDateString('cs-CZ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTasks.length === 0 && (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Žádné úkoly odpovídající filtrům</div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════ */}
        {/* ██  DETAIL PANEL                  */}
        {/* ══════════════════════════════════ */}
        {selectedTask && (
          <div className="md:w-[480px] w-full flex-shrink-0 border-l overflow-y-auto"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <div className="p-4">
              {/* Close + title */}
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus
                      className="text-base sm:text-sm font-bold w-full rounded-lg border px-2 py-1"
                      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setEditTitle(selectedTask.title); } }}
                      onBlur={saveTitle}
                    />
                  ) : (
                    <h2 className="text-lg font-bold cursor-pointer" style={{ color: 'var(--text-primary)' }}
                      onClick={() => { if (canManage) { setEditingTitle(true); setEditTitle(selectedTask.title); } }}>
                      {selectedTask.title}
                    </h2>
                  )}
                </div>
                {canManage && (
                  <button onClick={() => { if (confirm('Smazat úkol?')) deleteTask(selectedTask.id); }}
                    className="p-1.5 rounded transition-colors flex-shrink-0"
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    style={{ color: 'var(--text-muted)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                )}
                <button onClick={() => setSelectedTask(null)} className="p-1.5 rounded transition-colors flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Status / Priority / Assignee / Deadline grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Status */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Status</label>
                  <div className="relative">
                    <select value={selectedTask.column_id ?? ''} disabled={!canManage}
                      onChange={e => { const cid = e.target.value; moveTaskTo(selectedTask, cid); setSelectedTask(prev => prev ? { ...prev, column_id: cid } : null); }}
                      className={selectCls} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      {sortedColumns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <SelectChevron />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Priorita</label>
                  <div className="relative">
                    <select value={selectedTask.priority} disabled={!canManage}
                      onChange={e => {
                        const p = e.target.value as TaskPriority;
                        updateTask(selectedTask.id, { priority: p }, 'priority_changed', PRIORITY_CONFIG[selectedTask.priority].label, PRIORITY_CONFIG[p].label);
                        setSelectedTask(prev => prev ? { ...prev, priority: p } : null);
                      }}
                      className={selectCls} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <SelectChevron />
                  </div>
                </div>

                {/* Assignee */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Řešitel</label>
                  <div className="relative">
                    <select value={selectedTask.assigned_to ?? ''} disabled={!canManage}
                      onChange={e => {
                        const uid = e.target.value || null;
                        const name = uid ? members.find(m => m.user_id === uid)?.display_name ?? '' : 'Nepřiřazen';
                        updateTask(selectedTask.id, { assigned_to: uid }, 'assigned', members.find(m => m.user_id === selectedTask.assigned_to)?.display_name ?? 'Nepřiřazen', name);
                        setSelectedTask(prev => prev ? { ...prev, assigned_to: uid } : null);
                      }}
                      className={selectCls} style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      <option value="">Nepřiřazen</option>
                      {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                    </select>
                    <SelectChevron />
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Termín</label>
                  <input type="date" value={selectedTask.deadline ?? ''} disabled={!canManage}
                    onChange={e => {
                      const d = e.target.value || null;
                      updateTask(selectedTask.id, { deadline: d }, 'deadline_changed', selectedTask.deadline ?? '', d ?? '');
                      setSelectedTask(prev => prev ? { ...prev, deadline: d } : null);
                    }}
                    className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
                    style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Popis</label>
                {canManage ? (
                  <>
                    <div ref={descRef} contentEditable suppressContentEditableWarning
                      className="text-base sm:text-sm rounded-lg border px-3 py-2 min-h-[60px] focus:outline-none"
                      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: selectedTask.description }}
                      onBlur={saveDescription}
                    />
                  </>
                ) : (
                  <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
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
                  {detailSubtasks.sort((a, b) => a.sort_order - b.sort_order).map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 group/sub">
                      <input type="checkbox" checked={sub.is_done} onChange={e => toggleSubtask(sub.id, e.target.checked)}
                        className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: 'var(--primary)' }} />
                      <span className="text-sm flex-1" style={{ color: 'var(--text-primary)', textDecoration: sub.is_done ? 'line-through' : 'none', opacity: sub.is_done ? 0.5 : 1 }}>{sub.title}</span>
                      {canManage && (
                        <button onClick={() => deleteSubtask(sub.id)} className="opacity-0 group-hover/sub:opacity-100 p-0.5 rounded transition-opacity"
                          style={{ color: 'var(--text-muted)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
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
                            {user?.id === c.user_id && (
                              <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover/com:opacity-100 p-0.5 rounded transition-opacity"
                                style={{ color: 'var(--text-muted)' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            )}
                          </div>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{c.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Napsat komentář..."
                    className="text-base sm:text-sm rounded-lg border px-3 py-2 flex-1"
                    style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
                  />
                  <button onClick={addComment} disabled={!newComment.trim()}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--primary)', color: '#fff' }}>
                    Odeslat
                  </button>
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
                    {detailHistory.slice(0, showAllHistory ? undefined : 10).map(h => (
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
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}

/* ── Export ── */

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <TasksContent />
    </WorkspaceProvider>
  );
}
