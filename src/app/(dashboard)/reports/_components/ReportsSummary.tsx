'use client';

import { fmtDuration, fmtCost } from './utils';

interface PerUserStat {
  userId: string;
  seconds: number;
  cost: number;
}

interface ReportsSummaryProps {
  totalSeconds: number;
  totalCost: number;
  hasCosts: boolean;
  currencySymbol: string;
  entriesCount: number;
  sortedDaysCount: number;
  perUserStats: PerUserStat[];
  canSeeOthers: boolean;
  loading: boolean;
  memberName: (userId: string) => string;
}

export function ReportsSummary({
  totalSeconds, totalCost, hasCosts, currencySymbol,
  entriesCount, sortedDaysCount, perUserStats, canSeeOthers, loading, memberName,
}: ReportsSummaryProps) {
  return (
    <>
      {/* Souhrn */}
      <div className={`grid gap-4 ${hasCosts ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Celkem odpracováno</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {fmtDuration(totalSeconds)}
          </div>
        </div>
        {hasCosts && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Výdělek</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
              {fmtCost(totalCost)} {currencySymbol}
            </div>
          </div>
        )}
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Počet záznamů</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {entriesCount}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Průměr / den</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {sortedDaysCount > 0 ? fmtDuration(Math.round(totalSeconds / sortedDaysCount)) : '0:00'}
          </div>
        </div>
      </div>

      {/* Per-uživatelský přehled nákladů */}
      {canSeeOthers && !loading && perUserStats.length > 1 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přehled per uživatel</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {perUserStats.map(stat => {
              const name = memberName(stat.userId);
              return (
                <div key={stat.userId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</div>
                  <div className="text-sm tabular-nums font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDuration(stat.seconds)}
                  </div>
                  {stat.cost > 0 && (
                    <div className="text-sm tabular-nums font-semibold" style={{ color: 'var(--primary)', minWidth: '80px', textAlign: 'right' }}>
                      {fmtCost(stat.cost)} {currencySymbol}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
