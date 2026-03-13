'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { CZECH_MONTH_NAMES_TITLE } from '@/lib/czech-calendar';
import { useDashboard } from './useDashboard';
import { StatCard } from './StatCard';
import { GreetingCard } from './GreetingCard';
import { NotificationsPanel } from './NotificationsPanel';
import { WeekChart } from './WeekChart';
import { MonthOverview } from './MonthOverview';
import { fmtHours, fmtEarnings } from './utils';

export function DashboardContent() {
  const { hasModule } = useWorkspace();
  const {
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
  } = useDashboard();

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
      <GreetingCard
        greetingPrefix={greetingPrefix}
        nickname={nickname}
        today={today}
        nameDay={nameDay}
        todayHoliday={todayHoliday}
      />

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
          <NotificationsPanel notifications={notifications} />
          <WeekChart weekData={weekData} />
        </div>
      )}

      {/* Přehled měsíce */}
      <MonthOverview
        month={month}
        year={year}
        today={today}
        daysInMonth={daysInMonth}
        workingDaysTotal={workingDaysTotal}
        monthProgress={monthProgress}
        monthHolidays={monthHolidays}
      />
    </div>
  );
}
