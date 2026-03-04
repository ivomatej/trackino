'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import type { Calendar, CalendarEvent, VacationEntry, ImportantDay } from '@/types/database';

// ─── Local Types ─────────────────────────────────────────────────────────────

interface DisplayEvent {
  id: string;
  title: string;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  color: string;
  source: 'manual' | 'vacation' | 'important_day';
  source_id: string;
  calendar_id?: string;
  description?: string;
  is_all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

type ViewType = 'list' | 'week' | 'month';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str: string): Date {
  return new Date(str + 'T00:00:00');
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  const endStr = end.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

const DAY_NAMES_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

// Vrátí všechny výskyty opakujícího se Důležitého dne v daném rozsahu
function getImportantDayOccurrences(
  day: ImportantDay,
  rangeStart: Date,
  rangeEnd: Date
): { start: string; end: string }[] {
  const result: { start: string; end: string }[] = [];
  const origStart = parseDate(day.start_date);
  const origEnd = parseDate(day.end_date);
  const durationDays = Math.round((origEnd.getTime() - origStart.getTime()) / 86400000);

  if (!day.is_recurring || day.recurring_type === 'none') {
    if (origStart <= rangeEnd && origEnd >= rangeStart) {
      result.push({ start: day.start_date, end: day.end_date });
    }
    return result;
  }

  const cur = new Date(rangeStart);
  let safetyCounter = 0;
  while (cur <= rangeEnd && safetyCounter < 1000) {
    safetyCounter++;
    let matches = false;
    if (day.recurring_type === 'yearly') {
      matches = origStart.getMonth() === cur.getMonth() && origStart.getDate() === cur.getDate();
    } else if (day.recurring_type === 'monthly') {
      matches = origStart.getDate() === cur.getDate();
    } else if (day.recurring_type === 'weekly') {
      matches = origStart.getDay() === cur.getDay();
    }

    if (matches) {
      const occEnd = addDays(cur, durationDays);
      result.push({ start: toDateStr(cur), end: toDateStr(occEnd) });
      if (day.recurring_type === 'yearly') {
        cur.setFullYear(cur.getFullYear() + 1);
      } else if (day.recurring_type === 'monthly') {
        cur.setMonth(cur.getMonth() + 1);
      } else {
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      cur.setDate(cur.getDate() + 1);
    }
  }

  return result;
}

// Zjistí, zda událost zasahuje do daného dne
function eventOnDay(ev: DisplayEvent, day: Date): boolean {
  const start = parseDate(ev.start_date);
  const end = parseDate(ev.end_date);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

function sourceBadgeLabel(source: DisplayEvent['source']): string {
  if (source === 'vacation') return 'Dovolená';
  if (source === 'important_day') return 'Důležitý den';
  return '';
}

// ─── Vnitřní komponenta (přístup k WorkspaceContext) ─────────────────────────

function CalendarContent() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [vacationEntries, setVacationEntries] = useState<VacationEntry[]>([]);
  const [importantDays, setImportantDays] = useState<ImportantDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());

  // Formulář události
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_all_day: true,
    start_time: '',
    end_time: '',
    color: '',
    calendar_id: '',
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Formulář kalendáře
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [calendarForm, setCalendarForm] = useState({ name: '', color: '#3b82f6' });
  const [savingCalendar, setSavingCalendar] = useState(false);

  // Příznak pro inicializaci výběru kalendářů
  const initializedRef = useRef(false);

  // ── Načtení dat ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);
    try {
      // Moje kalendáře
      const { data: cals } = await supabase
        .from('trackino_calendars')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_user_id', user.id)
        .order('created_at');

      let calList = (cals ?? []) as Calendar[];

      // Automaticky vytvoř výchozí kalendář při prvním přístupu
      if (calList.length === 0) {
        const { data: newCal } = await supabase
          .from('trackino_calendars')
          .insert({
            workspace_id: currentWorkspace.id,
            owner_user_id: user.id,
            name: 'Můj kalendář',
            color: '#3b82f6',
            is_default: true,
          })
          .select()
          .single();
        if (newCal) calList = [newCal as Calendar];
      }

      setCalendars(calList);

      // Inicializuj výběr jen poprvé – při dalším načtení přidej nové, nemazej existující výběr
      if (!initializedRef.current) {
        initializedRef.current = true;
        setSelectedCalendarIds(new Set(calList.map(c => c.id)));
      } else {
        setSelectedCalendarIds(prev => {
          const next = new Set(prev);
          for (const c of calList) next.add(c.id);
          return next;
        });
      }

      // Události z mých kalendářů
      if (calList.length > 0) {
        const calIds = calList.map(c => c.id);
        const { data: evs } = await supabase
          .from('trackino_calendar_events')
          .select('*')
          .in('calendar_id', calIds)
          .order('start_date');
        setEvents((evs ?? []) as CalendarEvent[]);
      } else {
        setEvents([]);
      }

      // Schválená dovolená
      const { data: vacs } = await supabase
        .from('trackino_vacation_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('status', 'approved');
      setVacationEntries((vacs ?? []) as VacationEntry[]);

      // Důležité dny
      const { data: days } = await supabase
        .from('trackino_important_days')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .order('start_date');
      setImportantDays((days ?? []) as ImportantDay[]);
    } finally {
      setLoading(false);
    }
  }, [user, currentWorkspace]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── CRUD – Události ───────────────────────────────────────────────────────

  function openNewEvent(date?: string) {
    const d = date ?? toDateStr(currentDate);
    setEditingEvent(null);
    const defaultCalId = calendars.find(c => c.is_default)?.id ?? calendars[0]?.id ?? '';
    setEventForm({
      title: '',
      description: '',
      start_date: d,
      end_date: d,
      is_all_day: true,
      start_time: '',
      end_time: '',
      color: '',
      calendar_id: defaultCalId,
    });
    setShowEventForm(true);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      description: ev.description,
      start_date: ev.start_date,
      end_date: ev.end_date,
      is_all_day: ev.is_all_day,
      start_time: ev.start_time ?? '',
      end_time: ev.end_time ?? '',
      color: ev.color ?? '',
      calendar_id: ev.calendar_id,
    });
    setShowEventForm(true);
  }

  async function saveEvent() {
    if (!user || !currentWorkspace || !eventForm.title.trim() || !eventForm.start_date || !eventForm.calendar_id) return;
    setSavingEvent(true);
    try {
      const payload = {
        calendar_id: eventForm.calendar_id,
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        title: eventForm.title.trim(),
        description: eventForm.description,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || eventForm.start_date,
        is_all_day: eventForm.is_all_day,
        start_time: eventForm.is_all_day ? null : (eventForm.start_time || null),
        end_time: eventForm.is_all_day ? null : (eventForm.end_time || null),
        color: eventForm.color || null,
        source: 'manual' as const,
        source_id: null,
      };
      if (editingEvent) {
        await supabase.from('trackino_calendar_events').update(payload).eq('id', editingEvent.id);
      } else {
        await supabase.from('trackino_calendar_events').insert(payload);
      }
      setShowEventForm(false);
      await fetchData();
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(id: string) {
    setDeletingEventId(id);
    await supabase.from('trackino_calendar_events').delete().eq('id', id);
    setDeletingEventId(null);
    setShowEventForm(false);
    await fetchData();
  }

  // ── CRUD – Kalendáře ──────────────────────────────────────────────────────

  function openNewCalendar() {
    setEditingCalendar(null);
    const nextColor = DEFAULT_COLORS[calendars.length % DEFAULT_COLORS.length];
    setCalendarForm({ name: '', color: nextColor });
    setShowCalendarForm(true);
  }

  function openEditCalendar(cal: Calendar) {
    setEditingCalendar(cal);
    setCalendarForm({ name: cal.name, color: cal.color });
    setShowCalendarForm(true);
  }

  async function saveCalendar() {
    if (!user || !currentWorkspace || !calendarForm.name.trim()) return;
    setSavingCalendar(true);
    try {
      if (editingCalendar) {
        await supabase
          .from('trackino_calendars')
          .update({ name: calendarForm.name.trim(), color: calendarForm.color })
          .eq('id', editingCalendar.id);
      } else {
        await supabase.from('trackino_calendars').insert({
          workspace_id: currentWorkspace.id,
          owner_user_id: user.id,
          name: calendarForm.name.trim(),
          color: calendarForm.color,
          is_default: false,
        });
      }
      setShowCalendarForm(false);
      await fetchData();
    } finally {
      setSavingCalendar(false);
    }
  }

  async function deleteCalendar(id: string) {
    await supabase.from('trackino_calendars').delete().eq('id', id);
    setSelectedCalendarIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    await fetchData();
  }

  // ── Navigace ──────────────────────────────────────────────────────────────

  function goToday() { setCurrentDate(new Date()); }

  function goPrev() {
    setCurrentDate(d => {
      const n = new Date(d);
      if (view === 'week') n.setDate(n.getDate() - 7);
      else n.setMonth(n.getMonth() - 1);
      return n;
    });
  }

  function goNext() {
    setCurrentDate(d => {
      const n = new Date(d);
      if (view === 'week') n.setDate(n.getDate() + 7);
      else n.setMonth(n.getMonth() + 1);
      return n;
    });
  }

  // ── Rozsah pro opakující se záznamy ──────────────────────────────────────

  const visibleRange = useMemo(() => {
    if (view === 'week') {
      const start = getMonday(currentDate);
      return { start, end: addDays(start, 6) };
    } else if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start: addDays(getMonday(start), -7), end: addDays(end, 14) };
    } else {
      // list – 6 měsíců dopředu od začátku aktuálního měsíce
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 6, 0);
      return { start, end };
    }
  }, [view, currentDate]);

  // ── DisplayEvents ─────────────────────────────────────────────────────────

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const result: DisplayEvent[] = [];

    // Ruční události (filtrovány podle vybraných kalendářů)
    for (const ev of events) {
      if (!selectedCalendarIds.has(ev.calendar_id)) continue;
      const cal = calendars.find(c => c.id === ev.calendar_id);
      result.push({
        id: ev.id,
        title: ev.title,
        start_date: ev.start_date,
        end_date: ev.end_date,
        color: ev.color ?? cal?.color ?? '#3b82f6',
        source: 'manual',
        source_id: ev.id,
        calendar_id: ev.calendar_id,
        description: ev.description,
        is_all_day: ev.is_all_day,
        start_time: ev.start_time,
        end_time: ev.end_time,
      });
    }

    // Schválená dovolená
    for (const v of vacationEntries) {
      result.push({
        id: `vacation-${v.id}`,
        title: 'Dovolená',
        start_date: v.start_date,
        end_date: v.end_date,
        color: '#0ea5e9',
        source: 'vacation',
        source_id: v.id,
        description: v.note || '',
        is_all_day: true,
      });
    }

    // Důležité dny (s opakováním)
    for (const day of importantDays) {
      const occs = getImportantDayOccurrences(day, visibleRange.start, visibleRange.end);
      for (const occ of occs) {
        result.push({
          id: `importantday-${day.id}-${occ.start}`,
          title: day.title,
          start_date: occ.start,
          end_date: occ.end,
          color: day.color,
          source: 'important_day',
          source_id: day.id,
          description: day.note || '',
          is_all_day: true,
        });
      }
    }

    return result.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
  }, [events, vacationEntries, importantDays, calendars, selectedCalendarIds, visibleRange]);

  // ── Mřížka měsíce ─────────────────────────────────────────────────────────

  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const gridStart = getMonday(firstDay);
    let gridEnd = addDays(getMonday(lastDay), 6);
    if (gridEnd < lastDay) gridEnd = addDays(gridEnd, 7);

    const weeks: Date[][] = [];
    let cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur));
        cur = addDays(cur, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [currentDate]);

  function eventsOnDay(day: Date): DisplayEvent[] {
    return displayEvents.filter(ev => eventOnDay(ev, day));
  }

  // ── Skupiny pro List view ─────────────────────────────────────────────────

  const listGroups = useMemo(() => {
    const { start, end } = visibleRange;
    const filtered = displayEvents.filter(ev => {
      const evStart = parseDate(ev.start_date);
      const evEnd = parseDate(ev.end_date);
      return evStart <= end && evEnd >= start;
    });

    const groups = new Map<string, DisplayEvent[]>();
    for (const ev of filtered) {
      const d = parseDate(ev.start_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, evs]) => {
        const [y, m] = key.split('-');
        return {
          key,
          label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
          events: evs,
        };
      });
  }, [displayEvents, visibleRange]);

  // ── Popis rozsahu dat ─────────────────────────────────────────────────────

  const dateRangeLabel = useMemo(() => {
    if (view === 'week') {
      const monday = getMonday(currentDate);
      const sunday = addDays(monday, 6);
      return formatWeekRange(monday, sunday);
    }
    return formatMonthYear(currentDate);
  }, [view, currentDate]);

  // ── Event pill – kompaktní zobrazení události ─────────────────────────────

  function EventPill({ ev, compact = false }: { ev: DisplayEvent; compact?: boolean }) {
    const isClickable = ev.source === 'manual';
    return (
      <div
        onClick={e => {
          e.stopPropagation();
          if (isClickable) {
            const original = events.find(x => x.id === ev.source_id);
            if (original) openEditEvent(original);
          }
        }}
        className={`${compact ? 'px-1 text-[10px] leading-[14px]' : 'px-1.5 py-0.5 text-xs'} rounded font-medium truncate`}
        style={{
          background: ev.color + '22',
          color: ev.color,
          border: `1px solid ${ev.color}44`,
          cursor: isClickable ? 'pointer' : 'default',
        }}
        title={ev.title}
      >
        {!ev.is_all_day && ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ''}
        {ev.title}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!currentWorkspace) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
    <div className="h-full flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Záhlaví ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Kalendář</h1>

        {/* Přepínač pohledu */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {(['list', 'week', 'month'] as ViewType[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: view === v ? 'var(--primary)' : 'var(--bg-card)',
                color: view === v ? 'white' : 'var(--text-secondary)',
              }}
            >
              {v === 'list' ? 'Liste' : v === 'week' ? 'Týden' : 'Měsíc'}
            </button>
          ))}
        </div>

        {/* Navigace */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
          >
            Dnes
          </button>
          <button
            onClick={goNext}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <span className="text-base font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
          {dateRangeLabel}
        </span>

        <div className="flex-1" />

        <button
          onClick={() => openNewEvent()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--primary)' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Přidat událost
        </button>
      </div>

      {/* ── Hlavní obsah ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Levý panel – Moje kalendáře ──────────────────────────────── */}
        <div
          className="w-52 flex-shrink-0 border-r overflow-y-auto px-4 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Moje kalendáře */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                MÉ KALENDÁŘE
              </span>
              <button
                onClick={openNewCalendar}
                className="p-0.5 rounded transition-colors"
                title="Přidat kalendář"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {calendars.map(cal => (
              <div key={cal.id} className="flex items-center gap-2 py-1 group/cal">
                <input
                  type="checkbox"
                  checked={selectedCalendarIds.has(cal.id)}
                  onChange={e => {
                    setSelectedCalendarIds(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(cal.id);
                      else next.delete(cal.id);
                      return next;
                    });
                  }}
                  className="w-3.5 h-3.5 rounded cursor-pointer"
                  style={{ accentColor: cal.color }}
                />
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: cal.color }}
                />
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {cal.name}
                </span>
                <button
                  onClick={() => openEditCalendar(cal)}
                  className="opacity-0 group-hover/cal:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  title="Upravit"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Automatické zdroje */}
          <div>
            <div className="mb-2">
              <span className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                AUTOMATICKY
              </span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#0ea5e9' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dovolená</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Důležité dny</span>
            </div>
          </div>
        </div>

        {/* ── Zobrazení kalendáře ───────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div
                className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : (
            <>

              {/* ══ MĚSÍČNÍ POHLED ═══════════════════════════════════════════ */}
              {view === 'month' && (
                <div className="min-w-[560px]">
                  {/* Záhlaví dnů */}
                  <div className="grid grid-cols-7 mb-1">
                    {DAY_NAMES_SHORT.map(d => (
                      <div
                        key={d}
                        className="text-center text-xs font-semibold py-1"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Týdny */}
                  <div
                    className="border rounded-xl overflow-hidden"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {monthGrid.map((week, wi) => (
                      <div
                        key={wi}
                        className={`grid grid-cols-7 ${wi < monthGrid.length - 1 ? 'border-b' : ''}`}
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {week.map((day, di) => {
                          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                          const isToday = isSameDay(day, today);
                          const dayEvs = eventsOnDay(day);
                          return (
                            <div
                              key={di}
                              onClick={() => openNewEvent(toDateStr(day))}
                              className="min-h-[90px] p-1.5 cursor-pointer border-r last:border-r-0 transition-colors"
                              style={{
                                borderColor: 'var(--border)',
                                background: !isCurrentMonth
                                  ? 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)'
                                  : 'var(--bg-card)',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                              onMouseLeave={e => (
                                e.currentTarget.style.background = !isCurrentMonth
                                  ? 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)'
                                  : 'var(--bg-card)'
                              )}
                            >
                              <div
                                className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1"
                                style={{
                                  background: isToday ? 'var(--primary)' : 'transparent',
                                  color: isToday ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}
                              >
                                {day.getDate()}
                              </div>
                              <div className="space-y-0.5">
                                {dayEvs.slice(0, 3).map(ev => (
                                  <EventPill key={ev.id} ev={ev} compact />
                                ))}
                                {dayEvs.length > 3 && (
                                  <div
                                    className="text-[10px] px-1"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    +{dayEvs.length - 3} další
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ══ TÝDENNÍ POHLED ════════════════════════════════════════════ */}
              {view === 'week' && (
                <div className="min-w-[500px]">
                  {/* Záhlaví dnů */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day, i) => {
                      const isToday = isSameDay(day, today);
                      return (
                        <div key={i} className="text-center">
                          <div
                            className="text-xs font-medium mb-1"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {DAY_NAMES_SHORT[i]}
                          </div>
                          <div
                            className="w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-semibold"
                            style={{
                              background: isToday ? 'var(--primary)' : 'transparent',
                              color: isToday ? 'white' : 'var(--text-primary)',
                            }}
                          >
                            {day.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Sloupce dnů */}
                  <div
                    className="grid grid-cols-7 gap-1 border rounded-xl p-2"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                  >
                    {weekDays.map((day, i) => {
                      const dayEvs = eventsOnDay(day);
                      const isToday = isSameDay(day, today);
                      return (
                        <div
                          key={i}
                          onClick={() => openNewEvent(toDateStr(day))}
                          className="min-h-[200px] rounded-lg p-1.5 cursor-pointer transition-colors space-y-0.5"
                          style={{
                            background: isToday
                              ? 'color-mix(in srgb, var(--primary) 6%, transparent)'
                              : 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (
                            e.currentTarget.style.background = isToday
                              ? 'color-mix(in srgb, var(--primary) 6%, transparent)'
                              : 'transparent'
                          )}
                        >
                          {dayEvs.map(ev => (
                            <EventPill key={ev.id} ev={ev} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ══ LISTOVÝ POHLED ════════════════════════════════════════════ */}
              {view === 'list' && (
                <div className="max-w-2xl">
                  {listGroups.length === 0 ? (
                    <div className="text-center py-16">
                      <div
                        className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--bg-hover)' }}
                      >
                        <svg
                          width="26" height="26" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                        Žádné události v tomto období
                      </p>
                      <button
                        onClick={() => openNewEvent()}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                        style={{ background: 'var(--primary)' }}
                      >
                        Přidat první událost
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {listGroups.map(group => (
                        <div key={group.key}>
                          <h3
                            className="text-sm font-semibold capitalize mb-2 pb-1 border-b"
                            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                          >
                            {group.label}
                          </h3>
                          <div className="space-y-2">
                            {group.events.map(ev => {
                              const evStart = parseDate(ev.start_date);
                              const evEnd = parseDate(ev.end_date);
                              const multiDay = ev.start_date !== ev.end_date;
                              const isClickable = ev.source === 'manual';
                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => {
                                    if (isClickable) {
                                      const orig = events.find(x => x.id === ev.source_id);
                                      if (orig) openEditEvent(orig);
                                    }
                                  }}
                                  className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                                  style={{
                                    borderColor: 'var(--border)',
                                    background: 'var(--bg-card)',
                                    cursor: isClickable ? 'pointer' : 'default',
                                  }}
                                  onMouseEnter={e => {
                                    if (isClickable) e.currentTarget.style.background = 'var(--bg-hover)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--bg-card)';
                                  }}
                                >
                                  {/* Barevný proužek */}
                                  <div
                                    className="w-1 self-stretch rounded-full flex-shrink-0"
                                    style={{ background: ev.color }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className="font-medium text-sm"
                                        style={{ color: 'var(--text-primary)' }}
                                      >
                                        {ev.title}
                                      </span>
                                      {ev.source !== 'manual' && (
                                        <span
                                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                          style={{ background: ev.color + '22', color: ev.color }}
                                        >
                                          {sourceBadgeLabel(ev.source)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                      {multiDay
                                        ? `${evStart.toLocaleDateString('cs-CZ')} – ${evEnd.toLocaleDateString('cs-CZ')}`
                                        : evStart.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
                                      }
                                      {!ev.is_all_day && ev.start_time
                                        ? ` · ${ev.start_time.slice(0, 5)}${ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ''}`
                                        : ''}
                                    </div>
                                    {ev.description && (
                                      <div
                                        className="text-xs mt-1 truncate"
                                        style={{ color: 'var(--text-muted)' }}
                                      >
                                        {ev.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ MODAL – Nová / Upravit událost ═══════════════════════════════════ */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingEvent ? 'Upravit událost' : 'Nová událost'}
              </h2>
              <button
                onClick={() => setShowEventForm(false)}
                className="p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Název */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Název *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Název události"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>

              {/* Kalendář */}
              {calendars.length > 1 && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Kalendář
                  </label>
                  <select
                    value={eventForm.calendar_id}
                    onChange={e => setEventForm(f => ({ ...f, calendar_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {calendars.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Datum od–do */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Od *</label>
                  <input
                    type="date"
                    value={eventForm.start_date}
                    onChange={e => setEventForm(f => ({
                      ...f,
                      start_date: e.target.value,
                      end_date: f.end_date < e.target.value ? e.target.value : f.end_date,
                    }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Do</label>
                  <input
                    type="date"
                    value={eventForm.end_date}
                    min={eventForm.start_date}
                    onChange={e => setEventForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Celý den */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cal_is_all_day"
                  checked={eventForm.is_all_day}
                  onChange={e => setEventForm(f => ({ ...f, is_all_day: e.target.checked }))}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label
                  htmlFor="cal_is_all_day"
                  className="text-sm cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Celý den
                </label>
              </div>

              {/* Čas */}
              {!eventForm.is_all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Čas začátku</label>
                    <input
                      type="time"
                      value={eventForm.start_time}
                      onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Čas konce</label>
                    <input
                      type="time"
                      value={eventForm.end_time}
                      onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              )}

              {/* Popis */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Popis</label>
                <textarea
                  value={eventForm.description}
                  onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Volitelný popis..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Barva */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setEventForm(f => ({ ...f, color: '' }))}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                    style={{
                      borderColor: !eventForm.color ? 'var(--primary)' : 'var(--border)',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-hover)',
                    }}
                    title="Barva dle kalendáře"
                  >
                    ○
                  </button>
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEventForm(f => ({ ...f, color: c }))}
                      className="w-6 h-6 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: eventForm.color === c ? 'scale(1.3)' : 'scale(1)',
                        outline: eventForm.color === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              {editingEvent ? (
                <button
                  onClick={async () => {
                    if (confirm('Opravdu smazat tuto událost?')) {
                      await deleteEvent(editingEvent.id);
                    }
                  }}
                  disabled={deletingEventId === editingEvent.id}
                  className="px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Smazat
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowEventForm(false)}
                  className="px-4 py-2 rounded-lg text-sm border transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveEvent}
                  disabled={savingEvent || !eventForm.title.trim() || !eventForm.start_date}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingEvent ? 'Ukládám...' : editingEvent ? 'Uložit' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – Nový / Upravit kalendář ══════════════════════════════════ */}
      {showCalendarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingCalendar ? 'Upravit kalendář' : 'Nový kalendář'}
              </h2>
              <button
                onClick={() => setShowCalendarForm(false)}
                className="p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input
                  type="text"
                  value={calendarForm.name}
                  onChange={e => setCalendarForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Název kalendáře"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCalendarForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: calendarForm.color === c ? 'scale(1.3)' : 'scale(1)',
                        outline: calendarForm.color === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {editingCalendar && (
              <div
                className="mt-4 p-3 rounded-lg text-xs"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
              >
                💡 Budoucí verze umožní sdílení kalendáře s ostatními členy workspace.
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              {editingCalendar && !editingCalendar.is_default ? (
                <button
                  onClick={async () => {
                    if (confirm('Smazat tento kalendář? Budou smazány i všechny jeho události.')) {
                      await deleteCalendar(editingCalendar.id);
                      setShowCalendarForm(false);
                    }
                  }}
                  className="px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Smazat
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCalendarForm(false)}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveCalendar}
                  disabled={savingCalendar || !calendarForm.name.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingCalendar ? 'Ukládám...' : editingCalendar ? 'Uložit' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

// ─── Vnější komponenta – obaluje WorkspaceProvider ───────────────────────────

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <CalendarContent />
    </WorkspaceProvider>
  );
}
