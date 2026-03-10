'use client';
// ─── Calendar Module – CalendarContent ────────────────────────────────────────
// Orchestrátor: zapojuje všechny hooky, poskytuje CalendarContext a renderuje
// layout (header, pozvánky, sidebar, views, modály).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getCzechHolidays } from '@/lib/czech-calendar';
import { getCzechNamedayForDate } from '@/lib/czech-namedays';

import { CalendarContext } from '../CalendarContext';
import type { ListGroup } from '../CalendarContext';
import { useCalendarState } from '../hooks/useCalendarState';
import { useCalendarData } from '../hooks/useCalendarData';
import { useCalendarNotes } from '../hooks/useCalendarNotes';
import { useCalendarCrud } from '../hooks/useCalendarCrud';
import { useCalendarSubscriptions } from '../hooks/useCalendarSubscriptions';
import {
  toDateStr, parseDate, addDays, getMonday, formatWeekRange,
  formatMonthYear, MONTH_NAMES, ROW_H, eventOnDay,
} from '../utils';
import { expandRecurringEvent, getImportantDayOccurrences } from '../recurrenceUtils';
import type { DisplayEvent } from '../types';

import CalendarHeader from './CalendarHeader';
import InvitationsPanel from './InvitationsPanel';
import CalendarSidebar from './CalendarSidebar';
import MonthView from './MonthView';
import WeekView from './WeekView';
import ThreeDaysView from './ThreeDaysView';
import TodayView from './TodayView';
import YearView from './YearView';
import ListView from './ListView';
import EventFormModal from './EventFormModal';
import EventDetailModal from './EventDetailModal';
import RsvpModal from './RsvpModal';
import CalendarFormModal from './CalendarFormModal';
import ShareModal from './ShareModal';
import IcsSubscriptionModal from './IcsSubscriptionModal';
import CalSettingsModal from './CalSettingsModal';

// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarContent() {
  const { user, profile } = useAuth();
  const { currentWorkspace, currentMembership } = useWorkspace();

  const today = useMemo(() => new Date(), []);
  const canViewBirthdays = (profile?.is_master_admin ?? false)
    || (currentMembership?.role === 'owner' || currentMembership?.role === 'admin')
    || (currentMembership?.can_view_birthdays ?? false);

  // ── 1. Veškerý stav ────────────────────────────────────────────────────────
  const state = useCalendarState(user, currentWorkspace);

  // ── 2. Data fetching ───────────────────────────────────────────────────────
  const dataHook = useCalendarData({
    user,
    currentWorkspace,
    canViewBirthdays,
    setCalendars: state.setCalendars,
    setEvents: state.setEvents,
    setVacationEntries: state.setVacationEntries,
    setImportantDays: state.setImportantDays,
    setLoading: state.setLoading,
    setSelectedCalendarIds: state.setSelectedCalendarIds,
    setCalendarShares: state.setCalendarShares,
    setSharedWithMe: state.setSharedWithMe,
    setSharePrefs: state.setSharePrefs,
    setSharedEvents: state.setSharedEvents,
    setWorkspaceMembers: state.setWorkspaceMembers,
    setBirthdayMembers: state.setBirthdayMembers,
    setEventAttendees: state.setEventAttendees,
    setAttendeeEvents: state.setAttendeeEvents,
    calendars: state.calendars,
    subscriptions: state.subscriptions,
    sharedWithMe: state.sharedWithMe,
    initializedRef: state.initializedRef,
  });

  // Wrapper fetchSubscriptions: volá dataHook.fetchSubscriptions a nastaví stav
  const fetchSubscriptions = useCallback(async () => {
    const data = await dataHook.fetchSubscriptions();
    if (data) state.setSubscriptions(data);
  }, [dataHook.fetchSubscriptions, state.setSubscriptions]);

  // Initial load subscriptions (chybělo po refactoringu – subscriptions se načítaly
  // jen přes saveSubscription/deleteSubscription, ne při prvním načtení stránky)
  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // ── 3. Odvozené vypočítané hodnoty ─────────────────────────────────────────

  const sortedCalendars = useMemo(() => {
    if (state.calendarOrder.length === 0) return state.calendars;
    const idx = new Map(state.calendarOrder.map((id, i) => [id, i]));
    return [...state.calendars].sort((a, b) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
  }, [state.calendars, state.calendarOrder]);

  const visibleRange = useMemo(() => {
    const { view, currentDate } = state;
    if (view === 'week') {
      const start = getMonday(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = addDays(start, 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start: addDays(getMonday(start), -7), end: addDays(end, 14) };
    }
    if (view === 'today') {
      const s = new Date(currentDate); s.setHours(0, 0, 0, 0);
      const e = new Date(currentDate); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (view === 'three_days') {
      const start = addDays(new Date(currentDate), -1); start.setHours(0, 0, 0, 0);
      const end = addDays(new Date(currentDate), 1); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === 'year') {
      const y = currentDate.getFullYear();
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
    }
    // list: 24 měsíců zpět + 6 dopředu
    return {
      start: new Date(currentDate.getFullYear(), currentDate.getMonth() - 24, 1),
      end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 6, 0),
    };
  }, [state.view, state.currentDate]);

  const czechHolidayEvents = useMemo<DisplayEvent[]>(() => {
    if (!state.showHolidays) return [];
    const result: DisplayEvent[] = [];
    const startYear = visibleRange.start.getFullYear();
    const endYear = visibleRange.end.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      for (const h of getCzechHolidays(y)) {
        const dateStr = toDateStr(h.date);
        result.push({ id: `holiday-${dateStr}`, title: h.name, start_date: dateStr, end_date: dateStr, color: state.holidayColor, source: 'holiday', source_id: dateStr, is_all_day: true });
      }
    }
    return result;
  }, [state.showHolidays, visibleRange, state.holidayColor]);

  const namedayEvents = useMemo<DisplayEvent[]>(() => {
    if (!state.showNamedays) return [];
    const result: DisplayEvent[] = [];
    const cur = new Date(visibleRange.start); cur.setHours(0, 0, 0, 0);
    while (cur <= visibleRange.end) {
      const name = getCzechNamedayForDate(cur);
      if (name) {
        const dateStr = toDateStr(cur);
        result.push({ id: `nameday-${dateStr}`, title: name, start_date: dateStr, end_date: dateStr, color: state.namedayColor, source: 'nameday', source_id: dateStr, is_all_day: true });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [state.showNamedays, visibleRange, state.namedayColor]);

  const birthdayEvents = useMemo<DisplayEvent[]>(() => {
    if (!state.showBirthdays || !canViewBirthdays || state.birthdayMembers.length === 0) return [];
    const result: DisplayEvent[] = [];
    const startYear = visibleRange.start.getFullYear();
    const endYear = visibleRange.end.getFullYear();
    for (const member of state.birthdayMembers) {
      const parts = member.birth_date.split('-');
      if (parts.length < 3) continue;
      const mm = parts[1]; const dd = parts[2];
      for (let year = startYear; year <= endYear; year++) {
        const dateStr = `${year}-${mm}-${dd}`;
        const d = parseDate(dateStr); d.setHours(0, 0, 0, 0);
        if (d >= visibleRange.start && d <= visibleRange.end) {
          result.push({ id: `birthday-${member.user_id}-${year}`, title: `🎂 ${member.display_name}`, start_date: dateStr, end_date: dateStr, color: state.birthdayColor, source: 'birthday', source_id: member.user_id, is_all_day: true });
        }
      }
    }
    return result;
  }, [state.showBirthdays, canViewBirthdays, state.birthdayMembers, visibleRange, state.birthdayColor]);

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const result: DisplayEvent[] = [];

    for (const ev of state.events) {
      if (!state.selectedCalendarIds.has(ev.calendar_id)) continue;
      const cal = state.calendars.find(c => c.id === ev.calendar_id);
      const baseColor = ev.color ?? cal?.color ?? '#3b82f6';
      const isRec = ev.recurrence_type && ev.recurrence_type !== 'none';

      if (isRec) {
        const occs = expandRecurringEvent(ev, visibleRange.start, visibleRange.end);
        for (const occ of occs) {
          result.push({ id: `${ev.id}__rec__${occ.start_date}`, title: ev.title, start_date: occ.start_date, end_date: occ.end_date, color: baseColor, source: 'manual', source_id: ev.id, calendar_id: ev.calendar_id, description: ev.description, is_all_day: ev.is_all_day, start_time: ev.start_time, end_time: ev.end_time, is_recurring: true, recurrence_type: ev.recurrence_type, recurrence_day: ev.recurrence_day });
        }
      } else {
        result.push({ id: ev.id, title: ev.title, start_date: ev.start_date, end_date: ev.end_date, color: baseColor, source: 'manual', source_id: ev.id, calendar_id: ev.calendar_id, description: ev.description, is_all_day: ev.is_all_day, start_time: ev.start_time, end_time: ev.end_time });
      }
    }

    if (state.showVacation) {
      for (const v of state.vacationEntries) {
        result.push({ id: `vacation-${v.id}`, title: 'Dovolená', start_date: v.start_date, end_date: v.end_date, color: state.vacationColor, source: 'vacation', source_id: v.id, description: v.note || '', is_all_day: true });
      }
    }

    if (state.showImportantDays) {
      for (const day of state.importantDays) {
        const occs = getImportantDayOccurrences(day, visibleRange.start, visibleRange.end);
        for (const occ of occs) {
          result.push({ id: `importantday-${day.id}-${occ.start}`, title: day.title, start_date: occ.start, end_date: occ.end, color: state.importantDaysColor ?? day.color, source: 'important_day', source_id: day.id, description: day.note || '', is_all_day: true, is_recurring: day.is_recurring });
        }
      }
    }

    for (const ev of state.subscriptionEvents) {
      const evStart = parseDate(ev.start_date); const evEnd = parseDate(ev.end_date);
      if (evStart <= visibleRange.end && evEnd >= visibleRange.start) result.push(ev);
    }

    for (const ev of state.sharedEvents) {
      const isRec = ev.recurrence_type && ev.recurrence_type !== 'none';
      if (isRec) {
        const occs = expandRecurringEvent({ recurrence_type: ev.recurrence_type!, recurrence_day: ev.recurrence_day, start_date: ev.start_date, end_date: ev.end_date }, visibleRange.start, visibleRange.end);
        for (const occ of occs) result.push({ ...ev, id: `${ev.id}__rec__${occ.start_date}`, start_date: occ.start_date, end_date: occ.end_date, is_recurring: true });
      } else {
        const evStart = parseDate(ev.start_date); const evEnd = parseDate(ev.end_date);
        if (evStart <= visibleRange.end && evEnd >= visibleRange.start) result.push(ev);
      }
    }

    for (const ev of state.attendeeEvents) {
      const isRec = ev.recurrence_type && ev.recurrence_type !== 'none';
      if (isRec) {
        const occs = expandRecurringEvent({ recurrence_type: ev.recurrence_type!, recurrence_day: ev.recurrence_day, start_date: ev.start_date, end_date: ev.end_date }, visibleRange.start, visibleRange.end);
        for (const occ of occs) result.push({ ...ev, id: `${ev.id}__rec__${occ.start_date}`, start_date: occ.start_date, end_date: occ.end_date, is_recurring: true });
      } else {
        const evStart = parseDate(ev.start_date); const evEnd = parseDate(ev.end_date);
        if (evStart <= visibleRange.end && evEnd >= visibleRange.start) result.push(ev);
      }
    }

    for (const ev of czechHolidayEvents) result.push(ev);
    for (const ev of namedayEvents) result.push(ev);
    for (const ev of birthdayEvents) result.push(ev);

    return result.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
  }, [state.events, state.vacationEntries, state.importantDays, state.calendars, state.selectedCalendarIds, visibleRange, state.subscriptionEvents, state.sharedEvents, state.attendeeEvents, czechHolidayEvents, namedayEvents, birthdayEvents, state.showVacation, state.vacationColor, state.showImportantDays, state.importantDaysColor]);

  // ── 4. Poznámky (potřebuje displayEvents) ──────────────────────────────────
  const notesHook = useCalendarNotes({
    user,
    currentWorkspace,
    notesByRef: state.notesByRef,
    setNotesByRef: state.setNotesByRef,
    openNoteEventIds: state.openNoteEventIds,
    setOpenNoteEventIds: state.setOpenNoteEventIds,
    orphanNotes: state.orphanNotes,
    setOrphanNotes: state.setOrphanNotes,
    setOrphanLoading: state.setOrphanLoading,
    notesLoadedRefs: state.notesLoadedRefs,
    displayEvents,
  });

  // Při změně displayEvents vyčistit cache poznámek
  const prevDisplayEventsRef = useRef<string>('');
  useEffect(() => {
    const key = displayEvents.map(ev => ev.id).join(',');
    if (key !== prevDisplayEventsRef.current) {
      prevDisplayEventsRef.current = key;
      state.notesLoadedRefs.current.clear();
    }
  }, [displayEvents, state.notesLoadedRefs]);

  // Načtení poznámek pro seznam pohled
  useEffect(() => {
    if (state.view === 'list' && !state.loading && displayEvents.length > 0) {
      notesHook.fetchNotesBatch(displayEvents.map(ev => ev.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view, state.loading, displayEvents]);

  // ── Deep-link od Notebook: otevřít inline poznámku pro konkrétní událost ───
  const pendingOpenNoteRef = useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('trackino_cal_open_note_ref') : null
  );
  useEffect(() => {
    if (pendingOpenNoteRef.current) {
      localStorage.removeItem('trackino_cal_open_note_ref');
    }
  }, []);
  useEffect(() => {
    const ref = pendingOpenNoteRef.current;
    if (!ref || state.loading || displayEvents.length === 0) return;
    const found = displayEvents.find(ev => ev.id === ref);
    if (found) {
      state.setOpenNoteEventIds(prev => new Set([...prev, found.id]));
      pendingOpenNoteRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayEvents, state.loading]);

  // ── 5. CRUD operace ────────────────────────────────────────────────────────
  const crudHook = useCalendarCrud({
    user,
    currentWorkspace,
    editingEvent: state.editingEvent,
    setEditingEvent: state.setEditingEvent,
    eventForm: state.eventForm,
    setEventForm: state.setEventForm,
    eventAttendees: state.eventAttendees,
    calendars: state.calendars,
    setShowEventForm: state.setShowEventForm,
    setSavingEvent: state.setSavingEvent,
    setDeletingEventId: state.setDeletingEventId,
    setAttendeeSearch: state.setAttendeeSearch,
    setShowAttendeeDropdown: state.setShowAttendeeDropdown,
    calendarShares: state.calendarShares,
    shareModalState: state.shareModalState,
    setShareModalState: state.setShareModalState,
    sharingCalendar: state.sharingCalendar,
    setSharingCalendar: state.setSharingCalendar,
    sharingSubscription: state.sharingSubscription,
    setSharingSubscription: state.setSharingSubscription,
    setSavingShare: state.setSavingShare,
    setShareError: state.setShareError,
    setShowShareModal: state.setShowShareModal,
    subscriptions: state.subscriptions,
    sharedWithMe: state.sharedWithMe,
    setSharedWithMe: state.setSharedWithMe,
    setSharePrefs: state.setSharePrefs,
    editingCalendar: state.editingCalendar,
    setEditingCalendar: state.setEditingCalendar,
    calendarForm: state.calendarForm,
    setCalendarForm: state.setCalendarForm,
    setShowCalendarForm: state.setShowCalendarForm,
    setSavingCalendar: state.setSavingCalendar,
    selectedCalendarIds: state.selectedCalendarIds,
    setSelectedCalendarIds: state.setSelectedCalendarIds,
    fetchData: dataHook.fetchData,
    fetchAttendeeEvents: dataHook.fetchAttendeeEvents,
    fetchCalendarShares: dataHook.fetchCalendarShares,
    fetchSharedEvents: dataHook.fetchSharedEvents,
  });

  // ── 6. ICS odběry ──────────────────────────────────────────────────────────
  const subsHook = useCalendarSubscriptions({
    user,
    currentWorkspace,
    editingSub: state.editingSub,
    setEditingSub: state.setEditingSub,
    subForm: state.subForm,
    setSubForm: state.setSubForm,
    subUrlError: state.subUrlError,
    setSubUrlError: state.setSubUrlError,
    setSavingSub: state.setSavingSub,
    setShowSubForm: state.setShowSubForm,
    subscriptions: state.subscriptions,
    setSubscriptions: state.setSubscriptions,
    subsOrder: state.subsOrder,
    setSubsOrder: state.setSubsOrder,
    calendarOrder: state.calendarOrder,
    setCalendarOrder: state.setCalendarOrder,
    fetchSubscriptions,
  });

  // ── 7. Lokální funkce ──────────────────────────────────────────────────────

  function moveCalendar(id: string, dir: -1 | 1) {
    state.setCalendarOrder(prev => {
      const list = prev.length > 0 ? [...prev] : sortedCalendars.map(c => c.id);
      const i = list.indexOf(id); if (i < 0) return list;
      const j = i + dir; if (j < 0 || j >= list.length) return list;
      const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
      localStorage.setItem('trackino_cal_order', JSON.stringify(next));
      return next;
    });
  }

  function saveCalSettings() {
    const vs = Math.max(0, Math.min(23, state.calSettingsForm.viewStart));
    const ve = Math.max(vs + 1, Math.min(24, state.calSettingsForm.viewEnd));
    state.setCalViewStart(vs); state.setCalViewEnd(ve);
    localStorage.setItem('trackino_cal_view_start', String(vs));
    localStorage.setItem('trackino_cal_view_end', String(ve));
    state.setShowCalSettings(false);
    const doScroll = () => {
      const wrapper = state.calWeekWrapperRef.current;
      const grid = state.weekGridRef.current;
      if (!wrapper || !grid) return;
      const wRect = wrapper.getBoundingClientRect();
      const totalH = window.innerHeight - wRect.top;
      if (totalH > 60) {
        wrapper.style.flex = 'none'; wrapper.style.height = `${totalH}px`;
        void wrapper.offsetHeight;
        const headerH = Math.max(0, grid.getBoundingClientRect().top - wRect.top);
        grid.style.maxHeight = `${Math.max(60, totalH - headerH)}px`;
      }
      void grid.offsetHeight;
      grid.scrollTop = vs * ROW_H;
    };
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
    setTimeout(doScroll, 100); setTimeout(doScroll, 300);
  }

  function goToday() { const t = new Date(); state.setCurrentDate(t); state.setMiniCalDate(t); }
  function goPrev() {
    const d = new Date(state.currentDate);
    if (state.view === 'week') d.setDate(d.getDate() - 7);
    else if (state.view === 'today') d.setDate(d.getDate() - 1);
    else if (state.view === 'three_days') d.setDate(d.getDate() - 1);
    else if (state.view === 'year') d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1);
    state.setCurrentDate(d); state.setMiniCalDate(d);
  }
  function goNext() {
    const d = new Date(state.currentDate);
    if (state.view === 'week') d.setDate(d.getDate() + 7);
    else if (state.view === 'today') d.setDate(d.getDate() + 1);
    else if (state.view === 'three_days') d.setDate(d.getDate() + 1);
    else if (state.view === 'year') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    state.setCurrentDate(d); state.setMiniCalDate(d);
  }

  // ── 8. Další computed values ────────────────────────────────────────────────

  const pendingInvitationsCount = useMemo(
    () => state.attendeeEvents.filter(ev => ev.attendee_status === 'pending' || ev.attendee_status === 'updated').length,
    [state.attendeeEvents]
  );

  const sortedInvitations = useMemo(() => {
    const statusOrder: Record<string, number> = { pending: 0, updated: 0, accepted: 1, maybe: 2, declined: 3 };
    return [...state.attendeeEvents]
      .filter(ev => {
        if (state.invitationsTab === 'pending') return ev.attendee_status === 'pending' || ev.attendee_status === 'updated';
        if (state.invitationsTab !== 'all') return ev.attendee_status === state.invitationsTab;
        return true;
      })
      .filter(ev => !state.invitationsSearch || ev.title.toLowerCase().includes(state.invitationsSearch.toLowerCase()))
      .sort((a, b) => {
        const ao = statusOrder[a.attendee_status ?? 'pending'] ?? 0;
        const bo = statusOrder[b.attendee_status ?? 'pending'] ?? 0;
        if (ao !== bo) return ao - bo;
        return a.start_date.localeCompare(b.start_date);
      });
  }, [state.attendeeEvents, state.invitationsTab, state.invitationsSearch]);

  const monthGrid = useMemo(() => {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const gridStart = getMonday(firstDay);
    let gridEnd = addDays(getMonday(lastDay), 6);
    if (gridEnd < lastDay) gridEnd = addDays(gridEnd, 7);
    const weeks: Date[][] = [];
    let cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur = addDays(cur, 1); }
      weeks.push(week);
    }
    return weeks;
  }, [state.currentDate]);

  const miniCalGrid = useMemo(() => {
    const year = state.miniCalDate.getFullYear();
    const month = state.miniCalDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const gridStart = getMonday(firstDay);
    const weeks: Date[][] = [];
    let cur = new Date(gridStart);
    while (true) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur = addDays(cur, 1); }
      weeks.push(week);
      if (cur > lastDay && weeks.length >= 4) break;
    }
    return weeks;
  }, [state.miniCalDate]);

  const weekDays = useMemo(() => {
    const monday = getMonday(state.currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [state.currentDate]);

  function eventsOnDay(day: Date): DisplayEvent[] {
    return displayEvents.filter(ev => eventOnDay(ev, day));
  }

  const listGroups = useMemo<ListGroup[]>(() => {
    const { start, end } = visibleRange;
    const filtered = displayEvents.filter(ev => {
      const evStart = parseDate(ev.start_date); const evEnd = parseDate(ev.end_date);
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
          events: evs.sort((a, b) => {
            const dateCmp = a.start_date.localeCompare(b.start_date);
            if (dateCmp !== 0) return dateCmp;
            if (!a.start_time && !b.start_time) return a.title.localeCompare(b.title);
            if (!a.start_time) return -1;
            if (!b.start_time) return 1;
            return a.start_time.localeCompare(b.start_time);
          }),
        };
      });
  }, [displayEvents, visibleRange]);

  const filteredListGroups = useMemo<ListGroup[]>(() => {
    if (!state.listSearch.trim()) return listGroups;
    const q = state.listSearch.trim().toLowerCase();
    return listGroups
      .map(g => ({ ...g, events: g.events.filter(ev => ev.title.toLowerCase().includes(q) || (ev.description && ev.description.toLowerCase().includes(q))) }))
      .filter(g => g.events.length > 0);
  }, [listGroups, state.listSearch]);

  const dateRangeLabel = useMemo(() => {
    const { view, currentDate } = state;
    if (view === 'week') { const mon = getMonday(currentDate); return formatWeekRange(mon, addDays(mon, 6)); }
    if (view === 'today') return currentDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'three_days') {
      const d1 = addDays(new Date(currentDate), -1); const d3 = addDays(new Date(currentDate), 1);
      const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
      return `${fmt(d1)} – ${fmt(d3)}`;
    }
    if (view === 'year') return String(currentDate.getFullYear());
    return formatMonthYear(currentDate);
  }, [state.view, state.currentDate]);

  // ── 9. Guard + render ──────────────────────────────────────────────────────

  if (!currentWorkspace) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    </DashboardLayout>
  );

  const ctxValue = {
    // Auth + workspace
    user, profile, currentWorkspace, today, canViewBirthdays,
    // Pohled + navigace
    view: state.view, setView: state.setView,
    currentDate: state.currentDate, setCurrentDate: state.setCurrentDate,
    goToday, goPrev, goNext, dateRangeLabel,
    // Data
    calendars: state.calendars, events: state.events,
    vacationEntries: state.vacationEntries, importantDays: state.importantDays,
    subscriptions: state.subscriptions, sharedWithMe: state.sharedWithMe,
    sharedEvents: state.sharedEvents, attendeeEvents: state.attendeeEvents,
    loading: state.loading,
    selectedCalendarIds: state.selectedCalendarIds, setSelectedCalendarIds: state.setSelectedCalendarIds,
    // Fetch
    fetchData: dataHook.fetchData, fetchSubscriptions, fetchAttendeeEvents: dataHook.fetchAttendeeEvents,
    // Computed
    displayEvents, visibleRange, monthGrid, miniCalGrid, weekDays,
    eventsOnDay, listGroups, filteredListGroups,
    pendingInvitationsCount, sortedInvitations,
    sortedCalendars, sortedSubscriptions: subsHook.sortedSubscriptions,
    // Mini kalendář
    miniCalDate: state.miniCalDate, setMiniCalDate: state.setMiniCalDate,
    // Event form
    showEventForm: state.showEventForm, setShowEventForm: state.setShowEventForm,
    editingEvent: state.editingEvent, eventForm: state.eventForm, setEventForm: state.setEventForm,
    attendeeSearch: state.attendeeSearch, setAttendeeSearch: state.setAttendeeSearch,
    showAttendeeDropdown: state.showAttendeeDropdown, setShowAttendeeDropdown: state.setShowAttendeeDropdown,
    savingEvent: state.savingEvent, deletingEventId: state.deletingEventId,
    eventAttendees: state.eventAttendees, workspaceMembers: state.workspaceMembers,
    openNewEvent: crudHook.openNewEvent, openEditEvent: crudHook.openEditEvent,
    saveEvent: crudHook.saveEvent, deleteEvent: crudHook.deleteEvent,
    respondToAttendance: crudHook.respondToAttendance,
    // Detail + RSVP
    detailEvent: state.detailEvent, setDetailEvent: state.setDetailEvent,
    rsvpModalEvent: state.rsvpModalEvent, setRsvpModalEvent: state.setRsvpModalEvent,
    // Kalendář form
    showCalendarForm: state.showCalendarForm, setShowCalendarForm: state.setShowCalendarForm,
    editingCalendar: state.editingCalendar,
    calendarForm: state.calendarForm, setCalendarForm: state.setCalendarForm,
    savingCalendar: state.savingCalendar,
    openNewCalendar: crudHook.openNewCalendar, openEditCalendar: crudHook.openEditCalendar,
    saveCalendar: crudHook.saveCalendar, deleteCalendar: crudHook.deleteCalendar,
    // Sdílení
    calendarShares: state.calendarShares, sharePrefs: state.sharePrefs,
    showShareModal: state.showShareModal, setShowShareModal: state.setShowShareModal,
    sharingCalendar: state.sharingCalendar, sharingSubscription: state.sharingSubscription,
    shareModalState: state.shareModalState, setShareModalState: state.setShareModalState,
    savingShare: state.savingShare, shareError: state.shareError,
    sharedCalExpanded: state.sharedCalExpanded, setSharedCalExpanded: state.setSharedCalExpanded,
    openShareModal: crudHook.openShareModal, saveShare: crudHook.saveShare,
    updateSharePref: crudHook.updateSharePref,
    // Poznámky
    openNoteEventIds: state.openNoteEventIds, setOpenNoteEventIds: state.setOpenNoteEventIds,
    notesByRef: state.notesByRef,
    showOrphanPanel: state.showOrphanPanel, setShowOrphanPanel: state.setShowOrphanPanel,
    orphanNotes: state.orphanNotes, orphanLoading: state.orphanLoading,
    fetchNotesBatch: notesHook.fetchNotesBatch,
    handleNoteSave: notesHook.handleNoteSave,
    handleNoteDelete: notesHook.handleNoteDelete,
    fetchOrphanNotes: notesHook.fetchOrphanNotes,
    deleteOrphanNote: notesHook.deleteOrphanNote,
    // ICS odběry
    showSubForm: state.showSubForm, setShowSubForm: state.setShowSubForm,
    editingSub: state.editingSub, setEditingSub: state.setEditingSub,
    subForm: state.subForm, setSubForm: state.setSubForm,
    savingSub: state.savingSub, subUrlError: state.subUrlError, setSubUrlError: state.setSubUrlError,
    icsRefreshing: state.icsRefreshing, setIcsRefreshToken: state.setIcsRefreshToken,
    showIcsGuide: state.showIcsGuide, setShowIcsGuide: state.setShowIcsGuide,
    openNewSub: subsHook.openNewSub, openEditSub: subsHook.openEditSub,
    saveSubscription: subsHook.saveSubscription, deleteSubscription: subsHook.deleteSubscription,
    toggleSubscription: subsHook.toggleSubscription,
    moveCalendar, moveSubscription: subsHook.moveSubscription,
    // Nastavení zobrazení
    calViewStart: state.calViewStart, calViewEnd: state.calViewEnd,
    showCalSettings: state.showCalSettings, setShowCalSettings: state.setShowCalSettings,
    calSettingsForm: state.calSettingsForm, setCalSettingsForm: state.setCalSettingsForm,
    saveCalSettings,
    // Přepínače + barvy
    showHolidays: state.showHolidays, setShowHolidays: state.setShowHolidays,
    holidayColor: state.holidayColor, setHolidayColor: state.setHolidayColor,
    showNamedays: state.showNamedays, setShowNamedays: state.setShowNamedays,
    namedayColor: state.namedayColor, setNamedayColor: state.setNamedayColor,
    showBirthdays: state.showBirthdays, setShowBirthdays: state.setShowBirthdays,
    birthdayColor: state.birthdayColor, setBirthdayColor: state.setBirthdayColor,
    birthdayMembers: state.birthdayMembers,
    showVacation: state.showVacation, setShowVacation: state.setShowVacation,
    vacationColor: state.vacationColor, setVacationColor: state.setVacationColor,
    showImportantDays: state.showImportantDays, setShowImportantDays: state.setShowImportantDays,
    importantDaysColor: state.importantDaysColor, setImportantDaysColor: state.setImportantDaysColor,
    // Panel stavy
    showLeftPanel: state.showLeftPanel, setShowLeftPanel: state.setShowLeftPanel,
    showInvitationsPanel: state.showInvitationsPanel, setShowInvitationsPanel: state.setShowInvitationsPanel,
    invitationsVisibleCount: state.invitationsVisibleCount, setInvitationsVisibleCount: state.setInvitationsVisibleCount,
    invitationsSearch: state.invitationsSearch, setInvitationsSearch: state.setInvitationsSearch,
    invitationsTab: state.invitationsTab, setInvitationsTab: state.setInvitationsTab,
    myCalExpanded: state.myCalExpanded, setMyCalExpanded: state.setMyCalExpanded,
    extCalExpanded: state.extCalExpanded, setExtCalExpanded: state.setExtCalExpanded,
    autoExpanded: state.autoExpanded, setAutoExpanded: state.setAutoExpanded,
    otherExpanded: state.otherExpanded, setOtherExpanded: state.setOtherExpanded,
    listSearch: state.listSearch, setListSearch: state.setListSearch,
    listHistoryCount: state.listHistoryCount, setListHistoryCount: state.setListHistoryCount,
    listVisibleCount: state.listVisibleCount, setListVisibleCount: state.setListVisibleCount,
    nowTime: state.nowTime,
    // Refs
    weekGridRef: state.weekGridRef, calWeekWrapperRef: state.calWeekWrapperRef,
  };

  return (
    <DashboardLayout>
      <CalendarContext.Provider value={ctxValue}>
        <div className="h-full flex flex-col" style={{ minHeight: 0 }}>
          <CalendarHeader />
          <InvitationsPanel />
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <CalendarSidebar />
            <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
              {state.loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                </div>
              ) : (
                <>
                  {state.view === 'month' && <MonthView />}
                  {state.view === 'week' && <WeekView />}
                  {state.view === 'today' && <TodayView />}
                  {state.view === 'three_days' && <ThreeDaysView />}
                  {state.view === 'year' && <YearView />}
                  {state.view === 'list' && <ListView />}
                </>
              )}
            </div>
          </div>
        </div>
        {state.showEventForm && <EventFormModal />}
        {state.detailEvent && <EventDetailModal />}
        {state.rsvpModalEvent && <RsvpModal />}
        {state.showCalendarForm && <CalendarFormModal />}
        {state.showShareModal && <ShareModal />}
        {state.showSubForm && <IcsSubscriptionModal />}
        {state.showCalSettings && <CalSettingsModal />}
      </CalendarContext.Provider>
    </DashboardLayout>
  );
}
