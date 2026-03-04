'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { AvailabilityStatus, AvailabilityEntry, ImportantDay } from '@/types/database';
import { getWorkspaceToday } from '@/lib/utils';
import { getCzechHolidays, isCzechHoliday } from '@/lib/czech-calendar';

// ─── Helpers ───────────────────────────────────────────────────────────────

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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { weekday: 'short' });
}

// isToday je definována uvnitř komponenty (potřebuje workspace timezone)

// ─── Strip lanes (proužky přes více dní) ───────────────────────────────────

interface StripItem {
  id: string;
  title: string;
  color: string;
  startCol: number; // 0–6 v aktuálním týdnu
  endCol: number;   // 0–6 v aktuálním týdnu
}

function packStripLanes(strips: StripItem[]): StripItem[][] {
  const lanes: StripItem[][] = [];
  const sorted = [...strips].sort((a, b) => a.startCol - b.startCol);
  for (const strip of sorted) {
    let placed = false;
    for (const lane of lanes) {
      if (lane[lane.length - 1].endCol < strip.startCol) {
        lane.push(strip);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([strip]);
  }
  return lanes;
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface MemberRow {
  userId: string;
  displayName: string;
  avatarColor: string;
  isPinned: boolean;
  isSelf: boolean;
}

type Half = 'am' | 'pm' | 'full';
type CellKey = string; // `${userId}|${dateStr}|${half}`
type DayKey = string;  // `${userId}|${dateStr}`

interface CellData {
  statusId: string | null;
  note: string;
}

// ─── Icons ─────────────────────────────────────────────────────────────────

/** Ikona rozdělení – dvě horizontální čáry */
function IconSplit() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="1" y1="4" x2="11" y2="4" />
      <line x1="1" y1="8" x2="11" y2="8" />
    </svg>
  );
}

/** Ikona sloučení – šipky sbíhající se k čáře */
function IconMerge() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,2 6,5 9,2" />
      <line x1="6" y1="5" x2="6" y2="7" />
      <polyline points="3,10 6,7 9,10" />
    </svg>
  );
}

// ─── Full-day cell ─────────────────────────────────────────────────────────

function CellFull({
  status,
  note,
  canEdit,
  onClick,
  cellKey,
  hoveredCell,
  setHoveredCell,
  setTooltipPos,
}: {
  status: AvailabilityStatus | null;
  note: string;
  canEdit: boolean;
  onClick: (e: React.MouseEvent) => void;
  cellKey: CellKey;
  hoveredCell: CellKey | null;
  setHoveredCell: (k: CellKey | null) => void;
  setTooltipPos: (p: { top: number; left: number } | null) => void;
}) {
  const hasStatus = status !== null;
  const hasNote = !!note;
  void hoveredCell; // používá se v rodiči pro tooltip

  return (
    <div
      className={`flex items-center gap-2 px-2 rounded-lg text-xs font-medium transition-all select-none ${canEdit ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
      style={{
        background: hasStatus ? status!.color + '2a' : 'var(--bg-hover)',
        color: hasStatus ? status!.color : 'var(--text-muted)',
        border: `1px solid ${hasStatus ? status!.color + '60' : 'transparent'}`,
        minHeight: 52,
      }}
      onClick={canEdit ? onClick : undefined}
      onMouseEnter={e => {
        if (hasNote) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setHoveredCell(cellKey);
          setTooltipPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
        }
      }}
      onMouseLeave={() => { setHoveredCell(null); setTooltipPos(null); }}
    >
      {hasStatus && (
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: status!.color }} />
      )}
      <span className="truncate leading-tight text-[11px]">
        {hasStatus ? status!.name : ''}
      </span>
      {hasNote && (
        <span className="ml-auto flex-shrink-0 opacity-80">
          <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M4 6h16M4 12h8M4 18h12" />
          </svg>
        </span>
      )}
    </div>
  );
}

// ─── Half-day cell (DOP / ODP) ─────────────────────────────────────────────

function CellHalf({
  label,
  status,
  note,
  canEdit,
  onClick,
  cellKey,
  hoveredCell,
  setHoveredCell,
  setTooltipPos,
}: {
  label: string;
  status: AvailabilityStatus | null;
  note: string;
  canEdit: boolean;
  onClick: (e: React.MouseEvent) => void;
  cellKey: CellKey;
  hoveredCell: CellKey | null;
  setHoveredCell: (k: CellKey | null) => void;
  setTooltipPos: (p: { top: number; left: number } | null) => void;
}) {
  const hasStatus = status !== null;
  const hasNote = !!note;
  void hoveredCell;

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all select-none ${canEdit ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
      style={{
        background: hasStatus ? status!.color + '2a' : 'var(--bg-hover)',
        color: hasStatus ? status!.color : 'var(--text-muted)',
        border: `1px solid ${hasStatus ? status!.color + '60' : 'transparent'}`,
        minHeight: 24,
      }}
      onClick={canEdit ? onClick : undefined}
      onMouseEnter={e => {
        if (hasNote) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setHoveredCell(cellKey);
          setTooltipPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
        }
      }}
      onMouseLeave={() => { setHoveredCell(null); setTooltipPos(null); }}
    >
      <span className="opacity-55 text-[9px] w-6 flex-shrink-0">{label}</span>
      {hasStatus && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: status!.color }} />}
      {hasNote && (
        <span className="ml-auto opacity-80">
          <svg width="10" height="10" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M4 6h16M4 12h8M4 18h12" />
          </svg>
        </span>
      )}
    </div>
  );
}

// ─── NoteInput ─────────────────────────────────────────────────────────────

function NoteInput({ initialNote, onSave }: { initialNote: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState(initialNote);
  return (
    <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka (zobrazí se při najetí myší)</p>
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

// ─── Main content ──────────────────────────────────────────────────────────

function PlannerContent() {
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
  const [editingCell, setEditingCell] = useState<{ userId: string; date: string; half: Half } | null>(null);
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

  // Helper: vrátí záznamy důležitých dnů pro konkrétní datum
  function getImportantDaysForDate(date: Date): ImportantDay[] {
    const dateStr = toDateStr(date);
    return importantDays.filter(entry => {
      if (!entry.is_recurring || entry.recurring_type === 'none') {
        return dateStr >= entry.start_date && dateStr <= entry.end_date;
      }
      const startD = new Date(entry.start_date + 'T12:00:00');
      switch (entry.recurring_type) {
        case 'weekly':  return date.getDay() === startD.getDay();
        case 'monthly': return date.getDate() === startD.getDate();
        case 'yearly':  return date.getMonth() === startD.getMonth() && date.getDate() === startD.getDate();
        default:        return false;
      }
    });
  }

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

  const handleCellClick = (userId: string, date: string, half: Half, e: React.MouseEvent) => {
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

  // ── Render ────────────────────────────────────────────────────────────────

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
          {canAdmin && (
            <button
              onClick={() => setShowStatusManager(v => !v)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: showStatusManager ? 'var(--primary)' : 'var(--bg-hover)',
                color: showStatusManager ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              Spravovat stavy
            </button>
          )}
        </div>

        {/* Správa stavů */}
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
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  {s.name}
                  <button
                    className="ml-1 opacity-60 hover:opacity-100"
                    onClick={() => { setEditingStatus(s); setNewStatusName(s.name); setNewStatusColor(s.color); }}
                    title="Upravit"
                  >✎</button>
                  <button
                    className="opacity-60 hover:opacity-100 text-red-500"
                    onClick={() => deleteStatus(s.id)}
                    title="Smazat"
                  >×</button>
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
                onKeyDown={e => { if (e.key === 'Enter') saveStatus(); }}
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
                >Zrušit</button>
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
          >‹</button>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatDateShort(weekStart)} – {formatDateShort(addDays(weekStart, 6))} {weekStart.getFullYear()}
          </span>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >›</button>
          <button
            onClick={() => setWeekStart(getMonday(new Date(workspaceTodayStr + 'T12:00:00')))}
            className="px-3 py-1 rounded-lg text-xs border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >Dnes</button>
        </div>

        {/* Tabulka */}
        <div className="rounded-2xl border overflow-x-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              {(() => {
                // ── Sestavení proužků ────────────────────────────────────
                const strips: StripItem[] = [];

                // Státní svátky (jednodenvní proužky)
                weekDays.forEach((day, colIdx) => {
                  const h = isCzechHoliday(day, weekHolidays);
                  if (h.isHoliday) {
                    strips.push({ id: `holiday-${colIdx}`, title: '🎉 ' + h.name, color: '#ef4444', startCol: colIdx, endCol: colIdx });
                  }
                });

                // Důležité dny (mohou přesahovat přes více dní týdne)
                const processed = new Set<string>();
                importantDays.forEach(imp => {
                  if (processed.has(imp.id)) return;
                  const matchingCols = weekDays
                    .map((d, i) => (getImportantDaysForDate(d).some(x => x.id === imp.id) ? i : -1))
                    .filter(i => i >= 0);
                  if (!matchingCols.length) return;
                  processed.add(imp.id);
                  // Skupiny po sobě jdoucích sloupců → samostatné proužky
                  let spanStart = matchingCols[0];
                  let prev = matchingCols[0];
                  for (let i = 1; i <= matchingCols.length; i++) {
                    const col = i < matchingCols.length ? matchingCols[i] : -1;
                    if (col !== prev + 1) {
                      strips.push({ id: `${imp.id}-${spanStart}`, title: imp.title, color: imp.color, startCol: spanStart, endCol: prev });
                      spanStart = col;
                    }
                    prev = col;
                  }
                });

                const stripLanes = packStripLanes(strips);

                return (
                  <>
                    {/* Řádky proužků (nad záhlavím dnů) */}
                    {stripLanes.map((lane, laneIdx) => {
                      const cells: React.ReactNode[] = [];
                      let col = 0;
                      for (const strip of lane) {
                        if (strip.startCol > col) {
                          cells.push(
                            <th key={`gap-${laneIdx}-${col}`} colSpan={strip.startCol - col}
                              style={{ padding: '2px 0', background: 'var(--bg-card)' }} />
                          );
                        }
                        const span = strip.endCol - strip.startCol + 1;
                        cells.push(
                          <th key={strip.id} colSpan={span}
                            style={{ padding: '2px 3px', background: 'var(--bg-card)' }}>
                            <div
                              title={strip.title}
                              style={{
                                background: strip.color + '22',
                                color: strip.color,
                                borderRadius: 5,
                                padding: '2px 7px',
                                fontSize: 10,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textAlign: 'left',
                                lineHeight: '1.4',
                              }}
                            >
                              {strip.title}
                            </div>
                          </th>
                        );
                        col = strip.endCol + 1;
                      }
                      if (col < 7) {
                        cells.push(
                          <th key={`gap-end-${laneIdx}`} colSpan={7 - col}
                            style={{ padding: '2px 0', background: 'var(--bg-card)' }} />
                        );
                      }
                      return (
                        <tr key={`strip-lane-${laneIdx}`}>
                          <th style={{ width: 160, background: 'var(--bg-card)', padding: '2px 0' }} />
                          {cells}
                        </tr>
                      );
                    })}

                    {/* Záhlaví dnů */}
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th
                        className="text-left px-4 py-2.5 text-xs font-semibold"
                        style={{ color: 'var(--text-muted)', width: 160, background: 'var(--bg-card)' }}
                      >
                        Člen
                      </th>
                      {weekDays.map(day => (
                        <th
                          key={toDateStr(day)}
                          className="px-1 py-2 text-center text-xs font-semibold"
                          style={{
                            color: isToday(day) ? 'var(--primary)' : 'var(--text-muted)',
                            background: isToday(day)
                              ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                              : 'var(--bg-card)',
                            minWidth: 110,
                          }}
                        >
                          <div>{formatDayName(day)}</div>
                          <div className="font-normal mt-0.5">{formatDateShort(day)}</div>
                        </th>
                      ))}
                    </tr>
                  </>
                );
              })()}
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
                const canEdit = member.userId === user?.id || canAdmin ||
                  (isManager && managerAssignments.some(a => a.member_user_id === member.userId));

                return (
                  <tr
                    key={member.userId}
                    style={{ borderBottom: rowIdx < members.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    {/* Jméno */}
                    <td className="px-3 py-2" style={{ background: 'var(--bg-card)', verticalAlign: 'middle' }}>
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
                            <svg width="13" height="13" viewBox="0 0 24 24"
                              fill={member.isPinned ? 'currentColor' : 'none'}
                              stroke="currentColor" strokeWidth="2"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Buňky dní */}
                    {weekDays.map(day => {
                      const dateStr = toDateStr(day);
                      const dayKey: DayKey = `${member.userId}|${dateStr}`;
                      const isSplit = splitDays.has(dayKey);
                      const isTodayCol = isToday(day);

                      const amKey: CellKey = `${member.userId}|${dateStr}|am`;
                      const pmKey: CellKey = `${member.userId}|${dateStr}|pm`;
                      const fullKey: CellKey = `${member.userId}|${dateStr}|full`;

                      const amCell = cells[amKey];
                      const pmCell = cells[pmKey];
                      const fullCell = cells[fullKey];

                      const amStatus = amCell?.statusId
                        ? statuses.find(s => s.id === amCell.statusId) ?? null : null;
                      const pmStatus = pmCell?.statusId
                        ? statuses.find(s => s.id === pmCell.statusId) ?? null : null;
                      const fullStatus = fullCell?.statusId
                        ? statuses.find(s => s.id === fullCell.statusId) ?? null : null;

                      return (
                        <td
                          key={dateStr}
                          className="px-1.5 py-1.5"
                          style={{
                            background: isTodayCol
                              ? 'color-mix(in srgb, var(--primary) 5%, transparent)'
                              : 'transparent',
                            verticalAlign: 'middle',
                          }}
                        >
                          {/*
                           * Relativní kontejner pro overlay tlačítka (split/merge).
                           * group: aktivuje group-hover třídy na child elementech.
                           */}
                          <div className="relative group">
                            {isSplit ? (
                              /* ── Rozdělený režim (DOP + ODP) ── */
                              <>
                                <div className="flex flex-col gap-0.5">
                                  <CellHalf
                                    label="DOP"
                                    status={amStatus}
                                    note={amCell?.note ?? ''}
                                    canEdit={canEdit}
                                    onClick={e => handleCellClick(member.userId, dateStr, 'am', e)}
                                    cellKey={amKey}
                                    hoveredCell={hoveredCell}
                                    setHoveredCell={setHoveredCell}
                                    setTooltipPos={setTooltipPos}
                                  />
                                  <CellHalf
                                    label="ODP"
                                    status={pmStatus}
                                    note={pmCell?.note ?? ''}
                                    canEdit={canEdit}
                                    onClick={e => handleCellClick(member.userId, dateStr, 'pm', e)}
                                    cellKey={pmKey}
                                    hoveredCell={hoveredCell}
                                    setHoveredCell={setHoveredCell}
                                    setTooltipPos={setTooltipPos}
                                  />
                                </div>
                                {/* Tlačítko sloučení – pravý horní roh, viditelné na hover */}
                                {canEdit && (
                                  <button
                                    className="absolute top-0 right-0 p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                                    onClick={e => { e.stopPropagation(); handleMerge(member.userId, dateStr); }}
                                    title="Sloučit na celý den"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    <IconMerge />
                                  </button>
                                )}
                              </>
                            ) : (
                              /* ── Celý den (výchozí) ── */
                              <>
                                <CellFull
                                  status={fullStatus}
                                  note={fullCell?.note ?? ''}
                                  canEdit={canEdit}
                                  onClick={e => handleCellClick(member.userId, dateStr, 'full', e)}
                                  cellKey={fullKey}
                                  hoveredCell={hoveredCell}
                                  setHoveredCell={setHoveredCell}
                                  setTooltipPos={setTooltipPos}
                                />
                                {/* Tlačítko rozdělení – pravý horní roh, viditelné na hover */}
                                {canEdit && (
                                  <button
                                    className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                                    onClick={e => { e.stopPropagation(); handleExpand(member.userId, dateStr); }}
                                    title="Rozdělit na DOP / ODP"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    <IconSplit />
                                  </button>
                                )}
                              </>
                            )}
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

        {/* Legenda stavů */}
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

      {/* Picker stavů – floating */}
      {editingCell && cellPickerPos && (
        <div
          ref={cellPickerRef}
          className="fixed z-50 rounded-xl border shadow-xl p-3"
          style={{
            top: cellPickerPos.top,
            left: Math.min(cellPickerPos.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260),
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            width: 244,
          }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
            {editingCell.half === 'full'
              ? `Celý den — ${editingCell.date}`
              : `${editingCell.half === 'am' ? 'Dopoledne' : 'Odpoledne'} — ${editingCell.date}`}
          </p>

          <div className="flex flex-col gap-1 mb-1">
            {/* Vymazat stav */}
            <button
              onClick={() => setAvailability(null)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)] text-left transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <span
                className="w-4 h-4 rounded-full border-2 border-dashed flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
              />
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
              <p className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>
                Nejsou definovány žádné stavy.{canAdmin ? ' Přidejte je výše.' : ''}
              </p>
            )}
          </div>

          {/* Poznámka (jen pokud je buňka vyplněna) */}
          {cells[`${editingCell.userId}|${editingCell.date}|${editingCell.half}`]?.statusId && (
            <NoteInput
              initialNote={cells[`${editingCell.userId}|${editingCell.date}|${editingCell.half}`]?.note ?? ''}
              onSave={(note) => {
                const key: CellKey = `${editingCell.userId}|${editingCell.date}|${editingCell.half}`;
                const existing = cells[key];
                if (!existing) return;
                setAvailability(existing.statusId, note);
              }}
            />
          )}
        </div>
      )}

      {/* Tooltip pro poznámku */}
      {hoveredCell && cells[hoveredCell]?.note && tooltipPos && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg text-xs shadow-lg pointer-events-none"
          style={{
            top: tooltipPos.top - 40,
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

// ─── Page wrapper ──────────────────────────────────────────────────────────

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
