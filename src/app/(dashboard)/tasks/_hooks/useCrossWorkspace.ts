'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { TaskItem, TaskPriority } from '@/types/database';
import type { UserWorkspace, CwsBoardInfo, CwsColumnInfo, Member, DeadlineFilter } from '../types';

// ──────────────────────────────────────────────
// Cross-workspace hook – all cws* state + logic
// ──────────────────────────────────────────────
export function useCrossWorkspace({ user }: { user: User | null }) {
  // ── State ──
  const [crossWsMode, setCrossWsMode] = useState(false);
  const [userWorkspaces, setUserWorkspaces] = useState<UserWorkspace[]>([]);
  const [cwsTab, setCwsTab] = useState<string>('all');
  const [cwsLoading, setCwsLoading] = useState(false);
  const [cwsTasks, setCwsTasks] = useState<TaskItem[]>([]);
  const [cwsBoardsMap, setCwsBoardsMap] = useState<Map<string, CwsBoardInfo>>(new Map());
  const [cwsColsMap, setCwsColsMap] = useState<Map<string, CwsColumnInfo>>(new Map());
  const [cwsAllMembers, setCwsAllMembers] = useState<Map<string, Member>>(new Map());
  const [cwsDataLoaded, setCwsDataLoaded] = useState(false);

  // ── Filters ──
  const [showCwsFilters, setShowCwsFilters] = useState(false);
  const [cwsSearch, setCwsSearch] = useState('');
  const [cwsFilterPriority, setCwsFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [cwsFilterDeadline, setCwsFilterDeadline] = useState<DeadlineFilter>('all');
  const [cwsFilterBoard, setCwsFilterBoard] = useState<string>('all');
  const [cwsFilterAssignee, setCwsFilterAssignee] = useState<string>('all');
  const [cwsHideCompleted, setCwsHideCompleted] = useState(true);
  const [cwsSortBy, setCwsSortBy] = useState<'deadline' | 'priority' | 'title' | 'created_at'>('deadline');
  const [cwsSortDir, setCwsSortDir] = useState<'asc' | 'desc'>('asc');

  // ── New task modal ──
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

  // ── Load boards+members when workspace changes in modal ──
  useEffect(() => {
    if (!cwsNewWsId || !showCwsNewTask) {
      setCwsNewTaskBoards([]); setCwsNewTaskCols([]); setCwsNewTaskMembers([]);
      return;
    }
    (async () => {
      const { data: bData } = await supabase
        .from('trackino_task_boards').select('id, name, workspace_id, color').eq('workspace_id', cwsNewWsId);
      const bList: CwsBoardInfo[] = (bData ?? []) as CwsBoardInfo[];
      setCwsNewTaskBoards(bList);
      setCwsNewBoardId(bList[0]?.id ?? '');
      const { data: wm } = await supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', cwsNewWsId);
      const uids = (wm ?? []).map((m: { user_id: string }) => m.user_id);
      if (uids.length > 0) {
        const { data: profiles } = await supabase.from('trackino_profiles').select('id, display_name, avatar_color, email').in('id', uids);
        setCwsNewTaskMembers((profiles ?? []).map((p: { id: string; display_name: string | null; avatar_color: string | null; email: string | null }) => ({
          user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1', email: p.email ?? '',
        })));
      } else { setCwsNewTaskMembers([]); }
    })();
  }, [cwsNewWsId, showCwsNewTask]);

  // ── Load columns when board changes in modal ──
  useEffect(() => {
    if (!cwsNewBoardId) { setCwsNewTaskCols([]); setCwsNewColId(''); return; }
    (async () => {
      const { data: colData } = await supabase
        .from('trackino_task_columns').select('id, name, color, board_id, sort_order').eq('board_id', cwsNewBoardId).order('sort_order');
      const cList: CwsColumnInfo[] = (colData ?? []) as CwsColumnInfo[];
      setCwsNewTaskCols(cList);
      setCwsNewColId(cList[0]?.id ?? '');
    })();
  }, [cwsNewBoardId]);

  // ── Fetch all cross-workspace data ──
  const fetchCrossWsData = useCallback(async (forceReload = false) => {
    if (!user) return;
    if (cwsDataLoaded && !forceReload) return;
    setCwsLoading(true);

    const { data: memberships } = await supabase
      .from('trackino_workspace_members').select('workspace_id').eq('user_id', user.id);
    const wsIds = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);
    if (!wsIds.length) { setCwsLoading(false); setCwsDataLoaded(true); return; }

    const { data: wsData } = await supabase
      .from('trackino_workspaces').select('id, name, color').in('id', wsIds);
    setUserWorkspaces((wsData ?? []) as UserWorkspace[]);

    const { data: allTaskData } = await supabase
      .from('trackino_task_items').select('*').order('created_at', { ascending: false }).limit(1000);
    const taskList = (allTaskData ?? []) as TaskItem[];
    setCwsTasks(taskList);

    if (taskList.length > 0) {
      const boardIds = [...new Set(taskList.map(t => t.board_id).filter(Boolean))];
      const { data: boardData } = await supabase
        .from('trackino_task_boards').select('id, name, workspace_id, color').in('id', boardIds);
      const newBoardsMap = new Map<string, CwsBoardInfo>();
      (boardData ?? []).forEach((b: CwsBoardInfo) => newBoardsMap.set(b.id, b));
      setCwsBoardsMap(newBoardsMap);

      const { data: colData } = await supabase
        .from('trackino_task_columns').select('id, name, color, board_id, sort_order').in('board_id', boardIds);
      const newColsMap = new Map<string, CwsColumnInfo>();
      (colData ?? []).forEach((c: CwsColumnInfo) => newColsMap.set(c.id, c));
      setCwsColsMap(newColsMap);
    }

    const { data: allWsMembers } = await supabase
      .from('trackino_workspace_members').select('user_id').in('workspace_id', wsIds);
    const memberUids = [...new Set((allWsMembers ?? []).map((m: { user_id: string }) => m.user_id))];
    if (memberUids.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles').select('id, display_name, avatar_color, email').in('id', memberUids);
      const membersMap = new Map<string, Member>();
      (profiles ?? []).forEach((p: { id: string; display_name: string | null; avatar_color: string | null; email: string | null }) =>
        membersMap.set(p.id, { user_id: p.id, display_name: p.display_name ?? '', avatar_color: p.avatar_color ?? '#6366f1', email: p.email ?? '' })
      );
      setCwsAllMembers(membersMap);
    }

    setCwsDataLoaded(true);
    setCwsLoading(false);
  }, [user, cwsDataLoaded]);

  // ── Create cross-workspace task ──
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

  // ── Filtered tasks useMemo ──
  const cwsFilteredTasks = useMemo(() => {
    if (!crossWsMode) return [];
    let list = cwsTasks;

    if (cwsTab !== 'all') {
      const tabBoardIds = [...cwsBoardsMap.entries()]
        .filter(([, b]) => b.workspace_id === cwsTab)
        .map(([id]) => id);
      list = list.filter(t => tabBoardIds.includes(t.board_id));
    }
    if (cwsSearch.trim()) {
      const q = cwsSearch.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (cwsBoardsMap.get(t.board_id)?.name ?? '').toLowerCase().includes(q)
      );
    }
    if (cwsFilterPriority !== 'all') list = list.filter(t => t.priority === cwsFilterPriority);
    if (cwsFilterBoard !== 'all') list = list.filter(t => t.board_id === cwsFilterBoard);
    if (cwsFilterAssignee === 'mine' && user) list = list.filter(t => t.assigned_to === user.id);
    else if (cwsFilterAssignee !== 'all') list = list.filter(t => t.assigned_to === cwsFilterAssignee);
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
    if (cwsHideCompleted) list = list.filter(t => !t.is_completed);

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

  const cwsActiveFilterCount = useMemo(() => {
    let n = 0;
    if (cwsFilterPriority !== 'all') n++;
    if (cwsFilterDeadline !== 'all') n++;
    if (cwsFilterBoard !== 'all') n++;
    if (cwsFilterAssignee !== 'all') n++;
    return n;
  }, [cwsFilterPriority, cwsFilterDeadline, cwsFilterBoard, cwsFilterAssignee]);

  return {
    crossWsMode, setCrossWsMode,
    userWorkspaces, cwsTab, setCwsTab,
    cwsLoading, cwsTasks, setCwsTasks,
    cwsBoardsMap, cwsColsMap, cwsAllMembers,
    showCwsFilters, setShowCwsFilters,
    cwsSearch, setCwsSearch,
    cwsFilterPriority, setCwsFilterPriority,
    cwsFilterDeadline, setCwsFilterDeadline,
    cwsFilterBoard, setCwsFilterBoard,
    cwsFilterAssignee, setCwsFilterAssignee,
    cwsHideCompleted, setCwsHideCompleted,
    cwsSortBy, setCwsSortBy,
    cwsSortDir, setCwsSortDir,
    showCwsNewTask, setShowCwsNewTask,
    cwsNewWsId, setCwsNewWsId,
    cwsNewBoardId, setCwsNewBoardId,
    cwsNewColId, setCwsNewColId,
    cwsNewTitle, setCwsNewTitle,
    cwsNewPriority, setCwsNewPriority,
    cwsNewDeadline, setCwsNewDeadline,
    cwsNewAssignee, setCwsNewAssignee,
    cwsNewSaving, cwsNewTaskBoards, cwsNewTaskCols, cwsNewTaskMembers,
    fetchCrossWsData, handleCreateCwsTask,
    cwsFilteredTasks, cwsActiveFilterCount,
  };
}
