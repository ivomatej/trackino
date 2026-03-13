'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import {
  getNameDay,
  getCzechHolidays,
  isCzechHoliday,
  getWorkingDaysInMonth,
  getRemainingWorkingDays,
  getRemainingDaysInMonth,
  getDaysInMonth,
} from '@/lib/czech-calendar';
import type { WorkspaceMember, MemberRate } from '@/types/database';
import { type NotificationItem, type WeekDayData, CZECH_SHORT_DAYS } from './types';

export function useDashboard() {
  const { user, profile } = useAuth();
  const { currentWorkspace, currentMembership, managerAssignments, hasModule } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [hasRate, setHasRate] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [weekData, setWeekData] = useState<WeekDayData[]>([]);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const holidays = getCzechHolidays(year);
  const todayHoliday = isCzechHoliday(today, holidays);
  const nameDay = getNameDay(today);

  const daysInMonth = getDaysInMonth(year, month);
  const workingDaysTotal = getWorkingDaysInMonth(year, month);
  const remainingDays = getRemainingDaysInMonth(year, month, today);
  const remainingWorkingDays = getRemainingWorkingDays(year, month, today);
  const monthProgress = Math.round(((today.getDate() - 1) / daysInMonth) * 100);

  const monthHolidays = holidays.filter(h => h.date.getMonth() === month && h.date.getFullYear() === year);

  const hour = today.getHours();
  const greetingPrefix = hour < 12 ? 'Dobré ráno' : hour < 17 ? 'Dobrý den' : 'Dobrý večer';
  const nickname = profile?.display_nickname?.trim()
    || profile?.display_name?.split(' ')[0]
    || 'uživateli';

  const currency = currentWorkspace?.currency ?? 'CZK';

  const fetchData = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);

    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 1).toISOString();

    // Záznamy tohoto měsíce (jen dokončené, ne running)
    const { data: entries } = await supabase
      .from('trackino_time_entries')
      .select('duration, start_time')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .eq('is_running', false)
      .gte('start_time', startOfMonth)
      .lt('start_time', endOfMonth);

    const totalSec = (entries ?? []).reduce((acc: number, e: { duration: number | null }) => acc + (e.duration ?? 0), 0);
    setTotalSeconds(totalSec);

    // Hodinová sazba uživatele
    const { data: membership } = await supabase
      .from('trackino_workspace_members')
      .select('id, hourly_rate')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .single();

    if (membership) {
      const { data: rates } = await supabase
        .from('trackino_member_rates')
        .select('*')
        .eq('workspace_member_id', (membership as WorkspaceMember).id);

      const rateList = (rates ?? []) as MemberRate[];

      const getRateForEntry = (entryDate: string): number | null => {
        const match = rateList
          .filter(r => r.valid_from <= entryDate && (r.valid_to === null || r.valid_to >= entryDate))
          .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
        return match?.hourly_rate ?? (membership as WorkspaceMember).hourly_rate ?? null;
      };

      let earnings = 0;
      let rateFound = false;
      for (const e of entries ?? []) {
        if (!e.duration) continue;
        const rate = getRateForEntry((e as { start_time: string }).start_time.split('T')[0]);
        if (rate !== null) {
          earnings += (e.duration / 3600) * rate;
          rateFound = true;
        }
      }
      setTotalEarnings(earnings);
      setHasRate(rateFound || rateList.length > 0 || !!(membership as WorkspaceMember).hourly_rate);
    }

    // ── Týdenní graf (posledních 7 dní) ──────────────────────────────────────
    const weekDays: WeekDayData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      weekDays.push({
        day: CZECH_SHORT_DAYS[d.getDay()],
        hours: 0,
        isToday: i === 0,
      });
    }

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999);

    const { data: weekEntries } = await supabase
      .from('trackino_time_entries')
      .select('duration, start_time')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .eq('is_running', false)
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', weekEnd.toISOString());

    for (const e of weekEntries ?? []) {
      if (!e.duration) continue;
      const eDate = new Date(e.start_time);
      const diffDays = Math.floor((eDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        weekDays[diffDays].hours += e.duration / 3600;
      }
    }
    // Zaokrouhlení
    for (const wd of weekDays) wd.hours = Math.round(wd.hours * 10) / 10;
    setWeekData(weekDays);

    // ── Notifikace „K vyřízení" ───────────────────────────────────────────────
    const canApproveVacation = isWorkspaceAdmin || isManager;
    const canProcessRequests = isWorkspaceAdmin || isManager || isMasterAdmin || (currentMembership?.can_process_requests ?? false);
    const canViewFeedback = isMasterAdmin || isWorkspaceAdmin || (currentMembership?.can_receive_feedback ?? false);
    const canApproveInvoices = isWorkspaceAdmin || isManager;

    const notifs: NotificationItem[] = [];

    // Čekající dovolené
    if (canApproveVacation && hasModule('vacation')) {
      const subordinateIds = managerAssignments.map(a => a.member_user_id);
      let vacQuery = supabase
        .from('trackino_vacation_entries')
        .select('id, user_id, start_date, end_date, days, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending');

      if (isManager && !isWorkspaceAdmin) {
        vacQuery = vacQuery.in('user_id', subordinateIds.length > 0 ? subordinateIds : ['__none__']);
      }

      const { data: pendingVacations } = await vacQuery;
      for (const v of pendingVacations ?? []) {
        notifs.push({
          id: `vac-${v.id}`,
          type: 'vacation',
          title: `Žádost o dovolenou (${v.days} ${v.days === 1 ? 'den' : v.days < 5 ? 'dny' : 'dní'})`,
          date: v.created_at,
          href: '/vacation',
        });
      }
    }

    // Čekající žádosti
    if (canProcessRequests && hasModule('requests')) {
      const { data: pendingRequests } = await supabase
        .from('trackino_requests')
        .select('id, title, type, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending');

      for (const r of pendingRequests ?? []) {
        notifs.push({
          id: `req-${r.id}`,
          type: 'request',
          title: r.title || 'Nová žádost',
          date: r.created_at,
          href: '/requests',
        });
      }
    }

    // Nevyřízené připomínky
    if (canViewFeedback && hasModule('feedback')) {
      const { data: unresolvedFeedback } = await supabase
        .from('trackino_feedback')
        .select('id, message, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_resolved', false);

      for (const f of unresolvedFeedback ?? []) {
        notifs.push({
          id: `fb-${f.id}`,
          type: 'feedback',
          title: (f.message ?? '').substring(0, 60) + ((f.message ?? '').length > 60 ? '…' : ''),
          date: f.created_at,
          href: '/feedback',
        });
      }
    }

    // Čekající faktury ke schválení
    if (canApproveInvoices && hasModule('invoices')) {
      const { data: pendingInvoices } = await supabase
        .from('trackino_invoices')
        .select('id, variable_symbol, billing_period_year, billing_period_month, submitted_at, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending');

      for (const inv of pendingInvoices ?? []) {
        notifs.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          title: `Faktura ${inv.variable_symbol || `${inv.billing_period_month}/${inv.billing_period_year}`}`,
          date: inv.submitted_at || inv.created_at,
          href: '/invoices',
        });
      }
    }

    // Čekající pozvánky do kalendáře
    if (hasModule('calendar')) {
      const { data: pendingAttendees } = await supabase
        .from('trackino_calendar_event_attendees')
        .select('id, event_id, created_at')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending');

      if (pendingAttendees && pendingAttendees.length > 0) {
        const eventIds = pendingAttendees.map(a => a.event_id);
        const { data: inviteEvents } = await supabase
          .from('trackino_calendar_events')
          .select('id, title')
          .in('id', eventIds);
        const eventTitleMap = new Map((inviteEvents ?? []).map(e => [e.id, e.title]));

        for (const att of pendingAttendees) {
          notifs.push({
            id: `cal-${att.id}`,
            type: 'calendar_invite',
            title: eventTitleMap.get(att.event_id) ?? 'Nová událost',
            date: att.created_at,
            href: '/calendar',
          });
        }
      }
    }

    // Revize z Znalostní báze (přiřazené přihlášenému uživateli, splatné dnes nebo dříve)
    if (hasModule('knowledge_base')) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: kbReviews } = await supabase
        .from('trackino_kb_reviews')
        .select('id, review_date, note, page_id, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('assigned_to', user.id)
        .eq('is_done', false)
        .lte('review_date', todayStr);

      if (kbReviews && kbReviews.length > 0) {
        const pageIds = (kbReviews as { page_id: string | null }[]).filter(r => r.page_id).map(r => r.page_id as string);
        const pageTitleMap = new Map<string, string>();
        if (pageIds.length > 0) {
          const { data: kbPages } = await supabase.from('trackino_kb_pages').select('id, title').in('id', pageIds);
          for (const p of kbPages ?? []) pageTitleMap.set((p as { id: string; title: string }).id, (p as { id: string; title: string }).title);
        }
        for (const r of kbReviews as { id: string; review_date: string; note: string; page_id: string | null; created_at: string }[]) {
          const pageTitle = r.page_id ? (pageTitleMap.get(r.page_id) ?? 'Stránka') : 'Znalostní báze';
          notifs.push({
            id: `kb-${r.id}`,
            type: 'kb_review',
            title: `Revize: ${pageTitle}`,
            date: r.created_at,
            href: '/knowledge-base',
          });
        }
      }
    }

    // Seřadit dle data (nejnovější nahoře)
    notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setNotifications(notifs);

    setLoading(false);
  }, [user, currentWorkspace, year, month, isWorkspaceAdmin, isManager, isMasterAdmin, currentMembership, managerAssignments, hasModule]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    loading,
    totalSeconds,
    totalEarnings,
    hasRate,
    notifications,
    weekData,
    today,
    year,
    month,
    todayHoliday,
    nameDay,
    daysInMonth,
    workingDaysTotal,
    remainingDays,
    remainingWorkingDays,
    monthProgress,
    monthHolidays,
    greetingPrefix,
    nickname,
    currency,
  };
}
