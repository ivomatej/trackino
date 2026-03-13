'use client';

import { CZECH_MONTH_NAMES_TITLE } from '@/lib/czech-calendar';

interface MonthHoliday {
  date: Date;
  name: string;
}

interface MonthOverviewProps {
  month: number;
  year: number;
  today: Date;
  daysInMonth: number;
  workingDaysTotal: number;
  monthProgress: number;
  monthHolidays: MonthHoliday[];
}

export function MonthOverview({
  month,
  year,
  today,
  daysInMonth,
  workingDaysTotal,
  monthProgress,
  monthHolidays,
}: MonthOverviewProps) {
  return (
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
  );
}
