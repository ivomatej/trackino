'use client';
// ─── Calendar Module – ListView ───────────────────────────────────────────────
// Listový pohled: chronologický výpis, inline poznámky, sirotčí poznámky panel.

import { useCalendarContext } from '../CalendarContext';
import { toDateStr, parseDate } from '../utils';
import type { DisplayEvent } from '../types';
import NotePanel from './NotePanel';

const MONTH_NAMES = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

function sourceBadgeLabel(source: DisplayEvent['source']): string {
  if (source === 'vacation') return 'Dovolená';
  if (source === 'important_day') return 'Důležitý den';
  if (source === 'subscription') return 'Ext. kalendář';
  if (source === 'holiday') return 'Státní svátek';
  if (source === 'nameday') return 'Jmeniny';
  if (source === 'birthday') return 'Narozeniny';
  return '';
}

export default function ListView() {
  const {
    filteredListGroups,
    listGroups,
    listSearch, setListSearch,
    listHistoryCount, setListHistoryCount,
    listVisibleCount, setListVisibleCount,
    nowTime,
    today,
    showOrphanPanel, setShowOrphanPanel,
    orphanNotes,
    orphanLoading,
    fetchOrphanNotes,
    deleteOrphanNote,
    openNoteEventIds, setOpenNoteEventIds,
    notesByRef,
    handleNoteSave,
    handleNoteDelete,
    subscriptions,
    setDetailEvent,
    openNewEvent,
  } = useCalendarContext();

  const todayStr = toDateStr(today);

  // Všechny události ze skupin
  const allGroupedEvents = filteredListGroups.flatMap(g => g.events);

  // Rozdělení na minulé a budoucí
  const pastEvents = allGroupedEvents.filter(ev => ev.start_date < todayStr);
  const futureEvents = allGroupedEvents.filter(ev => ev.start_date >= todayStr);

  // Viditelné minulé: posledních listHistoryCount (nejstarší první)
  const visiblePastEvents = listHistoryCount > 0
    ? pastEvents.slice(Math.max(0, pastEvents.length - listHistoryCount))
    : [];
  const hasMorePast = pastEvents.length > listHistoryCount;
  const morePastCount = pastEvents.length - listHistoryCount;

  // Viditelné budoucí: prvních listVisibleCount
  const visibleFutureEvents = futureEvents.slice(0, listVisibleCount);
  const hasMoreFuture = futureEvents.length > listVisibleCount;

  // Přeskupení pro zobrazení
  const allVisible = [...visiblePastEvents, ...visibleFutureEvents];
  const groupMap = new Map<string, DisplayEvent[]>();
  for (const ev of allVisible) {
    const d = parseDate(ev.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(ev);
  }
  const visibleGroups = [...groupMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, evs]) => {
      const [y, m] = key.split('-');
      return {
        key,
        label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
        events: evs.sort((a, b) => {
          const dateCmp = a.start_date.localeCompare(b.start_date);
          if (dateCmp !== 0) return dateCmp;
          if (!a.start_time && !b.start_time) return a.title.localeCompare(b.title);
          if (!a.start_time) return -1;
          if (!b.start_time) return 1;
          return a.start_time.localeCompare(b.start_time);
        }),
      };
    });

  // Červená linka aktuálního času
  const nowHH = String(nowTime.getHours()).padStart(2, '0');
  const nowMM = String(nowTime.getMinutes()).padStart(2, '0');
  const nowTimeStr = `${nowHH}:${nowMM}`;
  let nowLineBeforeEvId: string | null = null;
  if (!listSearch) {
    for (const ev of allVisible) {
      if (ev.start_date > todayStr) { nowLineBeforeEvId = ev.id; break; }
      if (ev.start_date === todayStr && ev.start_time && ev.start_time > nowTimeStr) { nowLineBeforeEvId = ev.id; break; }
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl p-4">
        {/* Vyhledávací pole + tlačítko Sirotčí poznámky */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--text-muted)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={listSearch}
              onChange={e => { setListSearch(e.target.value); setListVisibleCount(10); }}
              placeholder="Hledat událost..."
              className="w-full pl-9 py-2 rounded-lg border text-base sm:text-sm"
              style={{
                paddingRight: listSearch ? '2.5rem' : '0.75rem',
                borderColor: 'var(--border)',
                background: 'var(--bg-hover)',
                color: 'var(--text-primary)',
              }}
            />
            {listSearch && (
              <button
                onClick={() => setListSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Tlačítko: Sirotčí poznámky */}
          <button
            onClick={() => {
              const next = !showOrphanPanel;
              setShowOrphanPanel(next);
              if (next) fetchOrphanNotes();
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            style={{
              border: showOrphanPanel ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              color: showOrphanPanel ? 'var(--primary)' : 'var(--text-secondary)',
              background: showOrphanPanel ? 'var(--bg-hover)' : 'var(--bg-card)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = showOrphanPanel ? 'var(--bg-hover)' : 'var(--bg-card)'; }}
            title="Zobrazit poznámky, jejichž událost již neexistuje"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
            Bez události
            {orphanNotes.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>
                {orphanNotes.length}
              </span>
            )}
          </button>
        </div>

        {/* Panel: Sirotčí poznámky */}
        {showOrphanPanel && (
          <div className="mb-5 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {/* Záhlaví */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b text-xs font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Poznámky bez události
                {!orphanLoading && <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({orphanNotes.length})</span>}
              </div>
              <button
                onClick={() => setShowOrphanPanel(false)}
                className="p-0.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Obsah */}
            {orphanLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Načítám…
              </div>
            ) : orphanNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Žádné sirotčí poznámky</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {orphanNotes.map(on => {
                  const hasContent = !!(on.content && on.content !== '<br>');
                  const dateLabel = on.event_date
                    ? (() => {
                        try {
                          return parseDate(on.event_date).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
                        } catch { return on.event_date; }
                      })()
                    : null;
                  const isIcs = on.event_ref.startsWith('sub-');
                  const subName = isIcs ? (subscriptions.find(s => s.id === on.event_ref.slice(4, 40))?.name ?? 'Ext. kalendář') : null;
                  return (
                    <div key={on.id} className="flex items-start gap-3 px-4 py-3 group/orphan" style={{ background: 'var(--bg-card)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                    >
                      {/* Barevný proužek */}
                      <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                        <div className="w-1 h-8 rounded-full" style={{ background: on.is_important ? '#ef4444' : on.is_favorite ? '#f59e0b' : 'var(--border)' }} />
                      </div>

                      {/* Obsah */}
                      <div className="flex-1 min-w-0">
                        {/* Název události */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {on.event_title || '(Bez názvu)'}
                          </span>
                          {on.is_important && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fef2f2', color: '#ef4444' }}>Důležitá</span>}
                          {on.is_favorite && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fffbeb', color: '#f59e0b' }}>Oblíbená</span>}
                          {on.is_done && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>Hotovo</span>}
                        </div>

                        {/* Datum + typ */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {dateLabel && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              📅 {dateLabel}
                            </span>
                          )}
                          {isIcs && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                              {subName}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Upraveno {(() => { try { return new Date(on.updated_at).toLocaleDateString('cs-CZ'); } catch { return ''; } })()}
                          </span>
                        </div>

                        {/* Obsah poznámky */}
                        {hasContent && (
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}
                            dangerouslySetInnerHTML={{ __html: on.content }}
                          />
                        )}
                        {/* Checklist úkolů */}
                        {on.tasks.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {on.tasks.map(task => (
                              <div key={task.id} className="flex items-center gap-1.5">
                                <input type="checkbox" checked={task.checked} readOnly className="w-3 h-3 flex-shrink-0 cursor-default" style={{ accentColor: '#9ca3af' }} />
                                <span className="text-xs" style={{ color: task.checked ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: task.checked ? 'line-through' : 'none' }}>
                                  {task.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tlačítko smazat */}
                      <button
                        onClick={() => deleteOrphanNote(on.id)}
                        className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover/orphan:opacity-100 transition-opacity"
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        title="Trvale smazat poznámku"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Popis pro ICS poznámky */}
            {!orphanLoading && orphanNotes.some(n => n.event_ref.startsWith('sub-')) && (
              <div className="px-4 py-2 border-t text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                Poznámky z externích kalendářů jsou zobrazeny jako sirotčí, pokud jejich událost není v aktuálním rozsahu (24 měsíců zpět). Mohla být přesunuta mimo tento rozsah nebo smazána.
              </div>
            )}
          </div>
        )}

        {/* Tlačítko: načíst 10 starších událostí */}
        {!listSearch && hasMorePast && (
          <button
            onClick={() => setListHistoryCount((n: number) => n + 10)}
            className="w-full py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 mb-4 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
            Zobrazit dřívější události {listHistoryCount > 0 ? `(ještě ${morePastCount})` : ''}
          </button>
        )}

        {listGroups.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Žádné události v tomto období</p>
            <button onClick={() => openNewEvent()} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>
              Přidat první událost
            </button>
          </div>
        ) : filteredListGroups.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Žádné výsledky pro „{listSearch}"
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleGroups.map(group => (
              <div key={group.key}>
                <h3 className="text-sm font-semibold capitalize mb-2 pb-1 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.events.map(ev => {
                    const evStart = parseDate(ev.start_date);
                    const evEnd = parseDate(ev.end_date);
                    const multiDay = ev.start_date !== ev.end_date;
                    const evNote = notesByRef[ev.id];
                    const noteHasContent = !!(evNote?.content || (evNote?.tasks?.length ?? 0) > 0);
                    const isSelected = openNoteEventIds.has(ev.id);
                    const noteVisible = isSelected || noteHasContent;
                    const isDeclined = ev.attendee_status === 'declined';
                    const isMaybe = ev.attendee_status === 'maybe';
                    const isPendingOrUpdated = ev.attendee_status === 'pending' || ev.attendee_status === 'updated';
                    const listPrefix = isPendingOrUpdated ? '? ' : isMaybe ? '~ ' : '';
                    return (
                      <div key={ev.id}>
                        {nowLineBeforeEvId === ev.id && (
                          <div className="flex items-center gap-2 py-1.5 mb-1">
                            <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: '#ef4444' }}>{nowTimeStr}</span>
                            <div className="flex-1 rounded-full" style={{ height: 2, background: '#ef4444', opacity: 0.75 }} />
                            <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                          </div>
                        )}
                        <div className="flex flex-col md:flex-row gap-3 md:items-start">
                          <div
                            onClick={() => setDetailEvent(ev)}
                            className="group/ev w-full md:flex-1 min-w-0 flex items-start gap-3 p-3 rounded-lg transition-colors"
                            style={{
                              borderWidth: isPendingOrUpdated ? 2 : 1,
                              borderStyle: isPendingOrUpdated ? 'dashed' : isMaybe ? 'dashed' : 'solid',
                              borderColor: isPendingOrUpdated ? ev.color : isMaybe ? ev.color + '88' : 'var(--border)',
                              background: 'var(--bg-card)',
                              cursor: 'pointer',
                              opacity: isDeclined ? 0.45 : 1,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                            title={isPendingOrUpdated ? `${ev.title} – čeká na potvrzení` : ev.attendee_status === 'updated' ? `${ev.title} – událost byla změněna` : isDeclined ? `${ev.title} – odmítnuto` : isMaybe ? `${ev.title} – nezávazně` : undefined}
                          >
                            <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: isDeclined ? ev.color + '66' : ev.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm flex items-center gap-1" style={{ color: 'var(--text-primary)', textDecoration: isDeclined ? 'line-through' : 'none' }}>
                                  {ev.is_recurring && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ opacity: 0.5 }}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>}
                                  {listPrefix}{ev.title}
                                </span>
                                {ev.source === 'shared' ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: ev.color + '22', color: ev.color }}>
                                    {ev.shared_calendar_name && ev.shared_owner_name
                                      ? `${ev.shared_calendar_name} · ${ev.shared_owner_name}`
                                      : ev.shared_calendar_name || ev.shared_owner_name || 'Sdílený kalendář'}
                                  </span>
                                ) : ev.source !== 'manual' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: ev.color + '22', color: ev.color }}>
                                    {ev.source === 'subscription'
                                      ? (subscriptions.find(s => s.id === ev.source_id)?.name ?? 'Ext. kalendář')
                                      : sourceBadgeLabel(ev.source)}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {multiDay
                                  ? `${evStart.toLocaleDateString('cs-CZ')} – ${evEnd.toLocaleDateString('cs-CZ')}`
                                  : evStart.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
                                }
                                {!ev.is_all_day && ev.start_time ? ` · ${ev.start_time.slice(0, 5)}${ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ''}` : ''}
                              </div>
                              {ev.description && (
                                <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{ev.description}</div>
                              )}
                            </div>
                            {/* Tlačítko pro toggle inline poznámky */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                if (ev.source === 'nameday' || ev.source === 'birthday') return;
                                setOpenNoteEventIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(ev.id)) n.delete(ev.id); else n.add(ev.id); return n; });
                              }}
                              className={`flex-shrink-0 p-1 rounded transition-all ${ev.source === 'nameday' || ev.source === 'birthday' ? 'opacity-0 pointer-events-none' : isSelected || noteHasContent ? 'opacity-70' : 'opacity-30 md:opacity-0'} md:group-hover/ev:opacity-100`}
                              style={{
                                color: isSelected || noteHasContent ? 'var(--primary)' : 'var(--text-muted)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                              title={isSelected ? 'Skrýt poznámku' : 'Přidat / zobrazit poznámku'}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                              </svg>
                            </button>
                          </div>
                          <div className="w-full md:w-[520px] flex-shrink-0">
                            {noteVisible && (
                              <div>
                                <NotePanel
                                  key={`inline-${ev.id}-${evNote?.id ?? 'new'}`}
                                  eventRef={ev.id}
                                  note={evNote ?? { content: '', tasks: [] }}
                                  onSave={(ref, content, tasks, meta) => handleNoteSave(ref, content, tasks, meta, ev.title, ev.start_date)}
                                  onDelete={handleNoteDelete}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Tlačítko Zobrazit více */}
            {!listSearch && hasMoreFuture && (
              <button
                onClick={() => setListVisibleCount(listVisibleCount + 10)}
                className="w-full py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Zobrazit více ({futureEvents.length - listVisibleCount} dalších)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
