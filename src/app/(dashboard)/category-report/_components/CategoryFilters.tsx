'use client';

import type { Preset } from './types';

const inputCls = 'px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Dnes' },
  { key: 'week', label: 'Týden' },
  { key: 'month', label: 'Měsíc' },
  { key: 'custom', label: 'Vlastní' },
];

interface CategoryFiltersProps {
  preset: Preset;
  from: string;
  to: string;
  today: string;
  selectedUserId: string | null;
  members: Array<{ userId: string; name: string }>;
  canAdmin: boolean;
  isManager: boolean;
  onPresetChange: (p: Preset) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onUserChange: (v: string | null) => void;
}

export function CategoryFilters({
  preset,
  from,
  to,
  today,
  selectedUserId,
  members,
  canAdmin,
  isManager,
  onPresetChange,
  onFromChange,
  onToChange,
  onUserChange,
}: CategoryFiltersProps) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => onPresetChange(p.key)}
          className="px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
          style={{
            borderColor: preset === p.key ? 'var(--primary)' : 'var(--border)',
            background: preset === p.key ? 'var(--primary-light)' : 'var(--bg-card)',
            color: preset === p.key ? 'var(--primary)' : 'var(--text-secondary)',
          }}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={e => onFromChange(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>–</span>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={e => onToChange(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      )}
      {(canAdmin || isManager) && members.length > 1 && (
        <div className="relative ml-auto sm:ml-2">
          <select
            value={selectedUserId ?? ''}
            onChange={e => onUserChange(e.target.value || null)}
            className="px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none pr-8"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <option value="">Všichni uživatelé</option>
            {members.map(m => (
              <option key={m.userId} value={m.userId}>{m.name}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-muted)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}
    </div>
  );
}
