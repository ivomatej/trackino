'use client';
// ─── Calendar Module – WeekView ───────────────────────────────────────────────
// Týdenní pohled s časovou mřížkou, celodennními událostmi a timed events.

import { useCalendarContext } from '../CalendarContext';
import { isSameDay, toDateStr } from '../utils';
import { layoutTimedEvents } from '../layoutUtils';
import EventPill from './EventPill';

const DAY_NAMES_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const ROW_H = 60;

export default function WeekView() {
  const {
    weekDays,
    eventsOnDay,
    today,
    nowTime,
    weekGridRef,
    calWeekWrapperRef,
    openNewEvent,
    setDetailEvent,
  } = useCalendarContext();

  const nowTopPx = (nowTime.getHours() * 60 + nowTime.getMinutes()) * (ROW_H / 60);

  return (
    <div ref={calWeekWrapperRef} className="flex-1 flex flex-col overflow-x-auto overflow-y-hidden" style={{ minHeight: 0 }}>
      <div className="flex flex-col" style={{ minWidth: 640, height: '100%' }}>
        {/* Záhlaví dnů – MIMO scroll kontejner, vždy viditelné */}
        <div className="flex-shrink-0 flex border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="flex-shrink-0 border-r" style={{ width: 56, borderColor: 'var(--border)' }} />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                className="flex-1 text-center py-2 border-r last:border-r-0"
                style={{
                  borderColor: 'var(--border)',
                  background: isToday ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'transparent',
                }}
              >
                <div className="text-[10px] font-semibold uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  {DAY_NAMES_SHORT[i]}
                </div>
                <div
                  className="w-7 h-7 mx-auto flex items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    background: isToday ? 'var(--primary)' : 'transparent',
                    color: isToday ? 'white' : 'var(--text-primary)',
                  }}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pás celodennních událostí – MIMO scroll kontejner, vždy viditelné */}
        {(() => {
          const allDayRows = weekDays.map(day =>
            eventsOnDay(day).filter(ev => ev.is_all_day || !ev.start_time)
          );
          const hasAny = allDayRows.some(r => r.length > 0);
          if (!hasAny) return null;
          return (
            <div className="flex-shrink-0 flex border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              <div
                className="flex-shrink-0 border-r flex items-center justify-end pr-1.5"
                style={{ width: 56, borderColor: 'var(--border)' }}
              >
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>celý den</span>
              </div>
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={i}
                    className="flex-1 border-r last:border-r-0 p-0.5 min-h-[28px] space-y-0.5"
                    style={{
                      borderColor: 'var(--border)',
                      background: isToday ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'transparent',
                    }}
                  >
                    {allDayRows[i].map(ev => (
                      <EventPill key={ev.id} ev={ev} compact wrap onEventClick={setDetailEvent} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Časová mřížka – POUZE tato část scrolluje vertikálně */}
        <div ref={weekGridRef} className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll" style={{ minHeight: 0 }}>
          <div className="flex">
            {/* Sloupec hodin */}
            <div className="flex-shrink-0 border-r" style={{ width: 56, borderColor: 'var(--border)' }}>
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="relative border-b"
                  style={{ height: ROW_H, borderColor: 'var(--border)' }}
                >
                  <span className="absolute text-[10px] right-1.5 top-1" style={{ color: 'var(--text-muted)' }}>
                    {String(i).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Sloupce dnů */}
            {weekDays.map((day, dayIdx) => {
              const timedEvs = eventsOnDay(day).filter(ev => !ev.is_all_day && ev.start_time);
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={dayIdx}
                  className="flex-1 border-r last:border-r-0 relative"
                  style={{
                    borderColor: 'var(--border)',
                    background: isToday ? 'color-mix(in srgb, var(--primary) 3%, transparent)' : 'transparent',
                  }}
                >
                  {/* Hodinové linky */}
                  {Array.from({ length: 24 }, (_, i) => (
                    <div
                      key={i}
                      className="border-b cursor-pointer transition-colors"
                      style={{ height: ROW_H, borderColor: 'var(--border)' }}
                      onClick={() => openNewEvent(toDateStr(day), i)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    />
                  ))}

                  {/* Indikátor aktuálního času */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{ top: nowTopPx, zIndex: 5 }}
                    >
                      <div
                        className="absolute w-2 h-2 rounded-full"
                        style={{ background: '#ef4444', left: 2, top: -4 }}
                      />
                      <div
                        className="absolute left-0 right-0"
                        style={{ height: 2, background: '#ef4444', opacity: 0.85, top: -1 }}
                      />
                    </div>
                  )}

                  {/* Timed events – absolutně pozicovány, s detekcí překrytí */}
                  {layoutTimedEvents(timedEvs).map(ev => {
                    const topPx = Math.max(0, ev._startMin * (ROW_H / 60));
                    const heightPx = Math.max(20, (ev._endMin - ev._startMin) * (ROW_H / 60));
                    const colW = 100 / ev._totalCols;
                    const leftPct = ev._col * colW;
                    const isDeclined = ev.attendee_status === 'declined';
                    const isMaybe = ev.attendee_status === 'maybe';
                    const isPendingOrUpdated = ev.attendee_status === 'pending' || ev.attendee_status === 'updated';
                    const prefix = isPendingOrUpdated ? '? ' : isMaybe ? '~ ' : '';
                    return (
                      <div
                        key={ev.id}
                        className="absolute rounded px-1 py-0.5 text-[10px] font-medium overflow-hidden cursor-pointer"
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${colW}% - 4px)`,
                          background: isDeclined ? ev.color + '11' : ev.color + '33',
                          color: isDeclined ? ev.color + '88' : ev.color,
                          border: isPendingOrUpdated ? `2px dashed ${ev.color}` : isMaybe ? `1px dashed ${ev.color}88` : `1px solid ${ev.color}66`,
                          lineHeight: '13px',
                          zIndex: ev._col + 1,
                          opacity: isDeclined ? 0.5 : 1,
                          textDecoration: isDeclined ? 'line-through' : 'none',
                        }}
                        onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
                        title={isPendingOrUpdated ? `${ev.title} – čeká na potvrzení` : ev.attendee_status === 'updated' ? `${ev.title} – událost byla změněna` : isDeclined ? `${ev.title} – odmítnuto` : isMaybe ? `${ev.title} – nezávazně` : ev.title}
                      >
                        {ev.is_recurring && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-0.5 top-0.5 flex-shrink-0" style={{ opacity: 0.7 }}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}
                        <div className="font-semibold truncate pr-3"><span className="truncate">{prefix}{ev.start_time?.slice(0, 5)} {ev.title}</span></div>
                        {heightPx > 30 && ev.end_time && (
                          <div className="opacity-70 truncate">{ev.end_time.slice(0, 5)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
