'use client';
// ─── Calendar Module – UI & Data State ───────────────────────────────────────
// Přesunuto z page.tsx (ř. 945–1307): všechny useState, useRef + základní efekty
// (scroll, hodiny, localStorage, reset listu, ICS load).

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Calendar, CalendarEvent, CalendarShare, CalendarSharePref,
  CalendarEventAttendee, VacationEntry, ImportantDay, CalendarSubscription,
} from '@/types/database';
import type {
  ViewType, DisplayEvent, SharedCalendarInfo, MemberWithProfile,
  BirthdayMember, EventNote, OrphanNote,
} from '../types';
import { ROW_H, parseICS } from '../utils';

// ─── Stav formuláře události ──────────────────────────────────────────────────

export interface EventFormState {
  title: string;
  description: string;
  location: string;
  url: string;
  attendee_ids: string[];
  reminder_minutes: number | null;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  start_time: string;
  end_time: string;
  color: string;
  calendar_id: string;
  recurrence_type: string;
  recurrence_day: number | null;
}

const DEFAULT_EVENT_FORM: EventFormState = {
  title: '', description: '', location: '', url: '',
  attendee_ids: [], reminder_minutes: null,
  start_date: '', end_date: '', is_all_day: true,
  start_time: '', end_time: '', color: '', calendar_id: '',
  recurrence_type: 'none', recurrence_day: null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendarState(
  user: { id: string } | null,
  currentWorkspace: { id: string } | null,
) {
  // ── Pohled + navigace ──────────────────────────────────────────────────────
  const [view, setView] = useState<ViewType>(() => {
    if (typeof window === 'undefined') return 'week';
    const saved = localStorage.getItem('trackino_calendar_view') as ViewType | null;
    return (saved && (['today', 'three_days', 'week', 'month', 'year', 'list'] as string[]).includes(saved))
      ? saved as ViewType : 'week';
  });
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // ── Datové pole ───────────────────────────────────────────────────────────
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [vacationEntries, setVacationEntries] = useState<VacationEntry[]>([]);
  const [importantDays, setImportantDays] = useState<ImportantDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());

  // ── Mini kalendář + nastavení ─────────────────────────────────────────────
  const [miniCalDate, setMiniCalDate] = useState<Date>(() => new Date());
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showCalSettings, setShowCalSettings] = useState(false);
  const [calSettingsForm, setCalSettingsForm] = useState({ viewStart: 9, viewEnd: 17 });

  // ── Formulář události ──────────────────────────────────────────────────────
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>(DEFAULT_EVENT_FORM);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [eventAttendees, setEventAttendees] = useState<Record<string, CalendarEventAttendee[]>>({});

  // ── Sdílení kalendářů ─────────────────────────────────────────────────────
  const [calendarShares, setCalendarShares] = useState<CalendarShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedCalendarInfo[]>([]);
  const [sharePrefs, setSharePrefs] = useState<Record<string, CalendarSharePref>>({});
  const [sharedEvents, setSharedEvents] = useState<DisplayEvent[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingCalendar, setSharingCalendar] = useState<Calendar | null>(null);
  const [sharingSubscription, setSharingSubscription] = useState<CalendarSubscription | null>(null);
  const [shareModalState, setShareModalState] = useState<{
    shareWithWorkspace: boolean;
    workspaceShowDetails: boolean;
    userShares: { user_id: string; enabled: boolean; show_details: boolean }[];
  }>({ shareWithWorkspace: false, workspaceShowDetails: true, userShares: [] });
  const [savingShare, setSavingShare] = useState(false);
  const [sharedCalExpanded, setSharedCalExpanded] = useState(true);
  const [shareError, setShareError] = useState('');

  // ── Workspace členové ──────────────────────────────────────────────────────
  const [workspaceMembers, setWorkspaceMembers] = useState<MemberWithProfile[]>([]);

  // ── RSVP + Detail modaly ───────────────────────────────────────────────────
  const [rsvpModalEvent, setRsvpModalEvent] = useState<DisplayEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<DisplayEvent | null>(null);

  // ── Formulář kalendáře ─────────────────────────────────────────────────────
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [calendarForm, setCalendarForm] = useState({ name: '', color: '#3b82f6' });
  const [savingCalendar, setSavingCalendar] = useState(false);

  // ── Čas (minutový tick) ────────────────────────────────────────────────────
  const [nowTime, setNowTime] = useState<Date>(() => new Date());

  // ── Listový pohled ─────────────────────────────────────────────────────────
  const [listVisibleCount, setListVisibleCount] = useState(10);
  const [listSearch, setListSearch] = useState('');
  const [listHistoryCount, setListHistoryCount] = useState(0);

  // ── ICS odběry ─────────────────────────────────────────────────────────────
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  const [subscriptionEvents, setSubscriptionEvents] = useState<DisplayEvent[]>([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingSub, setEditingSub] = useState<CalendarSubscription | null>(null);
  const [subForm, setSubForm] = useState({ name: '', url: '', color: '#8b5cf6' });
  const [savingSub, setSavingSub] = useState(false);
  const [subUrlError, setSubUrlError] = useState('');
  const [icsRefreshToken, setIcsRefreshToken] = useState(0);
  const [icsRefreshing, setIcsRefreshing] = useState(false);
  const [showIcsGuide, setShowIcsGuide] = useState(false);

  // ── Viditelný rozsah kalendáře (localStorage) ─────────────────────────────
  const [calViewStart, setCalViewStart] = useState(() => {
    if (typeof window === 'undefined') return 9;
    return parseInt(localStorage.getItem('trackino_cal_view_start') ?? '9', 10);
  });
  const [calViewEnd, setCalViewEnd] = useState(() => {
    if (typeof window === 'undefined') return 17;
    return parseInt(localStorage.getItem('trackino_cal_view_end') ?? '17', 10);
  });

  // ── Sort order kalendářů (localStorage) ───────────────────────────────────
  const [calendarOrder, setCalendarOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('trackino_cal_order') ?? '[]'); } catch { return []; }
  });
  const [subsOrder, setSubsOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('trackino_subs_order') ?? '[]'); } catch { return []; }
  });

  // ── Přepínače kategorií + barvy (localStorage) ────────────────────────────
  const [showHolidays, setShowHolidays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_holidays') !== '0';
  });
  const [holidayColor, setHolidayColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#ef4444';
    return localStorage.getItem('trackino_cal_holiday_color') ?? '#ef4444';
  });
  const [showNamedays, setShowNamedays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_namedays') !== '0';
  });
  const [namedayColor, setNamedayColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#7c3aed';
    return localStorage.getItem('trackino_cal_nameday_color') ?? '#7c3aed';
  });
  const [showBirthdays, setShowBirthdays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_birthdays') !== '0';
  });
  const [birthdayColor, setBirthdayColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#ec4899';
    return localStorage.getItem('trackino_cal_birthday_color') ?? '#ec4899';
  });
  const [birthdayMembers, setBirthdayMembers] = useState<BirthdayMember[]>([]);
  const [showVacation, setShowVacation] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_vacation') !== '0';
  });
  const [vacationColor, setVacationColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#0ea5e9';
    return localStorage.getItem('trackino_cal_vacation_color') ?? '#0ea5e9';
  });
  const [showImportantDays, setShowImportantDays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_important_days') !== '0';
  });
  const [importantDaysColor, setImportantDaysColor] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('trackino_cal_important_days_color');
    return saved && saved !== 'null' ? saved : null;
  });

  // ── Collapse stav sekcí v levém panelu ────────────────────────────────────
  const [myCalExpanded, setMyCalExpanded] = useState(true);
  const [extCalExpanded, setExtCalExpanded] = useState(true);
  const [autoExpanded, setAutoExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(true);

  // ── Poznámky k událostem ───────────────────────────────────────────────────
  const [openNoteEventIds, setOpenNoteEventIds] = useState<Set<string>>(new Set());
  const [notesByRef, setNotesByRef] = useState<Record<string, EventNote>>({});
  const notesLoadedRefs = useRef<Set<string>>(new Set());

  // ── Sirotčí poznámky ──────────────────────────────────────────────────────
  const [showOrphanPanel, setShowOrphanPanel] = useState(false);
  const [orphanNotes, setOrphanNotes] = useState<OrphanNote[]>([]);
  const [orphanLoading, setOrphanLoading] = useState(false);

  // ── Panel Pozvánky ────────────────────────────────────────────────────────
  const [showInvitationsPanel, setShowInvitationsPanel] = useState(false);
  const [invitationsVisibleCount, setInvitationsVisibleCount] = useState(20);
  const [invitationsSearch, setInvitationsSearch] = useState('');
  const [invitationsTab, setInvitationsTab] = useState<'all' | 'pending' | 'accepted' | 'maybe' | 'declined'>('all');

  // ── Účastnické události ────────────────────────────────────────────────────
  const [attendeeEvents, setAttendeeEvents] = useState<DisplayEvent[]>([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const weekGridRef = useRef<HTMLDivElement>(null);
  const calWeekWrapperRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // ── Efekty: scroll na calViewStart ───────────────────────────────────────
  useLayoutEffect(() => {
    if (view !== 'week' && view !== 'today' && view !== 'three_days') return;
    if (loading) return;

    const wrapper = calWeekWrapperRef.current;
    const grid = weekGridRef.current;
    if (!wrapper || !grid) return;

    const applyHeight = () => {
      const wRect = wrapper.getBoundingClientRect();
      const totalH = window.innerHeight - wRect.top;
      if (totalH <= 60) return;
      wrapper.style.flex = 'none';
      wrapper.style.height = `${totalH}px`;
      void wrapper.offsetHeight;
      const headerH = Math.max(0, grid.getBoundingClientRect().top - wRect.top);
      grid.style.maxHeight = `${Math.max(60, totalH - headerH)}px`;
    };

    applyHeight();
    void grid.offsetHeight;
    grid.scrollTop = calViewStart * ROW_H;

    window.addEventListener('resize', applyHeight);
    return () => window.removeEventListener('resize', applyHeight);
  }, [view, loading, calViewStart, currentDate]);

  // Fallback scroll (vícenásobný timeout)
  useEffect(() => {
    if (view !== 'week' && view !== 'today' && view !== 'three_days') return;
    if (loading) return;
    const target = calViewStart * ROW_H;
    const doScroll = () => {
      const wrapper = calWeekWrapperRef.current;
      const grid = weekGridRef.current;
      if (!wrapper || !grid) return;
      const wRect = wrapper.getBoundingClientRect();
      const totalH = window.innerHeight - wRect.top;
      if (totalH > 60) {
        wrapper.style.flex = 'none';
        wrapper.style.height = `${totalH}px`;
        void wrapper.offsetHeight;
        const headerH = Math.max(0, grid.getBoundingClientRect().top - wRect.top);
        grid.style.maxHeight = `${Math.max(60, totalH - headerH)}px`;
      }
      void grid.offsetHeight;
      grid.scrollTop = target;
    };
    const t1 = setTimeout(doScroll, 50);
    const t2 = setTimeout(doScroll, 150);
    const t3 = setTimeout(doScroll, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [view, loading, calViewStart, currentDate]);

  // Minutový tick
  useEffect(() => {
    const tick = () => setNowTime(new Date());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Uložení pohledu do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trackino_calendar_view', view);
    }
  }, [view]);

  // Reset stránkování, vyhledávání a otevřených poznámek při navigaci
  useEffect(() => {
    setListVisibleCount(10);
    setListSearch('');
    setListHistoryCount(0);
    setOpenNoteEventIds(new Set());
  }, [view, currentDate]);

  // Načtení ICS událostí při změně odběrů nebo manuálním refreshi
  useEffect(() => {
    const enabled = subscriptions.filter(s => s.is_enabled);
    if (enabled.length === 0) {
      setSubscriptionEvents([]);
      setIcsRefreshing(false);
      return;
    }
    let cancelled = false;
    setIcsRefreshing(true);
    (async () => {
      const allEvents: DisplayEvent[] = [];
      const cacheBust = icsRefreshToken > 0 ? `&t=${icsRefreshToken}` : '';
      await Promise.all(
        enabled.map(async sub => {
          try {
            const res = await fetch(`/api/ics-proxy?url=${encodeURIComponent(sub.url)}${cacheBust}`);
            if (!res.ok) return;
            const text = await res.text();
            const parsed = parseICS(text, sub.id, sub.color);
            if (!cancelled) allEvents.push(...parsed);
            const isShared = calendarShares.some(sh => sh.calendar_id === sub.id);
            if (isShared && currentWorkspace && parsed.length > 0) {
              const cacheRows = parsed.map(ev => ({
                subscription_id: sub.id,
                workspace_id: currentWorkspace.id,
                uid: ev.id,
                title: ev.title,
                description: ev.description ?? '',
                start_date: ev.start_date,
                end_date: ev.end_date,
                start_time: ev.start_time ?? null,
                end_time: ev.end_time ?? null,
                is_all_day: ev.is_all_day,
                synced_at: new Date().toISOString(),
              }));
              await supabase.from('trackino_ics_event_cache')
                .upsert(cacheRows, { onConflict: 'subscription_id,uid' });
            }
          } catch { /* ignoruj chyby jednotlivých odběrů */ }
        })
      );
      if (!cancelled) {
        setSubscriptionEvents(allEvents);
        setIcsRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions, icsRefreshToken]);

  // Periodický auto-refresh ICS každých 15 minut
  useEffect(() => {
    if (!subscriptions.some(s => s.is_enabled)) return;
    const id = setInterval(() => setIcsRefreshToken(t => t + 1), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [subscriptions]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    // Pohled
    view, setView, currentDate, setCurrentDate,
    // Datové pole
    calendars, setCalendars,
    events, setEvents,
    vacationEntries, setVacationEntries,
    importantDays, setImportantDays,
    loading, setLoading,
    selectedCalendarIds, setSelectedCalendarIds,
    // Mini kal + panel
    miniCalDate, setMiniCalDate,
    showLeftPanel, setShowLeftPanel,
    showCalSettings, setShowCalSettings,
    calSettingsForm, setCalSettingsForm,
    // Event form
    showEventForm, setShowEventForm,
    editingEvent, setEditingEvent,
    eventForm, setEventForm,
    attendeeSearch, setAttendeeSearch,
    showAttendeeDropdown, setShowAttendeeDropdown,
    savingEvent, setSavingEvent,
    deletingEventId, setDeletingEventId,
    eventAttendees, setEventAttendees,
    // Sdílení
    calendarShares, setCalendarShares,
    sharedWithMe, setSharedWithMe,
    sharePrefs, setSharePrefs,
    sharedEvents, setSharedEvents,
    showShareModal, setShowShareModal,
    sharingCalendar, setSharingCalendar,
    sharingSubscription, setSharingSubscription,
    shareModalState, setShareModalState,
    savingShare, setSavingShare,
    sharedCalExpanded, setSharedCalExpanded,
    shareError, setShareError,
    // Členové
    workspaceMembers, setWorkspaceMembers,
    // Modaly
    rsvpModalEvent, setRsvpModalEvent,
    detailEvent, setDetailEvent,
    // Kalendář form
    showCalendarForm, setShowCalendarForm,
    editingCalendar, setEditingCalendar,
    calendarForm, setCalendarForm,
    savingCalendar, setSavingCalendar,
    // Čas
    nowTime,
    // List
    listVisibleCount, setListVisibleCount,
    listSearch, setListSearch,
    listHistoryCount, setListHistoryCount,
    // ICS
    subscriptions, setSubscriptions,
    subscriptionEvents, setSubscriptionEvents,
    showSubForm, setShowSubForm,
    editingSub, setEditingSub,
    subForm, setSubForm,
    savingSub, setSavingSub,
    subUrlError, setSubUrlError,
    icsRefreshToken, setIcsRefreshToken,
    icsRefreshing, setIcsRefreshing,
    showIcsGuide, setShowIcsGuide,
    // Rozsah zobrazení
    calViewStart, setCalViewStart,
    calViewEnd, setCalViewEnd,
    // Řazení
    calendarOrder, setCalendarOrder,
    subsOrder, setSubsOrder,
    // Přepínače + barvy
    showHolidays, setShowHolidays,
    holidayColor, setHolidayColor,
    showNamedays, setShowNamedays,
    namedayColor, setNamedayColor,
    showBirthdays, setShowBirthdays,
    birthdayColor, setBirthdayColor,
    birthdayMembers, setBirthdayMembers,
    showVacation, setShowVacation,
    vacationColor, setVacationColor,
    showImportantDays, setShowImportantDays,
    importantDaysColor, setImportantDaysColor,
    // Collapse
    myCalExpanded, setMyCalExpanded,
    extCalExpanded, setExtCalExpanded,
    autoExpanded, setAutoExpanded,
    otherExpanded, setOtherExpanded,
    // Poznámky
    openNoteEventIds, setOpenNoteEventIds,
    notesByRef, setNotesByRef,
    notesLoadedRefs,
    showOrphanPanel, setShowOrphanPanel,
    orphanNotes, setOrphanNotes,
    orphanLoading, setOrphanLoading,
    // Pozvánky
    showInvitationsPanel, setShowInvitationsPanel,
    invitationsVisibleCount, setInvitationsVisibleCount,
    invitationsSearch, setInvitationsSearch,
    invitationsTab, setInvitationsTab,
    // Účastník
    attendeeEvents, setAttendeeEvents,
    // Refs
    weekGridRef, calWeekWrapperRef, initializedRef,
  };
}
