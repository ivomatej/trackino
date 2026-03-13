'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { CategoryStats } from './types';
import { formatHM, formatHMFull } from './utils';

// ─── Custom tooltip ────────────────────────────────────────────────────────────

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: CategoryStats }> }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
      <div className="font-semibold mb-0.5">{d.name}</div>
      <div>{formatHMFull(d.totalSeconds)}</div>
      <div style={{ color: 'var(--text-muted)' }}>{d.count} záznamů</div>
    </div>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

interface CategoryPieChartProps {
  stats: CategoryStats[];
  totalSeconds: number;
}

export function CategoryPieChart({ stats, totalSeconds }: CategoryPieChartProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {/* Pie chart */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Rozložení kategorií</h2>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={stats}
              dataKey="totalSeconds"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={40}
              paddingAngle={2}
            >
              {stats.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / quick stats */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Kategorie</h2>
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 256 }}>
          {stats.map((s, idx) => {
            const pct = totalSeconds > 0 ? Math.round((s.totalSeconds / totalSeconds) * 100) : 0;
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)', minWidth: 44, textAlign: 'right' }}>{formatHM(s.totalSeconds)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
