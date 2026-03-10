'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { TaskBoard, TaskBoardSettings, TaskColumn, TaskItem, TaskSubtask, TaskComment, TaskAttachment, TaskHistory, TaskPriority, TaskFolder, TaskFolderShare, TaskBoardMember } from '@/types/database';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
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
  email: string;
}

// ── Cross-workspace types ──
interface UserWorkspace { id: string; name: string; color: string | null; }
interface CwsBoardInfo { id: string; name: string; workspace_id: string; color: string; }
interface CwsColumnInfo { id: string; name: string; color: string; board_id: string; sort_order: number; }

const WORKSPACE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9'];
const getWsColor = (wsId: string, ws?: UserWorkspace | null): string => {
  if (ws?.color) return ws.color;
  let hash = 0;
  for (let i = 0; i < wsId.length; i++) hash = wsId.charCodeAt(i) + ((hash << 5) - hash);
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length];
};

// ── Inline Avatar ──
function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: color, color: '#fff', fontSize: size * 0.4, fontWeight: 600, lineHeight: 1 }}>
      {initials}
    </div>
  );
}

// ── Droppable Column Wrapper (fix cross-column DnD) ──
function DroppableColumn({ id, children, isOver: _parentIsOver }: { id: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `droppable-${id}` });
  return (
    <div ref={setNodeRef} className="min-h-[40px] rounded-lg transition-colors" style={{ background: isOver ? 'var(--bg-card)' : undefined }}>
      {children}
    </div>
  );
}

// ── Sortable Column Wrapper (drag entire columns) ──
function SortableColumnWrapper({ id, render, canDrag }: { id: string; render: (listeners: Record<string, unknown>) => React.ReactNode; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${id}`, disabled: !canDrag,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="md:w-[280px] md:min-w-[280px] flex-shrink-0">
      {render(listeners ?? {})}
    </div>
  );
}

// ── Sortable Kanban Card ──
function SortableCard({ task, members, subtaskMap, commentCountMap, attachCountMap, onOpen, canDrag, onToggleComplete, isSelected }: {
  task: TaskItem; members: Member[]; subtaskMap: Map<string, TaskSubtask[]>; commentCountMap: Map<string, number>;
  attachCountMap: Map<string, number>; onOpen: (t: TaskItem) => void; canDrag: boolean; onToggleComplete?: (t: TaskItem) => void; isSelected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, disabled: !canDrag,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : task.is_completed ? 0.5 : 1 };
  const assignee = members.find(m => m.user_id === task.assigned_to);
  const subs = subtaskMap.get(task.id) ?? [];
  const doneSubs = subs.filter(s => s.is_done).length;
  const commentCount = commentCountMap.get(task.id) ?? 0;
  const attachCount = attachCountMap.get(task.id) ?? 0;
  const pc = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();

  return (
    <div ref={setNodeRef} {...attributes} {...(canDrag ? listeners : {})}
      className="rounded-lg border p-3 mb-2 cursor-pointer transition-colors overflow-hidden"
      onClick={() => onOpen(task)}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(task); }}
      style={{ ...style, background: 'var(--bg-card)', borderColor: isSelected ? 'var(--primary)' : 'var(--border)', boxShadow: isSelected ? '0 0 0 2px var(--primary)' : undefined, textDecoration: task.is_completed ? 'line-through' : 'none' }}
    >
      {/* Priority strip */}
      {task.priority !== 'none' && <div className="rounded-t-lg -mx-3 -mt-3 mb-2" style={{ height: 3, background: pc.color }} />}
      <div className="flex items-center gap-2 mb-1">
        {/* Completion checkbox */}
        {onToggleComplete && (
          <button className="flex-shrink-0" onClick={e => { e.stopPropagation(); onToggleComplete(task); }}>
            <div className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors"
              style={{ borderColor: task.is_completed ? '#22c55e' : 'var(--border)', background: task.is_completed ? '#22c55e' : 'transparent' }}>
              {task.is_completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
          </button>
        )}
        <div className="text-sm font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</div>
      </div>
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

  // ── Folder & project state ──
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  const [folderShares, setFolderShares] = useState<TaskFolderShare[]>([]);
  const [boardMembers, setBoardMembers] = useState<TaskBoardMember[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null | undefined>(undefined);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [leftOpen, setLeftOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('trackino_tasks_sidebar_collapsed') === '1';
  });

  // ── Board settings state ──
  const [showBoardSettings, setShowBoardSettings] = useState(false);

  // ── Column editing state ──
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColumnName, setEditColumnName] = useState('');

  // ── DnD type state ──
  const [dragType, setDragType] = useState<'card' | 'column' | null>(null);

  // ── Folder CRUD state ──
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [addingBoard, setAddingBoard] = useState(false);
  const [addingBoardFolderId, setAddingBoardFolderId] = useState<string | null | undefined>(undefined);

  // ── Share modal state ──
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMode, setShareMode] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareSelectedUsers, setShareSelectedUsers] = useState<Set<string>>(new Set());

  // ── New/edit board modal state ──
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [boardModalName, setBoardModalName] = useState('');
  const [boardModalColor, setBoardModalColor] = useState('#6366f1');
  const [boardModalDesc, setBoardModalDesc] = useState('');
  const [boardModalFolderId, setBoardModalFolderId] = useState<string | null>(null);
  const [boardModalEditId, setBoardModalEditId] = useState<string | null>(null);

  // ── Comment editing ──
  const commentRef = useRef<HTMLDivElement>(null);

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

  // Sort for table & list
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'deadline' | 'created_at' | 'assigned_to'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [listSortBy, setListSortBy] = useState<'default' | 'created_at' | 'updated_at' | 'deadline' | 'priority' | 'title'>('default');
  const [myTasksMode, setMyTasksMode] = useState(false);

  const wsId = currentWorkspace?.id;

  // ── Cross-workspace state ──
  const [crossWsMode, setCrossWsMode] = useState(false);
  const [userWorkspaces, setUserWorkspaces] = useState<UserWorkspace[]>([]);
  const [cwsTab, setCwsTab] = useState<string>('all');
  const [cwsLoading, setCwsLoading] = useState(false);
  const [cwsTasks, setCwsTasks] = useState<TaskItem[]>([]);
  const [cwsBoardsMap, setCwsBoardsMap] = useState<Map<string, CwsBoardInfo>>(new Map());
  const [cwsColsMap, setCwsColsMap] = useState<Map<string, CwsColumnInfo>>(new Map());
  const [cwsAllMembers, setCwsAllMembers] = useState<Map<string, Member>>(new Map());
  const [cwsDataLoaded, setCwsDataLoaded] = useState(false);
  // Cross-workspace filters
  const [showCwsFilters, setShowCwsFilters] = useState(false);
  const [cwsSearch, setCwsSearch] = useState('');
  const [cwsFilterPriority, setCwsFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [cwsFilterDeadline, setCwsFilterDeadline] = useState<DeadlineFilter>('all');
  const [cwsFilterBoard, setCwsFilterBoard] = useState<string>('all');
  const [cwsFilterAssignee, setCwsFilterAssignee] = useState<string>('all');
  const [cwsHideCompleted, setCwsHideCompleted] = useState(true);
  const [cwsSortBy, setCwsSortBy] = useState<'deadline' | 'priority' | 'title' | 'created_at'>('deadline');
  const [cwsSortDir, setCwsSortDir] = useState<'asc' | 'desc'>('asc');
  // Cross-workspace new task modal
  const [showCwsNewTask, setShowCwsNewTask] = useState(false);
  const [cwsNewWsId, setCwsNewWsId] = useState('');
  const [cwsNewBoardId, setCwsNewBoardId] = useState('');
  const [cwsNewColId, setCwsNewColId] = useState('');
  const [cwsNewTitle, setCwsNewTitle] = useState('');
  const [cwsNewPriority, setCwsNewPriority] = useState<TaskPriority>('none');
  const [cwsNewDeadline, setCwsNewDeadline] = useState('');
  const [cwsNewAssignee, setCwsNewAssignee] = useState('');
  const [cwsNewTaskBoards, setCwsNewTaskBoards] = useState<CwsBoardInfo[]>([]);
  const [cwsNewTaskCols, setCwsNewTaskCols] = useState<CwsColumnInfo[]>([]);
  const [cwsNewTaskMembers, setCwsNewTaskMembers] = useState<Member[]>([]);
  const [cwsNewSaving, setCwsNewSaving] = useState(false);

  // ── Favorite boards (localStorage) ──
  const [favoriteBoards, setFavoriteBoards] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !currentWorkspace?.id) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(`trackino_task_favorites_${currentWorkspace.id}`) || '[]')); } catch { return new Set(); }
  });
  const toggleFavoriteBoard = useCallback((boardId: string) => {
    setFavoriteBoards(prev => {
      const next = new Set(prev);
      next.has(boardId) ? next.delete(boardId) : next.add(boardId);
      if (typeof window !== 'undefined' && wsId) localStorage.setItem(`trackino_task_favorites_${wsId}`, JSON.stringify([...next]));
      return next;
    });
  }, [wsId]);

  // Mobile detection (disable DnD on mobile)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Active board ──
  const activeBoard = useMemo(() => {
    if (activeBoardId) return boards.find(b => b.id === activeBoardId) ?? boards[0] ?? null;
    return boards[0] ?? null;
  }, [boards, activeBoardId]);

  // ── Visible boards (filtered by sharing) ──
  const visibleBoards = useMemo(() => {
    return boards.filter(b => {
      if (isMasterAdmin || isAdmin) return true;
      if (!b.is_shared) return true;
      return boardMembers.some(bm => bm.board_id === b.id && bm.user_id === user?.id);
    });
  }, [boards, boardMembers, isMasterAdmin, isAdmin, user]);

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
    if (hideCompleted) list = list.filter(t => !t.is_completed && (doneColumnId ? t.column_id !== doneColumnId : true));
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

  // ── Cross-workspace filtered tasks ──
  const cwsFilteredTasks = useMemo(() => {
    if (!crossWsMode) return [];
    let list = cwsTasks;

    // Tab filter: show only tasks from selected workspace
    if (cwsTab !== 'all') {
      const tabBoardIds = [...cwsBoardsMap.entries()]
        .filter(([, b]) => b.workspace_id === cwsTab)
        .map(([id]) => id);
      list = list.filter(t => tabBoardIds.includes(t.board_id));
    }

    // Search
    if (cwsSearch.trim()) {
      const q = cwsSearch.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (cwsBoardsMap.get(t.board_id)?.name ?? '').toLowerCase().includes(q)
      );
    }

    // Priority
    if (cwsFilterPriority !== 'all') list = list.filter(t => t.priority === cwsFilterPriority);

    // Board
    if (cwsFilterBoard !== 'all') list = list.filter(t => t.board_id === cwsFilterBoard);

    // Assignee
    if (cwsFilterAssignee === 'mine' && user) list = list.filter(t => t.assigned_to === user.id);
    else if (cwsFilterAssignee !== 'all') list = list.filter(t => t.assigned_to === cwsFilterAssignee);

    // Deadline
    if (cwsFilterDeadline !== 'all') {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      if (cwsFilterDeadline === 'overdue') list = list.filter(t => t.deadline && t.deadline < today);
      else if (cwsFilterDeadline === 'today') list = list.filter(t => t.deadline === today);
      else if (cwsFilterDeadline === 'this_week') {
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
        list = list.filter(t => t.deadline && t.deadline >= today && t.deadline <= weekEnd.toISOString().slice(0, 10));
      } else if (cwsFilterDeadline === 'this_month') {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        list = list.filter(t => t.deadline && t.deadline >= today && t.deadline <= monthEnd);
      } else if (cwsFilterDeadline === 'no_deadline') list = list.filter(t => !t.deadline);
    }

    // Hide completed
    if (cwsHideCompleted) list = list.filter(t => !t.is_completed);

    // Sort
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (cwsSortBy === 'deadline') cmp = (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
      else if (cwsSortBy === 'priority') {
        const order: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        cmp = order[a.priority] - order[b.priority];
      } else if (cwsSortBy === 'title') cmp = a.title.localeCompare(b.title, 'cs');
      else if (cwsSortBy === 'created_at') cmp = b.created_at.localeCompare(a.created_at);
      return cwsSortDir === 'asc' ? cmp : -cmp;
    });
  }, [crossWsMode, cwsTasks, cwsTab, cwsSearch, cwsFilterPriority, cwsFilterBoard, cwsFilterAssignee, cwsFilterDeadline, cwsHideCompleted, cwsBoardsMap, cwsSortBy, cwsSortDir, user]);

  // ── Active filter count (cross-ws) ──
  const cwsActiveFilterCount = useMemo(() => {
    let n = 0;
    if (cwsFilterPriority !== 'all') n++;
    if (cwsFilterDeadline !== 'all') n++;
    if (cwsFilterBoard !== 'all') n++;
    if (cwsFilterAssignee !== 'all') n++;
    return n;
  }, [cwsFilterPriority, cwsFilterDeadline, cwsFilterBoard, cwsFilterAssignee]);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!wsId || !user) return;
    setLoading(true);
    const [bRes, mRes, fRes, fsRes, bmRes] = await Promise.all([
      supabase.from('trackino_task_boards').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true }),
      (async () => {
        const { data: wm } = await supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId);
        if (!wm || wm.length === 0) return [];
        const uids = wm.map(m => m.user_id);
        const { data: profiles } = await supabase.from('trackino_profiles').select('id, display_name, avatar_color, email').in('id', uids);
        return (profiles ?? []).map(p => ({ user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1', email: p.email ?? '' }));
      })(),
      supabase.from('trackino_task_folders').select('*').eq('workspace_id', wsId).order('sort_order'),
      supabase.from('trackino_task_folder_shares').select('*').eq('workspace_id', wsId),
      supabase.from('trackino_task_board_members').select('*').eq('workspace_id', wsId),
    ]);
    const boardList = (bRes.data ?? []) as TaskBoard[];
    setBoards(boardList);
    setMembers(mRes as Member[]);
    setFolders((fRes.data ?? []) as TaskFolder[]);
    setFolderShares((fsRes.data ?? []) as TaskFolderShare[]);
    setBoardMembers((bmRes.data ?? []) as TaskBoardMember[]);

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

    // Set active board (not when in myTasksMode with activeBoardId=null)
    if (board && activeBoardId === undefined) setActiveBoardId(board.id);

    if (board || boardList.length > 0) {
      // If activeBoardId is null (myTasksMode) → load ALL boards
      const allBoardIds = boardList.map(b => b.id);
      const targetBoardId = activeBoardId;
      let colRes, taskRes;
      if (targetBoardId) {
        [colRes, taskRes] = await Promise.all([
          supabase.from('trackino_task_columns').select('*').eq('board_id', targetBoardId).order('sort_order'),
          supabase.from('trackino_task_items').select('*').eq('board_id', targetBoardId).order('sort_order'),
        ]);
      } else if (allBoardIds.length > 0) {
        // My tasks mode or initial: load all
        [colRes, taskRes] = await Promise.all([
          supabase.from('trackino_task_columns').select('*').in('board_id', allBoardIds).order('sort_order'),
          supabase.from('trackino_task_items').select('*').in('board_id', allBoardIds).order('sort_order'),
        ]);
      } else {
        colRes = { data: [] }; taskRes = { data: [] };
      }
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
      } else {
        setSubtasks([]);
        setComments([]);
        setAttachments([]);
      }
    }
    setLoading(false);
  }, [wsId, user, canManage, activeBoardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Cross-workspace fetch ──
  const fetchCrossWsData = useCallback(async (forceReload = false) => {
    if (!user) return;
    if (cwsDataLoaded && !forceReload) return;
    setCwsLoading(true);

    // 1. Get workspace IDs user belongs to
    const { data: memberships } = await supabase
      .from('trackino_workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    const wsIds = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);
    if (!wsIds.length) { setCwsLoading(false); setCwsDataLoaded(true); return; }

    // 2. Get workspace names
    const { data: wsData } = await supabase
      .from('trackino_workspaces')
      .select('id, name, color')
      .in('id', wsIds);
    setUserWorkspaces((wsData ?? []) as UserWorkspace[]);

    // 3. Fetch ALL tasks (RLS handles cross-workspace access automatically)
    const { data: allTaskData } = await supabase
      .from('trackino_task_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    const taskList = (allTaskData ?? []) as TaskItem[];
    setCwsTasks(taskList);

    if (taskList.length > 0) {
      // 4. Boards for all tasks
      const boardIds = [...new Set(taskList.map(t => t.board_id).filter(Boolean))];
      const { data: boardData } = await supabase
        .from('trackino_task_boards')
        .select('id, name, workspace_id, color')
        .in('id', boardIds);
      const newBoardsMap = new Map<string, CwsBoardInfo>();
      (boardData ?? []).forEach((b: CwsBoardInfo) => newBoardsMap.set(b.id, b));
      setCwsBoardsMap(newBoardsMap);

      // 5. Columns
      const { data: colData } = await supabase
        .from('trackino_task_columns')
        .select('id, name, color, board_id, sort_order')
        .in('board_id', boardIds);
      const newColsMap = new Map<string, CwsColumnInfo>();
      (colData ?? []).forEach((c: CwsColumnInfo) => newColsMap.set(c.id, c));
      setCwsColsMap(newColsMap);
    }

    // 6. Members from all workspaces
    const { data: allWsMembers } = await supabase
      .from('trackino_workspace_members')
      .select('user_id')
      .in('workspace_id', wsIds);
    const memberUids = [...new Set((allWsMembers ?? []).map((m: { user_id: string }) => m.user_id))];
    if (memberUids.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, avatar_color, email')
        .in('id', memberUids);
      const membersMap = new Map<string, Member>();
      (profiles ?? []).forEach((p: { id: string; display_name: string | null; avatar_color: string | null; email: string | null }) =>
        membersMap.set(p.id, { user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1', email: p.email ?? '' })
      );
      setCwsAllMembers(membersMap);
    }

    setCwsDataLoaded(true);
    setCwsLoading(false);
  }, [user, cwsDataLoaded]);

  // Load boards+members when cwsNewWsId changes (for new task modal)
  useEffect(() => {
    if (!cwsNewWsId || !showCwsNewTask) { setCwsNewTaskBoards([]); setCwsNewTaskCols([]); setCwsNewTaskMembers([]); return; }
    (async () => {
      const { data: bData } = await supabase.from('trackino_task_boards').select('id, name, workspace_id, color').eq('workspace_id', cwsNewWsId);
      const bList: CwsBoardInfo[] = (bData ?? []) as CwsBoardInfo[];
      setCwsNewTaskBoards(bList);
      setCwsNewBoardId(bList[0]?.id ?? '');
      const { data: wm } = await supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', cwsNewWsId);
      const uids = (wm ?? []).map((m: { user_id: string }) => m.user_id);
      if (uids.length > 0) {
        const { data: profiles } = await supabase.from('trackino_profiles').select('id, display_name, avatar_color, email').in('id', uids);
        setCwsNewTaskMembers((profiles ?? []).map((p: { id: string; display_name: string | null; avatar_color: string | null; email: string | null }) => ({ user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1', email: p.email ?? '' })));
      } else { setCwsNewTaskMembers([]); }
    })();
  }, [cwsNewWsId, showCwsNewTask]);

  useEffect(() => {
    if (!cwsNewBoardId) { setCwsNewTaskCols([]); setCwsNewColId(''); return; }
    (async () => {
      const { data: colData } = await supabase.from('trackino_task_columns').select('id, name, color, board_id, sort_order').eq('board_id', cwsNewBoardId).order('sort_order');
      const cList: CwsColumnInfo[] = (colData ?? []) as CwsColumnInfo[];
      setCwsNewTaskCols(cList);
      setCwsNewColId(cList[0]?.id ?? '');
    })();
  }, [cwsNewBoardId]);

  const handleCreateCwsTask = useCallback(async () => {
    if (!cwsNewWsId || !cwsNewBoardId || !cwsNewColId || !cwsNewTitle.trim() || !user) return;
    setCwsNewSaving(true);
    const { data } = await supabase.from('trackino_task_items').insert({
      workspace_id: cwsNewWsId, board_id: cwsNewBoardId, column_id: cwsNewColId,
      title: cwsNewTitle.trim(), priority: cwsNewPriority,
      deadline: cwsNewDeadline || null, assigned_to: cwsNewAssignee || null,
      sort_order: 0, created_by: user.id,
    }).select().single();
    if (data) {
      setCwsTasks(prev => [data as TaskItem, ...prev]);
      await supabase.from('trackino_task_history').insert({ task_id: (data as TaskItem).id, user_id: user.id, action: 'created' });
    }
    setCwsNewSaving(false);
    setShowCwsNewTask(false);
    setCwsNewTitle(''); setCwsNewPriority('none'); setCwsNewDeadline(''); setCwsNewAssignee('');
  }, [cwsNewWsId, cwsNewBoardId, cwsNewColId, cwsNewTitle, cwsNewPriority, cwsNewDeadline, cwsNewAssignee, user]);

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

  // ── Toggle task completion ──
  const toggleComplete = useCallback(async (task: TaskItem) => {
    const newCompleted = !task.is_completed;
    const updates: Partial<TaskItem> = { is_completed: newCompleted };

    // Auto-move to completion column if configured
    const settings = activeBoard?.settings ?? {};
    if (newCompleted && settings.auto_complete_column_id) {
      updates.column_id = settings.auto_complete_column_id;
      updates.sort_order = -1; // insert at top
    }

    await supabase.from('trackino_task_items').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
    if (selectedTask?.id === task.id) setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    if (user) {
      await supabase.from('trackino_task_history').insert({ task_id: task.id, user_id: user.id, action: newCompleted ? 'completed' : 'reopened' });
    }
  }, [activeBoard, selectedTask, user]);

  // ── Save board settings ──
  const saveBoardSettings = useCallback(async (newSettings: TaskBoardSettings) => {
    if (!activeBoard) return;
    await supabase.from('trackino_task_boards').update({ settings: newSettings }).eq('id', activeBoard.id);
    setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, settings: newSettings } : b));
  }, [activeBoard]);

  // ── Update column color ──
  const updateColumnColor = useCallback(async (colId: string, color: string) => {
    await supabase.from('trackino_task_columns').update({ color }).eq('id', colId);
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, color } : c));
  }, []);

  // ── Folder CRUD ──
  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    if (!wsId || !user) return;
    const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_folders').insert({
      workspace_id: wsId, name, sort_order: maxOrder, parent_id: parentId ?? null, created_by: user.id,
    }).select().single();
    if (data) setFolders(prev => [...prev, data as TaskFolder]);
  }, [wsId, user, folders]);

  const deleteFolder = useCallback(async (folderId: string) => {
    await supabase.from('trackino_task_folders').delete().eq('id', folderId);
    setFolders(prev => prev.filter(f => f.id !== folderId));
    // Move boards from deleted folder to no folder
    setBoards(prev => prev.map(b => b.folder_id === folderId ? { ...b, folder_id: null } : b));
    await supabase.from('trackino_task_boards').update({ folder_id: null }).eq('folder_id', folderId);
  }, []);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    await supabase.from('trackino_task_folders').update({ name }).eq('id', folderId);
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
  }, []);

  // ── Board CRUD ──
  const createBoard = useCallback(async (name: string, folderId?: string | null, color?: string, description?: string) => {
    if (!wsId || !user) return;
    const { data: nb } = await supabase.from('trackino_task_boards').insert({
      workspace_id: wsId, name, folder_id: folderId ?? null, created_by: user.id,
      ...(color ? { color } : {}), ...(description ? { description } : {}),
    }).select().single();
    if (nb) {
      const board = nb as TaskBoard;
      setBoards(prev => [...prev, board]);
      // Create default columns
      const defaults = [
        { name: 'K řešení', color: '#9ca3af', sort_order: 0 },
        { name: 'Rozpracováno', color: '#3b82f6', sort_order: 1 },
        { name: 'Hotovo', color: '#22c55e', sort_order: 2 },
      ];
      const { data: cols } = await supabase.from('trackino_task_columns').insert(defaults.map(d => ({ ...d, board_id: board.id }))).select();
      if (cols) setColumns(prev => [...prev, ...(cols as TaskColumn[])]);
      setActiveBoardId(board.id);
    }
  }, [wsId, user]);

  const deleteBoard = useCallback(async (boardId: string) => {
    await supabase.from('trackino_task_boards').delete().eq('id', boardId);
    setBoards(prev => prev.filter(b => b.id !== boardId));
    if (activeBoardId === boardId) {
      const remaining = boards.filter(b => b.id !== boardId);
      setActiveBoardId(remaining[0]?.id ?? null);
    }
  }, [activeBoardId, boards]);

  const updateBoard = useCallback(async (boardId: string, updates: Partial<TaskBoard>) => {
    await supabase.from('trackino_task_boards').update(updates).eq('id', boardId);
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, ...updates } : b));
  }, []);

  // ── Board sharing ──
  const saveBoardSharing = useCallback(async () => {
    if (!activeBoard || !wsId) return;
    if (shareMode === 'none') {
      await supabase.from('trackino_task_boards').update({ is_shared: false }).eq('id', activeBoard.id);
      await supabase.from('trackino_task_board_members').delete().eq('board_id', activeBoard.id);
      setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, is_shared: false } : b));
      setBoardMembers(prev => prev.filter(m => m.board_id !== activeBoard.id));
    } else if (shareMode === 'workspace') {
      await supabase.from('trackino_task_boards').update({ is_shared: false }).eq('id', activeBoard.id);
      await supabase.from('trackino_task_board_members').delete().eq('board_id', activeBoard.id);
      setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, is_shared: false } : b));
      setBoardMembers(prev => prev.filter(m => m.board_id !== activeBoard.id));
    } else {
      await supabase.from('trackino_task_boards').update({ is_shared: true }).eq('id', activeBoard.id);
      await supabase.from('trackino_task_board_members').delete().eq('board_id', activeBoard.id);
      const inserts = [...shareSelectedUsers].map(uid => ({
        board_id: activeBoard.id, workspace_id: wsId, user_id: uid, can_edit: true,
      }));
      if (inserts.length > 0) {
        const { data } = await supabase.from('trackino_task_board_members').insert(inserts).select();
        if (data) setBoardMembers(prev => [...prev.filter(m => m.board_id !== activeBoard.id), ...(data as TaskBoardMember[])]);
      }
      setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, is_shared: true } : b));
    }
    setShowShareModal(false);
  }, [activeBoard, wsId, shareMode, shareSelectedUsers]);

  // ── Folder sharing ──
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  const [folderShareTargetId, setFolderShareTargetId] = useState<string | null>(null);
  const [folderShareMode, setFolderShareMode] = useState<'none' | 'workspace' | 'users'>('none');
  const [folderShareUsers, setFolderShareUsers] = useState<Set<string>>(new Set());

  const saveFolderSharing = useCallback(async () => {
    if (!folderShareTargetId || !wsId || !user) return;
    // Delete existing shares
    await supabase.from('trackino_task_folder_shares').delete().eq('folder_id', folderShareTargetId);
    let newShared = false;
    const newShares: TaskFolderShare[] = [];
    if (folderShareMode === 'workspace') {
      newShared = true;
      const { data } = await supabase.from('trackino_task_folder_shares').insert({
        folder_id: folderShareTargetId, workspace_id: wsId, user_id: null, shared_by: user.id,
      }).select().single();
      if (data) newShares.push(data as TaskFolderShare);
    } else if (folderShareMode === 'users') {
      newShared = true;
      for (const uid of folderShareUsers) {
        const { data } = await supabase.from('trackino_task_folder_shares').insert({
          folder_id: folderShareTargetId, workspace_id: wsId, user_id: uid, shared_by: user.id,
        }).select().single();
        if (data) newShares.push(data as TaskFolderShare);
      }
    }
    await supabase.from('trackino_task_folders').update({ is_shared: newShared }).eq('id', folderShareTargetId);
    setFolders(prev => prev.map(f => f.id === folderShareTargetId ? { ...f, is_shared: newShared } : f));
    setFolderShares(prev => [...prev.filter(s => s.folder_id !== folderShareTargetId), ...newShares]);
    setShowFolderShareModal(false);
  }, [folderShareTargetId, wsId, user, folderShareMode, folderShareUsers]);

  // ── DnD handlers ──
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    if (id.startsWith('col-')) {
      setDragType('column');
    } else {
      setDragType('card');
    }
    setActiveId(id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const currentDragType = dragType;
    setActiveId(null);
    setDragType(null);
    const { active, over } = event;
    if (!over || !user) return;

    // ── Column reorder ──
    if (currentDragType === 'column') {
      const activeColId = (active.id as string).replace('col-', '');
      const overColId = (over.id as string).replace('col-', '');
      if (activeColId === overColId) return;
      const oldIdx = sortedColumns.findIndex(c => c.id === activeColId);
      const newIdx = sortedColumns.findIndex(c => c.id === overColId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(sortedColumns, oldIdx, newIdx);
      const updates = reordered.map((c, i) => ({ ...c, sort_order: i }));
      setColumns(prev => {
        const other = prev.filter(c => c.board_id !== activeBoard?.id);
        return [...other, ...updates];
      });
      for (const u of updates) {
        await supabase.from('trackino_task_columns').update({ sort_order: u.sort_order }).eq('id', u.id);
      }
      return;
    }

    // ── Card DnD ──
    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;

    // Detect target column: droppable column, task, or column itself
    let targetColId: string | null = null;
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      targetColId = overTask.column_id;
    } else if (overId.startsWith('droppable-')) {
      targetColId = overId.replace('droppable-', '');
    } else {
      targetColId = sortedColumns.find(c => c.id === overId)?.id ?? null;
    }

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
      case 'completed': return `${actor} dokončil(a) úkol`;
      case 'reopened': return `${actor} znovu otevřel(a) úkol`;
      default: return `${actor}: ${h.action}`;
    }
  };

  // ── Left panel folder tree (hooks must be before early returns) ──
  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order), [folders]);
  const unfiledBoards = useMemo(() => visibleBoards.filter(b => !b.folder_id), [visibleBoards]);
  const favBoards = useMemo(() => visibleBoards.filter(b => favoriteBoards.has(b.id)), [visibleBoards, favoriteBoards]);
  const getFolderChildren = useCallback((parentId: string) => folders.filter(f => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order), [folders]);
  const getBoardsInFolder = useCallback((folderId: string) => visibleBoards.filter(b => b.folder_id === folderId), [visibleBoards]);

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

  const toggleFolder = (id: string) => setExpandedFolders(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Recursive folder rendering
  const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const childFolders = parentId ? getFolderChildren(parentId) : rootFolders;
    const childBoards = parentId ? getBoardsInFolder(parentId) : [];
    if (depth > 4) return null;

    return (
      <>
        {childFolders.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderBoards = getBoardsInFolder(folder.id);
          const subFolders = getFolderChildren(folder.id);
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
                    <div key={b.id} className="flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors group/board"
                      style={{ paddingLeft: (depth + 1) * 12 + 8, background: activeBoardId === b.id ? 'var(--bg-hover)' : 'transparent' }}
                      onMouseEnter={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => { setMyTasksMode(false); setOnlyMine(false); setActiveBoardId(b.id); setLeftOpen(false); }}>
                      <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: b.color ?? '#6366f1' }} />
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: activeBoardId === b.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</span>
                      {/* Favorite star */}
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
          );
        })}
        {parentId && childBoards.map(b => (
          <div key={b.id} className="flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors group/board"
            style={{ paddingLeft: depth * 12 + 8, background: activeBoardId === b.id ? 'var(--bg-hover)' : 'transparent' }}
            onMouseEnter={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (activeBoardId !== b.id) e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { setMyTasksMode(false); setOnlyMine(false); setActiveBoardId(b.id); setLeftOpen(false); }}>
            <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ background: b.color ?? '#6366f1' }} />
            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: activeBoardId === b.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</span>
            {/* Favorite star */}
            <button onClick={e => { e.stopPropagation(); toggleFavoriteBoard(b.id); }}
              className={`p-0.5 rounded transition-opacity flex-shrink-0 ${favoriteBoards.has(b.id) ? 'opacity-80' : 'opacity-0 group-hover/board:opacity-100'}`}
              title={favoriteBoards.has(b.id) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
              style={{ color: favoriteBoards.has(b.id) ? '#f59e0b' : 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill={favoriteBoards.has(b.id) ? '#f59e0b' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
        ))}
      </>
    );
  };

  return (
    <DashboardLayout>
    <div className="flex -m-4 lg:-m-6" style={{ height: 'calc(100vh - var(--topbar-height, 56px))' }}>
      {/* ── LEFT SIDEBAR ── */}
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
              <button onClick={() => { setAddingBoard(true); setAddingBoardFolderId(null); setNewBoardName(''); }}
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
                  {/* Favorite star */}
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

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-4 lg:p-6">

    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
        {/* Left panel toggle (inline with header) */}
        <button className="flex-shrink-0 p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
          title={sidebarCollapsed ? 'Zobrazit projekty' : 'Skrýt projekty'}
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth >= 768) {
              setSidebarCollapsed(prev => { const next = !prev; localStorage.setItem('trackino_tasks_sidebar_collapsed', next ? '1' : '0'); return next; });
            } else {
              setLeftOpen(true);
            }
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {crossWsMode ? 'Přehled workspace' : (myTasksMode ? 'Moje úkoly' : (activeBoard?.name ?? 'Úkoly'))}
        </h1>
        {!crossWsMode && <div className="flex items-center gap-2 flex-wrap flex-1">
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

          {/* List sort selector */}
          {view === 'list' && (
            <div className="relative">
              <select value={listSortBy} onChange={e => setListSortBy(e.target.value as typeof listSortBy)}
                className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 140 }}>
                <option value="default">Dle sloupce</option>
                <option value="updated_at">Naposledy přiřazené</option>
                <option value="created_at">Nejnovější</option>
                <option value="deadline">Dle termínu</option>
                <option value="priority">Dle priority</option>
                <option value="title">Dle názvu</option>
              </select>
              <SelectChevron />
            </div>
          )}

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

          {/* Settings button */}
          {canManage && activeBoard && (
            <button onClick={() => setShowBoardSettings(true)} className="p-1.5 rounded-lg transition-colors" title="Nastavení projektu"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          )}

          {/* Share button */}
          {canManage && activeBoard && (
            <button onClick={() => {
              const bm = boardMembers.filter(m => m.board_id === activeBoard.id);
              setShareMode(activeBoard.is_shared ? 'users' : 'none');
              setShareSelectedUsers(new Set(bm.map(m => m.user_id)));
              setShowShareModal(true);
            }} className="p-1.5 rounded-lg transition-colors" title="Sdílet projekt"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          )}

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
        </div>}
        {crossWsMode && (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="flex-1" />
            {/* Reload */}
            <button onClick={() => fetchCrossWsData(true)}
              className="p-1.5 rounded-lg transition-colors" title="Obnovit data"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            {/* Filters toggle */}
            <button onClick={() => setShowCwsFilters(!showCwsFilters)}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors flex items-center gap-1.5"
              style={{ background: showCwsFilters ? 'var(--bg-hover)' : 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" strokeWidth="3"/></svg>
              Filtry
              {cwsActiveFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold text-white" style={{ background: 'var(--primary)' }}>{cwsActiveFilterCount}</span>
              )}
            </button>
            {/* New task */}
            <button onClick={() => { setCwsNewWsId(userWorkspaces[0]?.id ?? ''); setShowCwsNewTask(true); }}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              + Nový úkol
            </button>
          </div>
        )}
      </div>

      {/* ── Cross-workspace workspace tabs ── */}
      {crossWsMode && (
        <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setCwsTab('all')}
            className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex-shrink-0"
            style={{ background: cwsTab === 'all' ? 'var(--primary)' : 'var(--bg-hover)', color: cwsTab === 'all' ? '#fff' : 'var(--text-muted)' }}>
            Vše ({cwsFilteredTasks.length})
          </button>
          {userWorkspaces.map(ws => {
            const wsColor = getWsColor(ws.id, ws);
            const wsTasks = cwsTasks.filter(t => cwsBoardsMap.get(t.board_id)?.workspace_id === ws.id);
            return (
              <button key={ws.id} onClick={() => setCwsTab(ws.id)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-colors flex-shrink-0 border"
                style={{ background: cwsTab === ws.id ? wsColor + '18' : 'var(--bg-hover)', color: cwsTab === ws.id ? wsColor : 'var(--text-muted)', borderColor: cwsTab === ws.id ? wsColor + '50' : 'transparent' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: wsColor }} />
                {ws.name}
                <span className="opacity-60">({wsTasks.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters row ── */}
      {!crossWsMode && <div className="flex items-center gap-2 mb-2 flex-wrap">
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
      </div>}

      {/* ── Cross-workspace search + filters ── */}
      {crossWsMode && (
        <div className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={cwsSearch} onChange={e => setCwsSearch(e.target.value)} placeholder="Hledat úkol..."
                className="text-base sm:text-sm rounded-lg border pl-8 pr-3 py-2 w-full" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {/* Sort */}
            <div className="relative">
              <select value={cwsSortBy} onChange={e => setCwsSortBy(e.target.value as typeof cwsSortBy)}
                className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 140 }}>
                <option value="deadline">Dle termínu</option>
                <option value="priority">Dle priority</option>
                <option value="title">Dle názvu</option>
                <option value="created_at">Nejnovější</option>
              </select>
              <SelectChevron />
            </div>
            {/* Sort direction */}
            <button onClick={() => setCwsSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg border transition-colors" title={cwsSortDir === 'asc' ? 'Vzestupně' : 'Sestupně'}
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {cwsSortDir === 'asc' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              )}
            </button>
            {/* Hide completed */}
            <button onClick={() => setCwsHideCompleted(!cwsHideCompleted)}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors"
              style={{ background: cwsHideCompleted ? 'var(--bg-hover)' : 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              {cwsHideCompleted ? 'Skrýt hotové' : 'Zobrazit vše'}
            </button>
          </div>
          {/* Collapsible filter panel */}
          {showCwsFilters && (
            <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {/* Priority */}
              <div className="relative">
                <select value={cwsFilterPriority} onChange={e => setCwsFilterPriority(e.target.value as TaskPriority | 'all')}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 110 }}>
                  <option value="all">Priorita</option>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <SelectChevron />
              </div>
              {/* Deadline */}
              <div className="relative">
                <select value={cwsFilterDeadline} onChange={e => setCwsFilterDeadline(e.target.value as DeadlineFilter)}
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
              {/* Board / project */}
              <div className="relative">
                <select value={cwsFilterBoard} onChange={e => setCwsFilterBoard(e.target.value)}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 140 }}>
                  <option value="all">Projekt</option>
                  {[...cwsBoardsMap.values()].map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <SelectChevron />
              </div>
              {/* Assignee */}
              <div className="relative">
                <select value={cwsFilterAssignee} onChange={e => setCwsFilterAssignee(e.target.value)}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 130 }}>
                  <option value="all">Řešitel</option>
                  <option value="mine">Moje</option>
                  {[...cwsAllMembers.values()].map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
                <SelectChevron />
              </div>
              {/* Reset */}
              {cwsActiveFilterCount > 0 && (
                <button onClick={() => { setCwsFilterPriority('all'); setCwsFilterDeadline('all'); setCwsFilterBoard('all'); setCwsFilterAssignee('all'); }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                  style={{ color: '#ef4444', borderColor: '#ef444440', background: '#ef444408' }}>
                  Vymazat filtry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════ */}
      {/* ██  VIEWS                         */}
      {/* ══════════════════════════════════ */}

      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-w-0 overflow-auto">

          {/* ── CROSS-WORKSPACE TABLE ── */}
          {crossWsMode && (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
              {cwsLoading ? (
                <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Načítám data...
                </div>
              ) : cwsFilteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  <span className="text-sm">Žádné úkoly</span>
                </div>
              ) : (
                <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-hover)' }}>
                      <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Název</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Projekt</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Workspace</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Řešitel</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Priorita</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Status</th>
                      <th className="text-left px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Termín</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cwsFilteredTasks.map((task, idx) => {
                      const board = cwsBoardsMap.get(task.board_id);
                      const col = cwsColsMap.get(task.column_id ?? '');
                      const ws = userWorkspaces.find(w => w.id === board?.workspace_id);
                      const wsColor = ws ? getWsColor(ws.id, ws) : '#9ca3af';
                      const assignee = cwsAllMembers.get(task.assigned_to ?? '');
                      const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['none'];
                      const isOverdue = task.deadline && !task.is_completed && task.deadline < new Date().toISOString().slice(0, 10);
                      return (
                        <tr key={task.id}
                          className="cursor-pointer transition-colors"
                          style={{ borderTop: idx > 0 ? `1px solid var(--border)` : undefined }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => openDetail(task)}>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate${task.is_completed ? ' line-through opacity-50' : ''}`}>{task.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {board && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: board.color + '20', color: board.color }}>{board.name}</span>}
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            {ws && (
                              <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: wsColor }} />
                                {ws.name}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {assignee ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: assignee.avatar_color }}>
                                  {assignee.display_name.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate max-w-[80px]">{assignee.display_name}</span>
                              </span>
                            ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pc.color + '20', color: pc.color }}>
                              {pc.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            {col && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{col.name}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {task.deadline ? (
                              <span className="text-xs whitespace-nowrap" style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                                {task.deadline}
                              </span>
                            ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {!crossWsMode && view === 'list' && (() => {
            // Sort helper for flat list mode
            const sortTasksList = (list: TaskItem[]) => {
              if (listSortBy === 'default') return list;
              return [...list].sort((a, b) => {
                if (listSortBy === 'updated_at') return (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at);
                if (listSortBy === 'created_at') return b.created_at.localeCompare(a.created_at);
                if (listSortBy === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
                if (listSortBy === 'priority') {
                  const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                  return order[a.priority] - order[b.priority];
                }
                if (listSortBy === 'title') return a.title.localeCompare(b.title, 'cs');
                return 0;
              });
            };
            const renderListRow = (task: TaskItem) => {
              const assignee = members.find(m => m.user_id === task.assigned_to);
              const subs = subtaskMap.get(task.id) ?? [];
              const doneSubs = subs.filter(s => s.is_done).length;
              const pc = PRIORITY_CONFIG[task.priority];
              const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();
              const boardName = myTasksMode ? boards.find(b => b.id === task.board_id)?.name : null;
              return (
                <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-colors"
                  onClick={() => openDetail(task)} role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') openDetail(task); }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ background: 'transparent' }}>
                  <button className="flex-shrink-0" onClick={e => { e.stopPropagation(); toggleComplete(task); }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors" style={{ borderColor: task.is_completed ? '#22c55e' : 'var(--border)', background: task.is_completed ? '#22c55e' : 'transparent' }}>
                      {task.is_completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                    </div>
                  </button>
                  <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)', textDecoration: task.is_completed ? 'line-through' : 'none', opacity: task.is_completed ? 0.5 : 1 }}>{task.title}</span>
                  {boardName && <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{boardName}</span>}
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
            };

            return (
            <div className="space-y-4">
              {listSortBy !== 'default' ? (
                // Flat sorted list
                <>
                  {sortTasksList(filteredTasks).map(renderListRow)}
                  {filteredTasks.length === 0 && <div className="text-xs py-2 px-3" style={{ color: 'var(--text-muted)' }}>Žádné úkoly</div>}
                </>
              ) : (
                // Grouped by column
                sortedColumns.map(col => {
                  const colTasks = filteredTasks.filter(t => t.column_id === col.id).sort((a, b) => a.sort_order - b.sort_order);
                  if (hideCompleted && col.id === doneColumnId && colTasks.length === 0) return null;
                  return (
                    <div key={col.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{colTasks.length}</span>
                      </div>
                      {colTasks.map(renderListRow)}
                      {colTasks.length === 0 && <div className="text-xs py-2 px-3" style={{ color: 'var(--text-muted)' }}>Žádné úkoly</div>}
                    </div>
                  );
                })
              )}
            </div>
            );
          })()}

          {/* ── KANBAN VIEW ── */}
          {!crossWsMode && view === 'kanban' && (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {/* Desktop: horizontal scroll with auto-hide scrollbar */}
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

                      {/* Cards – wrapped in DroppableColumn for cross-column DnD */}
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
          )}

          {/* ── TABLE VIEW ── */}
          {!crossWsMode && view === 'table' && (
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
        {/* Backdrop – click outside to close */}
        {selectedTask && (
          <div className="fixed inset-0 z-50" onClick={e => { if (e.target === e.currentTarget) setSelectedTask(null); }}
            style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="w-full flex-shrink-0 border-l overflow-y-auto fixed right-0 top-0 bottom-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', transition: 'transform 0.2s ease-out', maxWidth: ({ compact: '400px', normal: '520px', large: '680px' }[(crossWsMode ? 'normal' : (activeBoard?.settings?.detail_size ?? 'normal'))] ?? '520px') }} onClick={e => e.stopPropagation()}>
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

              {/* ── Fields grid (3×2) ── */}
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
                    {/* Rich text toolbar */}
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
                      {/* Subtask assignee */}
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
                            {user?.id === c.user_id && (
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
                  {/* Comment toolbar */}
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
          </div>
        )}
      </div>

      {/* ══════════════════════════════════ */}
      {/* ██  BOARD SETTINGS MODAL         */}
      {/* ══════════════════════════════════ */}
      {showBoardSettings && activeBoard && (
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
      )}

      {/* ══════════════════════════════════ */}
      {/* ██  SHARE MODAL                  */}
      {/* ══════════════════════════════════ */}
      {showShareModal && activeBoard && (
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
                {members.filter(m => m.user_id !== user?.id).length === 0 && (
                  <p className="text-xs px-2 py-1" style={{ color: 'var(--text-muted)' }}>Žádní další členové workspace</p>
                )}
                {members.filter(m => m.user_id !== user?.id).map(m => {
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
      )}

      {/* ══════════════════════════════════ */}
      {/* ██  BOARD EDIT MODAL             */}
      {/* ══════════════════════════════════ */}
      {showBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => { setShowBoardModal(false); setBoardModalEditId(null); }}>
          <div className="rounded-xl border p-6 max-w-md w-full mx-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{boardModalEditId ? 'Upravit projekt' : 'Nový projekt'}</h3>
              <button onClick={() => { setShowBoardModal(false); setBoardModalEditId(null); }} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }}>
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
                      setShowBoardModal(false);
                      setBoardModalEditId(null);
                    }
                  }} className="px-3 py-2 rounded-lg text-sm font-medium transition-colors" style={{ color: '#ef4444' }}>
                    Smazat
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {boardModalEditId && (
                  <button onClick={() => { setShowBoardModal(false); setBoardModalEditId(null); setShowShareModal(true); }}
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
                  setShowBoardModal(false);
                  setBoardModalEditId(null);
                }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                  {boardModalEditId ? 'Uložit' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
      {/* ══════════════════════════════════ */}
      {/* ██  CROSS-WS NEW TASK MODAL      */}
      {/* ══════════════════════════════════ */}
      {showCwsNewTask && (
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
              {/* Workspace select */}
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
              {/* Board select */}
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
              {/* Column select */}
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
              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>Název úkolu</label>
                <input value={cwsNewTitle} onChange={e => setCwsNewTitle(e.target.value)}
                  placeholder="Název úkolu..."
                  className="text-base sm:text-sm rounded-lg border px-3 py-2 w-full"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCwsTask(); }}
                  autoFocus />
              </div>
              {/* Priority + Deadline row */}
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
              {/* Assignee */}
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
