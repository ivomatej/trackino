'use client';

import type { DomainStats } from './types';

interface Props {
  stats: DomainStats;
}

export function StatsDashboard({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Celkem',     value: stats.total,      color: 'var(--primary)' },
        { label: 'Aktivní',    value: stats.active,     color: '#22c55e' },
        { label: 'Expirující', value: stats.expiring,   color: '#f59e0b' },
        { label: 'Dobíhá',     value: stats.windingDown, color: '#8b5cf6' },
        { label: 'Expirované', value: stats.expired,    color: '#ef4444' },
      ].map(card => (
        <div key={card.label} className="rounded-xl border p-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
          <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
