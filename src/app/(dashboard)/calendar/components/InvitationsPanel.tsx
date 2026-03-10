'use client';
// ─── Calendar Module – InvitationsPanel ──────────────────────────────────────
// Panel s přehledem pozvánek a RSVP tlačítky.

import { useCalendarContext } from '../CalendarContext';
import { parseDate } from '../utils';

export default function InvitationsPanel() {
  const {
    showInvitationsPanel, setShowInvitationsPanel,
    attendeeEvents,
    sortedInvitations,
    invitationsTab, setInvitationsTab,
    invitationsSearch, setInvitationsSearch,
    invitationsVisibleCount, setInvitationsVisibleCount,
    workspaceMembers,
    respondToAttendance,
  } = useCalendarContext();

  if (!showInvitationsPanel) return null;

  return (
    <div className="mb-4 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Záhlaví panelu */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Pozvánky</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({attendeeEvents.length})</span>
        </div>

        {/* Filtr záložky */}
        <div className="flex gap-1 flex-1 flex-wrap">
          {([
            { id: 'all', label: 'Vše' },
            { id: 'pending', label: 'Čeká na odpověď' },
            { id: 'accepted', label: 'Přijato' },
            { id: 'maybe', label: 'Nezávazně' },
            { id: 'declined', label: 'Odmítnuto' },
          ] as const).map(tab => {
            const cnt = tab.id === 'all'
              ? attendeeEvents.length
              : tab.id === 'pending'
                ? attendeeEvents.filter(e => e.attendee_status === 'pending' || e.attendee_status === 'updated').length
                : attendeeEvents.filter(e => e.attendee_status === tab.id).length;
            if (tab.id !== 'all' && cnt === 0) return null;
            return (
              <button
                key={tab.id}
                onClick={() => { setInvitationsTab(tab.id); setInvitationsVisibleCount(20); }}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  background: invitationsTab === tab.id ? 'var(--primary)' : 'var(--bg-card)',
                  color: invitationsTab === tab.id ? 'white' : 'var(--text-muted)',
                  border: invitationsTab === tab.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                }}
              >
                {tab.label} {cnt > 0 && <span className="opacity-70">({cnt})</span>}
              </button>
            );
          })}
        </div>

        {/* Vyhledávání */}
        <div className="relative flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={invitationsSearch}
            onChange={e => { setInvitationsSearch(e.target.value); setInvitationsVisibleCount(20); }}
            placeholder="Hledat…"
            className="pl-7 pr-7 py-1 rounded-lg border text-base sm:text-xs w-36 sm:w-44"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
          {invitationsSearch && (
            <button
              onClick={() => setInvitationsSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Zavřít */}
        <button
          onClick={() => setShowInvitationsPanel(false)}
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Seznam pozvánek */}
      {sortedInvitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {invitationsSearch || invitationsTab !== 'all' ? 'Žádné pozvánky pro tento filtr' : 'Žádné pozvánky'}
          </p>
        </div>
      ) : (
        <div className="divide-y overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: '400px' }}>
          {sortedInvitations.slice(0, invitationsVisibleCount).map(ev => {
            const isDeclinedEv = ev.attendee_status === 'declined';
            const isAccepted = ev.attendee_status === 'accepted';
            const isMaybeEv = ev.attendee_status === 'maybe';
            const isPendingEv = ev.attendee_status === 'pending' || ev.attendee_status === 'updated';
            const statusColor = isPendingEv ? '#f59e0b' : isAccepted ? '#22c55e' : isMaybeEv ? '#f59e0b' : '#ef4444';
            const statusLabel = isPendingEv
              ? (ev.attendee_status === 'updated' ? '! Změna čeká' : '? Čeká na odpověď')
              : isAccepted ? '✓ Přijato' : isMaybeEv ? '~ Nezávazně' : '✗ Odmítnuto';
            const organizer = workspaceMembers.find(m => m.user_id === ev.event_owner_id);
            const dateLabel = (() => {
              try {
                const d = parseDate(ev.start_date);
                const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
                return d.toLocaleDateString('cs-CZ', opts);
              } catch { return ev.start_date; }
            })();
            return (
              <div
                key={ev.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  borderLeft: `3px solid ${ev.color}`,
                  opacity: isDeclinedEv ? 0.6 : 1,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              >
                {/* Levá část: název + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)', textDecoration: isDeclinedEv ? 'line-through' : 'none', maxWidth: '240px' }}
                    >
                      {ev.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: statusColor + '22', color: statusColor }}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{dateLabel}</span>
                    {!ev.is_all_day && ev.start_time && (
                      <span>{ev.start_time.slice(0, 5)}{ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ''}</span>
                    )}
                    {ev.is_all_day && <span>celodenní</span>}
                    {organizer && <span>· {organizer.display_name}</span>}
                  </div>
                </div>

                {/* Pravá část: RSVP tlačítka */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'accepted'); void ok; }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                    style={{ background: isAccepted ? '#15803d' : '#22c55e' }}
                    title="Přijmout"
                  >✓</button>
                  <button
                    onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'maybe'); void ok; }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                    style={{ background: isMaybeEv ? '#b45309' : '#f59e0b' }}
                    title="Nezávazně"
                  >~</button>
                  <button
                    onClick={async () => { const ok = await respondToAttendance(ev.source_id, 'declined'); void ok; }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
                    style={{ background: isDeclinedEv ? '#b91c1c' : '#ef4444' }}
                    title="Odmítnout"
                  >✗</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Načíst více */}
      {sortedInvitations.length > invitationsVisibleCount && (
        <button
          onClick={() => setInvitationsVisibleCount(invitationsVisibleCount + 20)}
          className="w-full py-2.5 text-xs font-medium transition-colors border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        >
          Načíst dalších {Math.min(20, sortedInvitations.length - invitationsVisibleCount)}
          <span style={{ color: 'var(--text-muted)' }}> ({sortedInvitations.length - invitationsVisibleCount} zbývá)</span>
        </button>
      )}
    </div>
  );
}
