'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { CategoryStats } from './types';
import { formatHM, formatHMFull } from './utils';

// ─── Custom tooltip ────────────────────────────────────────────────────────────

const BarTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryStats }> }) => {
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

interface CategoryBarChartProps {
  stats: CategoryStats[];
}

export function CategoryBarChart({ stats }: CategoryBarChartProps) {
  return (
    <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Odpracované hodiny dle kategorie</h2>
      <ResponsiveContainer width="100%" height={Math.max(160, stats.length * 44)}>
        <BarChart
          data={stats}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tickFormatter={v => formatHM(v as number)}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' as string }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: 'var(--text-primary)' as string }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<BarTooltip />} />
          <Bar dataKey="totalSeconds" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {stats.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
