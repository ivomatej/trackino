'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
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
import type { WorkspaceMember, MemberRate } from '@/types/database';

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
  const { currentWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [hasRate, setHasRate] = useState(false);

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

    setLoading(false);
  }, [user, currentWorkspace, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pozdrav dle části dne
  const hour = today.getHours();
  const greetingPrefix = hour < 12 ? 'Dobré ráno' : hour < 17 ? 'Dobrý den' : 'Dobrý večer';
  const firstName = profile?.display_name?.split(' ')[0] ?? profile?.display_name ?? 'uživateli';

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
              {greetingPrefix}, {firstName}!
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
