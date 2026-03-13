'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type {
  TaskBoard,
  TaskBoardSettings,
  TaskColumn,
  TaskItem,
  TaskSubtask,
  TaskComment,
  TaskAttachment,
  TaskHistory,
  TaskPriority,
  TaskFolder,
  TaskFolderShare,
  TaskBoardMember,
} from '@/types/database';
import type { Member, TaskView, DeadlineFilter } from '../types';

interface UseTasksDataParams {
  user: User | null;
  wsId: string | undefined;
  canManage: boolean;
  isAdmin: boolean;
  isMasterAdmin: boolean;
}

// ──────────────────────────────────────────────
// Primary data hook – state + fetchData + computed values
// ──────────────────────────────────────────────
export function useTasksData({ user, wsId, canManage, isAdmin, isMasterAdmin }: UseTasksDataParams) {

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

  // ── Quick add in kanban ──
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // ── New column ──
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // ── Sort for table & list ──
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'deadline' | 'created_at' | 'assigned_to'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [listSortBy, setListSortBy] = useState<'default' | 'created_at' | 'updated_at' | 'deadline' | 'priority' | 'title'>('default');
  const [myTasksMode, setMyTasksMode] = useState(false);

  // ── Favorite boards (localStorage) ──
  const [favoriteBoards, setFavoriteBoards] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !wsId) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(`trackino_task_favorites_${wsId}`) || '[]')); } catch { return new Set(); }
  });
  const toggleFavoriteBoard = useCallback((boardId: string) => {
    setFavoriteBoards(prev => {
      const next = new Set(prev);
      next.has(boardId) ? next.delete(boardId) : next.add(boardId);
      if (typeof window !== 'undefined' && wsId) localStorage.setItem(`trackino_task_favorites_${wsId}`, JSON.stringify([...next]));
      return next;
    });
  }, [wsId]);

  // ── Mobile detection (disable DnD on mobile) ──
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Save view preference ──
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('trackino_tasks_view', view);
  }, [view]);

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

  // ── Comment & attachment count maps ──
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

  // ── Folder tree helpers ──
  const rootFolders = useMemo(() => folders.filter(f => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order), [folders]);
  const unfiledBoards = useMemo(() => visibleBoards.filter(b => !b.folder_id), [visibleBoards]);
  const favBoards = useMemo(() => visibleBoards.filter(b => favoriteBoards.has(b.id)), [visibleBoards, favoriteBoards]);
  const getFolderChildren = useCallback((parentId: string) => folders.filter(f => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order), [folders]);
  const getBoardsInFolder = useCallback((folderId: string) => visibleBoards.filter(b => b.folder_id === folderId), [visibleBoards]);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!wsId || !user) return;
    setLoading(true);
    const [bRes, mRes, fRes, fsRes, bmRes] = await Promise.all([
      supabase.from('trackino_task_boards').select('*').eq('workspace_id', wsId).order('created_at', { ascending: true }),
      (async () => {
        const { data: wm } = await supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId);
        if (!wm || wm.length === 0) return [];
        const uids = wm.map((m: { user_id: string }) => m.user_id);
        const { data: profiles } = await supabase.from('trackino_profiles').select('id, display_name, avatar_color, email').in('id', uids);
        return (profiles ?? []).map((p: { id: string; display_name: string | null; avatar_color: string | null; email: string | null }) => ({
          user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1', email: p.email ?? '',
        }));
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
      const allBoardIds = boardList.map(b => b.id);
      const targetBoardId = activeBoardId;
      let colRes, taskRes;
      if (targetBoardId) {
        [colRes, taskRes] = await Promise.all([
          supabase.from('trackino_task_columns').select('*').eq('board_id', targetBoardId).order('sort_order'),
          supabase.from('trackino_task_items').select('*').eq('board_id', targetBoardId).order('sort_order'),
        ]);
      } else if (allBoardIds.length > 0) {
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
        setSubtasks([]); setComments([]); setAttachments([]);
      }
    }
    setLoading(false);
  }, [wsId, user, canManage, activeBoardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    // Data state
    boards, setBoards,
    columns, setColumns,
    tasks, setTasks,
    subtasks, setSubtasks,
    comments, setComments,
    attachments, setAttachments,
    history, setHistory,
    members, setMembers,
    loading,

    // Folder & project state
    folders, setFolders,
    folderShares, setFolderShares,
    boardMembers, setBoardMembers,
    activeBoardId, setActiveBoardId,
    expandedFolders, setExpandedFolders,
    leftOpen, setLeftOpen,
    sidebarCollapsed, setSidebarCollapsed,

    // Board settings
    showBoardSettings, setShowBoardSettings,

    // Column editing
    editingColumnId, setEditingColumnId,
    editColumnName, setEditColumnName,

    // DnD type
    dragType, setDragType,

    // Folder CRUD
    newFolderName, setNewFolderName,
    addingFolder, setAddingFolder,
    newBoardName, setNewBoardName,
    addingBoard, setAddingBoard,
    addingBoardFolderId, setAddingBoardFolderId,

    // Share modal
    showShareModal, setShowShareModal,
    shareMode, setShareMode,
    shareSelectedUsers, setShareSelectedUsers,

    // Board modal
    showBoardModal, setShowBoardModal,
    boardModalName, setBoardModalName,
    boardModalColor, setBoardModalColor,
    boardModalDesc, setBoardModalDesc,
    boardModalFolderId, setBoardModalFolderId,
    boardModalEditId, setBoardModalEditId,

    // UI state
    view, setView,
    selectedTask, setSelectedTask,
    search, setSearch,
    filterAssignee, setFilterAssignee,
    filterPriority, setFilterPriority,
    filterDeadline, setFilterDeadline,
    onlyMine, setOnlyMine,
    hideCompleted, setHideCompleted,
    activeId, setActiveId,

    // Quick add
    quickAddCol, setQuickAddCol,
    quickAddTitle, setQuickAddTitle,

    // Column add
    addingColumn, setAddingColumn,
    newColumnName, setNewColumnName,

    // Sort
    sortBy, setSortBy,
    sortDir, setSortDir,
    listSortBy, setListSortBy,
    myTasksMode, setMyTasksMode,

    // Favorites
    favoriteBoards, toggleFavoriteBoard,

    // Mobile & DnD
    isMobile, sensors,

    // Computed values
    activeBoard,
    visibleBoards,
    sortedColumns,
    doneColumnId,
    subtaskMap,
    commentCountMap,
    attachCountMap,
    filteredTasks,

    // Folder tree helpers
    rootFolders,
    unfiledBoards,
    favBoards,
    getFolderChildren,
    getBoardsInFolder,

    // Actions
    fetchData,
  };
}
