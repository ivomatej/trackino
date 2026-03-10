'use client';
// ─── Calendar Module – CalendarSidebar ───────────────────────────────────────
// Levý panel s mini kalendářem, filtry a nastavením.

import { useCalendarContext } from '../CalendarContext';
import { isSameDay } from '../utils';
import CalendarSidebarCalendars from './CalendarSidebarCalendars';
import CalendarSidebarOther from './CalendarSidebarOther';

const MONTH_NAMES = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
const DAY_NAMES_SHORT = ['Po','Út','St','Čt','Pá','So','Ne'];

export default function CalendarSidebar() {
  const {
    view,
    showLeftPanel, setShowLeftPanel,
    miniCalDate, setMiniCalDate,
    miniCalGrid,
    currentDate, setCurrentDate,
    today,
  } = useCalendarContext();

  return (
    <>
      {/* Mobile toggle button */}
      <div className="md:hidden px-4 pb-2 flex-shrink-0">
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border w-full"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          onClick={() => setShowLeftPanel(!showLeftPanel)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Mini kalendář &amp; filtry
          <svg className="ml-auto" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showLeftPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {/* Levý panel */}
      <div
        className={`md:w-56 flex-shrink-0 border-r overflow-y-auto flex flex-col${showLeftPanel ? '' : ' hidden md:flex'}`}
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Filter panels */}
        <div className="px-3 pt-3 flex-1">
          <CalendarSidebarCalendars />
          <CalendarSidebarOther />
        </div>

        {/* Mini kalendář – skrytý v ročním pohledu */}
        {view !== 'year' && (
          <div className="px-3 pt-3 pb-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            {/* Navigace mini kalu */}
            <div className="flex items-center justify-between mb-1.5">
              <button
                onClick={() => { const n = new Date(miniCalDate); n.setMonth(n.getMonth() - 1); setMiniCalDate(n); }}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                {MONTH_NAMES[miniCalDate.getMonth()]} {miniCalDate.getFullYear()}
              </span>
              <button
                onClick={() => { const n = new Date(miniCalDate); n.setMonth(n.getMonth() + 1); setMiniCalDate(n); }}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Day name headers */}
            <div className="grid grid-cols-7 mb-0.5">
              {DAY_NAMES_SHORT.map(d => (
                <div key={d} className="text-center text-[9px] font-semibold py-0.5" style={{ color: 'var(--text-muted)' }}>
                  {d.charAt(0)}
                </div>
              ))}
            </div>

            {/* Day grid */}
            {miniCalGrid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const isToday = isSameDay(day, today);
                  const isCurMonth = day.getMonth() === miniCalDate.getMonth();
                  const isSelected = isSameDay(day, currentDate);
                  return (
                    <div key={di} className="flex items-center justify-center py-0.5">
                      <button
                        onClick={() => { setCurrentDate(day); setMiniCalDate(day); }}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-medium transition-colors"
                        style={{
                          background: isToday ? 'var(--primary)' : isSelected ? 'var(--bg-active)' : 'transparent',
                          color: isToday ? 'white' : isSelected ? 'var(--primary)' : isCurMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                        onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'var(--primary)' : isSelected ? 'var(--bg-active)' : 'transparent'; }}
                      >
                        {day.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
