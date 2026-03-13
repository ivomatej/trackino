'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { getWorkspaceToday } from '@/lib/utils';
import type { Category } from '@/types/database';
import { toDateStr, getMonday, COLORS } from './utils';
import type { Preset, CategoryStats } from './types';

export interface UseCategoryReportReturn {
  preset: Preset;
  from: string;
  to: string;
  today: string;
  categories: Category[];
  stats: CategoryStats[];
  loadingData: boolean;
  totalSeconds: number;
  totalCount: number;
  selectedUserId: string | null;
  members: Array<{ userId: string; name: string }>;
  canAdmin: boolean;
  isManager: boolean;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setSelectedUserId: (v: string | null) => void;
  applyPreset: (p: Preset) => void;
}

export function useCategoryReport(): UseCategoryReportReturn {
  const { user } = useAuth();
  const { currentWorkspace, managerAssignments } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin, isManager } = usePermissions();

  const canAdmin = isWorkspaceAdmin || isMasterAdmin;
  const today = getWorkspaceToday(currentWorkspace?.timezone ?? 'Europe/Prague');
  const monday = toDateStr(getMonday(new Date(today + 'T12:00:00')));

  const [preset, setPreset] = useState<Preset>('week');
  const [from, setFrom] = useState(monday);
  const [to, setTo] = useState(today);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rawEntries, setRawEntries] = useState<Array<{ category_id: string | null; duration: number | null }>>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ userId: string; name: string }>>([]);

  // ─── Fetch members for user picker ─────────────────────────────────────────

  useEffect(() => {
    if (!currentWorkspace || !user || (!canAdmin && !isManager)) {
      setMembers([]);
      return;
    }
    const run = async () => {
      let filterUserIds: string[] | null = null;
      if (!canAdmin && isManager) {
        const subordinateIds = managerAssignments.map(a => a.member_user_id);
        filterUserIds = Array.from(new Set([user.id, ...subordinateIds]));
      }

      let q = supabase
        .from('trackino_workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('approved', true);
      if (filterUserIds) q = q.in('user_id', filterUserIds);

      const { data: mems } = await q;
      if (!mems || mems.length === 0) { setMembers([]); return; }

      const uids = (mems as { user_id: string }[]).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name')
        .in('id', uids)
        .order('display_name');

      setMembers((profiles ?? []).map(p => ({ userId: p.id, name: p.display_name })));
    };
    run();
  }, [currentWorkspace?.id, user?.id, canAdmin, isManager, managerAssignments]);

  // ─── Preset date ranges ────────────────────────────────────────────────────

  const applyPreset = useCallback((p: Preset) => {
    const t = getWorkspaceToday(currentWorkspace?.timezone ?? 'Europe/Prague');
    const nowDate = new Date(t + 'T12:00:00');
    if (p === 'today') {
      setFrom(t); setTo(t);
    } else if (p === 'week') {
      setFrom(toDateStr(getMonday(nowDate)));
      setTo(t);
    } else if (p === 'month') {
      const first = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
      setFrom(toDateStr(first));
      setTo(t);
    }
    setPreset(p);
  }, [currentWorkspace?.timezone]);

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoadingData(true);

    const { data: cats } = await supabase
      .from('trackino_categories')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('name');
    setCategories((cats ?? []) as Category[]);

    let visibleUserIds: string[] | null = null;
    if (!canAdmin) {
      if (isManager) {
        const subordinateIds = managerAssignments.map(a => a.member_user_id);
        visibleUserIds = Array.from(new Set([user.id, ...subordinateIds]));
      } else {
        visibleUserIds = [user.id];
      }
    }

    if (selectedUserId) {
      if (visibleUserIds === null) {
        visibleUserIds = [selectedUserId];
      } else if (visibleUserIds.includes(selectedUserId)) {
        visibleUserIds = [selectedUserId];
      }
    }

    let query = supabase
      .from('trackino_time_entries')
      .select('category_id, duration')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_running', false)
      .gte('start_time', from + 'T00:00:00')
      .lte('start_time', to + 'T23:59:59');

    if (visibleUserIds) {
      query = query.in('user_id', visibleUserIds);
    }

    const { data: entries } = await query;
    setRawEntries((entries ?? []) as Array<{ category_id: string | null; duration: number | null }>);
    setLoadingData(false);
  }, [currentWorkspace, user, from, to, canAdmin, isManager, managerAssignments, selectedUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Aggregation ──────────────────────────────────────────────────────────

  const stats = useMemo((): CategoryStats[] => {
    const map: Record<string, { totalSeconds: number; count: number }> = {};
    rawEntries.forEach(e => {
      const key = e.category_id ?? '__none__';
      if (!map[key]) map[key] = { totalSeconds: 0, count: 0 };
      map[key].totalSeconds += e.duration ?? 0;
      map[key].count += 1;
    });

    const catMap: Record<string, string> = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    return Object.entries(map)
      .map(([key, val], idx): CategoryStats => ({
        categoryId: key === '__none__' ? null : key,
        name: key === '__none__' ? 'Bez kategorie' : (catMap[key] ?? 'Neznámá'),
        totalSeconds: val.totalSeconds,
        count: val.count,
        color: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [rawEntries, categories]);

  const totalSeconds = stats.reduce((s, c) => s + c.totalSeconds, 0);
  const totalCount = stats.reduce((s, c) => s + c.count, 0);

  return {
    preset,
    from,
    to,
    today,
    categories,
    stats,
    loadingData,
    totalSeconds,
    totalCount,
    selectedUserId,
    members,
    canAdmin,
    isManager,
    setFrom,
    setTo,
    setSelectedUserId,
    applyPreset,
  };
}
