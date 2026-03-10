'use client';
// ─── Calendar Module – EventDetailModal ──────────────────────────────────────
// Přesunuto z page.tsx (ř. 5843–5093)

import { useCalendarContext } from '../CalendarContext';
import { parseDate } from '../utils';
import { getRecurrenceLabel } from '../recurrenceUtils';

export default function EventDetailModal() {
  const {
    detailEvent, setDetailEvent,
    calendars, subscriptions, events,
    eventAttendees, workspaceMembers,
    respondToAttendance,
    openEditEvent,
  } = useCalendarContext();

  if (!detailEvent) return null;

  const ev = detailEvent;
  const isOwnManual = ev.source === 'manual' && !ev.is_shared && !ev.attendee_status;
  const isShared = ev.is_shared || ev.source === 'shared';
  const isAttendee = !!ev.attendee_status;
  const isNameday = ev.source === 'nameday';
  const isBirthday = ev.source === 'birthday';
  const isEditable = isOwnManual;

  // Kalendář / zdroj
  const calName = ev.calendar_id
    ? calendars.find(c => c.id === ev.calendar_id)?.name
    : null;
  const subName = ev.source === 'subscription'
    ? subscriptions.find(s => s.id === ev.source_id)?.name
    : null;
  const sourceName = isNameday ? 'Jmeniny' : isBirthday ? 'Narozeniny' : (calName ?? subName ?? null);

  // Datum
  const multiDay = ev.start_date !== ev.end_date;
  const fmtDate = (d: string) => parseDate(d).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  const dateStr = multiDay
    ? `${parseDate(ev.start_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })} – ${parseDate(ev.end_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}`
    : fmtDate(ev.start_date);
  const timeStr = !ev.is_all_day && ev.start_time
    ? `${ev.start_time.slice(0, 5)}${ev.end_time ? ' – ' + ev.end_time.slice(0, 5) : ''}`
    : 'Celý den';

  // Účastníci (pro vlastní události)
  const attendeeList = isOwnManual ? (eventAttendees[ev.source_id] ?? []) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailEvent(null)}>
      <div
        className="w-full max-w-md rounded-xl shadow-xl border flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Záhlaví */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: ev.color }} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{ev.title}</h2>
              {sourceName && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sourceName}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setDetailEvent(null)}
            className="p-1 rounded flex-shrink-0 hover:opacity-60 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tělo */}
        <div className="overflow-y-auto px-5 pb-5 space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {/* Datum + čas */}
          <div className="flex items-start gap-2.5">
            <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <div>{dateStr}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{timeStr}</div>
            </div>
          </div>

          {/* Opakování */}
          {ev.recurrence_type && ev.recurrence_type !== 'none' && (
            <div className="flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              <span>{getRecurrenceLabel(ev.recurrence_type)}{ev.recurrence_type === 'monthly_on_day' && ev.recurrence_day ? ` (${ev.recurrence_day}.)` : ''}</span>
            </div>
          )}

          {/* Místo */}
          {ev.location && (
            <div className="flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{ev.location}</span>
            </div>
          )}

          {/* URL */}
          {ev.url && (
            <div className="flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }}>{ev.url}</a>
            </div>
          )}

          {/* Popis / poznámka */}
          {ev.description && (
            <div className="flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
                <line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
              </svg>
              <span className="whitespace-pre-wrap">{ev.description}</span>
            </div>
          )}

          {/* Sdíleno od / Organizátor */}
          {(isShared || isAttendee) && ev.shared_owner_name && (
            <div className="flex items-center gap-2.5">
              <svg className="flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span>{isAttendee ? 'Organizátor:' : 'Sdíleno od:'} <strong>{ev.shared_owner_name}</strong></span>
            </div>
          )}

          {/* Účastníci (pro vlastní události) */}
          {attendeeList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Účastníci</span>
              </div>
              <div className="space-y-1 pl-5">
                {attendeeList.map(att => {
                  const m = workspaceMembers.find(x => x.user_id === att.user_id);
                  const statusIcon = att.status === 'accepted' ? '✓' : att.status === 'declined' ? '✗' : att.status === 'updated' ? '!' : '?';
                  const statusColor = att.status === 'accepted' ? '#22c55e' : att.status === 'declined' ? '#ef4444' : att.status === 'updated' ? '#f59e0b' : '#9ca3af';
                  return (
                    <div key={att.id} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: m?.avatar_color ?? '#6b7280' }}>
                        {(m?.display_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m?.display_name ?? 'Uživatel'}</span>
                      <span className="ml-auto font-bold text-[11px]" style={{ color: statusColor }}>{statusIcon}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upozornění */}
          {ev.reminder_minutes != null && ev.reminder_minutes > 0 && (
            <div className="flex items-center gap-2.5">
              <svg className="flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span>{ev.reminder_minutes < 60 ? `${ev.reminder_minutes} min` : ev.reminder_minutes === 60 ? '1 hodina' : '1 den'} před událostí</span>
            </div>
          )}

          {/* Blok změn – zobrazí se příjemci, pokud organizátor upravil událost po přijetí */}
          {isAttendee && ev.attendee_status === 'updated' && (() => {
            const p = ev;
            const fmtD = (d: string) => parseDate(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
            const prevMultiDay = p.attendee_prev_start_date && p.attendee_prev_end_date && p.attendee_prev_start_date !== p.attendee_prev_end_date;
            const prevDateStr = p.attendee_prev_start_date
              ? prevMultiDay
                ? `${fmtD(p.attendee_prev_start_date)} – ${fmtD(p.attendee_prev_end_date!)}`
                : fmtD(p.attendee_prev_start_date)
              : null;
            const prevTimeStr = p.attendee_prev_start_time
              ? `${p.attendee_prev_start_time.slice(0, 5)}${p.attendee_prev_end_time ? ' – ' + p.attendee_prev_end_time.slice(0, 5) : ''}`
              : (p.attendee_prev_start_date != null ? 'Celý den' : null);
            const dateChanged = p.attendee_prev_start_date != null && (
              p.attendee_prev_start_date !== p.start_date || (p.attendee_prev_end_date ?? p.attendee_prev_start_date) !== p.end_date
            );
            const timeChanged = p.attendee_prev_start_date != null && (
              (p.attendee_prev_start_time ?? null) !== (p.start_time ?? null) ||
              (p.attendee_prev_end_time ?? null) !== (p.end_time ?? null)
            );
            const locationChanged = p.attendee_prev_location != null && p.attendee_prev_location !== '' &&
              p.attendee_prev_location !== (p.location ?? '');
            const locationAdded = p.attendee_prev_location === '' && !!(p.location ?? '');
            const descChanged = p.attendee_prev_description != null && p.attendee_prev_description !== '' &&
              p.attendee_prev_description !== (p.description ?? '');
            const descAdded = p.attendee_prev_description === '' && !!(p.description ?? '');
            const hasSpecificChanges = dateChanged || timeChanged || locationChanged || locationAdded || descChanged || descAdded;
            return (
              <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: '#f59e0b18', borderLeft: '3px solid #f59e0b', color: 'var(--text-secondary)' }}>
                <div className="font-semibold mb-1" style={{ color: '#f59e0b' }}>⚠ Událost byla upravena organizátorem</div>
                {hasSpecificChanges ? (
                  <>
                    {dateChanged && prevDateStr && (
                      <div>Datum: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{prevDateStr}</span> → {dateStr}</div>
                    )}
                    {timeChanged && prevTimeStr && (
                      <div>Čas: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{prevTimeStr}</span> → {timeStr}</div>
                    )}
                    {locationChanged && (
                      <div>Místo: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{p.attendee_prev_location}</span> → {p.location || '—'}</div>
                    )}
                    {locationAdded && (
                      <div>Místo přidáno: {p.location}</div>
                    )}
                    {(descChanged || descAdded) && (
                      <div>Poznámka byla upravena</div>
                    )}
                  </>
                ) : (
                  <div style={{ opacity: 0.7 }}>Podrobnosti změny nejsou k dispozici.</div>
                )}
              </div>
            );
          })()}

          {/* RSVP status pro attendee */}
          {isAttendee && (
            <div className="pt-1 space-y-2">
              <div className="text-center text-xs py-1 rounded-lg font-medium" style={{
                background: ev.attendee_status === 'accepted' ? '#22c55e22' :
                            ev.attendee_status === 'declined' ? '#ef444422' :
                            ev.attendee_status === 'maybe' ? '#f59e0b22' :
                            ev.attendee_status === 'updated' ? '#f59e0b22' : 'var(--bg-hover)',
                color: ev.attendee_status === 'accepted' ? '#22c55e' :
                       ev.attendee_status === 'declined' ? '#ef4444' :
                       ev.attendee_status === 'maybe' ? '#f59e0b' :
                       ev.attendee_status === 'updated' ? '#f59e0b' : 'var(--text-muted)',
              }}>
                {ev.attendee_status === 'accepted' ? '✓ Přijato' :
                 ev.attendee_status === 'declined' ? '✗ Odmítnuto' :
                 ev.attendee_status === 'maybe' ? '~ Nezávazně' :
                 ev.attendee_status === 'updated' ? '! Změna čeká na potvrzení' : '? Čeká na odpověď'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'accepted'); if (ok) setDetailEvent(null); }}
                  className="flex-1 py-2 px-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-85"
                  style={{ background: ev.attendee_status === 'accepted' ? '#15803d' : '#22c55e' }}
                >✓ {ev.attendee_status === 'updated' ? 'Beru na vědomí' : 'Přijmout'}</button>
                <button
                  onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'maybe'); if (ok) setDetailEvent(null); }}
                  className="flex-1 py-2 px-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-85"
                  style={{ background: ev.attendee_status === 'maybe' ? '#b45309' : '#f59e0b' }}
                >~ Nezávazně</button>
                <button
                  onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'declined'); if (ok) setDetailEvent(null); }}
                  className="flex-1 py-2 px-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-85"
                  style={{ background: ev.attendee_status === 'declined' ? '#b91c1c' : '#ef4444' }}
                >✗ Odmítnout</button>
              </div>
            </div>
          )}
        </div>

        {/* Patička – Edit tlačítko */}
        {isEditable && (
          <div className="px-5 pb-4 pt-2 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => {
                const orig = events.find(x => x.id === ev.source_id);
                if (orig) { setDetailEvent(null); openEditEvent(orig); }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Upravit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
