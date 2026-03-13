'use client';

import React from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  icon: React.ReactNode;
}

export function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color: accent ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.7 }}>{icon}</span>
      </div>
      <div
        className="text-2xl font-bold tabular-nums leading-tight"
        style={{ color: accent ? 'var(--primary)' : 'var(--text-primary)' }}
      >
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}
