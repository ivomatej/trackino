'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import type { AvailabilityStatus, AvailabilityEntry, ImportantDay } from '@/types/database';
import { getWorkspaceToday } from '@/lib/utils';
import { getCzechHolidays } from '@/lib/czech-calendar';
import { getMonday, addDays, toDateStr, getImportantDaysForDate } from './utils';
import type { MemberRow, Half, CellKey, DayKey, CellData, EditingCell } from './types';

export function usePlanner() {
  const { user } = useAuth();
  const { currentWorkspace, managerAssignments } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin, isManager } = usePermissions();
  const [loading, setLoading] = useState(true);

  // Dnešní datum v timezone workspace (YYYY-MM-DD)
  const workspaceTodayStr = getWorkspaceToday(currentWorkspace?.timezone ?? 'Europe/Prague');
  // isToday komponentová funkce – porovnává vůči workspace timezone
  const isToday = (date: Date) => toDateStr(date) === workspaceTodayStr;

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  const [statuses, setStatuses] = useState<AvailabilityStatus[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [cells, setCells] = useState<Record<CellKey, CellData>>({});
  const [pins, setPins] = useState<string[]>([]);
  // Mapa userId → can_use_vacation (pro sync Plánovač → Dovolená)
  const [canUseVacMap, setCanUseVacMap] = useState<Record<string, boolean>>({});

  /**
   * splitDays = Set of DayKeys (`${userId}|${date}`) zobrazených v rozděleném režimu (DOP+ODP).
   * Výchozí stav je "celý den" – jedna buňka.
   * Při expanzi se dayKey přidá; při sloučení odebere.
   * Při načtení dat se dayKeys s am/pm záznamy automaticky přidají.
   */
  const [splitDays, setSplitDays] = useState<Set<DayKey>>(new Set());

  // UI state
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellPickerPos, setCellPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellKey | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  // Důležité dny (osobní záznamy uživatele)
  const [importantDays, setImportantDays] = useState<ImportantDay[]>([]);

  // Status manager state
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6366f1');
  const [editingStatus, setEditingStatus] = useState<AvailabilityStatus | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const cellPickerRef = useRef<HTMLDivElement>(null);

  const canAdmin = isWorkspaceAdmin || isMasterAdmin;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // České svátky pro viditelný týden (může přesahovat dva roky)
  const weekHolidays = [...new Set(weekDays.map(d => d.getFullYear()))].flatMap(y => getCzechHolidays(y));

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchStatuses = useCallback(async () => {
    if (!currentWorkspace) return;
    const { data } = await supabase
      .from('trackino_availability_statuses')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('sort_order');
    setStatuses((data ?? []) as AvailabilityStatus[]);
  }, [currentWorkspace]);

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace || !user) return;

    const { data: memberData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id, can_use_vacation')
      .eq('workspace_id', currentWorkspace.id)
      .eq('approved', true);

    if (!memberData) return;
    const userIds = (memberData as { user_id: string; can_use_vacation: boolean }[]).map(m => m.user_id);

    // Sestavit mapu can_use_vacation
    const vacMap: Record<string, boolean> = {};
    (memberData as { user_id: string; can_use_vacation: boolean }[]).forEach(m => {
      vacMap[m.user_id] = m.can_use_vacation ?? false;
    });
    setCanUseVacMap(vacMap);

    const { data: profileData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, avatar_color')
      .in('id', userIds);

    const profileMap: Record<string, { display_name: string; avatar_color: string }> = {};
    (profileData ?? []).forEach((p: { id: string; display_name: string; avatar_color: string }) => {
      profileMap[p.id] = p;
    });

    const { data: pinData } = await supabase
      .from('trackino_planner_pins')
      .select('pinned_user_id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id);

    const pinnedIds = (pinData ?? []).map((p: { pinned_user_id: string }) => p.pinned_user_id);
    setPins(pinnedIds);

    let visibleIds: string[] = [];
    if (canAdmin) {
      visibleIds = userIds;
    } else if (isManager) {
      const teamIds = managerAssignments.map(a => a.member_user_id);
      visibleIds = [...new Set([user.id, ...teamIds])];
    } else {
      const { data: myManagers } = await supabase
        .from('trackino_manager_assignments')
        .select('manager_user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('member_user_id', user.id);

      const myManagerIds = (myManagers ?? []).map((m: { manager_user_id: string }) => m.manager_user_id);
      if (myManagerIds.length > 0) {
        const { data: teammates } = await supabase
          .from('trackino_manager_assignments')
          .select('member_user_id')
          .eq('workspace_id', currentWorkspace.id)
          .in('manager_user_id', myManagerIds);

        const teammateIds = (teammates ?? []).map((t: { member_user_id: string }) => t.member_user_id);
        visibleIds = [...new Set([user.id, ...teammateIds])];
      } else {
        visibleIds = [user.id];
      }
    }

    const rows: MemberRow[] = visibleIds
      .filter(id => profileMap[id])
      .map(id => ({
        userId: id,
        displayName: profileMap[id]?.display_name ?? id,
        avatarColor: profileMap[id]?.avatar_color ?? '#6366f1',
        isPinned: pinnedIds.includes(id),
        isSelf: id === user.id,
      }))
      .sort((a, b) => {
        if (a.isSelf && !b.isSelf) return -1;
        if (!a.isSelf && b.isSelf) return 1;
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.displayName.localeCompare(b.displayName, 'cs');
      });

    setMembers(rows);
  }, [currentWorkspace, user, canAdmin, isManager, managerAssignments]);

  const fetchAvailability = useCallback(async () => {
    if (!currentWorkspace) return;
    const from = toDateStr(weekStart);
    const to = toDateStr(addDays(weekStart, 6));

    const { data } = await supabase
      .from('trackino_availability')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .gte('date', from)
      .lte('date', to);

    const map: Record<CellKey, CellData> = {};
    const autoSplit = new Set<DayKey>();

    (data ?? []).forEach((e: AvailabilityEntry) => {
      map[`${e.user_id}|${e.date}|${e.half}`] = { statusId: e.status_id, note: e.note };
      // Dny s am/pm záznamy automaticky zobrazit v rozděleném režimu
      if (e.half === 'am' || e.half === 'pm') {
        autoSplit.add(`${e.user_id}|${e.date}`);
      }
    });

    setCells(map);
    setSplitDays(autoSplit);
  }, [currentWorkspace, weekStart]);

  // Fetch důležitých dnů přihlášeného uživatele
  const fetchImportantDays = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const { data } = await supabase
      .from('trackino_important_days')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id);
    setImportantDays((data ?? []) as ImportantDay[]);
  }, [user, currentWorkspace]);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([fetchStatuses(), fetchMembers(), fetchAvailability(), fetchImportantDays()]).finally(() => setLoading(false));
  }, [currentWorkspace, fetchStatuses, fetchMembers, fetchAvailability, fetchImportantDays]);

  // Zavřít picker při kliknutí mimo
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cellPickerRef.current && !cellPickerRef.current.contains(e.target as Node)) {
        setEditingCell(null);
        setCellPickerPos(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Expand (celý den → DOP+ODP) ──────────────────────────────────────────

  const handleExpand = async (userId: string, date: string) => {
    if (!currentWorkspace) return;

    // Okamžitě zobrazit v rozděleném režimu (optimistická aktualizace)
    setSplitDays(prev => new Set([...prev, `${userId}|${date}`]));

    const fullKey = `${userId}|${date}|full`;
    const fullCell = cells[fullKey];

    if (fullCell?.statusId) {
      // Zkopírovat stav celého dne do DOP i ODP
      await supabase.from('trackino_availability').upsert([
        { workspace_id: currentWorkspace.id, user_id: userId, date, half: 'am', status_id: fullCell.statusId, note: fullCell.note },
        { workspace_id: currentWorkspace.id, user_id: userId, date, half: 'pm', status_id: fullCell.statusId, note: fullCell.note },
      ], { onConflict: 'workspace_id,user_id,date,half' });

      // Smazat záznam celého dne
      await supabase.from('trackino_availability').delete()
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', userId)
        .eq('date', date)
        .eq('half', 'full');

      setCells(prev => {
        const next = { ...prev };
        delete next[fullKey];
        next[`${userId}|${date}|am`] = { statusId: fullCell.statusId, note: fullCell.note };
        next[`${userId}|${date}|pm`] = { statusId: fullCell.statusId, note: fullCell.note };
        return next;
      });
    }
  };

  // ── Merge (DOP+ODP → celý den) ────────────────────────────────────────────

  const handleMerge = async (userId: string, date: string) => {
    if (!currentWorkspace) return;

    const amKey = `${userId}|${date}|am`;
    const pmKey = `${userId}|${date}|pm`;
    const amCell = cells[amKey];
    const pmCell = cells[pmKey];

    // Použít stav DOP (nebo ODP pokud DOP je prázdné) jako stav celého dne
    const fullStatusId = amCell?.statusId ?? pmCell?.statusId ?? null;
    const fullNote = amCell?.note || pmCell?.note || '';

    // Okamžitě skrýt split (optimistická aktualizace)
    setSplitDays(prev => {
      const next = new Set(prev);
      next.delete(`${userId}|${date}`);
      return next;
    });

    // Smazat am a pm záznamy
    await supabase.from('trackino_availability').delete()
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', userId)
      .eq('date', date)
      .in('half', ['am', 'pm']);

    // Uložit jako "full" pokud byl nastaven nějaký stav
    if (fullStatusId) {
      await supabase.from('trackino_availability').upsert({
        workspace_id: currentWorkspace.id,
        user_id: userId,
        date,
        half: 'full',
        status_id: fullStatusId,
        note: fullNote,
      }, { onConflict: 'workspace_id,user_id,date,half' });
    }

    setCells(prev => {
      const next = { ...prev };
      delete next[amKey];
      delete next[pmKey];
      if (fullStatusId) {
        next[`${userId}|${date}|full`] = { statusId: fullStatusId, note: fullNote };
      }
      return next;
    });
  };

  // ── Kliknutí na buňku ─────────────────────────────────────────────────────

  const handleCellClick = (userId: string, date: string, half: Half, e: { currentTarget: EventTarget | null }) => {
    if (!user) return;
    const canEdit = userId === user.id || canAdmin ||
      (isManager && managerAssignments.some(a => a.member_user_id === userId));
    if (!canEdit) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellPickerPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    setEditingCell({ userId, date, half });
  };

  // ── Sync Plánovač → Dovolená ─────────────────────────────────────────────
  // Poznámka: po opravě toDateStr jsou planner klíče lokální data (YYYY-MM-DD),
  // takže `date` param přímo odpovídá vacation start_date/end_date – bez konverze.

  /** Vytvoří 1denní vacation záznam pro daný den, pokud ještě neexistuje. */
  const syncPlannerDayToVacation = async (userId: string, date: string) => {
    if (!currentWorkspace) return;
    // Dedup: existuje vacation záznam pokrývající tento datum?
    const { data: existing } = await supabase
      .from('trackino_vacation_entries')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', userId)
      .lte('start_date', date)
      .gte('end_date', date);
    if (existing && existing.length > 0) return;

    await supabase.from('trackino_vacation_entries').insert({
      workspace_id: currentWorkspace.id,
      user_id: userId,
      start_date: date,
      end_date: date,
      days: 1,
      note: '',
    });
  };

  /** Smaže 1denní vacation záznamy pro daný den (vícedenní záznamy nechá). */
  const removePlannerDayFromVacation = async (userId: string, date: string) => {
    if (!currentWorkspace) return;
    await supabase.from('trackino_vacation_entries')
      .delete()
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', userId)
      .eq('start_date', date)
      .eq('end_date', date);
  };

  // ── Nastavení stavu dostupnosti ───────────────────────────────────────────

  const setAvailability = async (statusId: string | null, note?: string) => {
    if (!editingCell || !currentWorkspace) return;
    const { userId, date, half } = editingCell;
    const key = `${userId}|${date}|${half}`;
    const existing = cells[key];
    const oldStatusId = existing?.statusId ?? null;

    if (statusId === null) {
      await supabase.from('trackino_availability').delete()
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', userId)
        .eq('date', date)
        .eq('half', half);

      setCells(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      await supabase.from('trackino_availability').upsert({
        workspace_id: currentWorkspace.id,
        user_id: userId,
        date,
        half,
        status_id: statusId,
        note: note ?? existing?.note ?? '',
      }, { onConflict: 'workspace_id,user_id,date,half' });

      setCells(prev => ({
        ...prev,
        [key]: { statusId, note: note ?? existing?.note ?? '' },
      }));
    }

    // ── Sync Plánovač → Dovolená (pouze pro half='full') ──────────────────
    const vacStatus = statuses.find(s => s.name.trim().toLowerCase() === 'dovolená');
    if (vacStatus && half === 'full') {
      // date je nyní lokální datum (po opravě toDateStr), T12:00:00 = lokální poledne.
      const isWeekday = ![0, 6].includes(new Date(date + 'T12:00:00').getDay());
      if (statusId === vacStatus.id) {
        // Nastavení stavu Dovolená → vytvoř vacation záznam (jen pracovní dny + can_use_vacation)
        if (isWeekday && canUseVacMap[userId]) {
          await syncPlannerDayToVacation(userId, date);
        }
      } else if (oldStatusId === vacStatus.id) {
        // Odebrání stavu Dovolená (null nebo jiný stav) → smaž 1denní vacation záznam
        await removePlannerDayFromVacation(userId, date);
      }
    }

    setEditingCell(null);
    setCellPickerPos(null);
  };

  // ── Pin / Unpin ───────────────────────────────────────────────────────────

  const togglePin = async (targetUserId: string) => {
    if (!currentWorkspace || !user) return;
    const isPinned = pins.includes(targetUserId);

    if (isPinned) {
      await supabase.from('trackino_planner_pins').delete()
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('pinned_user_id', targetUserId);
      setPins(prev => prev.filter(id => id !== targetUserId));
    } else {
      await supabase.from('trackino_planner_pins').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        pinned_user_id: targetUserId,
      });
      setPins(prev => [...prev, targetUserId]);
    }

    setMembers(prev =>
      [...prev.map(m => ({ ...m, isPinned: m.userId === targetUserId ? !isPinned : m.isPinned }))]
        .sort((a, b) => {
          if (a.isSelf && !b.isSelf) return -1;
          if (!a.isSelf && b.isSelf) return 1;
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return a.displayName.localeCompare(b.displayName, 'cs');
        })
    );
  };

  // ── Správa stavů ─────────────────────────────────────────────────────────

  const saveStatus = async () => {
    if (!currentWorkspace || !newStatusName.trim()) return;
    setSavingStatus(true);

    if (editingStatus) {
      await supabase.from('trackino_availability_statuses')
        .update({ name: newStatusName.trim(), color: newStatusColor })
        .eq('id', editingStatus.id);
    } else {
      await supabase.from('trackino_availability_statuses').insert({
        workspace_id: currentWorkspace.id,
        name: newStatusName.trim(),
        color: newStatusColor,
        sort_order: statuses.length,
      });
    }

    await fetchStatuses();
    setNewStatusName('');
    setNewStatusColor('#6366f1');
    setEditingStatus(null);
    setSavingStatus(false);
  };

  const deleteStatus = async (id: string) => {
    await supabase.from('trackino_availability_statuses').delete().eq('id', id);
    setCells(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k].statusId === id) delete next[k]; });
      return next;
    });
    await fetchStatuses();
  };

  return {
    // State
    loading,
    weekStart, setWeekStart,
    statuses,
    members,
    cells,
    splitDays,
    showStatusManager, setShowStatusManager,
    editingCell, setEditingCell,
    cellPickerPos, setCellPickerPos,
    hoveredCell, setHoveredCell,
    tooltipPos, setTooltipPos,
    importantDays,
    newStatusName, setNewStatusName,
    newStatusColor, setNewStatusColor,
    editingStatus, setEditingStatus,
    savingStatus,
    cellPickerRef,
    // Computed
    canAdmin,
    weekDays,
    weekHolidays,
    workspaceTodayStr,
    isToday,
    isManager,
    managerAssignments,
    currentUserId: user?.id,
    // Handlers
    handleExpand,
    handleMerge,
    handleCellClick,
    setAvailability,
    togglePin,
    saveStatus,
    deleteStatus,
    getImportantDaysForDate: (date: Date) => getImportantDaysForDate(date, importantDays),
  };
}
