'use client';
// ─── Calendar Module – useCalendarCrud ────────────────────────────────────────
// CRUD operace pro události, sdílení a kalendáře. Přesunuto z page.tsx.

import type { Calendar, CalendarShare, CalendarSharePref, CalendarSubscription, CalendarEventAttendee, CalendarEvent } from '@/types/database';
import type { EventFormState, ShareModalState } from '../CalendarContext';
import type { SharedCalendarInfo } from '../types';
import { DEFAULT_COLORS } from '../utils';
import { supabase } from '@/lib/supabase';

// ─── Typy závislostí ──────────────────────────────────────────────────────────

export interface CrudDeps {
  user: { id: string } | null;
  currentWorkspace: { id: string } | null;
  // Event form
  editingEvent: CalendarEvent | null;
  setEditingEvent: (ev: CalendarEvent | null) => void;
  eventForm: EventFormState;
  setEventForm: (f: EventFormState | ((p: EventFormState) => EventFormState)) => void;
  eventAttendees: Record<string, CalendarEventAttendee[]>;
  calendars: Calendar[];
  setShowEventForm: (v: boolean) => void;
  setSavingEvent: (v: boolean) => void;
  setDeletingEventId: (id: string | null) => void;
  setAttendeeSearch: (v: string) => void;
  setShowAttendeeDropdown: (v: boolean) => void;
  // Share
  calendarShares: CalendarShare[];
  shareModalState: ShareModalState;
  setShareModalState: (s: ShareModalState | ((p: ShareModalState) => ShareModalState)) => void;
  sharingCalendar: Calendar | null;
  setSharingCalendar: (c: Calendar | null) => void;
  sharingSubscription: CalendarSubscription | null;
  setSharingSubscription: (s: CalendarSubscription | null) => void;
  setSavingShare: (v: boolean) => void;
  setShareError: (e: string) => void;
  setShowShareModal: (v: boolean) => void;
  subscriptions: CalendarSubscription[];
  sharedWithMe: SharedCalendarInfo[];
  setSharedWithMe: (s: SharedCalendarInfo[]) => void;
  setSharePrefs: (p: Record<string, CalendarSharePref> | ((prev: Record<string, CalendarSharePref>) => Record<string, CalendarSharePref>)) => void;
  // Calendar form
  editingCalendar: Calendar | null;
  setEditingCalendar: (c: Calendar | null) => void;
  calendarForm: { name: string; color: string };
  setCalendarForm: (f: { name: string; color: string }) => void;
  setShowCalendarForm: (v: boolean) => void;
  setSavingCalendar: (v: boolean) => void;
  selectedCalendarIds: Set<string>;
  setSelectedCalendarIds: (s: Set<string> | ((p: Set<string>) => Set<string>)) => void;
  // Fetch funkce
  fetchData: () => Promise<void>;
  fetchAttendeeEvents: () => Promise<void>;
  fetchCalendarShares: (calIds: string[], subIds: string[]) => Promise<void>;
  fetchSharedEvents: (sharedWithMe: SharedCalendarInfo[]) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendarCrud(deps: CrudDeps) {
  const {
    user, currentWorkspace,
    editingEvent, setEditingEvent, eventForm, setEventForm, eventAttendees,
    calendars, setShowEventForm, setSavingEvent, setDeletingEventId,
    setAttendeeSearch, setShowAttendeeDropdown,
    calendarShares, shareModalState, setShareModalState, sharingCalendar,
    setSharingCalendar, sharingSubscription, setSharingSubscription,
    setSavingShare, setShareError, setShowShareModal, subscriptions,
    sharedWithMe, setSharedWithMe, setSharePrefs,
    editingCalendar, setEditingCalendar, calendarForm, setCalendarForm,
    setShowCalendarForm, setSavingCalendar, selectedCalendarIds, setSelectedCalendarIds,
    fetchData, fetchAttendeeEvents, fetchCalendarShares, fetchSharedEvents,
  } = deps;

  // ── Události ──────────────────────────────────────────────────────────────

  function openNewEvent(date?: string, startHour?: number) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    setEditingEvent(null);
    const defaultCalId = calendars.find(c => c.is_default)?.id ?? calendars[0]?.id ?? '';
    const hasTime = startHour !== undefined;
    const endHour = hasTime ? Math.min(startHour! + 1, 23) : 0;
    setEventForm({
      title: '', description: '', location: '', url: '',
      attendee_ids: [], reminder_minutes: null,
      start_date: d, end_date: d,
      is_all_day: !hasTime,
      start_time: hasTime ? `${String(startHour).padStart(2, '0')}:00` : '',
      end_time: hasTime ? `${String(endHour).padStart(2, '0')}:00` : '',
      color: '', calendar_id: defaultCalId,
      recurrence_type: 'none', recurrence_day: null,
    });
    setAttendeeSearch('');
    setShowAttendeeDropdown(false);
    setShowEventForm(true);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    const existingAttendees = eventAttendees[ev.id]?.map(a => a.user_id) ?? [];
    setEventForm({
      title: ev.title, description: ev.description,
      location: ev.location ?? '', url: ev.url ?? '',
      attendee_ids: existingAttendees, reminder_minutes: ev.reminder_minutes ?? null,
      start_date: ev.start_date, end_date: ev.end_date,
      is_all_day: ev.is_all_day,
      start_time: ev.start_time ?? '', end_time: ev.end_time ?? '',
      color: ev.color ?? '', calendar_id: ev.calendar_id,
      recurrence_type: ev.recurrence_type ?? 'none',
      recurrence_day: ev.recurrence_day ?? null,
    });
    setAttendeeSearch('');
    setShowAttendeeDropdown(false);
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
        location: eventForm.location,
        url: eventForm.url,
        reminder_minutes: eventForm.reminder_minutes,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || eventForm.start_date,
        is_all_day: eventForm.is_all_day,
        start_time: eventForm.is_all_day ? null : (eventForm.start_time || null),
        end_time: eventForm.is_all_day ? null : (eventForm.end_time || null),
        color: eventForm.color || null,
        source: 'manual' as const,
        source_id: null,
        recurrence_type: eventForm.recurrence_type || 'none',
        recurrence_day: eventForm.recurrence_type === 'monthly_on_day' ? (eventForm.recurrence_day ?? null) : null,
      };
      let savedEventId: string;
      if (editingEvent) {
        const origStartTime = editingEvent.start_time ?? null;
        const origEndTime = editingEvent.end_time ?? null;
        const changed =
          (editingEvent.start_date !== payload.start_date) ||
          (editingEvent.end_date !== (payload.end_date || payload.start_date)) ||
          (origStartTime !== (payload.start_time ?? null)) ||
          (origEndTime !== (payload.end_time ?? null)) ||
          ((editingEvent.location ?? '') !== (payload.location ?? '')) ||
          ((editingEvent.description ?? '') !== (payload.description ?? ''));
        if (changed) {
          await supabase
            .from('trackino_calendar_event_attendees')
            .update({
              status: 'updated',
              prev_start_date: editingEvent.start_date,
              prev_end_date: editingEvent.end_date,
              prev_start_time: origStartTime,
              prev_end_time: origEndTime,
              prev_location: editingEvent.location ?? null,
              prev_description: editingEvent.description ?? null,
            })
            .eq('event_id', editingEvent.id)
            .in('status', ['accepted', 'updated'])
            .neq('user_id', user.id);
        }
        await supabase.from('trackino_calendar_events').update(payload).eq('id', editingEvent.id);
        savedEventId = editingEvent.id;
      } else {
        const { data: inserted } = await supabase
          .from('trackino_calendar_events').insert(payload).select('id').single();
        savedEventId = inserted?.id ?? '';
      }
      if (savedEventId) {
        const existing = eventAttendees[savedEventId] ?? [];
        const toKeep = existing.filter(a => eventForm.attendee_ids.includes(a.user_id));
        const toAdd = eventForm.attendee_ids.filter(uid => !existing.find(a => a.user_id === uid));
        const toRemove = existing.filter(a => !eventForm.attendee_ids.includes(a.user_id));
        if (toRemove.length > 0) {
          await supabase.from('trackino_calendar_event_attendees')
            .delete().in('id', toRemove.map(a => a.id));
        }
        if (toAdd.length > 0) {
          await supabase.from('trackino_calendar_event_attendees')
            .insert(toAdd.map(uid => ({
              event_id: savedEventId,
              workspace_id: currentWorkspace.id,
              user_id: uid,
              status: 'pending',
            })));
        }
        void toKeep;
      }
      setShowEventForm(false);
      await Promise.all([fetchData(), fetchAttendeeEvents()]);
    } finally {
      setSavingEvent(false);
    }
  }

  async function respondToAttendance(eventSourceId: string, status: 'accepted' | 'declined' | 'maybe'): Promise<boolean> {
    if (!user || !currentWorkspace) return false;
    const { error } = await supabase
      .from('trackino_calendar_event_attendees')
      .update({ status, prev_start_date: null, prev_end_date: null, prev_start_time: null, prev_end_time: null, prev_location: null, prev_description: null })
      .eq('event_id', eventSourceId)
      .eq('user_id', user.id);
    if (error) { console.error('respondToAttendance error:', error); return false; }
    await fetchAttendeeEvents();
    return true;
  }

  async function deleteEvent(id: string) {
    setDeletingEventId(id);
    await supabase.from('trackino_calendar_events').delete().eq('id', id);
    setDeletingEventId(null);
    setShowEventForm(false);
    await fetchData();
  }

  // ── Sdílení kalendáře ─────────────────────────────────────────────────────

  function openShareModal(cal?: Calendar, sub?: CalendarSubscription) {
    setSharingCalendar(cal ?? null);
    setSharingSubscription(sub ?? null);
    const calId = cal?.id ?? sub?.id ?? '';
    const existing = calendarShares.filter(s => s.calendar_id === calId);
    const wsShare = existing.find(s => s.share_with_workspace);
    const userShares = existing
      .filter(s => !s.share_with_workspace && s.shared_with_user_id)
      .map(s => ({ user_id: s.shared_with_user_id!, enabled: true, show_details: s.show_details }));
    setShareModalState({
      shareWithWorkspace: !!wsShare,
      workspaceShowDetails: wsShare?.show_details ?? true,
      userShares,
    });
    setShowShareModal(true);
  }

  async function saveShare() {
    if (!currentWorkspace) return;
    const calId = sharingCalendar?.id ?? sharingSubscription?.id ?? '';
    if (!calId) return;
    setSavingShare(true);
    setShareError('');
    try {
      await supabase.from('trackino_calendar_shares').delete().eq('calendar_id', calId);
      const toInsert: Partial<CalendarShare>[] = [];
      if (shareModalState.shareWithWorkspace) {
        toInsert.push({ calendar_id: calId, shared_with_user_id: null, share_with_workspace: true, show_details: shareModalState.workspaceShowDetails, can_edit: false });
      }
      for (const us of shareModalState.userShares) {
        if (!us.enabled) continue;
        toInsert.push({ calendar_id: calId, shared_with_user_id: us.user_id, share_with_workspace: false, show_details: us.show_details, can_edit: false });
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from('trackino_calendar_shares').insert(toInsert);
        if (error) {
          console.error('saveShare error:', error);
          setShareError('Uložení se nezdařilo. Zkontrolujte, zda byla spuštěna SQL migrace pro sdílení externích kalendářů.');
          return;
        }
      }
      setShowShareModal(false);
      const calIds = calendars.map(c => c.id);
      const subIds = subscriptions.map(s => s.id);
      await fetchCalendarShares(calIds, subIds);
    } finally {
      setSavingShare(false);
    }
  }

  async function updateSharePref(calendarId: string, update: Partial<CalendarSharePref>) {
    if (!user) return;
    await supabase.from('trackino_calendar_share_prefs')
      .upsert({ calendar_id: calendarId, user_id: user.id, ...update }, { onConflict: 'calendar_id,user_id' });
    setSharePrefs(prev => ({ ...prev, [calendarId]: { ...prev[calendarId], ...update } as CalendarSharePref }));
    const updated = sharedWithMe.map(s =>
      s.calendar_id === calendarId
        ? { ...s, ...update, is_enabled: update.is_enabled ?? s.is_enabled, color_override: update.color_override ?? s.color_override }
        : s
    );
    setSharedWithMe(updated);
    await fetchSharedEvents(updated);
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
        await supabase.from('trackino_calendars')
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

  return {
    openNewEvent, openEditEvent, saveEvent, respondToAttendance, deleteEvent,
    openShareModal, saveShare, updateSharePref,
    openNewCalendar, openEditCalendar, saveCalendar, deleteCalendar,
  };
}
