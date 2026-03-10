'use client';
// ─── Calendar Module – CalendarHeader ────────────────────────────────────────
// Záhlaví kalendáře: navigace, view switcher, tlačítko Přidat událost, Pozvánky.

import { useCalendarContext } from '../CalendarContext';
import type { ViewType } from '../types';

export default function CalendarHeader() {
  const {
    view, setView,
    goPrev, goNext, goToday,
    dateRangeLabel,
    setCurrentDate, setMiniCalDate,
    openNewEvent,
    attendeeEvents,
    showInvitationsPanel, setShowInvitationsPanel,
    setInvitationsVisibleCount,
    pendingInvitationsCount,
  } = useCalendarContext();

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 flex-shrink-0">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Kalendář</h1>

      {/* Navigace */}
      <div className="flex items-center gap-1">
        <button
          onClick={goPrev}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          onClick={goToday}
          className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
        >
          Dnes
        </button>
        <button
          onClick={goNext}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <span className="text-base font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
        {dateRangeLabel}
      </span>

      <div className="flex-1" />

      {/* Tlačítko Pozvánky */}
      {attendeeEvents.length > 0 && (
        <button
          onClick={() => { setShowInvitationsPanel(!showInvitationsPanel); setInvitationsVisibleCount(20); }}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors"
          style={{
            border: showInvitationsPanel ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
            color: showInvitationsPanel ? 'var(--primary)' : 'var(--text-secondary)',
            background: showInvitationsPanel ? 'var(--bg-hover)' : 'var(--bg-card)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = showInvitationsPanel ? 'var(--bg-hover)' : 'var(--bg-card)'; }}
          title="Zobrazit pozvánky na události"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
          <span className="hidden sm:inline">Pozvánky</span>
          {pendingInvitationsCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>
              {pendingInvitationsCount}
            </span>
          )}
        </button>
      )}

      {/* Přepínač pohledu */}
      <div className="flex rounded-lg overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        {(['today', 'three_days', 'week', 'month', 'year', 'list'] as ViewType[]).map(v => (
          <button
            key={v}
            onClick={() => {
              if (v === 'today') {
                const t = new Date();
                setCurrentDate(t);
                setMiniCalDate(t);
              }
              setView(v);
            }}
            className="px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors"
            style={{
              background: view === v ? 'var(--primary)' : 'var(--bg-card)',
              color: view === v ? 'white' : 'var(--text-secondary)',
            }}
          >
            {v === 'today' ? 'Den' : v === 'three_days' ? '3 dny' : v === 'week' ? 'Týden' : v === 'month' ? 'Měsíc' : v === 'year' ? 'Rok' : 'Seznam'}
          </button>
        ))}
      </div>

      {/* Přidat událost */}
      <button
        onClick={() => openNewEvent()}
        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-white flex-shrink-0"
        style={{ background: 'var(--primary)' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="hidden sm:inline">Přidat událost</span>
        <span className="sm:hidden">Přidat</span>
      </button>
    </div>
  );
}
