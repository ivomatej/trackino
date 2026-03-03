'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { AvailabilityStatus, AvailabilityEntry, PlannerPin, Profile } from '@/types/database';

// ─── Pomocné funkce ────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { weekday: 'short' });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return toDateStr(date) === toDateStr(today);
}

// ─── Typy ─────────────────────────────────────────────────────────────────

interface MemberRow {
  userId: string;
  displayName: string;
  avatarColor: string;
  isPinned: boolean;
  isSelf: boolean;
}

type CellKey = string; // `${userId}|${dateStr}|${half}`

interface CellData {
  statusId: string | null;
  note: string;
  entryId?: string;
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────

function PlannerContent() {
  const { user } = useAuth();
  const { currentWorkspace, managerAssignments } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin, isManager } = usePermissions();
  const [loading, setLoading] = useState(true);

  // Týden
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  // Data
  const [statuses, setStatuses] = useState<AvailabilityStatus[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [cells, setCells] = useState<Record<CellKey, CellData>>({});
  const [pins, setPins] = useState<string[]>([]); // pinned_user_id[]

  // UI
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [editingCell, setEditingCell] = useState<{ userId: string; date: string; half: 'am' | 'pm' } | null>(null);
  const [cellPickerPos, setCellPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellKey | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  // Status manager stav
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6366f1');
  const [editingStatus, setEditingStatus] = useState<AvailabilityStatus | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const cellPickerRef = useRef<HTMLDivElement>(null);

  const canAdmin = isWorkspaceAdmin || isMasterAdmin;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ── Načtení dat ────────────────────────────────────────────────────────

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

    // Načíst všechny schválené členy
    const { data: memberData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id, approved')
      .eq('workspace_id', currentWorkspace.id)
      .eq('approved', true);

    if (!memberData) return;

    const userIds = memberData.map((m: { user_id: string; approved: boolean }) => m.user_id);

    const { data: profileData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, avatar_color')
      .in('id', userIds);

    const profileMap: Record<string, { display_name: string; avatar_color: string }> = {};
    (profileData ?? []).forEach((p: { id: string; display_name: string; avatar_color: string }) => {
      profileMap[p.id] = p;
    });

    // Načíst piny
    const { data: pinData } = await supabase
      .from('trackino_planner_pins')
      .select('pinned_user_id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id);

    const pinnedIds = (pinData ?? []).map((p: { pinned_user_id: string }) => p.pinned_user_id);
    setPins(pinnedIds);

    // Filtrovat dle viditelnosti
    let visibleIds: string[] = [];

    if (canAdmin) {
      // Admin vidí všechny
      visibleIds = userIds;
    } else if (isManager) {
      // Manager vidí sebe + svůj tým
      const teamIds = managerAssignments.map(a => a.member_user_id);
      visibleIds = [...new Set([user.id, ...teamIds])];
    } else {
      // Member vidí sebe + členy se stejným manažerem
      // Načíst, kdo jsou manažeři aktuálního uživatele
      const { data: myManagers } = await supabase
        .from('trackino_manager_assignments')
        .select('manager_user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('member_user_id', user.id);

      const myManagerIds = (myManagers ?? []).map((m: { manager_user_id: string }) => m.manager_user_id);

      if (myManagerIds.length > 0) {
        // Spoluhráči = ostatní členové se stejným manažerem
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
      }));

    // Řazení: self první, pak pinnovaní, pak ostatní dle jména
    rows.sort((a, b) => {
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
    (data ?? []).forEach((e: AvailabilityEntry) => {
      if (e.half === 'full') {
        map[`${e.user_id}|${e.date}|am`] = { statusId: e.status_id, note: e.note, entryId: e.id };
        map[`${e.user_id}|${e.date}|pm`] = { statusId: e.status_id, note: e.note, entryId: e.id };
      } else {
        map[`${e.user_id}|${e.date}|${e.half}`] = { statusId: e.status_id, note: e.note, entryId: e.id };
      }
    });
    setCells(map);
  }, [currentWorkspace, weekStart]);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([fetchStatuses(), fetchMembers(), fetchAvailability()]).finally(() => setLoading(false));
  }, [currentWorkspace, fetchStatuses, fetchMembers, fetchAvailability]);

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

  // ── Pin/Unpin ──────────────────────────────────────────────────────────

  const togglePin = async (targetUserId: string) => {
    if (!currentWorkspace || !user) return;
    const isPinned = pins.includes(targetUserId);
    if (isPinned) {
      await supabase
        .from('trackino_planner_pins')
        .delete()
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('pinned_user_id', targetUserId);
      setPins(prev => prev.filter(id => id !== targetUserId));
    } else {
      await supabase
        .from('trackino_planner_pins')
        .insert({ workspace_id: currentWorkspace.id, user_id: user.id, pinned_user_id: targetUserId });
      setPins(prev => [...prev, targetUserId]);
    }
    // Přeseřadit members
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

  // ── Kliknutí na buňku ─────────────────────────────────────────────────

  const handleCellClick = (userId: string, date: string, half: 'am' | 'pm', e: React.MouseEvent) => {
    if (!user) return;
    const canEdit = userId === user.id || canAdmin || (isManager && managerAssignments.some(a => a.member_user_id === userId));
    if (!canEdit) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setCellPickerPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    setEditingCell({ userId, date, half });
  };

  // ── Nastavení availability ────────────────────────────────────────────

  const setAvailability = async (statusId: string | null, note?: string) => {
    if (!editingCell || !currentWorkspace) return;
    const { userId, date, half } = editingCell;

    const key = `${userId}|${date}|${half}`;
    const existing = cells[key];

    if (statusId === null && !existing) {
      setEditingCell(null);
      setCellPickerPos(null);
      return;
    }

    if (statusId === null) {
      // Smazat
      await supabase
        .from('trackino_availability')
        .delete()
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
      // Upsert
      await supabase
        .from('trackino_availability')
        .upsert(
          {
            workspace_id: currentWorkspace.id,
            user_id: userId,
            date,
            half,
            status_id: statusId,
            note: note ?? existing?.note ?? '',
          },
          { onConflict: 'workspace_id,user_id,date,half' }
        );

      setCells(prev => ({
        ...prev,
        [key]: { statusId, note: note ?? existing?.note ?? '' },
      }));
    }

    setEditingCell(null);
    setCellPickerPos(null);
  };

  // ── Status manager ────────────────────────────────────────────────────

  const saveStatus = async () => {
    if (!currentWorkspace || !newStatusName.trim()) return;
    setSavingStatus(true);

    if (editingStatus) {
      await supabase
        .from('trackino_availability_statuses')
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
    // Vyčistit buňky s tímto statusem
    setCells(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k].statusId === id) delete next[k];
      });
      return next;
    });
    await fetchStatuses();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ minWidth: 0 }}>
        {/* Hlavička */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Plánovač</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Přehled dostupnosti týmu na aktuální týden
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canAdmin && (
              <button
                onClick={() => setShowStatusManager(v => !v)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: showStatusManager ? 'var(--primary)' : 'var(--bg-hover)', color: showStatusManager ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                Spravovat stavy
              </button>
            )}
          </div>
        </div>

        {/* Status manager (jen admin) */}
        {showStatusManager && canAdmin && (
          <div className="rounded-2xl border p-4 mb-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Správa stavů dostupnosti</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {statuses.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: s.color + '22', color: s.color, border: `1px solid ${s.color}55` }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.color }}
                  />
                  {s.name}
                  <button
                    className="ml-1 opacity-60 hover:opacity-100"
                    onClick={() => { setEditingStatus(s); setNewStatusName(s.name); setNewStatusColor(s.color); }}
                    title="Upravit"
                  >
                    ✎
                  </button>
                  <button
                    className="opacity-60 hover:opacity-100 text-red-500"
                    onClick={() => deleteStatus(s.id)}
                    title="Smazat"
                  >
                    ×
                  </button>
                </div>
              ))}
              {statuses.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Zatím žádné stavy. Přidejte první níže.</p>
              )}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="text"
                placeholder="Název stavu (např. Home office)"
                value={newStatusName}
                onChange={e => setNewStatusName(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg text-sm border outline-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <input
                type="color"
                value={newStatusColor}
                onChange={e => setNewStatusColor(e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border p-0.5"
                style={{ borderColor: 'var(--border)' }}
                title="Barva stavu"
              />
              <button
                onClick={saveStatus}
                disabled={savingStatus || !newStatusName.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ background: 'var(--primary)' }}
              >
                {editingStatus ? 'Uložit' : 'Přidat'}
              </button>
              {editingStatus && (
                <button
                  onClick={() => { setEditingStatus(null); setNewStatusName(''); setNewStatusColor('#6366f1'); }}
                  className="px-3 py-1.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  Zrušit
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigace týdnem */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            ‹
          </button>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatDateShort(weekStart)} – {formatDateShort(addDays(weekStart, 6))} {weekStart.getFullYear()}
          </span>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            ›
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-3 py-1 rounded-lg text-xs border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Dnes
          </button>
        </div>

        {/* Tabulka */}
        <div className="rounded-2xl border overflow-x-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Jméno sloupec */}
                <th
                  className="text-left px-4 py-2.5 text-xs font-semibold"
                  style={{ color: 'var(--text-muted)', width: 160, background: 'var(--bg-card)' }}
                >
                  Člen
                </th>
                {weekDays.map(day => (
                  <th
                    key={toDateStr(day)}
                    className="px-1 py-2.5 text-center text-xs font-semibold"
                    style={{
                      color: isToday(day) ? 'var(--primary)' : 'var(--text-muted)',
                      background: isToday(day) ? 'var(--primary-subtle, var(--bg-hover))' : 'var(--bg-card)',
                      minWidth: 88,
                    }}
                  >
                    <div>{formatDayName(day)}</div>
                    <div className="font-normal mt-0.5">{formatDateShort(day)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Žádní členové k zobrazení.
                  </td>
                </tr>
              )}
              {members.map((member, rowIdx) => {
                const canEdit = member.userId === user?.id || canAdmin || (isManager && managerAssignments.some(a => a.member_user_id === member.userId));
                return (
                  <tr
                    key={member.userId}
                    style={{ borderBottom: rowIdx < members.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    {/* Jméno */}
                    <td className="px-3 py-2" style={{ background: 'var(--bg-card)' }}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: member.avatarColor }}
                        >
                          {member.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium truncate max-w-[90px]" style={{ color: 'var(--text-primary)' }}>
                          {member.displayName}
                        </span>
                        {!member.isSelf && (
                          <button
                            onClick={() => togglePin(member.userId)}
                            title={member.isPinned ? 'Odepnout' : 'Připnout'}
                            className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                            style={{ color: member.isPinned ? 'var(--primary)' : 'var(--text-muted)' }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill={member.isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Dny */}
                    {weekDays.map(day => {
                      const dateStr = toDateStr(day);
                      const amKey: CellKey = `${member.userId}|${dateStr}|am`;
                      const pmKey: CellKey = `${member.userId}|${dateStr}|pm`;
                      const amCell = cells[amKey];
                      const pmCell = cells[pmKey];
                      const amStatus = amCell ? statuses.find(s => s.id === amCell.statusId) : null;
                      const pmStatus = pmCell ? statuses.find(s => s.id === pmCell.statusId) : null;
                      const isTodayCol = isToday(day);

                      return (
                        <td
                          key={dateStr}
                          className="px-1 py-1.5 align-top"
                          style={{ background: isTodayCol ? 'var(--primary-subtle, rgba(99,102,241,0.04))' : 'transparent' }}
                        >
                          <div className="flex flex-col gap-0.5">
                            {/* AM */}
                            <CellHalf
                              label="DOP"
                              statusColor={amStatus?.color ?? null}
                              statusName={amStatus?.name ?? null}
                              note={amCell?.note ?? ''}
                              canEdit={canEdit}
                              onClick={e => handleCellClick(member.userId, dateStr, 'am', e)}
                              cellKey={amKey}
                              hoveredCell={hoveredCell}
                              setHoveredCell={setHoveredCell}
                              setTooltipPos={setTooltipPos}
                            />
                            {/* PM */}
                            <CellHalf
                              label="ODP"
                              statusColor={pmStatus?.color ?? null}
                              statusName={pmStatus?.name ?? null}
                              note={pmCell?.note ?? ''}
                              canEdit={canEdit}
                              onClick={e => handleCellClick(member.userId, dateStr, 'pm', e)}
                              cellKey={pmKey}
                              hoveredCell={hoveredCell}
                              setHoveredCell={setHoveredCell}
                              setTooltipPos={setTooltipPos}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        {statuses.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {statuses.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{ background: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cell picker – floating */}
      {editingCell && cellPickerPos && (
        <div
          ref={cellPickerRef}
          className="fixed z-50 rounded-xl border shadow-xl p-3"
          style={{
            top: cellPickerPos.top,
            left: Math.min(cellPickerPos.left, window.innerWidth - 260),
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            width: 240,
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
            Vyberte stav – {editingCell.half === 'am' ? 'dopoledne' : 'odpoledne'} {editingCell.date}
          </p>
          <div className="flex flex-col gap-1 mb-3">
            {/* Vymazat */}
            <button
              onClick={() => setAvailability(null)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)] text-left transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="w-4 h-4 rounded-full border-2 border-dashed flex-shrink-0" style={{ borderColor: 'var(--border)' }} />
              Bez stavu
            </button>
            {statuses.map(s => (
              <button
                key={s.id}
                onClick={() => setAvailability(s.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)] text-left transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.name}
              </button>
            ))}
            {statuses.length === 0 && (
              <p className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>Nejsou definovány žádné stavy.{canAdmin ? ' Přidejte je výše.' : ''}</p>
            )}
          </div>
          {/* Poznámka */}
          <NoteInput
            initialNote={cells[`${editingCell.userId}|${editingCell.date}|${editingCell.half}`]?.note ?? ''}
            onSave={(note) => {
              const key: CellKey = `${editingCell.userId}|${editingCell.date}|${editingCell.half}`;
              const existing = cells[key];
              if (!existing) return; // Bez stavu nelze přidat poznámku
              setAvailability(existing.statusId, note);
            }}
          />
        </div>
      )}

      {/* Tooltip pro poznámku */}
      {hoveredCell && cells[hoveredCell]?.note && tooltipPos && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg text-xs shadow-lg pointer-events-none"
          style={{
            top: tooltipPos.top - 36,
            left: tooltipPos.left,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            maxWidth: 220,
          }}
        >
          {cells[hoveredCell]?.note}
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── CellHalf subkomponenta ────────────────────────────────────────────────

function CellHalf({
  label,
  statusColor,
  statusName,
  note,
  canEdit,
  onClick,
  cellKey,
  hoveredCell,
  setHoveredCell,
  setTooltipPos,
}: {
  label: string;
  statusColor: string | null;
  statusName: string | null;
  note: string;
  canEdit: boolean;
  onClick: (e: React.MouseEvent) => void;
  cellKey: CellKey;
  hoveredCell: CellKey | null;
  setHoveredCell: (k: CellKey | null) => void;
  setTooltipPos: (p: { top: number; left: number } | null) => void;
}) {
  const hasStatus = statusColor !== null;
  const hasNote = !!note;

  return (
    <div
      className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all select-none ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
      style={{
        background: hasStatus ? statusColor + '28' : 'var(--bg-hover)',
        color: hasStatus ? statusColor : 'var(--text-muted)',
        border: `1px solid ${hasStatus ? statusColor + '55' : 'transparent'}`,
        minHeight: 24,
      }}
      onClick={canEdit ? onClick : undefined}
      onMouseEnter={e => {
        if (hasNote) {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          setHoveredCell(cellKey);
          setTooltipPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
        }
      }}
      onMouseLeave={() => {
        setHoveredCell(null);
        setTooltipPos(null);
      }}
      title={statusName ?? label}
    >
      <span className="opacity-60 text-[9px] w-6 flex-shrink-0">{label}</span>
      {hasStatus && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: statusColor }}
        />
      )}
      {hasNote && (
        <span className="ml-auto opacity-50">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6h16M4 12h8M4 18h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </div>
  );
}

// ─── NoteInput subkomponenta ───────────────────────────────────────────────

function NoteInput({ initialNote, onSave }: { initialNote: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState(initialNote);
  return (
    <div className="mt-1">
      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka (zobrazí se při najetí)</p>
      <textarea
        rows={2}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Volitelná poznámka..."
        className="w-full px-2 py-1.5 rounded-lg text-xs border outline-none resize-none"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
      />
      <button
        onClick={() => onSave(note)}
        className="mt-1.5 w-full py-1 rounded-lg text-xs font-medium text-white transition-colors"
        style={{ background: 'var(--primary)' }}
      >
        Uložit poznámku
      </button>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────

function PlannerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <PlannerContent />
    </WorkspaceProvider>
  );
}

export default PlannerPage;
