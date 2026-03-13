'use client';

import type { ImportantDay } from '@/types/database';
import { formatDate, recurringLabel } from './utils';

interface Props {
  entry: ImportantDay;
  onEdit: (entry: ImportantDay) => void;
  onDelete: (id: string) => void;
}

export default function ImportantDayItem({ entry, onEdit, onDelete }: Props) {
  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
    >
      {/* Barevný pruh vlevo */}
      <div
        className="flex-shrink-0 w-1.5 self-stretch rounded-full"
        style={{ background: entry.color }}
      />

      {/* Barevný puntík */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
        style={{ background: entry.color + '22', border: `2px solid ${entry.color}44` }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={entry.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M8 14h.01" /><path d="M12 14h.01" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{entry.title}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {entry.is_recurring ? (
            <span>
              {recurringLabel(entry.recurring_type)} – od {formatDate(entry.start_date)}
            </span>
          ) : entry.start_date === entry.end_date ? (
            formatDate(entry.start_date)
          ) : (
            `${formatDate(entry.start_date)} – ${formatDate(entry.end_date)}`
          )}
        </div>
        {entry.note && (
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{entry.note}</div>
        )}
      </div>

      {/* Badge opakování */}
      {entry.is_recurring && (
        <span
          className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: entry.color + '22', color: entry.color }}
        >
          {recurringLabel(entry.recurring_type)}
        </span>
      )}

      {/* Akce */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(entry)}
          className="p-1.5 rounded-lg transition-colors"
          title="Upravit"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="p-1.5 rounded-lg transition-colors"
          title="Smazat"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-light)'; e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
