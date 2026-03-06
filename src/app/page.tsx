'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import {
  getNameDay,
  getCzechHolidays,
  isCzechHoliday,
  getWorkingDaysInMonth,
  getRemainingWorkingDays,
  getRemainingDaysInMonth,
  getDaysInMonth,
  CZECH_MONTH_NAMES_TITLE,
} from '@/lib/czech-calendar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkspaceMember, MemberRate } from '@/types/database';

// ── notification types ────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  type: 'vacation' | 'request' | 'feedback' | 'invoice';
  title: string;
  date: string;
  href: string;
}

interface WeekDayData {
  day: string;
  hours: number;
  isToday: boolean;
}

const CZECH_SHORT_DAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmtEarnings(amount: number, currency: string): string {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : 'Kč';
  const formatted = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  return `${formatted} ${sym}`;
}

function getCzechDay(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon: React.ReactNode;
}

function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color: accent ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.7 }}>{icon}</span>
      </div>
      <div
        className="text-2xl font-bold tabular-nums leading-tight"
        style={{ color: accent ? 'var(--primary)' : 'var(--text-primary)' }}
      >
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── main content ──────────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, profile } = useAuth();
  const { currentWorkspace, currentMembership, managerAssignments, isManagerOf, hasModule } = useWorkspace();
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

  // Svátky tento měsíc
  const monthHolidays = holidays.filter(h => h.date.getMonth() === month && h.date.getFullYear() === year);

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

    // Seřadit dle data (nejnovější nahoře)
    notifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setNotifications(notifs);

    setLoading(false);
  }, [user, currentWorkspace, year, month, isWorkspaceAdmin, isManager, isMasterAdmin, currentMembership, managerAssignments, hasModule]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pozdrav dle části dne
  const hour = today.getHours();
  const greetingPrefix = hour < 12 ? 'Dobré ráno' : hour < 17 ? 'Dobrý den' : 'Dobrý večer';
  const nickname = profile?.display_nickname?.trim()
    || profile?.display_name?.split(' ')[0]
    || 'uživateli';

  const currency = currentWorkspace?.currency ?? 'CZK';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">

      {/* Pozdrav */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {greetingPrefix}, {nickname}!
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Tady máš přehled aktivit. Ať ti jde práce od ruky!
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {getCzechDay(today)}
            </div>
            {(nameDay || todayHoliday.isHoliday) && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {todayHoliday.isHoliday
                  ? <span style={{ color: 'var(--primary)' }}>🎉 {todayHoliday.name}</span>
                  : <>Dnes slaví svátek: <strong style={{ color: 'var(--text-secondary)' }}>{nameDay}</strong></>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statistiky */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {hasRate && (
          <StatCard
            label="Výdělek tento měsíc"
            value={fmtEarnings(totalEarnings, currency)}
            sub={`za ${CZECH_MONTH_NAMES_TITLE[month].toLowerCase()} ${year}`}
            accent
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />
        )}
        <StatCard
          label="Odpracováno"
          value={fmtHours(totalSeconds)}
          sub={`za ${CZECH_MONTH_NAMES_TITLE[month].toLowerCase()} ${year}`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <StatCard
          label="Zbývá dní"
          value={String(remainingDays)}
          sub={`do konce ${CZECH_MONTH_NAMES_TITLE[month].toLowerCase() === 'leden' ? 'ledna' : CZECH_MONTH_NAMES_TITLE[month].toLowerCase().replace(/en$/, 'na').replace(/ec$/, 'ce')}`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          label="Pracovní dny"
          value={String(remainingWorkingDays)}
          sub={`zbývá z ${workingDaysTotal} pracovních dnů`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
      </div>

      {/* Notifikace „K vyřízení" + Týdenní graf – vedle sebe */}
      {(notifications.length > 0 || weekData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Notifikace */}
          {notifications.length > 0 && (
            <div
              className="rounded-xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  K vyřízení
                </h2>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--primary)', color: 'white' }}
                >
                  {notifications.length}
                </span>
              </div>
              <div className="space-y-1 max-h-[172px] overflow-y-auto">
                {notifications.map(n => {
                  const icon = n.type === 'vacation' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  ) : n.type === 'request' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                  ) : n.type === 'feedback' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                  );

                  const typeColor = n.type === 'vacation' ? '#10b981' : n.type === 'request' ? '#6366f1' : n.type === 'feedback' ? '#f59e0b' : '#3b82f6';
                  const typeLabel = n.type === 'vacation' ? 'Dovolená' : n.type === 'request' ? 'Žádost' : n.type === 'feedback' ? 'Připomínka' : 'Faktura';

                  const dateStr = new Date(n.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
                  const timeStr = new Date(n.date).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <a
                      key={n.id}
                      href={n.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: typeColor + '18', color: typeColor }}
                      >
                        {icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {n.title}
                        </div>
                        <div className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                          <span className="font-medium" style={{ color: typeColor }}>{typeLabel}</span>
                          <span>·</span>
                          <span>{dateStr}, {timeStr}</span>
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="flex-shrink-0 opacity-40">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Týdenní graf */}
          {weekData.length > 0 && (
            <div
              className="rounded-xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                  </svg>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Posledních 7 dní
                  </h2>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {fmtHours(Math.round(weekData.reduce((a, b) => a + b.hours, 0) * 3600))} celkem
                </span>
              </div>
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      unit="h"
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-hover)', radius: 4 }}
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        boxShadow: 'var(--shadow-md)',
                      }}
                      formatter={(value: number | undefined) => [`${value ?? 0} h`, 'Odpracováno']}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    />
                    <Bar
                      dataKey="hours"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                      fill="var(--primary)"
                      opacity={0.85}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {(() => {
                const avg = weekData.reduce((a, b) => a + b.hours, 0) / 7;
                const todayH = weekData.find(d => d.isToday)?.hours ?? 0;
                const diff = todayH - avg;
                return avg > 0 ? (
                  <div className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                    Průměr: {Math.round(avg * 10) / 10} h/den
                    {todayH > 0 && diff !== 0 && (
                      <span style={{ color: diff > 0 ? '#10b981' : '#ef4444', marginLeft: 8 }}>
                        {diff > 0 ? '▲' : '▼'} dnes {diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10} h oproti průměru
                      </span>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Přehled měsíce */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {CZECH_MONTH_NAMES_TITLE[month]} {year}
        </h2>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            <span>1. {CZECH_MONTH_NAMES_TITLE[month].toLowerCase()}</span>
            <span>{today.getDate()}. den</span>
            <span>{daysInMonth}. {CZECH_MONTH_NAMES_TITLE[month].toLowerCase()}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${monthProgress}%`, background: 'var(--primary)' }}
            />
          </div>
          <div className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
            {monthProgress} % měsíce uplynulo
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Celkem dní', value: String(daysInMonth) },
            { label: 'Pracovní dny', value: String(workingDaysTotal) },
            { label: 'Víkendy + svátky', value: String(daysInMonth - workingDaysTotal) },
          ].map(item => (
            <div key={item.label} className="text-center py-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
              <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Svátky tento měsíc */}
        {monthHolidays.length > 0 && (
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Státní svátky v {CZECH_MONTH_NAMES_TITLE[month].toLowerCase() === 'leden' ? 'lednu' : CZECH_MONTH_NAMES_TITLE[month].toLowerCase().replace(/ec$/, 'ci').replace(/en$/, 'nu')}
            </div>
            <div className="space-y-1.5">
              {monthHolidays.map((h) => {
                const isToday = h.date.toDateString() === today.toDateString();
                return (
                  <div
                    key={h.date.toISOString()}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: isToday ? 'var(--bg-active)' : 'transparent',
                      border: isToday ? '1px solid var(--primary)' : '1px solid transparent',
                    }}
                  >
                    <span
                      className="font-bold tabular-nums w-6 text-center"
                      style={{ color: isToday ? 'var(--primary)' : 'var(--text-muted)' }}
                    >
                      {h.date.getDate()}.
                    </span>
                    <span style={{ color: isToday ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {h.name}
                    </span>
                    {isToday && (
                      <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--primary)', color: 'white' }}>
                        dnes
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {monthHolidays.length === 0 && (
          <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
            V tomto měsíci nejsou žádné státní svátky.
          </p>
        )}
      </div>
    </div>
  );
}

// ── dashboard wrapper ─────────────────────────────────────────────────────────

function DashboardWrapper() {
  const { currentWorkspace, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return <WorkspaceSelector />;
  }

  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

// ── page wrapper ──────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <DashboardWrapper />
    </WorkspaceProvider>
  );
}
