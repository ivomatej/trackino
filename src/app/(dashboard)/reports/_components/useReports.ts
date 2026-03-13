'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { splitAtMidnight } from '@/lib/midnight-split';
import type { TimeEntry, Project, Category, Task, MemberRate } from '@/types/database';
import type { MemberProfile, DatePreset } from './types';
import { isoDate, getPresetRange, getRateForEntry } from './utils';

export function useReports() {
  const { user } = useAuth();
  const { currentWorkspace, isManagerOf } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin, canManualEntry } = usePermissions();

  // Filtry
  const [preset, setPreset] = useState<DatePreset>('week');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [userFilter, setUserFilter] = useState<string>('me');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [ratesByMemberId, setRatesByMemberId] = useState<Record<string, MemberRate[]>>({});
  const [userToMemberId, setUserToMemberId] = useState<Record<string, string>>({});

  // Ruční zadání
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(isoDate(new Date()));
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('10:00');
  const [manualProject, setManualProject] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualTask, setManualTask] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualForUser, setManualForUser] = useState('me');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');

  // Poznámky
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const canSeeOthers = isWorkspaceAdmin || isManager;
  const canManageNotes = isMasterAdmin || isWorkspaceAdmin || isManager;

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPresetRange(preset);

  // Načtení členů workspace + jejich sazeb
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace || !user) return;

    if (canSeeOthers) {
      const { data: memberRows } = await supabase
        .from('trackino_workspace_members')
        .select('id, user_id')
        .eq('workspace_id', currentWorkspace.id);

      const rawMembers = (memberRows ?? []) as { id: string; user_id: string }[];
      const userIds = rawMembers.map(m => m.user_id);
      if (userIds.length === 0) return;

      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      const memberList: MemberProfile[] = (profiles ?? []).map((p: { id: string; display_name: string; email: string }) => {
        const row = rawMembers.find(r => r.user_id === p.id);
        return {
          member_id: row?.id ?? '',
          user_id: p.id,
          display_name: p.display_name || p.email,
          email: p.email,
        };
      });

      const filtered = (isManager && !isWorkspaceAdmin)
        ? memberList.filter(m => m.user_id === user.id || isManagerOf(m.user_id))
        : memberList;

      setMembers(filtered);

      const memberDbIds = memberList.map(m => m.member_id).filter(Boolean);
      if (memberDbIds.length > 0) {
        const { data: rates } = await supabase
          .from('trackino_member_rates')
          .select('*')
          .in('workspace_member_id', memberDbIds);

        const rMap: Record<string, MemberRate[]> = {};
        (rates ?? []).forEach((r: MemberRate) => {
          if (!rMap[r.workspace_member_id]) rMap[r.workspace_member_id] = [];
          rMap[r.workspace_member_id].push(r);
        });
        setRatesByMemberId(rMap);
      }

      const idMap: Record<string, string> = {};
      memberList.forEach(m => { if (m.member_id) idMap[m.user_id] = m.member_id; });
      setUserToMemberId(idMap);
    } else {
      const { data: ownRow } = await supabase
        .from('trackino_workspace_members')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .single();

      if (ownRow) {
        const { data: rates } = await supabase
          .from('trackino_member_rates')
          .select('*')
          .eq('workspace_member_id', ownRow.id);

        const rMap: Record<string, MemberRate[]> = {};
        rMap[ownRow.id] = (rates ?? []) as MemberRate[];
        setRatesByMemberId(rMap);
        setUserToMemberId({ [user.id]: ownRow.id });
      }
    }
  }, [currentWorkspace, canSeeOthers, isManager, isWorkspaceAdmin, user, isManagerOf]);

  // Načtení projektů
  const fetchProjects = useCallback(async () => {
    if (!currentWorkspace) return;
    const [pRes, cRes, tRes] = await Promise.all([
      supabase.from('trackino_projects').select('*').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
    ]);
    setProjects((pRes.data ?? []) as Project[]);
    setCategories((cRes.data ?? []) as Category[]);
    setTasks((tRes.data ?? []) as Task[]);
  }, [currentWorkspace]);

  // Načtení záznamů
  const fetchEntries = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    const fromDt = `${from}T00:00:00.000Z`;
    const toDt = `${to}T23:59:59.999Z`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('trackino_time_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .gte('start_time', fromDt)
      .lte('start_time', toDt)
      .eq('is_running', false)
      .order('start_time', { ascending: false });

    if (userFilter === 'me' || !canSeeOthers) {
      query = query.eq('user_id', user.id);
    } else if (userFilter !== 'all') {
      query = query.eq('user_id', userFilter);
    }

    if (projectFilter !== 'all') {
      query = query.eq('project_id', projectFilter);
    }

    const { data } = await query;
    setEntries((data ?? []) as TimeEntry[]);
    setLoading(false);
  }, [currentWorkspace, user, from, to, userFilter, projectFilter, canSeeOthers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Skupiny dle dne
  const groupedEntries = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const _d = new Date(e.start_time);
    const day = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(groupedEntries).sort().reverse();

  const totalSeconds = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

  const getEntryRate = (userId: string, entryDate: string): number | null =>
    getRateForEntry(userId, entryDate, userToMemberId, ratesByMemberId);

  const totalCost = entries.reduce((sum, e) => {
    if (!e.duration) return sum;
    const _cd = new Date(e.start_time);
    const costDay = `${_cd.getFullYear()}-${String(_cd.getMonth() + 1).padStart(2, '0')}-${String(_cd.getDate()).padStart(2, '0')}`;
    const rate = getEntryRate(e.user_id, costDay);
    return rate !== null ? sum + (e.duration / 3600) * rate : sum;
  }, 0);

  const hasCosts = totalCost > 0;

  const perUserStats = canSeeOthers
    ? Object.values(
        entries.reduce<Record<string, { userId: string; seconds: number; cost: number }>>((acc, e) => {
          if (!acc[e.user_id]) acc[e.user_id] = { userId: e.user_id, seconds: 0, cost: 0 };
          acc[e.user_id].seconds += e.duration ?? 0;
          if (e.duration) {
            const _pd = new Date(e.start_time);
            const perDay = `${_pd.getFullYear()}-${String(_pd.getMonth() + 1).padStart(2, '0')}-${String(_pd.getDate()).padStart(2, '0')}`;
            const rate = getEntryRate(e.user_id, perDay);
            if (rate !== null) acc[e.user_id].cost += (e.duration / 3600) * rate;
          }
          return acc;
        }, {})
      ).sort((a, b) => b.seconds - a.seconds)
    : [];

  const currencySymbol = currentWorkspace?.currency === 'EUR' ? '€' : currentWorkspace?.currency === 'USD' ? '$' : 'Kč';

  // Manuální zadání
  const saveManual = async () => {
    if (!user || !currentWorkspace) return;
    setManualError('');

    const startDt = new Date(`${manualDate}T${manualStart}:00`);
    const endDt = new Date(`${manualDate}T${manualEnd}:00`);

    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      setManualError('Neplatný datum nebo čas.'); return;
    }
    if (endDt <= startDt) {
      setManualError('Čas konce musí být po čase začátku.'); return;
    }

    const targetUserId = (canManualEntry && canSeeOthers && manualForUser !== 'me') ? manualForUser : user.id;

    setManualSaving(true);
    const segments = splitAtMidnight(startDt, endDt);

    for (const seg of segments) {
      const dur = Math.round((seg.end.getTime() - seg.start.getTime()) / 1000);
      await supabase.from('trackino_time_entries').insert({
        workspace_id: currentWorkspace.id,
        user_id: targetUserId,
        project_id: manualProject || null,
        category_id: manualCategory || null,
        task_id: manualTask || null,
        description: manualDesc,
        start_time: seg.start.toISOString(),
        end_time: seg.end.toISOString(),
        duration: dur,
        is_running: false,
        manager_note: '',
      });
    }

    setManualDesc('');
    setManualProject('');
    setManualCategory('');
    setManualTask('');
    setManualSaving(false);
    setShowManual(false);
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Smazat záznam?')) return;
    await supabase.from('trackino_time_entries').delete().eq('id', id);
    fetchEntries();
  };

  const saveNote = async (entryId: string) => {
    setSavingNoteId(entryId);
    await supabase
      .from('trackino_time_entries')
      .update({ manager_note: noteText.trim() })
      .eq('id', entryId);
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, manager_note: noteText.trim() } : e
    ));
    setSavingNoteId(null);
    setEditingNoteId(null);
  };

  // Lookups
  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? null;
  const taskName = (id: string | null) => tasks.find(t => t.id === id)?.name ?? null;
  const memberName = (userId: string) => members.find(m => m.user_id === userId)?.display_name ?? '—';

  return {
    user,
    canSeeOthers,
    canManageNotes,
    canManualEntry,
    // Filtry
    preset, setPreset,
    customFrom, setCustomFrom,
    customTo, setCustomTo,
    userFilter, setUserFilter,
    projectFilter, setProjectFilter,
    from, to,
    // Data
    entries,
    projects,
    categories,
    tasks,
    members,
    loading,
    // Ruční zadání
    showManual, setShowManual,
    manualDate, setManualDate,
    manualStart, setManualStart,
    manualEnd, setManualEnd,
    manualProject, setManualProject,
    manualCategory, setManualCategory,
    manualTask, setManualTask,
    manualDesc, setManualDesc,
    manualForUser, setManualForUser,
    manualSaving,
    manualError,
    saveManual,
    // Poznámky
    editingNoteId, setEditingNoteId,
    noteText, setNoteText,
    savingNoteId,
    saveNote,
    // Akce
    deleteEntry,
    // Computed
    groupedEntries,
    sortedDays,
    totalSeconds,
    totalCost,
    hasCosts,
    perUserStats,
    currencySymbol,
    // Lookups
    projectName,
    categoryName,
    taskName,
    memberName,
    getEntryRate,
  };
}
