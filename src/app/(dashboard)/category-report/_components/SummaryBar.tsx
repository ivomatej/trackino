'use client';

import { formatHM } from './utils';

interface SummaryBarProps {
  totalSeconds: number;
  totalCount: number;
  categoryCount: number;
}

export function SummaryBar({ totalSeconds, totalCount, categoryCount }: SummaryBarProps) {
  return (
    <div className="flex items-center gap-6 mb-6 px-4 py-3 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Celkem odpracováno</div>
        <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatHM(totalSeconds)} h</div>
      </div>
      <div className="w-px h-8" style={{ background: 'var(--border)' }} />
      <div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Záznamů</div>
        <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalCount}</div>
      </div>
      <div className="w-px h-8" style={{ background: 'var(--border)' }} />
      <div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Kategorií</div>
        <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{categoryCount}</div>
      </div>
    </div>
  );
}
