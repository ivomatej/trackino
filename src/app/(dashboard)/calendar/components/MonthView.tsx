'use client';
// ─── Calendar Module – MonthView ──────────────────────────────────────────────
// Měsíční mřížka s EventPill komponentami.

import { useCalendarContext } from '../CalendarContext';
import { isSameDay, toDateStr } from '../utils';
import EventPill from './EventPill';

const DAY_NAMES_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function MonthView() {
  const {
    monthGrid,
    eventsOnDay,
    currentDate,
    today,
    openNewEvent,
    setDetailEvent,
  } = useCalendarContext();

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[560px] p-4">
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES_SHORT.map(d => (
            <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--text-muted)' }}>
              {d}
            </div>
          ))}
        </div>
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {monthGrid.map((week, wi) => (
            <div key={wi} className={`grid grid-cols-7 ${wi < monthGrid.length - 1 ? 'border-b' : ''}`} style={{ borderColor: 'var(--border)' }}>
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, today);
                const dayEvs = eventsOnDay(day);
                return (
                  <div
                    key={di}
                    onClick={() => openNewEvent(toDateStr(day))}
                    className="min-h-[90px] p-1.5 cursor-pointer border-r last:border-r-0 transition-colors relative"
                    style={{
                      borderColor: 'var(--border)',
                      background: !isCurrentMonth ? 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)' : 'var(--bg-card)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = !isCurrentMonth ? 'color-mix(in srgb, var(--bg-sidebar) 60%, transparent)' : 'var(--bg-card)')}
                  >
                    <div
                      className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1"
                      style={{
                        background: isToday ? 'var(--primary)' : 'transparent',
                        color: isToday ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 3).map(ev => (
                        <EventPill key={ev.id} ev={ev} compact onEventClick={setDetailEvent} />
                      ))}
                      {dayEvs.length > 3 && (
                        <div className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>
                          +{dayEvs.length - 3} další
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
