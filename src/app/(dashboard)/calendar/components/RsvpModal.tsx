'use client';
// ─── Calendar Module – RsvpModal ─────────────────────────────────────────────
// Přesunuto z page.tsx (ř. 5767–5840)

import { useCalendarContext } from '../CalendarContext';
import { parseDate } from '../utils';

export default function RsvpModal() {
  const {
    rsvpModalEvent, setRsvpModalEvent,
    respondToAttendance,
  } = useCalendarContext();

  if (!rsvpModalEvent) return null;

  const ev = rsvpModalEvent;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setRsvpModalEvent(null)}
    >
      <div
        className="w-full max-w-sm rounded-xl shadow-xl border p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Pozvánka na událost</h2>
          <button onClick={() => setRsvpModalEvent(null)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Info o události */}
        <div className="p-3 rounded-lg mb-4" style={{ background: ev.color + '15', border: `1px solid ${ev.color}44` }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ev.color }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ev.title}</span>
          </div>
          <p className="text-xs ml-[18px]" style={{ color: 'var(--text-secondary)' }}>
            {ev.start_date === ev.end_date
              ? parseDate(ev.start_date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
              : `${parseDate(ev.start_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })} – ${parseDate(ev.end_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })}`
            }
            {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}${ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ''}` : ''}
          </p>
          {ev.location && (
            <p className="text-xs ml-[18px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {ev.location}
            </p>
          )}
        </div>

        {/* Aktuální stav */}
        <p className="text-xs mb-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Tvůj stav:{' '}
          <span style={{
            color: ev.attendee_status === 'accepted' ? '#22c55e' :
                   ev.attendee_status === 'declined' ? '#ef4444' :
                   ev.attendee_status === 'maybe' ? '#f59e0b' :
                   ev.attendee_status === 'updated' ? '#f59e0b' : 'var(--text-secondary)',
            fontWeight: 600,
          }}>
            {ev.attendee_status === 'accepted' ? '✓ Přijato' :
             ev.attendee_status === 'declined' ? '✗ Odmítnuto' :
             ev.attendee_status === 'maybe' ? '~ Nezávazně' :
             ev.attendee_status === 'updated' ? '! Změna čeká na potvrzení' : '? Čeká na odpověď'}
          </span>
        </p>

        {/* RSVP tlačítka */}
        <div className="flex gap-2">
          <button
            onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'accepted'); if (ok) setRsvpModalEvent(null); }}
            className="flex-1 py-2.5 px-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: ev.attendee_status === 'accepted' ? '#15803d' : '#22c55e' }}
          >
            ✓ {ev.attendee_status === 'updated' ? 'Beru na vědomí' : 'Přijmout'}
          </button>
          <button
            onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'maybe'); if (ok) setRsvpModalEvent(null); }}
            className="flex-1 py-2.5 px-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: ev.attendee_status === 'maybe' ? '#b45309' : '#f59e0b' }}
          >
            ~ Nezávazně
          </button>
          <button
            onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'declined'); if (ok) setRsvpModalEvent(null); }}
            className="flex-1 py-2.5 px-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: ev.attendee_status === 'declined' ? '#b91c1c' : '#ef4444' }}
          >
            ✗ Odmítnout
          </button>
        </div>
      </div>
    </div>
  );
}
