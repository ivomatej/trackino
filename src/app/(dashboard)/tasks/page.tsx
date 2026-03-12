'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { TaskBoard, TaskBoardSettings, TaskColumn, TaskItem, TaskSubtask, TaskComment, TaskAttachment, TaskHistory, TaskPriority, TaskFolder, TaskFolderShare, TaskBoardMember } from '@/types/database';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { PRIORITY_CONFIG, selectCls, SelectChevron, getWsColor, type TaskView, type DeadlineFilter, type Member, type UserWorkspace, type CwsBoardInfo, type CwsColumnInfo } from './types';
import { TaskLeftSidebar } from './components/TaskLeftSidebar';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { BoardSettingsModal, ShareModal, BoardEditModal, CwsNewTaskModal } from './components/TaskModals';
import { ListView } from './views/ListView';
import { KanbanView } from './views/KanbanView';
import { TableView } from './views/TableView';
import { CrossWorkspaceView } from './views/CrossWorkspaceView';

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

  if (!hasModule('tasks')) return <DashboardLayout moduleName="Úkoly"><div /></DashboardLayout>;

  if (loading) {
    return (
      <DashboardLayout moduleName="Úkoly">
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
    <DashboardLayout moduleName="Úkoly">
    <div className="flex -m-4 lg:-m-6" style={{ height: 'calc(100vh - var(--topbar-height, 56px))' }}>

      {/* ── LEFT SIDEBAR ── */}
      <TaskLeftSidebar
        leftOpen={leftOpen}
        setLeftOpen={setLeftOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        addingFolder={addingFolder}
        setAddingFolder={setAddingFolder}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        addingBoard={addingBoard}
        setAddingBoard={setAddingBoard}
        newBoardName={newBoardName}
        setNewBoardName={setNewBoardName}
        addingBoardFolderId={addingBoardFolderId ?? null}
        activeBoardId={activeBoardId ?? null}
        setActiveBoardId={setActiveBoardId}
        expandedFolders={expandedFolders}
        setExpandedFolders={setExpandedFolders}
        crossWsMode={crossWsMode}
        setCrossWsMode={setCrossWsMode}
        myTasksMode={myTasksMode}
        setMyTasksMode={setMyTasksMode}
        setOnlyMine={setOnlyMine}
        setView={setView}
        setListSortBy={setListSortBy}
        fetchCrossWsData={fetchCrossWsData}
        boards={boards}
        favBoards={favBoards}
        rootFolders={rootFolders}
        unfiledBoards={unfiledBoards}
        favoriteBoards={favoriteBoards}
        toggleFavoriteBoard={toggleFavoriteBoard}
        getFolderChildren={getFolderChildren}
        getBoardsInFolder={getBoardsInFolder}
        canManage={canManage}
        createFolder={createFolder}
        deleteFolder={deleteFolder}
        renameFolder={renameFolder}
        setFolderShareTargetId={setFolderShareTargetId}
        setFolderShareMode={setFolderShareMode}
        setShowFolderShareModal={setShowFolderShareModal}
        createBoard={createBoard}
        deleteBoard={deleteBoard}
        setBoardModalEditId={setBoardModalEditId}
        setBoardModalName={setBoardModalName}
        setBoardModalColor={setBoardModalColor}
        setBoardModalDesc={setBoardModalDesc}
        setBoardModalFolderId={setBoardModalFolderId}
        setShowBoardModal={setShowBoardModal}
      />

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

      {/* ── VIEWS ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-w-0 overflow-auto">

          {/* Cross-workspace table view */}
          {crossWsMode && (
            <CrossWorkspaceView
              cwsLoading={cwsLoading}
              cwsFilteredTasks={cwsFilteredTasks}
              cwsBoardsMap={cwsBoardsMap}
              cwsColsMap={cwsColsMap}
              cwsAllMembers={cwsAllMembers}
              userWorkspaces={userWorkspaces}
              openDetail={openDetail}
            />
          )}

          {/* List view */}
          {!crossWsMode && view === 'list' && (
            <ListView
              filteredTasks={filteredTasks}
              sortedColumns={sortedColumns}
              listSortBy={listSortBy}
              hideCompleted={hideCompleted}
              doneColumnId={doneColumnId}
              myTasksMode={myTasksMode}
              boards={boards}
              members={members}
              subtaskMap={subtaskMap}
              openDetail={openDetail}
              toggleComplete={toggleComplete}
            />
          )}

          {/* Kanban view */}
          {!crossWsMode && view === 'kanban' && (
            <KanbanView
              sortedColumns={sortedColumns}
              filteredTasks={filteredTasks}
              activeBoard={activeBoard}
              members={members}
              subtaskMap={subtaskMap}
              commentCountMap={commentCountMap}
              attachCountMap={attachCountMap}
              selectedTask={selectedTask}
              canManage={canManage}
              isMobile={isMobile}
              activeId={activeId}
              dragType={dragType}
              tasks={tasks}
              editingColumnId={editingColumnId}
              editColumnName={editColumnName}
              quickAddCol={quickAddCol}
              quickAddTitle={quickAddTitle}
              addingColumn={addingColumn}
              newColumnName={newColumnName}
              sensors={sensors}
              setEditingColumnId={setEditingColumnId}
              setEditColumnName={setEditColumnName}
              setQuickAddCol={setQuickAddCol}
              setQuickAddTitle={setQuickAddTitle}
              setAddingColumn={setAddingColumn}
              setNewColumnName={setNewColumnName}
              openDetail={openDetail}
              toggleComplete={toggleComplete}
              renameColumn={renameColumn}
              deleteColumn={deleteColumn}
              createTask={createTask}
              addColumn={addColumn}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
            />
          )}

          {/* Table view */}
          {!crossWsMode && view === 'table' && (
            <TableView
              filteredTasks={filteredTasks}
              sortedColumns={sortedColumns}
              members={members}
              subtaskMap={subtaskMap}
              sortBy={sortBy}
              sortDir={sortDir}
              setSortBy={setSortBy}
              setSortDir={setSortDir}
              openDetail={openDetail}
            />
          )}

        </div>

        {/* Detail panel */}
        {selectedTask && (
          <TaskDetailPanel
            selectedTask={selectedTask}
            setSelectedTask={setSelectedTask}
            crossWsMode={crossWsMode}
            cwsBoardsMap={cwsBoardsMap}
            userWorkspaces={userWorkspaces}
            cwsColsMap={cwsColsMap}
            boards={boards}
            sortedColumns={sortedColumns}
            activeBoard={activeBoard ?? undefined}
            members={members}
            canManage={canManage}
            toggleComplete={toggleComplete}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            saveTitle={saveTitle}
            descRef={descRef}
            saveDescription={saveDescription}
            detailSubtasks={detailSubtasks}
            setDetailSubtasks={setDetailSubtasks}
            toggleSubtask={toggleSubtask}
            addSubtask={addSubtask}
            deleteSubtask={deleteSubtask}
            newSubtaskText={newSubtaskText}
            setNewSubtaskText={setNewSubtaskText}
            detailAttachments={detailAttachments}
            downloadAttachment={downloadAttachment}
            deleteAttachment={deleteAttachment}
            uploadFile={uploadFile}
            detailComments={detailComments}
            deleteComment={deleteComment}
            commentRef={commentRef}
            setNewComment={setNewComment}
            addComment={addComment}
            showAllHistory={showAllHistory}
            setShowAllHistory={setShowAllHistory}
            detailHistory={detailHistory}
            historyText={historyText}
            deleteTask={deleteTask}
            updateTask={updateTask}
            moveTaskTo={moveTaskTo}
            userId={user?.id}
          />
        )}
      </div>
    </div>

      {/* ── Modals ── */}
      {activeBoard && showBoardSettings && (
        <BoardSettingsModal
          showBoardSettings={showBoardSettings}
          setShowBoardSettings={setShowBoardSettings}
          activeBoard={activeBoard}
          sortedColumns={sortedColumns}
          setColumns={setColumns}
          saveBoardSettings={saveBoardSettings}
          updateColumnColor={updateColumnColor}
        />
      )}

      {activeBoard && showShareModal && (
        <ShareModal
          showShareModal={showShareModal}
          setShowShareModal={setShowShareModal}
          activeBoard={activeBoard}
          shareMode={shareMode}
          setShareMode={setShareMode}
          shareSelectedUsers={shareSelectedUsers}
          setShareSelectedUsers={setShareSelectedUsers}
          members={members}
          userId={user?.id}
          saveBoardSharing={saveBoardSharing}
        />
      )}

      <BoardEditModal
        showBoardModal={showBoardModal}
        setShowBoardModal={setShowBoardModal}
        boardModalEditId={boardModalEditId}
        setBoardModalEditId={setBoardModalEditId}
        boardModalName={boardModalName}
        setBoardModalName={setBoardModalName}
        boardModalColor={boardModalColor}
        setBoardModalColor={setBoardModalColor}
        boardModalDesc={boardModalDesc}
        setBoardModalDesc={setBoardModalDesc}
        boardModalFolderId={boardModalFolderId}
        setBoardModalFolderId={setBoardModalFolderId}
        folders={folders}
        deleteBoard={deleteBoard}
        createBoard={createBoard}
        updateBoard={updateBoard}
        setShowShareModal={setShowShareModal}
      />

      </div>

      <CwsNewTaskModal
        showCwsNewTask={showCwsNewTask}
        setShowCwsNewTask={setShowCwsNewTask}
        userWorkspaces={userWorkspaces}
        cwsNewWsId={cwsNewWsId}
        setCwsNewWsId={setCwsNewWsId}
        cwsNewBoardId={cwsNewBoardId}
        setCwsNewBoardId={setCwsNewBoardId}
        cwsNewColId={cwsNewColId}
        setCwsNewColId={setCwsNewColId}
        cwsNewTitle={cwsNewTitle}
        setCwsNewTitle={setCwsNewTitle}
        cwsNewPriority={cwsNewPriority}
        setCwsNewPriority={setCwsNewPriority}
        cwsNewDeadline={cwsNewDeadline}
        setCwsNewDeadline={setCwsNewDeadline}
        cwsNewAssignee={cwsNewAssignee}
        setCwsNewAssignee={setCwsNewAssignee}
        cwsNewSaving={cwsNewSaving}
        cwsNewTaskBoards={cwsNewTaskBoards}
        cwsNewTaskCols={cwsNewTaskCols}
        cwsNewTaskMembers={cwsNewTaskMembers}
        handleCreateCwsTask={handleCreateCwsTask}
      />

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
