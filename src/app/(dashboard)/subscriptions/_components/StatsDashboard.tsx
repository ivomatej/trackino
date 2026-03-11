'use client';

import { fmtPrice } from './utils';
import type { Stats } from './types';

interface StatsDashboardProps {
  stats: Stats;
}

export function StatsDashboard({ stats }: StatsDashboardProps) {
  const cards = [
    { label: 'Aktivních', value: stats.activeCount, sub: `z ${stats.totalCount} celkem`, color: '#22c55e' },
    { label: 'Měsíčně', value: fmtPrice(Math.round(stats.totalMonthly), 'CZK'), sub: 'aktivní předplatná', color: 'var(--primary)' },
    { label: 'Ročně', value: fmtPrice(Math.round(stats.totalYearly), 'CZK'), sub: 'aktivní předplatná', color: '#3b82f6' },
    { label: 'Blížící se platby', value: stats.upcomingCount, sub: 'do 30 dní', color: '#f59e0b' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {cards.map((s, i) => (
        <div key={i} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
