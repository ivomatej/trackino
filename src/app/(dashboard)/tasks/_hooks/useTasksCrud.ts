'use client';

import { useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { TaskBoard, TaskBoardSettings, TaskColumn, TaskItem, TaskSubtask, TaskComment, TaskAttachment, TaskFolder, TaskFolderShare, TaskBoardMember } from '@/types/database';

interface UseTasksCrudParams {
  user: User | null;
  wsId: string | undefined;
  canManage: boolean;
  activeBoard: TaskBoard | null;
  sortedColumns: TaskColumn[];
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  columns: TaskColumn[];
  setColumns: React.Dispatch<React.SetStateAction<TaskColumn[]>>;
  boards: TaskBoard[];
  setBoards: React.Dispatch<React.SetStateAction<TaskBoard[]>>;
  activeBoardId: string | null | undefined;
  setActiveBoardId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  selectedTask: TaskItem | null;
  setSelectedTask: React.Dispatch<React.SetStateAction<TaskItem | null>>;
  subtasks: TaskSubtask[];
  setSubtasks: React.Dispatch<React.SetStateAction<TaskSubtask[]>>;
  comments: TaskComment[];
  setComments: React.Dispatch<React.SetStateAction<TaskComment[]>>;
  attachments: TaskAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<TaskAttachment[]>>;
  folders: TaskFolder[];
  setFolders: React.Dispatch<React.SetStateAction<TaskFolder[]>>;
  folderShares: TaskFolderShare[];
  setFolderShares: React.Dispatch<React.SetStateAction<TaskFolderShare[]>>;
  boardMembers: TaskBoardMember[];
  setBoardMembers: React.Dispatch<React.SetStateAction<TaskBoardMember[]>>;
  showShareModal: boolean;
  setShowShareModal: React.Dispatch<React.SetStateAction<boolean>>;
  shareMode: 'none' | 'workspace' | 'users';
  shareSelectedUsers: Set<string>;
  dragType: 'card' | 'column' | null;
  setDragType: React.Dispatch<React.SetStateAction<'card' | 'column' | null>>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
}

// ──────────────────────────────────────────────
// CRUD hook – task/column/folder/board CRUD + DnD + sharing
// ──────────────────────────────────────────────
export function useTasksCrud({
  user, wsId, canManage,
  activeBoard, sortedColumns,
  tasks, setTasks,
  columns, setColumns,
  boards, setBoards,
  activeBoardId, setActiveBoardId,
  selectedTask, setSelectedTask,
  subtasks: _subtasks, setSubtasks: _setSubtasks,
  comments: _comments, setComments: _setComments,
  attachments: _attachments, setAttachments: _setAttachments,
  folders, setFolders,
  folderShares, setFolderShares,
  boardMembers, setBoardMembers,
  showShareModal: _showShareModal, setShowShareModal,
  shareMode, shareSelectedUsers,
  dragType, setDragType,
  activeId: _activeId, setActiveId,
}: UseTasksCrudParams) {

  // ── Folder sharing state (local to CRUD) ──
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  const [folderShareTargetId, setFolderShareTargetId] = useState<string | null>(null);
  const [folderShareMode, setFolderShareMode] = useState<'none' | 'workspace' | 'users'>('none');
  const [folderShareUsers, setFolderShareUsers] = useState<Set<string>>(new Set());

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
  }, [wsId, user, activeBoard, tasks, setTasks]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<TaskItem>, historyAction?: string, oldVal?: string, newVal?: string) => {
    await supabase.from('trackino_task_items').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (historyAction && user) {
      await supabase.from('trackino_task_history').insert({ task_id: taskId, user_id: user.id, action: historyAction, old_value: oldVal ?? null, new_value: newVal ?? null });
    }
  }, [user, setTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    await supabase.from('trackino_task_items').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
  }, [setTasks, setSelectedTask]);

  // ── Column CRUD ──
  const addColumn = useCallback(async (name: string) => {
    if (!activeBoard) return;
    const maxOrder = sortedColumns.length > 0 ? Math.max(...sortedColumns.map(c => c.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_columns').insert({ board_id: activeBoard.id, name, sort_order: maxOrder }).select().single();
    if (data) setColumns(prev => [...prev, data as TaskColumn]);
  }, [activeBoard, sortedColumns, setColumns]);

  const renameColumn = useCallback(async (colId: string, name: string) => {
    await supabase.from('trackino_task_columns').update({ name }).eq('id', colId);
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, name } : c));
  }, [setColumns]);

  const deleteColumn = useCallback(async (colId: string) => {
    await supabase.from('trackino_task_columns').delete().eq('id', colId);
    setColumns(prev => prev.filter(c => c.id !== colId));
    setTasks(prev => prev.map(t => t.column_id === colId ? { ...t, column_id: null } : t));
  }, [setColumns, setTasks]);

  // ── Toggle task completion ──
  const toggleComplete = useCallback(async (task: TaskItem) => {
    const newCompleted = !task.is_completed;
    const updates: Partial<TaskItem> = { is_completed: newCompleted };

    const settings = activeBoard?.settings ?? {};
    if (newCompleted && settings.auto_complete_column_id) {
      updates.column_id = settings.auto_complete_column_id;
      updates.sort_order = -1;
    }

    await supabase.from('trackino_task_items').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
    if (selectedTask?.id === task.id) setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    if (user) {
      await supabase.from('trackino_task_history').insert({ task_id: task.id, user_id: user.id, action: newCompleted ? 'completed' : 'reopened' });
    }
  }, [activeBoard, selectedTask, user, setTasks, setSelectedTask]);

  // ── Board settings ──
  const saveBoardSettings = useCallback(async (newSettings: TaskBoardSettings) => {
    if (!activeBoard) return;
    await supabase.from('trackino_task_boards').update({ settings: newSettings }).eq('id', activeBoard.id);
    setBoards(prev => prev.map(b => b.id === activeBoard.id ? { ...b, settings: newSettings } : b));
  }, [activeBoard, setBoards]);

  const updateColumnColor = useCallback(async (colId: string, color: string) => {
    await supabase.from('trackino_task_columns').update({ color }).eq('id', colId);
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, color } : c));
  }, [setColumns]);

  // ── Folder CRUD ──
  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    if (!wsId || !user) return;
    const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.sort_order)) + 1 : 0;
    const { data } = await supabase.from('trackino_task_folders').insert({
      workspace_id: wsId, name, sort_order: maxOrder, parent_id: parentId ?? null, created_by: user.id,
    }).select().single();
    if (data) setFolders(prev => [...prev, data as TaskFolder]);
  }, [wsId, user, folders, setFolders]);

  const deleteFolder = useCallback(async (folderId: string) => {
    await supabase.from('trackino_task_folders').delete().eq('id', folderId);
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setBoards(prev => prev.map(b => b.folder_id === folderId ? { ...b, folder_id: null } : b));
    await supabase.from('trackino_task_boards').update({ folder_id: null }).eq('folder_id', folderId);
  }, [setFolders, setBoards]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    await supabase.from('trackino_task_folders').update({ name }).eq('id', folderId);
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
  }, [setFolders]);

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
      const defaults = [
        { name: 'K řešení', color: '#9ca3af', sort_order: 0 },
        { name: 'Rozpracováno', color: '#3b82f6', sort_order: 1 },
        { name: 'Hotovo', color: '#22c55e', sort_order: 2 },
      ];
      const { data: cols } = await supabase.from('trackino_task_columns').insert(defaults.map(d => ({ ...d, board_id: board.id }))).select();
      if (cols) setColumns(prev => [...prev, ...(cols as TaskColumn[])]);
      setActiveBoardId(board.id);
    }
  }, [wsId, user, setBoards, setColumns, setActiveBoardId]);

  const deleteBoard = useCallback(async (boardId: string) => {
    await supabase.from('trackino_task_boards').delete().eq('id', boardId);
    setBoards(prev => prev.filter(b => b.id !== boardId));
    if (activeBoardId === boardId) {
      const remaining = boards.filter(b => b.id !== boardId);
      setActiveBoardId(remaining[0]?.id ?? null);
    }
  }, [activeBoardId, boards, setBoards, setActiveBoardId]);

  const updateBoard = useCallback(async (boardId: string, updates: Partial<TaskBoard>) => {
    await supabase.from('trackino_task_boards').update(updates).eq('id', boardId);
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, ...updates } : b));
  }, [setBoards]);

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
  }, [activeBoard, wsId, shareMode, shareSelectedUsers, setBoards, setBoardMembers, setShowShareModal]);

  // ── Folder sharing ──
  const saveFolderSharing = useCallback(async () => {
    if (!folderShareTargetId || !wsId || !user) return;
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
  }, [folderShareTargetId, wsId, user, folderShareMode, folderShareUsers, setFolders, setFolderShares]);

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

  return {
    // Task
    createTask, updateTask, deleteTask,
    // Column
    addColumn, renameColumn, deleteColumn,
    // Task state
    toggleComplete, saveBoardSettings, updateColumnColor,
    // Folder
    createFolder, deleteFolder, renameFolder,
    // Board
    createBoard, deleteBoard, updateBoard,
    // Sharing
    saveBoardSharing,
    // Folder sharing state + action
    showFolderShareModal, setShowFolderShareModal,
    folderShareTargetId, setFolderShareTargetId,
    folderShareMode, setFolderShareMode,
    folderShareUsers, setFolderShareUsers,
    saveFolderSharing,
    // DnD
    handleDragStart, handleDragEnd,
  };
}
