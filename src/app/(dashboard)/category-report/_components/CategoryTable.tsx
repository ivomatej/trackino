'use client';

import type { CategoryStats } from './types';
import { formatHM } from './utils';

interface CategoryTableProps {
  stats: CategoryStats[];
  totalSeconds: number;
  totalCount: number;
}

export function CategoryTable({ stats, totalSeconds, totalCount }: CategoryTableProps) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold px-4 pt-4 pb-3" style={{ color: 'var(--text-primary)' }}>Přehled kategorií</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
              <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Kategorie</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Záznamy</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Hodiny</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)', minWidth: 160 }}>Podíl</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, idx) => {
              const pct = totalSeconds > 0 ? (s.totalSeconds / totalSeconds) * 100 : 0;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{s.count}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatHM(s.totalSeconds)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--bg-hover)', maxWidth: 120 }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: s.color }}
                        />
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 36 }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-hover)' }}>
              <td className="px-4 py-2.5">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Celkem</span>
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{totalCount}</td>
              <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: 'var(--primary)' }}>{formatHM(totalSeconds)}</td>
              <td className="px-4 py-2.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>100%</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
