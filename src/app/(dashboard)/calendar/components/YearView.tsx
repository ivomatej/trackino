'use client';
// ─── Calendar Module – YearView ───────────────────────────────────────────────
// Roční přehled – 12 mini mřížek.

import { useCalendarContext } from '../CalendarContext';
import { isSameDay, toDateStr, addDays, getMonday } from '../utils';
import type { ViewType } from '../types';

const MONTH_NAMES = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
const DAY_NAMES_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function YearView() {
  const {
    currentDate,
    eventsOnDay,
    today,
    setCurrentDate,
    setMiniCalDate,
    setView,
  } = useCalendarContext();

  const year = currentDate.getFullYear();

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, monthIdx) => {
            const firstDay = new Date(year, monthIdx, 1);
            const lastDay = new Date(year, monthIdx + 1, 0);
            const gridStart = getMonday(firstDay);
            const weeks: Date[][] = [];
            let cur = new Date(gridStart);
            while (true) {
              const week: Date[] = [];
              for (let i = 0; i < 7; i++) {
                week.push(new Date(cur));
                cur = addDays(cur, 1);
              }
              weeks.push(week);
              if (cur > lastDay && weeks.length >= 4) break;
            }
            return (
              <div
                key={monthIdx}
                className="rounded-xl border p-3"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {MONTH_NAMES[monthIdx]}
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES_SHORT.map(d => (
                    <div key={d} className="text-center text-[9px] font-semibold py-0.5" style={{ color: 'var(--text-muted)' }}>
                      {d.charAt(0)}
                    </div>
                  ))}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((day, di) => {
                      const isCurrentMonth = day.getMonth() === monthIdx;
                      const isDayToday = isSameDay(day, today);
                      const dayEvs = isCurrentMonth ? eventsOnDay(day) : [];
                      return (
                        <div key={di} className="flex items-center justify-center py-0.5">
                          <div className="relative">
                            <button
                              onClick={() => { setCurrentDate(day); setMiniCalDate(day); setView('today' as ViewType); }}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-medium transition-colors"
                              style={{
                                background: isDayToday ? 'var(--primary)' : 'transparent',
                                color: isDayToday ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                              }}
                              onMouseEnter={e => { if (!isDayToday) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isDayToday ? 'var(--primary)' : 'transparent'; }}
                              title={toDateStr(day)}
                            >
                              {day.getDate()}
                            </button>
                            {dayEvs.length > 0 && isCurrentMonth && !isDayToday && (
                              <span
                                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                                style={{ background: dayEvs[0].color }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
