'use client';
// ─── Calendar Module – Data Fetch Functions ───────────────────────────────────
// Přesunuto z page.tsx (ř. 1308–1736): fetchData a všechny dílčí fetch funkce.

import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Calendar, CalendarEvent, CalendarShare, CalendarSharePref,
  CalendarEventAttendee, VacationEntry, ImportantDay, CalendarSubscription,
} from '@/types/database';
import type { DisplayEvent, SharedCalendarInfo, MemberWithProfile, BirthdayMember } from '../types';

interface DataDeps {
  user: { id: string } | null;
  currentWorkspace: { id: string } | null;
  canViewBirthdays: boolean;
  // settery ze state hooku
  setCalendars: (v: Calendar[]) => void;
  setEvents: (v: CalendarEvent[]) => void;
  setVacationEntries: (v: VacationEntry[]) => void;
  setImportantDays: (v: ImportantDay[]) => void;
  setLoading: (v: boolean) => void;
  setSelectedCalendarIds: (fn: ((prev: Set<string>) => Set<string>) | Set<string>) => void;
  setCalendarShares: (v: CalendarShare[]) => void;
  setSharedWithMe: (v: SharedCalendarInfo[]) => void;
  setSharePrefs: (v: Record<string, CalendarSharePref>) => void;
  setSharedEvents: (v: DisplayEvent[]) => void;
  setWorkspaceMembers: (v: MemberWithProfile[]) => void;
  setBirthdayMembers: (v: BirthdayMember[]) => void;
  setEventAttendees: (v: Record<string, CalendarEventAttendee[]>) => void;
  setAttendeeEvents: (v: DisplayEvent[]) => void;
  // data potřebná pro efekty
  calendars: Calendar[];
  subscriptions: CalendarSubscription[];
  sharedWithMe: SharedCalendarInfo[];
  initializedRef: React.MutableRefObject<boolean>;
}

export function useCalendarData(deps: DataDeps) {
  const {
    user, currentWorkspace, canViewBirthdays,
    setCalendars, setEvents, setVacationEntries, setImportantDays, setLoading,
    setSelectedCalendarIds, setCalendarShares, setSharedWithMe, setSharePrefs,
    setSharedEvents, setWorkspaceMembers, setBirthdayMembers, setEventAttendees, setAttendeeEvents,
    calendars, subscriptions, sharedWithMe, initializedRef,
  } = deps;

  const fetchSubscriptions = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const { data } = await supabase
      .from('trackino_calendar_subscriptions')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('created_at');
    // Subscriptions jsou řízeny v useCalendarSubscriptions – tady jen re-export
    // Pozn.: setSubscriptions je v useCalendarSubscriptions; zde se volá pouze
    //        z fetchData → proto fetchSubscriptions přidáme do deps přes parametr.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []) as CalendarSubscription[];
  }, [user, currentWorkspace]);

  const fetchWorkspaceMembers = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const { data: membersData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id);
    if (!membersData || membersData.length === 0) return;
    const userIds = membersData
      .map((m: Record<string, unknown>) => m.user_id as string)
      .filter(uid => uid !== user.id);
    if (userIds.length === 0) { setWorkspaceMembers([]); return; }
    const { data: profilesData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, avatar_color')
      .in('id', userIds);
    const members: MemberWithProfile[] = (profilesData ?? []).map((p: Record<string, string>) => ({
      user_id: p.id,
      display_name: p.display_name ?? 'Uživatel',
      avatar_color: p.avatar_color ?? '#6b7280',
    }));
    setWorkspaceMembers(members);
  }, [user, currentWorkspace, setWorkspaceMembers]);

  const fetchBirthdayMembers = useCallback(async () => {
    if (!user || !currentWorkspace || !canViewBirthdays) { setBirthdayMembers([]); return; }
    const { data: membersData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id);
    if (!membersData || membersData.length === 0) { setBirthdayMembers([]); return; }
    const userIds = membersData.map((m: Record<string, unknown>) => m.user_id as string);
    const { data: profilesData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, birth_date')
      .in('id', userIds)
      .not('birth_date', 'is', null);
    setBirthdayMembers(
      (profilesData ?? [])
        .filter((p: Record<string, unknown>) => p.birth_date)
        .map((p: Record<string, unknown>) => ({
          user_id: p.id as string,
          display_name: (p.display_name as string) ?? 'Uživatel',
          birth_date: p.birth_date as string,
        }))
    );
  }, [user, currentWorkspace, canViewBirthdays, setBirthdayMembers]);

  const fetchCalendarShares = useCallback(async (calIds: string[], subIds: string[]) => {
    if (!user) return;
    const allIds = [...calIds, ...subIds];
    if (allIds.length === 0) { setCalendarShares([]); return; }
    const { data } = await supabase
      .from('trackino_calendar_shares')
      .select('*')
      .in('calendar_id', allIds);
    setCalendarShares((data ?? []) as CalendarShare[]);
  }, [user, setCalendarShares]);

  const fetchSharedWithMe = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const { data: shares } = await supabase
      .from('trackino_calendar_shares')
      .select('*')
      .or(`shared_with_user_id.eq.${user.id},share_with_workspace.eq.true`);
    if (!shares || shares.length === 0) { setSharedWithMe([]); return; }

    const { data: prefs } = await supabase
      .from('trackino_calendar_share_prefs')
      .select('*')
      .eq('user_id', user.id);
    const prefsMap: Record<string, CalendarSharePref> = {};
    for (const p of (prefs ?? [])) prefsMap[p.calendar_id] = p as CalendarSharePref;
    setSharePrefs(prefsMap);

    const calIds = [...new Set(shares.map((s: Record<string, unknown>) => s.calendar_id as string))];
    const { data: cals } = await supabase
      .from('trackino_calendars')
      .select('id, name, color, owner_user_id')
      .in('id', calIds);
    const { data: subs } = await supabase
      .from('trackino_calendar_subscriptions')
      .select('id, name, color, user_id')
      .in('id', calIds);

    const ownerIds = [
      ...new Set([
        ...(cals ?? []).map((c: Record<string, unknown>) => c.owner_user_id as string),
        ...(subs ?? []).map((s: Record<string, unknown>) => s.user_id as string),
      ])
    ].filter(id => id !== user.id);

    const ownerNames: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name')
        .in('id', ownerIds);
      for (const p of (profiles ?? [])) {
        ownerNames[p.id] = p.display_name ?? 'Uživatel';
      }
    }

    const result: SharedCalendarInfo[] = [];
    const seenCalIds = new Set<string>();
    for (const share of shares as CalendarShare[]) {
      if (seenCalIds.has(share.calendar_id)) continue;
      const cal = (cals ?? []).find((c: Record<string, unknown>) => c.id === share.calendar_id);
      const sub = (subs ?? []).find((s: Record<string, unknown>) => s.id === share.calendar_id);
      if (!cal && !sub) continue;
      const ownerUserId = cal
        ? (cal as Record<string, unknown>).owner_user_id as string
        : (sub as Record<string, unknown>).user_id as string;
      if (ownerUserId === user.id) continue;
      seenCalIds.add(share.calendar_id);
      const pref = prefsMap[share.calendar_id];
      result.push({
        share_id: share.id,
        calendar_id: share.calendar_id,
        type: cal ? 'calendar' : 'subscription',
        name: cal ? (cal as Record<string, unknown>).name as string : (sub as Record<string, unknown>).name as string,
        owner_name: ownerNames[ownerUserId] ?? 'Uživatel',
        owner_user_id: ownerUserId,
        base_color: cal ? (cal as Record<string, unknown>).color as string : (sub as Record<string, unknown>).color as string,
        show_details: share.show_details,
        is_enabled: pref?.is_enabled ?? true,
        color_override: pref?.color_override ?? null,
      });
    }
    setSharedWithMe(result);
  }, [user, currentWorkspace, setSharedWithMe, setSharePrefs]);

  const fetchSharedEvents = useCallback(async (shared: SharedCalendarInfo[]) => {
    if (!user || !currentWorkspace) return;
    const result: DisplayEvent[] = [];
    const enabledShared = shared.filter(s => s.is_enabled);
    if (enabledShared.length === 0) { setSharedEvents([]); return; }

    const calShared = enabledShared.filter(s => s.type === 'calendar');
    if (calShared.length > 0) {
      const calIds = calShared.map(s => s.calendar_id);
      const { data: evs } = await supabase
        .from('trackino_calendar_events')
        .select('*')
        .in('calendar_id', calIds)
        .order('start_date');
      for (const ev of (evs ?? []) as CalendarEvent[]) {
        const info = calShared.find(s => s.calendar_id === ev.calendar_id);
        if (!info) continue;
        const color = info.color_override ?? info.base_color;
        result.push({
          id: `shared-${ev.id}`,
          title: info.show_details ? ev.title : 'Nemá čas',
          start_date: ev.start_date,
          end_date: ev.end_date,
          color,
          source: 'shared',
          source_id: ev.id,
          calendar_id: ev.calendar_id,
          description: info.show_details ? ev.description : '',
          location: info.show_details ? ev.location : '',
          url: info.show_details ? ev.url : '',
          is_all_day: ev.is_all_day,
          start_time: ev.start_time,
          end_time: ev.end_time,
          is_shared: true,
          show_details: info.show_details,
          shared_owner_name: info.owner_name,
          shared_calendar_name: info.name,
          recurrence_type: ev.recurrence_type ?? 'none',
          recurrence_day: ev.recurrence_day ?? null,
        });
      }
    }

    const subShared = enabledShared.filter(s => s.type === 'subscription');
    if (subShared.length > 0) {
      const subIds = subShared.map(s => s.calendar_id);
      const { data: cached } = await supabase
        .from('trackino_ics_event_cache')
        .select('*')
        .in('subscription_id', subIds);
      for (const ev of (cached ?? [])) {
        const info = subShared.find(s => s.calendar_id === ev.subscription_id);
        if (!info) continue;
        const color = info.color_override ?? info.base_color;
        result.push({
          id: `shared-ics-${ev.id}`,
          title: info.show_details ? ev.title : 'Nemá čas',
          start_date: ev.start_date,
          end_date: ev.end_date,
          color,
          source: 'shared',
          source_id: ev.id,
          description: info.show_details ? ev.description : '',
          is_all_day: ev.is_all_day,
          start_time: ev.start_time,
          end_time: ev.end_time,
          is_shared: true,
          show_details: info.show_details,
          shared_owner_name: info.owner_name,
          shared_calendar_name: info.name,
        });
      }
    }
    setSharedEvents(result);
  }, [user, currentWorkspace, setSharedEvents]);

  const fetchAttendees = useCallback(async (eventIds: string[]) => {
    if (!user || !currentWorkspace || eventIds.length === 0) return;
    const { data } = await supabase
      .from('trackino_calendar_event_attendees')
      .select('*')
      .in('event_id', eventIds);
    const map: Record<string, CalendarEventAttendee[]> = {};
    for (const a of (data ?? []) as CalendarEventAttendee[]) {
      if (!map[a.event_id]) map[a.event_id] = [];
      map[a.event_id].push(a);
    }
    setEventAttendees(map);
  }, [user, currentWorkspace, setEventAttendees]);

  const fetchAttendeeEvents = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const { data: myAttendances } = await supabase
      .from('trackino_calendar_event_attendees')
      .select('event_id, status, prev_start_date, prev_end_date, prev_start_time, prev_end_time, prev_location, prev_description')
      .eq('user_id', user.id)
      .eq('workspace_id', currentWorkspace.id);
    if (!myAttendances || myAttendances.length === 0) { setAttendeeEvents([]); return; }

    const eventIds = myAttendances.map((a: Record<string, unknown>) => a.event_id as string);
    const { data: evs } = await supabase
      .from('trackino_calendar_events')
      .select('*')
      .in('id', eventIds);

    const result: DisplayEvent[] = [];
    for (const ev of (evs ?? []) as CalendarEvent[]) {
      const att = myAttendances.find((a: Record<string, unknown>) => a.event_id === ev.id);
      result.push({
        id: `attendee-${ev.id}`,
        title: ev.title,
        start_date: ev.start_date,
        end_date: ev.end_date,
        color: ev.color ?? '#f59e0b',
        source: 'manual',
        source_id: ev.id,
        description: ev.description,
        location: ev.location,
        url: ev.url,
        is_all_day: ev.is_all_day,
        start_time: ev.start_time,
        end_time: ev.end_time,
        attendee_status: att?.status as 'pending' | 'accepted' | 'declined' | 'maybe' | 'updated',
        event_owner_id: ev.user_id,
        attendee_prev_start_date: (att?.prev_start_date as string | null) ?? null,
        attendee_prev_end_date: (att?.prev_end_date as string | null) ?? null,
        attendee_prev_start_time: (att?.prev_start_time as string | null) ?? null,
        attendee_prev_end_time: (att?.prev_end_time as string | null) ?? null,
        attendee_prev_location: (att?.prev_location as string | null) ?? null,
        attendee_prev_description: (att?.prev_description as string | null) ?? null,
        recurrence_type: ev.recurrence_type ?? 'none',
        recurrence_day: ev.recurrence_day ?? null,
      });
    }
    setAttendeeEvents(result);
  }, [user, currentWorkspace, setAttendeeEvents]);

  const fetchData = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);
    try {
      const { data: cals } = await supabase
        .from('trackino_calendars')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_user_id', user.id)
        .order('created_at');

      let calList = (cals ?? []) as Calendar[];

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

      if (calList.length > 0) {
        const calIds = calList.map(c => c.id);
        const { data: evs } = await supabase
          .from('trackino_calendar_events')
          .select('*')
          .in('calendar_id', calIds)
          .order('start_date');
        setEvents((evs ?? []) as CalendarEvent[]);
        await fetchAttendees(calIds.length > 0 ? (evs ?? []).map((e: Record<string, unknown>) => e.id as string) : []);
      } else {
        setEvents([]);
      }

      const { data: vacs } = await supabase
        .from('trackino_vacation_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('status', 'approved');
      setVacationEntries((vacs ?? []) as VacationEntry[]);

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
  }, [user, currentWorkspace, fetchAttendees, setCalendars, setEvents, setVacationEntries, setImportantDays, setLoading, setSelectedCalendarIds, initializedRef]);

  // Efekt: initial fetch
  useEffect(() => {
    fetchData();
    fetchWorkspaceMembers();
    fetchAttendeeEvents();
    fetchBirthdayMembers();
  }, [fetchData, fetchWorkspaceMembers, fetchAttendeeEvents, fetchBirthdayMembers]);

  // Efekt: sdílení po načtení kalendářů
  useEffect(() => {
    if (calendars.length > 0 || subscriptions.length > 0) {
      const calIds = calendars.map(c => c.id);
      const subIds = subscriptions.map(s => s.id);
      fetchCalendarShares(calIds, subIds);
    }
  }, [calendars, subscriptions, fetchCalendarShares]);

  // Efekt: sdílené kalendáře (kde jsem příjemce)
  useEffect(() => {
    fetchSharedWithMe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSharedWithMe]);

  // Efekt: události ze sdílených kalendářů
  useEffect(() => {
    fetchSharedEvents(sharedWithMe);
  }, [sharedWithMe, fetchSharedEvents]);

  return {
    fetchData,
    fetchSubscriptions,
    fetchWorkspaceMembers,
    fetchBirthdayMembers,
    fetchCalendarShares,
    fetchSharedWithMe,
    fetchSharedEvents,
    fetchAttendees,
    fetchAttendeeEvents,
  };
}
