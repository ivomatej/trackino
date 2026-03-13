'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { type WeekDayData } from './types';
import { fmtHours } from './utils';

interface WeekChartProps {
  weekData: WeekDayData[];
}

export function WeekChart({ weekData }: WeekChartProps) {
  if (weekData.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
          </svg>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Posledních 7 dní
          </h2>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {fmtHours(Math.round(weekData.reduce((a, b) => a + b.hours, 0) * 3600))} celkem
        </span>
      </div>
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              unit="h"
            />
            <Tooltip
              cursor={{ fill: 'var(--bg-hover)', radius: 4 }}
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                boxShadow: 'var(--shadow-md)',
              }}
              formatter={(value: number | undefined) => [`${value ?? 0} h`, 'Odpracováno']}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            />
            <Bar
              dataKey="hours"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              fill="var(--primary)"
              opacity={0.85}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {(() => {
        const avg = weekData.reduce((a, b) => a + b.hours, 0) / 7;
        const todayH = weekData.find(d => d.isToday)?.hours ?? 0;
        const diff = todayH - avg;
        return avg > 0 ? (
          <div className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
            Průměr: {Math.round(avg * 10) / 10} h/den
            {todayH > 0 && diff !== 0 && (
              <span style={{ color: diff > 0 ? '#10b981' : '#ef4444', marginLeft: 8 }}>
                {diff > 0 ? '▲' : '▼'} dnes {diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10} h oproti průměru
              </span>
            )}
          </div>
        ) : null;
      })()}
    </div>
  );
}
