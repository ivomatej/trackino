'use client';
// ─── Calendar Module – Context ────────────────────────────────────────────────
// Sdílený stav a funkce pro všechny subkomponenty kalendáře.

import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type {
  Calendar, CalendarEvent, CalendarShare, CalendarSharePref,
  CalendarEventAttendee, VacationEntry, ImportantDay, CalendarSubscription,
} from '@/types/database';
import type {
  DisplayEvent, SharedCalendarInfo, MemberWithProfile, BirthdayMember,
  ViewType, EventNote, OrphanNote, TaskItem,
} from './types';

// ─── Typy formulářů ──────────────────────────────────────────────────────────

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

export interface ShareModalState {
  shareWithWorkspace: boolean;
  workspaceShowDetails: boolean;
  userShares: { user_id: string; enabled: boolean; show_details: boolean }[];
}

export interface ListGroup {
  key: string;
  label: string;
  events: DisplayEvent[];
}

// ─── CalendarContextValue ─────────────────────────────────────────────────────

export interface CalendarContextValue {
  // Auth + workspace
  user: { id: string } | null;
  profile: { is_master_admin?: boolean; calendar_day_start?: number; calendar_day_end?: number } | null;
  currentWorkspace: { id: string; name: string } | null;
  today: Date;
  canViewBirthdays: boolean;

  // Pohled + navigace
  view: ViewType;
  setView: (v: ViewType) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  dateRangeLabel: string;

  // Data
  calendars: Calendar[];
  events: CalendarEvent[];
  vacationEntries: VacationEntry[];
  importantDays: ImportantDay[];
  subscriptions: CalendarSubscription[];
  sharedWithMe: SharedCalendarInfo[];
  sharedEvents: DisplayEvent[];
  attendeeEvents: DisplayEvent[];
  loading: boolean;
  selectedCalendarIds: Set<string>;
  setSelectedCalendarIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;

  // Načítání dat
  fetchData: () => Promise<void>;
  fetchSubscriptions: () => void;
  fetchAttendeeEvents: () => Promise<void>;

  // Vypočítané hodnoty pro views
  displayEvents: DisplayEvent[];
  visibleRange: { start: Date; end: Date };
  monthGrid: Date[][];
  miniCalGrid: Date[][];
  weekDays: Date[];
  eventsOnDay: (day: Date) => DisplayEvent[];
  listGroups: ListGroup[];
  filteredListGroups: ListGroup[];
  pendingInvitationsCount: number;
  sortedInvitations: DisplayEvent[];
  sortedCalendars: Calendar[];
  sortedSubscriptions: CalendarSubscription[];

  // Mini kalendář
  miniCalDate: Date;
  setMiniCalDate: (d: Date) => void;

  // Formulář události
  showEventForm: boolean;
  setShowEventForm: (v: boolean) => void;
  editingEvent: CalendarEvent | null;
  eventForm: EventFormState;
  setEventForm: (f: EventFormState | ((prev: EventFormState) => EventFormState)) => void;
  attendeeSearch: string;
  setAttendeeSearch: (v: string) => void;
  showAttendeeDropdown: boolean;
  setShowAttendeeDropdown: (v: boolean) => void;
  savingEvent: boolean;
  deletingEventId: string | null;
  eventAttendees: Record<string, CalendarEventAttendee[]>;
  workspaceMembers: MemberWithProfile[];
  openNewEvent: (date?: string, startHour?: number) => void;
  openEditEvent: (ev: CalendarEvent) => void;
  saveEvent: () => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  respondToAttendance: (eventSourceId: string, status: 'accepted' | 'declined' | 'maybe') => Promise<boolean>;

  // Detail + RSVP modal
  detailEvent: DisplayEvent | null;
  setDetailEvent: (ev: DisplayEvent | null) => void;
  rsvpModalEvent: DisplayEvent | null;
  setRsvpModalEvent: (ev: DisplayEvent | null) => void;

  // Formulář kalendáře
  showCalendarForm: boolean;
  setShowCalendarForm: (v: boolean) => void;
  editingCalendar: Calendar | null;
  calendarForm: { name: string; color: string };
  setCalendarForm: (f: { name: string; color: string } | ((prev: { name: string; color: string }) => { name: string; color: string })) => void;
  savingCalendar: boolean;
  openNewCalendar: () => void;
  openEditCalendar: (cal: Calendar) => void;
  saveCalendar: () => Promise<void>;
  deleteCalendar: (id: string) => Promise<void>;

  // Sdílení
  calendarShares: CalendarShare[];
  sharePrefs: Record<string, CalendarSharePref>;
  showShareModal: boolean;
  setShowShareModal: (v: boolean) => void;
  sharingCalendar: Calendar | null;
  sharingSubscription: CalendarSubscription | null;
  shareModalState: ShareModalState;
  setShareModalState: (s: ShareModalState | ((prev: ShareModalState) => ShareModalState)) => void;
  savingShare: boolean;
  shareError: string;
  sharedCalExpanded: boolean;
  setSharedCalExpanded: (v: boolean) => void;
  openShareModal: (cal?: Calendar, sub?: CalendarSubscription) => void;
  saveShare: () => Promise<void>;
  updateSharePref: (calendarId: string, update: Partial<CalendarSharePref>) => Promise<void>;

  // Poznámky
  openNoteEventIds: Set<string>;
  setOpenNoteEventIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  notesByRef: Record<string, EventNote>;
  showOrphanPanel: boolean;
  setShowOrphanPanel: (v: boolean) => void;
  orphanNotes: OrphanNote[];
  orphanLoading: boolean;
  fetchNotesBatch: (refs: string[]) => Promise<void>;
  handleNoteSave: (
    eventRef: string,
    content: string,
    tasks: TaskItem[],
    meta?: { is_important: boolean; is_done: boolean; is_favorite: boolean },
    eventTitle?: string,
    eventDate?: string
  ) => Promise<void>;
  handleNoteDelete: (eventRef: string) => Promise<void>;
  fetchOrphanNotes: () => Promise<void>;
  deleteOrphanNote: (id: string) => Promise<void>;

  // ICS odběry
  showSubForm: boolean;
  setShowSubForm: (v: boolean) => void;
  editingSub: CalendarSubscription | null;
  setEditingSub: (s: CalendarSubscription | null) => void;
  subForm: { name: string; url: string; color: string };
  setSubForm: (f: { name: string; url: string; color: string } | ((prev: { name: string; url: string; color: string }) => { name: string; url: string; color: string })) => void;
  savingSub: boolean;
  subUrlError: string;
  setSubUrlError: (e: string) => void;
  icsRefreshing: boolean;
  setIcsRefreshToken: (v: number | ((prev: number) => number)) => void;
  showIcsGuide: boolean;
  setShowIcsGuide: (v: boolean) => void;
  openNewSub: () => void;
  openEditSub: (sub: CalendarSubscription) => void;
  saveSubscription: () => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  toggleSubscription: (id: string, enabled: boolean) => Promise<void>;
  moveCalendar: (id: string, dir: -1 | 1) => void;
  moveSubscription: (id: string, dir: -1 | 1) => void;

  // Nastavení zobrazení
  calViewStart: number;
  calViewEnd: number;
  showCalSettings: boolean;
  setShowCalSettings: (v: boolean) => void;
  calSettingsForm: { viewStart: number; viewEnd: number };
  setCalSettingsForm: (f: { viewStart: number; viewEnd: number } | ((prev: { viewStart: number; viewEnd: number }) => { viewStart: number; viewEnd: number })) => void;
  saveCalSettings: () => void;

  // Zobrazení kategorií (přepínače + barvy)
  showHolidays: boolean;
  setShowHolidays: (v: boolean) => void;
  holidayColor: string;
  setHolidayColor: (c: string) => void;
  showNamedays: boolean;
  setShowNamedays: (v: boolean) => void;
  namedayColor: string;
  setNamedayColor: (c: string) => void;
  showBirthdays: boolean;
  setShowBirthdays: (v: boolean) => void;
  birthdayColor: string;
  setBirthdayColor: (c: string) => void;
  birthdayMembers: BirthdayMember[];
  showVacation: boolean;
  setShowVacation: (v: boolean) => void;
  vacationColor: string;
  setVacationColor: (c: string) => void;
  showImportantDays: boolean;
  setShowImportantDays: (v: boolean) => void;
  importantDaysColor: string | null;
  setImportantDaysColor: (c: string | null) => void;

  // Panel – panel stav
  showLeftPanel: boolean;
  setShowLeftPanel: (v: boolean) => void;
  showInvitationsPanel: boolean;
  setShowInvitationsPanel: (v: boolean) => void;
  invitationsVisibleCount: number;
  setInvitationsVisibleCount: (v: number) => void;
  invitationsSearch: string;
  setInvitationsSearch: (v: string) => void;
  invitationsTab: 'all' | 'pending' | 'accepted' | 'maybe' | 'declined';
  setInvitationsTab: (t: 'all' | 'pending' | 'accepted' | 'maybe' | 'declined') => void;
  myCalExpanded: boolean;
  setMyCalExpanded: (v: boolean) => void;
  extCalExpanded: boolean;
  setExtCalExpanded: (v: boolean) => void;
  autoExpanded: boolean;
  setAutoExpanded: (v: boolean) => void;
  otherExpanded: boolean;
  setOtherExpanded: (v: boolean) => void;
  listSearch: string;
  setListSearch: (v: string) => void;
  listHistoryCount: number;
  setListHistoryCount: (v: number | ((prev: number) => number)) => void;
  listVisibleCount: number;
  setListVisibleCount: (v: number) => void;
  nowTime: Date;

  // Refs pro scroll (týdenní / denní mřížka)
  weekGridRef: RefObject<HTMLDivElement | null>;
  calWeekWrapperRef: RefObject<HTMLDivElement | null>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendarContext(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendarContext must be used within CalendarContent');
  return ctx;
}
