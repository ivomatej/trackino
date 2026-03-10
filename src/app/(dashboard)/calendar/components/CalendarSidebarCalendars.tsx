'use client';
// ─── Calendar Module – CalendarSidebarCalendars ───────────────────────────────
// Sekce „Mé kalendáře" a „EXTERNÍ KALENDÁŘE" v levém panelu.

import { useCalendarContext } from '../CalendarContext';

export default function CalendarSidebarCalendars() {
  const {
    sortedCalendars,
    selectedCalendarIds, setSelectedCalendarIds,
    myCalExpanded, setMyCalExpanded,
    extCalExpanded, setExtCalExpanded,
    openNewCalendar, openEditCalendar, deleteCalendar,
    moveCalendar,
    calendarShares,
    openShareModal,
    subscriptions,
    sortedSubscriptions,
    toggleSubscription,
    openEditSub, openNewSub,
    moveSubscription,
    icsRefreshing, setIcsRefreshToken,
  } = useCalendarContext();

  return (
    <>
      {/* ── Mé kalendáře ─────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setMyCalExpanded(!myCalExpanded)}
            className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            MÉ KALENDÁŘE
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: myCalExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <button
            onClick={openNewCalendar}
            className="p-0.5 rounded transition-colors"
            title="Přidat kalendář"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        {myCalExpanded && sortedCalendars.map((cal, calIdx) => (
          <div key={cal.id} className="flex items-center gap-1.5 py-0.5 group/cal">
            <button
              role="checkbox"
              aria-checked={selectedCalendarIds.has(cal.id)}
              onClick={() => {
                setSelectedCalendarIds(prev => {
                  const next = new Set(prev);
                  if (next.has(cal.id)) next.delete(cal.id);
                  else next.add(cal.id);
                  return next;
                });
              }}
              className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
              style={{
                background: selectedCalendarIds.has(cal.id) ? cal.color : 'transparent',
                borderColor: cal.color,
              }}
            >
              {selectedCalendarIds.has(cal.id) && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
            <span className="text-xs flex-1 truncate min-w-0 cursor-pointer" onClick={() => openEditCalendar(cal)} style={{ color: 'var(--text-primary)' }}>
              {cal.name}
            </span>
            {/* Šipky nahoru/dolů */}
            <div className="opacity-0 group-hover/cal:opacity-100 flex flex-col transition-opacity flex-shrink-0">
              <button onClick={() => moveCalendar(cal.id, -1)} disabled={calIdx === 0} className="p-0 leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} title="Nahoru">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button onClick={() => moveCalendar(cal.id, 1)} disabled={calIdx === sortedCalendars.length - 1} className="p-0 leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} title="Dolů">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <button
              onClick={() => openEditCalendar(cal)}
              className="opacity-0 group-hover/cal:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
              title="Upravit"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => openShareModal(cal)}
              className="opacity-0 group-hover/cal:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded flex-shrink-0"
              style={{ color: calendarShares.some(s => s.calendar_id === cal.id) ? 'var(--primary)' : 'var(--text-muted)' }}
              title="Sdílet kalendář"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            {!cal.is_default && (
              <button
                onClick={async () => {
                  if (confirm('Smazat tento kalendář? Budou smazány i všechny jeho události.')) {
                    await deleteCalendar(cal.id);
                  }
                }}
                className="opacity-0 group-hover/cal:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded flex-shrink-0"
                style={{ color: '#ef4444' }}
                title="Smazat"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── EXTERNÍ KALENDÁŘE ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setExtCalExpanded(!extCalExpanded)}
            className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            EXTERNÍ KALENDÁŘE
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: extCalExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div className="flex items-center gap-0.5">
            {subscriptions.some(s => s.is_enabled) && (
              <button
                onClick={() => setIcsRefreshToken(t => t + 1)}
                className="p-0.5 rounded transition-colors"
                title="Aktualizovat externí kalendáře"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={icsRefreshing ? 'animate-spin' : ''}>
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            )}
            <button
              onClick={openNewSub}
              className="p-0.5 rounded transition-colors"
              title="Přidat ICS/iCal kalendář"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        {extCalExpanded && (
          subscriptions.length === 0 ? (
            <button
              onClick={openNewSub}
              className="text-xs w-full text-left px-1 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              + Přidat ICS odkaz
            </button>
          ) : (
            sortedSubscriptions.map((sub, subIdx) => (
              <div key={sub.id} className="flex items-center gap-1.5 py-0.5 group/sub">
                <button
                  role="checkbox"
                  aria-checked={sub.is_enabled}
                  onClick={() => toggleSubscription(sub.id, !sub.is_enabled)}
                  className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                  style={{
                    background: sub.is_enabled ? sub.color : 'transparent',
                    borderColor: sub.color,
                  }}
                >
                  {sub.is_enabled && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
                <span className="text-xs flex-1 truncate min-w-0" style={{ color: 'var(--text-primary)' }} title={sub.name}>{sub.name}</span>
                <div className="opacity-0 group-hover/sub:opacity-100 flex flex-col transition-opacity flex-shrink-0">
                  <button onClick={() => moveSubscription(sub.id, -1)} disabled={subIdx === 0} className="p-0 leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} title="Nahoru">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button onClick={() => moveSubscription(sub.id, 1)} disabled={subIdx === sortedSubscriptions.length - 1} className="p-0 leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} title="Dolů">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
                <button
                  onClick={() => openEditSub(sub)}
                  className="opacity-0 group-hover/sub:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  title="Upravit odběr"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => openShareModal(undefined, sub)}
                  className="opacity-0 group-hover/sub:opacity-60 hover:!opacity-100 transition-opacity p-0.5 rounded flex-shrink-0"
                  style={{ color: calendarShares.some(s => s.calendar_id === sub.id) ? 'var(--primary)' : 'var(--text-muted)' }}
                  title="Sdílet kalendář"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
              </div>
            ))
          )
        )}
      </div>
    </>
  );
}
