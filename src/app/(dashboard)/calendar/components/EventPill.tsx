'use client';
// ─── Calendar Module – EventPill ──────────────────────────────────────────────
// Přesunuto z page.tsx (ř. 2788–2825)

import type { DisplayEvent } from '../types';

interface EventPillProps {
  ev: DisplayEvent;
  compact?: boolean;
  wrap?: boolean;
  onEventClick: (ev: DisplayEvent) => void;
}

export default function EventPill({ ev, compact = false, wrap = false, onEventClick }: EventPillProps) {
  const isDeclined = ev.attendee_status === 'declined';
  const isMaybe = ev.attendee_status === 'maybe';
  const isPendingOrUpdated = ev.attendee_status === 'pending' || ev.attendee_status === 'updated';
  const prefix = isPendingOrUpdated ? '? ' : isMaybe ? '~ ' : '';
  return (
    <div
      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
      className={`${compact ? 'px-1 py-0.5 text-[10px] leading-[14px]' : 'px-1.5 py-0.5 text-xs'} rounded font-medium ${wrap ? 'break-words' : 'truncate'} relative`}
      style={{
        background: isDeclined ? ev.color + '0d' : ev.color + '22',
        color: isDeclined ? ev.color + '99' : ev.color,
        border: isPendingOrUpdated ? `2px dashed ${ev.color}` : isMaybe ? `1px dashed ${ev.color}88` : `1px solid ${ev.color}44`,
        opacity: isDeclined ? 0.5 : 1,
        cursor: 'pointer',
        textDecoration: isDeclined ? 'line-through' : 'none',
      }}
      title={
        isPendingOrUpdated ? `${ev.title} – čeká na potvrzení` :
        ev.attendee_status === 'updated' ? `${ev.title} – událost byla změněna` :
        isDeclined ? `${ev.title} – odmítnuto` :
        isMaybe ? `${ev.title} – nezávazně` :
        ev.title
      }
    >
      {ev.is_recurring && (
        <svg width={compact ? 8 : 9} height={compact ? 8 : 9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-0.5 top-0.5 flex-shrink-0" style={{ opacity: 0.7 }}>
          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      )}
      <span className={wrap ? 'break-words' : 'truncate'}>
        {prefix}
        {!ev.is_all_day && ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ''}
        {ev.title}
      </span>
    </div>
  );
}
