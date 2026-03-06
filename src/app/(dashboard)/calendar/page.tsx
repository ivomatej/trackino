'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import type { Calendar, CalendarEvent, VacationEntry, ImportantDay, CalendarSubscription } from '@/types/database';
import { getCzechHolidays } from '@/lib/czech-calendar';

// ─── Local Types ─────────────────────────────────────────────────────────────

interface DisplayEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  color: string;
  source: 'manual' | 'vacation' | 'important_day' | 'subscription' | 'holiday';
  source_id: string;
  calendar_id?: string;
  description?: string;
  is_all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

type ViewType = 'list' | 'week' | 'month' | 'today' | 'year';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(str: string): Date {
  return new Date(str + 'T00:00:00');
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  const endStr = end.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

const DAY_NAMES_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#f43f5e', '#78716c',
  '#6b7280', '#92400e', '#a16207', '#1e3a5f',
];

// ─── Timed-event overlap layout ──────────────────────────────────────────────

interface LayoutEvt extends DisplayEvent {
  _col: number;
  _totalCols: number;
  _startMin: number;
  _endMin: number;
}

/** Greedy column layout pro překrývající se časové události.
 *  Vrátí pole s `_col` (0-based sloupec), `_totalCols` a přepočítanými minutami. */
function layoutTimedEvents(evs: DisplayEvent[]): LayoutEvt[] {
  if (evs.length === 0) return [];
  const mapped: LayoutEvt[] = evs.map(ev => {
    const parts = (ev.start_time ?? '00:00').split(':');
    const sh = parseInt(parts[0] ?? '0', 10);
    const sm = parseInt(parts[1] ?? '0', 10);
    const startMin = sh * 60 + sm;
    let endMin = startMin + 60;
    if (ev.end_time) {
      const ep = ev.end_time.split(':');
      endMin = parseInt(ep[0] ?? '0', 10) * 60 + parseInt(ep[1] ?? '0', 10);
    }
    return { ...ev, _col: 0, _totalCols: 1, _startMin: startMin, _endMin: Math.max(startMin + 15, endMin) };
  });

  // Seřadit podle začátku, delší nejdříve při stejném začátku
  mapped.sort((a, b) => a._startMin - b._startMin || b._endMin - a._endMin);

  // Greedy přiřazení sloupců
  const colEnds: number[] = [];
  for (const ev of mapped) {
    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= ev._startMin) {
        ev._col = c;
        colEnds[c] = ev._endMin;
        placed = true;
        break;
      }
    }
    if (!placed) {
      ev._col = colEnds.length;
      colEnds.push(ev._endMin);
    }
  }

  // Spočítej totalCols = max(col)+1 mezi všemi přímo překrývajícími se událostmi
  for (const ev of mapped) {
    let maxCol = ev._col;
    for (const other of mapped) {
      if (other._startMin < ev._endMin && other._endMin > ev._startMin) {
        maxCol = Math.max(maxCol, other._col);
      }
    }
    ev._totalCols = maxCol + 1;
  }

  return mapped;
}

function getImportantDayOccurrences(
  day: ImportantDay,
  rangeStart: Date,
  rangeEnd: Date
): { start: string; end: string }[] {
  const result: { start: string; end: string }[] = [];
  const origStart = parseDate(day.start_date);
  const origEnd = parseDate(day.end_date);
  const durationDays = Math.round((origEnd.getTime() - origStart.getTime()) / 86400000);

  if (!day.is_recurring || day.recurring_type === 'none') {
    if (origStart <= rangeEnd && origEnd >= rangeStart) {
      result.push({ start: day.start_date, end: day.end_date });
    }
    return result;
  }

  const cur = new Date(rangeStart);
  let safetyCounter = 0;
  while (cur <= rangeEnd && safetyCounter < 1000) {
    safetyCounter++;
    let matches = false;
    if (day.recurring_type === 'yearly') {
      matches = origStart.getMonth() === cur.getMonth() && origStart.getDate() === cur.getDate();
    } else if (day.recurring_type === 'monthly') {
      matches = origStart.getDate() === cur.getDate();
    } else if (day.recurring_type === 'weekly') {
      matches = origStart.getDay() === cur.getDay();
    }

    if (matches) {
      const occEnd = addDays(cur, durationDays);
      result.push({ start: toDateStr(cur), end: toDateStr(occEnd) });
      if (day.recurring_type === 'yearly') {
        cur.setFullYear(cur.getFullYear() + 1);
      } else if (day.recurring_type === 'monthly') {
        cur.setMonth(cur.getMonth() + 1);
      } else {
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      cur.setDate(cur.getDate() + 1);
    }
  }

  return result;
}

/** Odstraní ICS escaping (\\, → ,  \\; → ;  \\n → mezera  \\\\ → \\) */
function unescapeIcs(s: string): string {
  return s.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').replace(/\\\\/g, '\\');
}

// Parsování ICS/iCal textu na DisplayEvent záznamy
function parseICS(icsText: string, subId: string, color: string): DisplayEvent[] {
  // Rozloží zalomené řádky (RFC 5545 line folding)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const result: DisplayEvent[] = [];
  const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m: RegExpExecArray | null;

  while ((m = veventRe.exec(unfolded)) !== null) {
    const blk = m[1];
    const get = (key: string) =>
      blk.match(new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:([^\\r\\n]+)`, 'i'))?.[1]?.trim() ?? '';

    const summary = unescapeIcs(get('SUMMARY')) || '(Bez názvu)';
    const dtstart = get('DTSTART');
    const dtend = get('DTEND') || dtstart;
    if (!dtstart) continue;

    const uid = get('UID') || `${subId}-${Math.random()}`;
    const description = unescapeIcs(get('DESCRIPTION'));
    const isDateTime = dtstart.includes('T');
    // Opakující se události (RRULE) nebo výjimky (RECURRENCE-ID) musí mít datum v ID,
    // aby se rozlišily jednotlivé výskyty. Nerekurentní události datum nepotřebují –
    // UID je dostatečně stabilní i při přesunutí schůzky na jiný den/čas.
    const isRecurring = get('RRULE') !== '' || get('RECURRENCE-ID') !== '';

    let startDate: string;
    let endDate: string;
    let startTime: string | null = null;
    let endTime: string | null = null;

    if (isDateTime) {
      const s = dtstart.replace(/Z$/, '');
      startDate = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      startTime = `${s.slice(9, 11)}:${s.slice(11, 13)}`;
      const e = dtend.replace(/Z$/, '');
      endDate = `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)}`;
      endTime = `${e.slice(9, 11)}:${e.slice(11, 13)}`;
    } else {
      // Celodenní – DTEND je exkluzivní (den po posledním dni)
      startDate = `${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`;
      const endRaw = `${dtend.slice(0, 4)}-${dtend.slice(4, 6)}-${dtend.slice(6, 8)}T00:00:00`;
      const endD = new Date(endRaw);
      endD.setDate(endD.getDate() - 1);
      endDate = toDateStr(endD);
      if (endDate < startDate) endDate = startDate;
    }

    const uidClean = uid.replace(/[^a-zA-Z0-9@._-]/g, '').slice(0, 40);
    const eventId = isRecurring
      ? `sub-${subId}-${uidClean}-${startDate}${startTime ? '-' + startTime.replace(':', '') : ''}`
      : `sub-${subId}-${uidClean}`;

    result.push({
      id: eventId,
      title: summary,
      start_date: startDate,
      end_date: endDate,
      color,
      source: 'subscription',
      source_id: subId,
      description,
      is_all_day: !isDateTime,
      start_time: startTime,
      end_time: endTime,
    });
  }

  return result;
}

function eventOnDay(ev: DisplayEvent, day: Date): boolean {
  const start = parseDate(ev.start_date);
  const end = parseDate(ev.end_date);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

function sourceBadgeLabel(source: DisplayEvent['source']): string {
  if (source === 'vacation') return 'Dovolená';
  if (source === 'important_day') return 'Důležitý den';
  if (source === 'subscription') return 'Ext. kalendář';
  if (source === 'holiday') return 'Státní svátek';
  return '';
}

/** ROW_H – px na hodinu v týdenním/denním pohledu */
const ROW_H = 60;

// ─── Poznámky k událostem ─────────────────────────────────────────────────────

interface TaskItem { id: string; text: string; checked: boolean; }
interface EventNote {
  id?: string;
  content: string;
  tasks: TaskItem[];
  is_important?: boolean;
  is_done?: boolean;
  is_favorite?: boolean;
}

/** Převede HTML na prostý text (stripuje tagy) */
function stripHtmlToText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

/** Obalí plaintext URL v HTML do klikatelného odkazu */
function linkifyHtml(html: string): string {
  // Pouze obalí URL které NEJSOU již uvnitř tagu (heuristika: nepředchází je href=")
  return html.replace(/(?<!["'>])(https?:\/\/[^\s<>"'\]]+)/g, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">${url}</a>`;
  });
}

function NotePanel({
  eventRef,
  note,
  onSave,
  onDelete,
}: {
  eventRef: string;
  note: EventNote;
  onSave: (eventRef: string, content: string, tasks: TaskItem[], meta: { is_important: boolean; is_done: boolean; is_favorite: boolean }) => void;
  onDelete: (eventRef: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [localTasks, setLocalTasks] = useState<TaskItem[]>(note.tasks);
  const [isEmpty, setIsEmpty] = useState(!note.content);
  const [isDirty, setIsDirty] = useState(false);
  const savedContentRef = useRef(note.content);
  const savedTasksRef = useRef<TaskItem[]>(note.tasks);
  const taskInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [focusLastTask, setFocusLastTask] = useState(false);

  // Meta flagy (local state + ref pro closure)
  const [isImportant, setIsImportant] = useState(note.is_important ?? false);
  const [isDone, setIsDone] = useState(note.is_done ?? false);
  const [isFavorite, setIsFavorite] = useState(note.is_favorite ?? false);
  const metaRef = useRef({ is_important: note.is_important ?? false, is_done: note.is_done ?? false, is_favorite: note.is_favorite ?? false });

  // Set initial HTML content on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = savedContentRef.current;
      setIsEmpty(!savedContentRef.current || savedContentRef.current === '<br>');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus nového úkolu po přidání přes Enter
  useEffect(() => {
    if (focusLastTask && localTasks.length > 0) {
      const lastTask = localTasks[localTasks.length - 1];
      taskInputRefs.current.get(lastTask.id)?.focus();
      setFocusLastTask(false);
    }
  }, [focusLastTask, localTasks]);

  function execFmt(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
  }

  function handleInput() {
    const html = editorRef.current?.innerHTML ?? '';
    const empty = !html || html === '<br>';
    setIsEmpty(empty);
    setIsDirty(true);
  }

  function handleBlur() {
    // Auto-linkify URLs při opuštění editoru (bez auto-save)
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const linked = linkifyHtml(html);
    if (linked !== html) {
      editorRef.current.innerHTML = linked;
      const empty = !linked || linked === '<br>';
      setIsEmpty(empty);
      setIsDirty(true);
    }
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  function save() {
    const html = editorRef.current?.innerHTML ?? '';
    const empty = !html || html === '<br>';
    const content = empty ? '' : html;
    savedContentRef.current = content;
    savedTasksRef.current = localTasks;
    onSave(eventRef, content, localTasks, metaRef.current);
    setIsDirty(false);
  }

  function cancel() {
    if (editorRef.current) {
      editorRef.current.innerHTML = savedContentRef.current;
      setIsEmpty(!savedContentRef.current || savedContentRef.current === '<br>');
    }
    setLocalTasks(savedTasksRef.current);
    setIsDirty(false);
  }

  function saveMetaImmediate(meta: { is_important: boolean; is_done: boolean; is_favorite: boolean }) {
    const html = editorRef.current?.innerHTML ?? '';
    const empty = !html || html === '<br>';
    onSave(eventRef, empty ? '' : html, localTasks, meta);
  }

  function toggleImportant() {
    const next = !isImportant;
    setIsImportant(next);
    if (next) setIsFavorite(false);
    const meta = { is_important: next, is_done: isDone, is_favorite: next ? false : isFavorite };
    metaRef.current = meta;
    saveMetaImmediate(meta);
  }

  function toggleDone() {
    const next = !isDone;
    setIsDone(next);
    const meta = { is_important: isImportant, is_done: next, is_favorite: isFavorite };
    metaRef.current = meta;
    saveMetaImmediate(meta);
  }

  function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    if (next) setIsImportant(false);
    const meta = { is_important: next ? false : isImportant, is_done: isDone, is_favorite: next };
    metaRef.current = meta;
    saveMetaImmediate(meta);
  }

  function copyContent() {
    const html = editorRef.current?.innerHTML ?? '';
    const text = stripHtmlToText(html).trim();
    const taskLines = localTasks.map(t => `${t.checked ? '✓' : '•'} ${t.text}`).join('\n');
    const combined = [text, taskLines].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(combined.trim()).catch(() => {});
  }

  function toggleTask(id: string) {
    const next = localTasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    setLocalTasks(next);
    setIsDirty(true);
  }

  function updateTaskText(id: string, text: string) {
    const next = localTasks.map(t => t.id === id ? { ...t, text } : t);
    setLocalTasks(next);
    setIsDirty(true);
  }

  function addTask() {
    const next = [...localTasks, { id: crypto.randomUUID(), text: '', checked: false }];
    setLocalTasks(next);
    setFocusLastTask(true);
    setIsDirty(true);
  }

  function removeTask(id: string) {
    const next = localTasks.filter(t => t.id !== id);
    setLocalTasks(next);
    setIsDirty(true);
  }

  const btnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 4, color: 'var(--text-secondary)',
    background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
  } as React.CSSProperties;

  // Barva okraje a pozadí dle meta flagů
  const borderColor = isImportant ? '#ef4444' : isFavorite ? '#f59e0b' : 'var(--border)';
  const bgColor = isImportant ? '#fff1f1' : isFavorite ? '#fffbeb' : 'var(--bg-sidebar)';

  return (
    <div
      className="flex-1 min-w-0 rounded-lg border flex flex-col gap-1.5 p-2.5"
      style={{ borderColor, background: bgColor, opacity: isDone ? 0.28 : 1, transition: 'border-color 0.15s, background 0.15s' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Řádek: Toolbar vlevo + Meta tagy vpravo */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Toolbar – formátování + kopírovat + koš */}
        <div className="flex items-center gap-0.5">
          {(['bold', 'italic', 'underline'] as const).map((cmd, idx) => (
            <button
              key={cmd}
              onMouseDown={e => { e.preventDefault(); execFmt(cmd); }}
              style={{ ...btnStyle, fontWeight: idx === 0 ? 700 : undefined, fontStyle: idx === 1 ? 'italic' : undefined, textDecoration: idx === 2 ? 'underline' : undefined, fontSize: 11 }}
              title={['Tučné', 'Kurzíva', 'Podtržené'][idx]}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {['B', 'I', 'U'][idx]}
            </button>
          ))}
          <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button onMouseDown={e => { e.preventDefault(); execFmt('insertUnorderedList'); }} style={btnStyle} title="Odrážkový seznam" onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          <button onMouseDown={e => { e.preventDefault(); execFmt('insertOrderedList'); }} style={btnStyle} title="Číselný seznam" onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
              <path d="M4 6h1v4" strokeLinecap="round"/><path d="M4 10h2" strokeLinecap="round"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeLinecap="round"/>
            </svg>
          </button>
          <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button onMouseDown={e => { e.preventDefault(); copyContent(); }} style={btnStyle} title="Kopírovat obsah" onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); if (confirm('Smazat celou poznámku?')) onDelete(eventRef); }}
            style={{ ...btnStyle, color: 'var(--text-muted)' }}
            title="Smazat poznámku"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
        {/* Meta tagy – Důležitá / Oblíbená / Hotovo */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onMouseDown={e => { e.preventDefault(); toggleImportant(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
            style={{
              background: isImportant ? '#fee2e2' : 'transparent',
              color: isImportant ? '#dc2626' : 'var(--text-muted)',
              borderColor: isImportant ? '#fca5a5' : 'var(--border)',
            }}
            title={isImportant ? 'Zrušit důležitou' : 'Označit jako důležitou'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill={isImportant ? '#dc2626' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            Důležitá
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); toggleFavorite(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
            style={{
              background: isFavorite ? '#fef3c7' : 'transparent',
              color: isFavorite ? '#d97706' : 'var(--text-muted)',
              borderColor: isFavorite ? '#fcd34d' : 'var(--border)',
            }}
            title={isFavorite ? 'Zrušit oblíbenou' : 'Přidat do oblíbených'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill={isFavorite ? '#d97706' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Oblíbená
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); toggleDone(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
            style={{
              background: isDone ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
              opacity: isDone ? 0.7 : 1,
            }}
            title={isDone ? 'Znovu otevřít' : 'Označit jako hotovou'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isDone ? 3 : 2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Hotovo
          </button>
        </div>
      </div>

      {/* Contenteditable editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleBlur}
          onClick={handleEditorClick}
          className="text-xs outline-none min-h-[40px] leading-relaxed pl-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:cursor-pointer"
          style={{ color: 'var(--text-primary)', caretColor: 'var(--primary)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.7 : 1 }}
        />
        {isEmpty && (
          <div className="absolute top-0 left-3 text-xs pointer-events-none select-none" style={{ color: 'var(--text-muted)' }}>
            Poznámky k události…
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="border-t pt-1.5 space-y-1 pl-2" style={{ borderColor: 'var(--border)' }}>
        {localTasks.map(task => (
          <div key={task.id} className="flex items-center gap-1.5 group/task">
            <input
              type="checkbox"
              checked={task.checked}
              onChange={() => toggleTask(task.id)}
              className="w-3 h-3 flex-shrink-0 cursor-pointer"
              style={{ accentColor: 'var(--primary)' }}
            />
            <input
              ref={el => { if (el) taskInputRefs.current.set(task.id, el); else taskInputRefs.current.delete(task.id); }}
              type="text"
              value={task.text}
              onChange={e => updateTaskText(task.id, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addTask(); }
                if (e.key === 'Backspace' && task.text === '') { e.preventDefault(); removeTask(task.id); }
              }}
              className="flex-1 text-xs bg-transparent outline-none min-w-0"
              style={{
                color: task.checked ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: task.checked ? 'line-through' : 'none',
              }}
              placeholder="Úkol…"
            />
            <button
              onClick={() => removeTask(task.id)}
              className="opacity-0 group-hover/task:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={addTask}
          className="flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 0' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Přidat úkol
        </button>
      </div>

      {/* Uložit / Zrušit – zobrazí se jen když jsou neuložené změny */}
      {isDirty && (
        <div className="flex items-center justify-end gap-2 border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={cancel}
            className="px-3 py-1 rounded text-xs border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Zrušit
          </button>
          <button
            onClick={save}
            className="px-3 py-1 rounded text-xs font-medium text-white transition-opacity"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Uložit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Vnitřní komponenta ───────────────────────────────────────────────────────

function CalendarContent() {
  const { user, profile, updateProfile } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewType>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [vacationEntries, setVacationEntries] = useState<VacationEntry[]>([]);
  const [importantDays, setImportantDays] = useState<ImportantDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());

  // Mini kalendář + nastavení
  const [miniCalDate, setMiniCalDate] = useState<Date>(() => new Date());
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [calDayStart, setCalDayStart] = useState(8);
  const [calDayEnd, setCalDayEnd] = useState(18);
  const [showCalSettings, setShowCalSettings] = useState(false);
  const [savingCalSettings, setSavingCalSettings] = useState(false);
  const [calSettingsForm, setCalSettingsForm] = useState({ dayStart: 8, dayEnd: 18, viewStart: 9, viewEnd: 17 });

  // Formulář události
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_all_day: true,
    start_time: '',
    end_time: '',
    color: '',
    calendar_id: '',
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Formulář kalendáře
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [calendarForm, setCalendarForm] = useState({ name: '', color: '#3b82f6' });
  const [savingCalendar, setSavingCalendar] = useState(false);

  // Aktuální čas (aktualizuje se každou minutu pro indikátor)
  const [nowTime, setNowTime] = useState<Date>(() => new Date());

  // Stránkování a vyhledávání v listovém pohledu
  const [listVisibleCount, setListVisibleCount] = useState(10);
  const [listSearch, setListSearch] = useState('');
  const [listHistoryCount, setListHistoryCount] = useState(0);

  // Odběry externích ICS kalendářů
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  const [subscriptionEvents, setSubscriptionEvents] = useState<DisplayEvent[]>([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingSub, setEditingSub] = useState<CalendarSubscription | null>(null);
  const [subForm, setSubForm] = useState({ name: '', url: '', color: '#8b5cf6' });
  const [savingSub, setSavingSub] = useState(false);
  const [subUrlError, setSubUrlError] = useState('');
  const [icsRefreshToken, setIcsRefreshToken] = useState(0);
  const [icsRefreshing, setIcsRefreshing] = useState(false);
  const [showIcsGuide, setShowIcsGuide] = useState(false);

  // Viditelná část kalendáře při načtení (localStorage, nezávislé na profilu)
  const [calViewStart, setCalViewStart] = useState(() => {
    if (typeof window === 'undefined') return 9;
    return parseInt(localStorage.getItem('trackino_cal_view_start') ?? '9', 10);
  });
  const [calViewEnd, setCalViewEnd] = useState(() => {
    if (typeof window === 'undefined') return 17;
    return parseInt(localStorage.getItem('trackino_cal_view_end') ?? '17', 10);
  });

  // Ref pro automatické scrollování časové mřížky na calViewStart
  const weekGridRef = useRef<HTMLDivElement>(null);

  // Sort order pro Moje kalendáře a Externí kalendáře (localStorage)
  const [calendarOrder, setCalendarOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('trackino_cal_order') ?? '[]'); } catch { return []; }
  });
  const [subsOrder, setSubsOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('trackino_subs_order') ?? '[]'); } catch { return []; }
  });

  // Státní svátky – toggle (localStorage, default zapnuto)
  const [showHolidays, setShowHolidays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_holidays') !== '0';
  });

  // Collapse stav sekcí v levém panelu
  const [myCalExpanded, setMyCalExpanded] = useState(true);
  const [extCalExpanded, setExtCalExpanded] = useState(true);
  const [autoExpanded, setAutoExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(true);

  // Poznámky k událostem – vybraná událost pro pravý panel
  const [openNoteEventIds, setOpenNoteEventIds] = useState<Set<string>>(new Set());
  const [notesByRef, setNotesByRef] = useState<Record<string, EventNote>>({});
  const notesLoadedRefs = useRef<Set<string>>(new Set());

  const initializedRef = useRef(false);

  // ── Sync nastavení kalendáře z profilu ────────────────────────────────────

  useEffect(() => {
    if (profile) {
      const start = profile.calendar_day_start ?? 8;
      const end = profile.calendar_day_end ?? 18;
      setCalDayStart(start);
      setCalDayEnd(end);
      setCalSettingsForm(f => ({ ...f, dayStart: start, dayEnd: end }));
    }
  }, [profile]);

  // ── Sticky fix: nastavení explicitní výšky weekGridRef ───────────────────
  // Protože DashboardLayout používá min-h-screen (ne h-screen), flex-1 uvnitř
  // calendar page nemá ohraničenou výšku → sticky záhlaví nefunguje.
  // Řešení: explicitně nastavíme výšku scroll containeru dle polohy v viewportu.
  useLayoutEffect(() => {
    const el = weekGridRef.current;
    if (!el || (view !== 'week' && view !== 'today')) return;

    const setHeight = () => {
      const rect = el.getBoundingClientRect();
      el.style.height = `${window.innerHeight - rect.top}px`;
    };

    setHeight();
    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, [view]);

  // ── Auto-scroll časové mřížky na calViewStart ─────────────────────────────
  // Dependency na `loading` zajistí, že scroll proběhne až po vykreslení mřížky
  useEffect(() => {
    if (!loading && (view === 'week' || view === 'today') && weekGridRef.current) {
      weekGridRef.current.scrollTop = Math.max(0, calViewStart - calDayStart) * ROW_H;
    }
  }, [loading, view, calViewStart, calDayStart]);

  // Aktualizace aktuálního času každou minutu
  useEffect(() => {
    const tick = () => setNowTime(new Date());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Reset stránkování, vyhledávání a historie při přepnutí pohledu nebo navigaci
  useEffect(() => {
    setListVisibleCount(10);
    setListSearch('');
    setListHistoryCount(0);
    setOpenNoteEventIds(new Set());
  }, [view, currentDate]);

  // Načtení ICS událostí při změně odběrů nebo manuálním refreshi
  useEffect(() => {
    const enabled = subscriptions.filter(s => s.is_enabled);
    if (enabled.length === 0) {
      setSubscriptionEvents([]);
      setIcsRefreshing(false);
      return;
    }
    let cancelled = false;
    setIcsRefreshing(true);
    (async () => {
      const allEvents: DisplayEvent[] = [];
      // Cache-busting parametr při manuálním refreshi
      const cacheBust = icsRefreshToken > 0 ? `&t=${icsRefreshToken}` : '';
      await Promise.all(
        enabled.map(async sub => {
          try {
            const res = await fetch(`/api/ics-proxy?url=${encodeURIComponent(sub.url)}${cacheBust}`);
            if (!res.ok) return;
            const text = await res.text();
            if (!cancelled) allEvents.push(...parseICS(text, sub.id, sub.color));
          } catch { /* ignoruj chyby jednotlivých odběrů */ }
        })
      );
      if (!cancelled) {
        setSubscriptionEvents(allEvents);
        setIcsRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions, icsRefreshToken]);

  // Periodický auto-refresh ICS každých 15 minut (jen pokud jsou aktivní odběry)
  useEffect(() => {
    if (!subscriptions.some(s => s.is_enabled)) return;
    const id = setInterval(() => setIcsRefreshToken(t => t + 1), 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [subscriptions]);

  // ── Načtení dat ──────────────────────────────────────────────────────────

  const fetchSubscriptions = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const { data } = await supabase
      .from('trackino_calendar_subscriptions')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('created_at');
    setSubscriptions((data ?? []) as CalendarSubscription[]);
  }, [user, currentWorkspace]);

  const fetchData = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);
    try {
      const { data: cals } = await supabase
        .from('trackino_calendars')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_user_id', user.id)
        .order('created_at');

      let calList = (cals ?? []) as Calendar[];

      if (calList.length === 0) {
        const { data: newCal } = await supabase
          .from('trackino_calendars')
          .insert({
            workspace_id: currentWorkspace.id,
            owner_user_id: user.id,
            name: 'Můj kalendář',
            color: '#3b82f6',
            is_default: true,
          })
          .select()
          .single();
        if (newCal) calList = [newCal as Calendar];
      }

      setCalendars(calList);

      if (!initializedRef.current) {
        initializedRef.current = true;
        setSelectedCalendarIds(new Set(calList.map(c => c.id)));
      } else {
        setSelectedCalendarIds(prev => {
          const next = new Set(prev);
          for (const c of calList) next.add(c.id);
          return next;
        });
      }

      if (calList.length > 0) {
        const calIds = calList.map(c => c.id);
        const { data: evs } = await supabase
          .from('trackino_calendar_events')
          .select('*')
          .in('calendar_id', calIds)
          .order('start_date');
        setEvents((evs ?? []) as CalendarEvent[]);
      } else {
        setEvents([]);
      }

      const { data: vacs } = await supabase
        .from('trackino_vacation_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('status', 'approved');
      setVacationEntries((vacs ?? []) as VacationEntry[]);

      const { data: days } = await supabase
        .from('trackino_important_days')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .order('start_date');
      setImportantDays((days ?? []) as ImportantDay[]);
    } finally {
      setLoading(false);
    }
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchData();
    fetchSubscriptions();
  }, [fetchData, fetchSubscriptions]);

  // ── CRUD – Události ───────────────────────────────────────────────────────

  function openNewEvent(date?: string) {
    const d = date ?? toDateStr(currentDate);
    setEditingEvent(null);
    const defaultCalId = calendars.find(c => c.is_default)?.id ?? calendars[0]?.id ?? '';
    setEventForm({
      title: '',
      description: '',
      start_date: d,
      end_date: d,
      is_all_day: true,
      start_time: '',
      end_time: '',
      color: '',
      calendar_id: defaultCalId,
    });
    setShowEventForm(true);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      description: ev.description,
      start_date: ev.start_date,
      end_date: ev.end_date,
      is_all_day: ev.is_all_day,
      start_time: ev.start_time ?? '',
      end_time: ev.end_time ?? '',
      color: ev.color ?? '',
      calendar_id: ev.calendar_id,
    });
    setShowEventForm(true);
  }

  async function saveEvent() {
    if (!user || !currentWorkspace || !eventForm.title.trim() || !eventForm.start_date || !eventForm.calendar_id) return;
    setSavingEvent(true);
    try {
      const payload = {
        calendar_id: eventForm.calendar_id,
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        title: eventForm.title.trim(),
        description: eventForm.description,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || eventForm.start_date,
        is_all_day: eventForm.is_all_day,
        start_time: eventForm.is_all_day ? null : (eventForm.start_time || null),
        end_time: eventForm.is_all_day ? null : (eventForm.end_time || null),
        color: eventForm.color || null,
        source: 'manual' as const,
        source_id: null,
      };
      if (editingEvent) {
        await supabase.from('trackino_calendar_events').update(payload).eq('id', editingEvent.id);
      } else {
        await supabase.from('trackino_calendar_events').insert(payload);
      }
      setShowEventForm(false);
      await fetchData();
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(id: string) {
    setDeletingEventId(id);
    await supabase.from('trackino_calendar_events').delete().eq('id', id);
    setDeletingEventId(null);
    setShowEventForm(false);
    await fetchData();
  }

  // ── Poznámky k událostem ───────────────────────────────────────────────────

  async function fetchNotesBatch(refs: string[]) {
    if (!currentWorkspace || !user || refs.length === 0) return;
    const newRefs = refs.filter(r => !notesLoadedRefs.current.has(r));
    if (newRefs.length === 0) return;
    newRefs.forEach(r => notesLoadedRefs.current.add(r));
    const { data } = await supabase
      .from('trackino_calendar_event_notes')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .in('event_ref', newRefs);
    if (data && data.length > 0) {
      setNotesByRef(prev => {
        const next = { ...prev };
        for (const n of data) {
          next[n.event_ref] = {
            id: n.id,
            content: n.content ?? '',
            tasks: (n.tasks as TaskItem[]) ?? [],
            is_important: n.is_important ?? false,
            is_done: n.is_done ?? false,
            is_favorite: n.is_favorite ?? false,
          };
        }
        return next;
      });
    }
  }

  async function handleNoteSave(
    eventRef: string,
    content: string,
    tasks: TaskItem[],
    meta: { is_important: boolean; is_done: boolean; is_favorite: boolean } = { is_important: false, is_done: false, is_favorite: false }
  ) {
    if (!currentWorkspace || !user) return;
    // Upsert – bezpečné pro insert i update, řeší UNIQUE (workspace_id, user_id, event_ref)
    const { data, error } = await supabase.from('trackino_calendar_event_notes')
      .upsert(
        {
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          event_ref: eventRef,
          content,
          tasks,
          is_important: meta.is_important,
          is_done: meta.is_done,
          is_favorite: meta.is_favorite,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,user_id,event_ref' }
      )
      .select('id')
      .single();
    if (error) {
      console.error('[Trackino] Poznámka – chyba ukládání:', error.message, error.code, error.details);
      return; // Neaktualizuj lokální stav pokud DB selhalo
    }
    if (data) {
      setNotesByRef(prev => ({ ...prev, [eventRef]: { id: data.id, content, tasks, ...meta } }));
    }
  }

  async function handleNoteDelete(eventRef: string) {
    const existing = notesByRef[eventRef];
    if (existing?.id) {
      await supabase.from('trackino_calendar_event_notes').delete().eq('id', existing.id);
      setNotesByRef(prev => { const n = { ...prev }; delete n[eventRef]; return n; });
    }
    setOpenNoteEventIds(prev => { const n = new Set(prev); n.delete(eventRef); return n; });
  }

  // ── CRUD – Kalendáře ──────────────────────────────────────────────────────

  function openNewCalendar() {
    setEditingCalendar(null);
    const nextColor = DEFAULT_COLORS[calendars.length % DEFAULT_COLORS.length];
    setCalendarForm({ name: '', color: nextColor });
    setShowCalendarForm(true);
  }

  function openEditCalendar(cal: Calendar) {
    setEditingCalendar(cal);
    setCalendarForm({ name: cal.name, color: cal.color });
    setShowCalendarForm(true);
  }

  async function saveCalendar() {
    if (!user || !currentWorkspace || !calendarForm.name.trim()) return;
    setSavingCalendar(true);
    try {
      if (editingCalendar) {
        await supabase
          .from('trackino_calendars')
          .update({ name: calendarForm.name.trim(), color: calendarForm.color })
          .eq('id', editingCalendar.id);
      } else {
        await supabase.from('trackino_calendars').insert({
          workspace_id: currentWorkspace.id,
          owner_user_id: user.id,
          name: calendarForm.name.trim(),
          color: calendarForm.color,
          is_default: false,
        });
      }
      setShowCalendarForm(false);
      await fetchData();
    } finally {
      setSavingCalendar(false);
    }
  }

  async function deleteCalendar(id: string) {
    await supabase.from('trackino_calendars').delete().eq('id', id);
    setSelectedCalendarIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    await fetchData();
  }

  // ── CRUD – ICS Odběry ─────────────────────────────────────────────────────

  function openNewSub() {
    setEditingSub(null);
    setSubForm({ name: '', url: '', color: '#8b5cf6' });
    setSubUrlError('');
    setShowSubForm(true);
  }

  function openEditSub(sub: CalendarSubscription) {
    setEditingSub(sub);
    setSubForm({ name: sub.name, url: sub.url, color: sub.color });
    setSubUrlError('');
    setShowSubForm(true);
  }

  async function saveSubscription() {
    if (!user || !currentWorkspace || !subForm.name.trim() || !subForm.url.trim()) return;
    setSubUrlError('');
    setSavingSub(true);
    try {
      // Ověř URL validitu
      try { new URL(subForm.url); } catch {
        setSubUrlError('Zadej platnou URL adresu');
        setSavingSub(false);
        return;
      }
      if (editingSub) {
        // Editace existujícího odběru
        await supabase
          .from('trackino_calendar_subscriptions')
          .update({ name: subForm.name.trim(), url: subForm.url.trim(), color: subForm.color })
          .eq('id', editingSub.id);
      } else {
        // Nový odběr
        await supabase.from('trackino_calendar_subscriptions').insert({
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          name: subForm.name.trim(),
          url: subForm.url.trim(),
          color: subForm.color,
          is_enabled: true,
        });
      }
      setShowSubForm(false);
      setEditingSub(null);
      await fetchSubscriptions();
    } finally {
      setSavingSub(false);
    }
  }

  async function deleteSubscription(id: string) {
    await supabase.from('trackino_calendar_subscriptions').delete().eq('id', id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  }

  async function toggleSubscription(id: string, enabled: boolean) {
    await supabase
      .from('trackino_calendar_subscriptions')
      .update({ is_enabled: enabled })
      .eq('id', id);
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, is_enabled: enabled } : s));
  }

  // ── Seřazené kalendáře a odběry ───────────────────────────────────────────

  const sortedCalendars = useMemo(() => {
    if (calendarOrder.length === 0) return calendars;
    const idx = new Map(calendarOrder.map((id, i) => [id, i]));
    return [...calendars].sort((a, b) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
  }, [calendars, calendarOrder]);

  const sortedSubscriptions = useMemo(() => {
    if (subsOrder.length === 0) return [...subscriptions].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    const idx = new Map(subsOrder.map((id, i) => [id, i]));
    return [...subscriptions].sort((a, b) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
  }, [subscriptions, subsOrder]);

  function moveCalendar(id: string, dir: -1 | 1) {
    setCalendarOrder(prev => {
      const list = prev.length > 0 ? [...prev] : sortedCalendars.map(c => c.id);
      const i = list.indexOf(id);
      if (i < 0) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      localStorage.setItem('trackino_cal_order', JSON.stringify(next));
      return next;
    });
  }

  function moveSubscription(id: string, dir: -1 | 1) {
    setSubsOrder(prev => {
      const list = prev.length > 0 ? [...prev] : sortedSubscriptions.map(s => s.id);
      const i = list.indexOf(id);
      if (i < 0) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      localStorage.setItem('trackino_subs_order', JSON.stringify(next));
      return next;
    });
  }

  // ── Nastavení kalendáře ───────────────────────────────────────────────────

  async function saveCalSettings() {
    setSavingCalSettings(true);
    await updateProfile({
      calendar_day_start: calSettingsForm.dayStart,
      calendar_day_end: calSettingsForm.dayEnd,
    });
    setCalDayStart(calSettingsForm.dayStart);
    setCalDayEnd(calSettingsForm.dayEnd);
    // Viditelná část – uložit do localStorage
    const vs = Math.max(calSettingsForm.dayStart, Math.min(calSettingsForm.dayEnd - 1, calSettingsForm.viewStart));
    const ve = Math.max(vs + 1, Math.min(calSettingsForm.dayEnd, calSettingsForm.viewEnd));
    setCalViewStart(vs);
    setCalViewEnd(ve);
    localStorage.setItem('trackino_cal_view_start', String(vs));
    localStorage.setItem('trackino_cal_view_end', String(ve));
    setSavingCalSettings(false);
    setShowCalSettings(false);
  }

  // ── Navigace ──────────────────────────────────────────────────────────────

  function goToday() {
    const t = new Date();
    setCurrentDate(t);
    setMiniCalDate(t);
  }

  function goPrev() {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() - 7);
    else if (view === 'today') d.setDate(d.getDate() - 1);
    else if (view === 'year') d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
    setMiniCalDate(d);
  }

  function goNext() {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() + 7);
    else if (view === 'today') d.setDate(d.getDate() + 1);
    else if (view === 'year') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
    setMiniCalDate(d);
  }

  // ── Rozsah pro opakující se záznamy ──────────────────────────────────────

  const visibleRange = useMemo(() => {
    if (view === 'week') {
      const start = getMonday(currentDate);
      return { start, end: addDays(start, 6) };
    } else if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start: addDays(getMonday(start), -7), end: addDays(end, 14) };
    } else if (view === 'today') {
      return { start: currentDate, end: currentDate };
    } else if (view === 'year') {
      const year = currentDate.getFullYear();
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 24, 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 6, 0);
      return { start, end };
    }
  }, [view, currentDate]);

  // ── České státní svátky ───────────────────────────────────────────────────

  const czechHolidayEvents = useMemo<DisplayEvent[]>(() => {
    if (!showHolidays) return [];
    const startYear = visibleRange.start.getFullYear();
    const endYear = visibleRange.end.getFullYear();
    const result: DisplayEvent[] = [];
    for (let y = startYear; y <= endYear; y++) {
      for (const h of getCzechHolidays(y)) {
        const dateStr = toDateStr(h.date);
        result.push({
          id: `holiday-${dateStr}`,
          title: h.name,
          start_date: dateStr,
          end_date: dateStr,
          color: '#ef4444',
          source: 'holiday',
          source_id: dateStr,
          is_all_day: true,
        });
      }
    }
    return result;
  }, [showHolidays, visibleRange]);

  // ── DisplayEvents ─────────────────────────────────────────────────────────

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const result: DisplayEvent[] = [];

    for (const ev of events) {
      if (!selectedCalendarIds.has(ev.calendar_id)) continue;
      const cal = calendars.find(c => c.id === ev.calendar_id);
      result.push({
        id: ev.id,
        title: ev.title,
        start_date: ev.start_date,
        end_date: ev.end_date,
        color: ev.color ?? cal?.color ?? '#3b82f6',
        source: 'manual',
        source_id: ev.id,
        calendar_id: ev.calendar_id,
        description: ev.description,
        is_all_day: ev.is_all_day,
        start_time: ev.start_time,
        end_time: ev.end_time,
      });
    }

    for (const v of vacationEntries) {
      result.push({
        id: `vacation-${v.id}`,
        title: 'Dovolená',
        start_date: v.start_date,
        end_date: v.end_date,
        color: '#0ea5e9',
        source: 'vacation',
        source_id: v.id,
        description: v.note || '',
        is_all_day: true,
      });
    }

    for (const day of importantDays) {
      const occs = getImportantDayOccurrences(day, visibleRange.start, visibleRange.end);
      for (const occ of occs) {
        result.push({
          id: `importantday-${day.id}-${occ.start}`,
          title: day.title,
          start_date: occ.start,
          end_date: occ.end,
          color: day.color,
          source: 'important_day',
          source_id: day.id,
          description: day.note || '',
          is_all_day: true,
        });
      }
    }

    // Externe ICS odběry – filtruj dle viditelného rozsahu
    for (const ev of subscriptionEvents) {
      const evStart = parseDate(ev.start_date);
      const evEnd = parseDate(ev.end_date);
      if (evStart <= visibleRange.end && evEnd >= visibleRange.start) {
        result.push(ev);
      }
    }

    // České státní svátky
    for (const ev of czechHolidayEvents) {
      result.push(ev);
    }

    return result.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
  }, [events, vacationEntries, importantDays, calendars, selectedCalendarIds, visibleRange, subscriptionEvents, czechHolidayEvents]);

  // Načtení poznámek pro viditelné události (seznam pohled) – vždy při seznam pohledu
  // Umístěno ZDE aby se mohlo odkazovat na displayEvents
  useEffect(() => {
    if (view === 'list' && !loading) {
      const refs = displayEvents.map(ev => ev.id);
      fetchNotesBatch(refs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loading, displayEvents]);

  // ── Mřížka měsíce ─────────────────────────────────────────────────────────

  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const gridStart = getMonday(firstDay);
    let gridEnd = addDays(getMonday(lastDay), 6);
    if (gridEnd < lastDay) gridEnd = addDays(gridEnd, 7);

    const weeks: Date[][] = [];
    let cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur));
        cur = addDays(cur, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [currentDate]);

  // ── Mřížka mini kalendáře ─────────────────────────────────────────────────

  const miniCalGrid = useMemo(() => {
    const year = miniCalDate.getFullYear();
    const month = miniCalDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
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
    return weeks;
  }, [miniCalDate]);

  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [currentDate]);

  function eventsOnDay(day: Date): DisplayEvent[] {
    return displayEvents.filter(ev => eventOnDay(ev, day));
  }

  // ── Skupiny pro List view ─────────────────────────────────────────────────

  const listGroups = useMemo(() => {
    const { start, end } = visibleRange;
    const filtered = displayEvents.filter(ev => {
      const evStart = parseDate(ev.start_date);
      const evEnd = parseDate(ev.end_date);
      return evStart <= end && evEnd >= start;
    });

    const groups = new Map<string, DisplayEvent[]>();
    for (const ev of filtered) {
      const d = parseDate(ev.start_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, evs]) => {
        const [y, m] = key.split('-');
        return {
          key,
          label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
          events: evs,
        };
      });
  }, [displayEvents, visibleRange]);

  // Filtrování skupin dle vyhledávacího dotazu
  const filteredListGroups = useMemo(() => {
    if (!listSearch.trim()) return listGroups;
    const q = listSearch.trim().toLowerCase();
    return listGroups
      .map(g => ({
        ...g,
        events: g.events.filter(ev =>
          ev.title.toLowerCase().includes(q) ||
          (ev.description && ev.description.toLowerCase().includes(q))
        ),
      }))
      .filter(g => g.events.length > 0);
  }, [listGroups, listSearch]);

  const dateRangeLabel = useMemo(() => {
    if (view === 'week') {
      const monday = getMonday(currentDate);
      const sunday = addDays(monday, 6);
      return formatWeekRange(monday, sunday);
    }
    if (view === 'today') {
      return currentDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (view === 'year') {
      return String(currentDate.getFullYear());
    }
    return formatMonthYear(currentDate);
  }, [view, currentDate]);

  // ── Event pill ────────────────────────────────────────────────────────────

  function EventPill({ ev, compact = false, wrap = false }: { ev: DisplayEvent; compact?: boolean; wrap?: boolean }) {
    const isClickable = ev.source === 'manual';
    return (
      <div
        onClick={e => {
          e.stopPropagation();
          if (isClickable) {
            const original = events.find(x => x.id === ev.source_id);
            if (original) openEditEvent(original);
          }
        }}
        className={`${compact ? 'px-1 py-0.5 text-[10px] leading-[14px]' : 'px-1.5 py-0.5 text-xs'} rounded font-medium ${wrap ? 'break-words' : 'truncate'}`}
        style={{
          background: ev.color + '22',
          color: ev.color,
          border: `1px solid ${ev.color}44`,
          cursor: isClickable ? 'pointer' : 'default',
        }}
        title={ev.title}
      >
        {!ev.is_all_day && ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ''}
        {ev.title}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!currentWorkspace) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    </DashboardLayout>
  );

  // Pozice indikátoru aktuálního času v týdenním pohledu
  const nowH = nowTime.getHours();
  const nowM = nowTime.getMinutes();
  const nowTotalMin = nowH * 60 + nowM;
  const dayStartMin = calDayStart * 60;
  const dayEndMin = calDayEnd * 60;
  const nowTopPx = nowTotalMin >= dayStartMin && nowTotalMin <= dayEndMin
    ? (nowTotalMin - dayStartMin) * (ROW_H / 60)
    : null;

  // Procento dne (pro měsíční pohled)
  const nowDayPct = Math.min(1, Math.max(0, nowTotalMin / (24 * 60)));

  return (
    <DashboardLayout>
    <div className="h-full flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Záhlaví ──────────────────────────────────────────────────────── */}
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

        {/* Přepínač pohledu – v hlavičce */}
        <div className="flex rounded-lg overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {(['today', 'week', 'month', 'year', 'list'] as ViewType[]).map(v => (
            <button
              key={v}
              onClick={() => { if (v === 'today') { const t = new Date(); setCurrentDate(t); setMiniCalDate(t); } setView(v); }}
              className="px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors"
              style={{
                background: view === v ? 'var(--primary)' : 'var(--bg-card)',
                color: view === v ? 'white' : 'var(--text-secondary)',
              }}
            >
              {v === 'today' ? 'Dnes' : v === 'week' ? 'Týden' : v === 'month' ? 'Měsíc' : v === 'year' ? 'Rok' : 'Seznam'}
            </button>
          ))}
        </div>

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

      {/* ── Hlavní obsah ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Mobile toggle button for left panel */}
        <div className="md:hidden px-4 pb-2 flex-shrink-0">
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border w-full"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onClick={() => setShowLeftPanel(p => !p)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Mini kalendář & filtry
            <svg className="ml-auto" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showLeftPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        {/* ── Levý panel ───────────────────────────────────────────────── */}
        <div
          className={`md:w-56 flex-shrink-0 border-r overflow-y-auto flex flex-col${showLeftPanel ? '' : ' hidden md:flex'}`}
          style={{ borderColor: 'var(--border)' }}
        >
          {/* ── Moje kalendáře (nahoře) ─────────────────────────────────── */}
          <div className="px-3 pt-3 flex-1">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setMyCalExpanded(p => !p)}
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
                  <input
                    type="checkbox"
                    checked={selectedCalendarIds.has(cal.id)}
                    onChange={e => {
                      setSelectedCalendarIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(cal.id);
                        else next.delete(cal.id);
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0"
                    style={{ accentColor: cal.color }}
                  />
                  <span className="text-xs flex-1 truncate min-w-0" style={{ color: 'var(--text-primary)' }}>
                    {cal.name}
                  </span>
                  {/* Šipky nahoru/dolů – zobrazí se na hover */}
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
                </div>
              ))}
            </div>

            {/* EXTERNÍ KALENDÁŘE (přesunuto nad Automaticky) */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setExtCalExpanded(p => !p)}
                  className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  EXTERNÍ KALENDÁŘE
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: extCalExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <div className="flex items-center gap-0.5">
                  {/* Tlačítko Refresh */}
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
                  {/* Tlačítko Přidat */}
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
                      <input
                        type="checkbox"
                        checked={sub.is_enabled}
                        onChange={() => toggleSubscription(sub.id, !sub.is_enabled)}
                        className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0"
                        style={{ accentColor: sub.color }}
                      />
                      <span className="text-xs flex-1 truncate min-w-0" style={{ color: 'var(--text-primary)' }} title={sub.name}>{sub.name}</span>
                      {/* Šipky nahoru/dolů */}
                      <div className="opacity-0 group-hover/sub:opacity-100 flex flex-col transition-opacity flex-shrink-0">
                        <button onClick={() => moveSubscription(sub.id, -1)} disabled={subIdx === 0} className="p-0 leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} title="Nahoru">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button onClick={() => moveSubscription(sub.id, 1)} disabled={subIdx === sortedSubscriptions.length - 1} className="p-0 leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} title="Dolů">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>
                      {/* Tlačítko Upravit */}
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
                    </div>
                  ))
                )
              )}
            </div>

            {/* Automatické zdroje */}
            <div className="mb-3">
              <div className="mb-2">
                <button
                  onClick={() => setAutoExpanded(p => !p)}
                  className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  AUTOMATICKY
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: autoExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </div>
              {autoExpanded && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#0ea5e9' }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dovolená</span>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #8b5cf6)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Důležité dny</span>
                  </div>
                </>
              )}
            </div>

            {/* Další kalendáře – Státní svátky */}
            <div className="mb-3">
              <div className="mb-2">
                <button
                  onClick={() => setOtherExpanded(p => !p)}
                  className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  DALŠÍ KALENDÁŘE
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: otherExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              </div>
              {otherExpanded && (
                <div className="flex items-center gap-1.5 py-0.5">
                  <input
                    type="checkbox"
                    checked={showHolidays}
                    onChange={e => {
                      setShowHolidays(e.target.checked);
                      localStorage.setItem('trackino_cal_holidays', e.target.checked ? '1' : '0');
                    }}
                    className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0"
                    style={{ accentColor: '#ef4444' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Státní svátky</span>
                </div>
              )}
            </div>

            {/* Nastavení kalendáře */}
            <div className="border-t pt-3 pb-4" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => { setCalSettingsForm({ dayStart: calDayStart, dayEnd: calDayEnd, viewStart: calViewStart, viewEnd: calViewEnd }); setShowCalSettings(true); }}
                className="flex items-center gap-2 w-full py-1 px-1 text-xs transition-colors rounded"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Nastavení kalendáře
              </button>
            </div>
          </div>

          {/* ── Mini kalendář (dole) – skrytý v ročním pohledu ──────────── */}
          {view !== 'year' && <div className="px-3 pt-3 pb-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            {/* Navigace mini kalu */}
            <div className="flex items-center justify-between mb-1.5">
              <button
                onClick={() => setMiniCalDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
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
                onClick={() => setMiniCalDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
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
                        onClick={() => {
                          setCurrentDate(day);
                          setMiniCalDate(day);
                        }}
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
          </div>}
        </div>

        {/* ── Zobrazení kalendáře ───────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* ══ MĚSÍČNÍ POHLED ═══════════════════════════════════════════ */}
              {view === 'month' && (
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
                                  <EventPill key={ev.id} ev={ev} compact />
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
              )}

              {/* ══ TÝDENNÍ POHLED ════════════════════════════════════════════ */}
              {view === 'week' && (
                <div ref={weekGridRef} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
                  <div className="flex flex-col" style={{ minWidth: 640 }}>
                  {/* Záhlaví dnů – sticky */}
                  <div className="flex border-b" style={{ borderColor: 'var(--border)', position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-card)' }}>
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

                  {/* Pás celodennních událostí – sticky pod záhlavím */}
                  {(() => {
                    const allDayRows = weekDays.map(day =>
                      eventsOnDay(day).filter(ev => ev.is_all_day || !ev.start_time)
                    );
                    const hasAny = allDayRows.some(r => r.length > 0);
                    if (!hasAny) return null;
                    return (
                      <div className="flex border-b" style={{ borderColor: 'var(--border)', position: 'sticky', top: 57, zIndex: 20, background: 'var(--bg-card)' }}>
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
                                <EventPill key={ev.id} ev={ev} compact wrap />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Časová mřížka */}
                  <div className="flex">
                    {/* Sloupec hodin */}
                    <div className="flex-shrink-0 border-r" style={{ width: 56, borderColor: 'var(--border)' }}>
                      {Array.from({ length: calDayEnd - calDayStart }, (_, i) => (
                        <div
                          key={i}
                          className="relative border-b"
                          style={{ height: ROW_H, borderColor: 'var(--border)' }}
                        >
                          <span className="absolute text-[10px] right-1.5 top-1" style={{ color: 'var(--text-muted)' }}>
                            {String(calDayStart + i).padStart(2, '0')}:00
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
                          {Array.from({ length: calDayEnd - calDayStart }, (_, i) => (
                            <div
                              key={i}
                              className="border-b cursor-pointer transition-colors"
                              style={{ height: ROW_H, borderColor: 'var(--border)' }}
                              onClick={() => openNewEvent(toDateStr(day))}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            />
                          ))}

                          {/* Indikátor aktuálního času */}
                          {isToday && nowTopPx !== null && (
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
                            const topPx = Math.max(0, (ev._startMin - calDayStart * 60) * (ROW_H / 60));
                            const heightPx = Math.max(20, (ev._endMin - ev._startMin) * (ROW_H / 60));
                            const colW = 100 / ev._totalCols;
                            const leftPct = ev._col * colW;
                            return (
                              <div
                                key={ev.id}
                                className="absolute rounded px-1 py-0.5 text-[10px] font-medium overflow-hidden cursor-pointer"
                                style={{
                                  top: topPx,
                                  height: heightPx,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${colW}% - 4px)`,
                                  background: ev.color + '33',
                                  color: ev.color,
                                  border: `1px solid ${ev.color}66`,
                                  lineHeight: '13px',
                                  zIndex: ev._col + 1,
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                  const orig = events.find(x => x.id === ev.source_id);
                                  if (orig) openEditEvent(orig);
                                }}
                                title={ev.title}
                              >
                                <div className="font-semibold truncate pr-3">{ev.start_time?.slice(0, 5)} {ev.title}</div>
                                {heightPx > 30 && ev.end_time && (
                                  <div className="opacity-70 truncate">{ev.end_time.slice(0, 5)}</div>
                                )}
                                {ev.source === 'manual' && (
                                  <div className="absolute top-0.5 right-0.5" style={{ opacity: 0.55 }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </div>
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
              )}

              {/* ══ DNES POHLED ══════════════════════════════════════════════ */}
              {view === 'today' && (() => {
                const day = currentDate;
                const isToday = isSameDay(day, today);
                const timedEvs = eventsOnDay(day).filter(ev => !ev.is_all_day && ev.start_time);
                const allDayEvs = eventsOnDay(day).filter(ev => ev.is_all_day || !ev.start_time);
                return (
                  <div ref={weekGridRef} className="flex-1 overflow-auto" style={{ minHeight: 0, minWidth: 320 }}>
                    {/* All-day strip – sticky */}
                    {allDayEvs.length > 0 && (
                      <div className="flex border-b" style={{ borderColor: 'var(--border)', position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-card)' }}>
                        <div className="flex-shrink-0 border-r text-[10px] px-1 py-1 flex items-center" style={{ width: 56, borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                          celý den
                        </div>
                        <div className="flex-1 p-1 flex flex-col gap-0.5">
                          {allDayEvs.map(ev => <EventPill key={ev.id} ev={ev} compact />)}
                        </div>
                      </div>
                    )}

                    {/* Časová mřížka */}
                    <div className="flex">
                      {/* Sloupec hodin */}
                      <div className="flex-shrink-0 border-r" style={{ width: 56, borderColor: 'var(--border)' }}>
                        {Array.from({ length: calDayEnd - calDayStart }, (_, i) => (
                          <div key={i} className="relative border-b" style={{ height: ROW_H, borderColor: 'var(--border)' }}>
                            <span className="absolute text-[10px] right-1.5 top-1" style={{ color: 'var(--text-muted)' }}>
                              {String(calDayStart + i).padStart(2, '0')}:00
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Sloupec dne */}
                      <div
                        className="flex-1 relative"
                        style={{
                          background: isToday ? 'color-mix(in srgb, var(--primary) 3%, transparent)' : 'transparent',
                        }}
                      >
                        {/* Hodinové linky */}
                        {Array.from({ length: calDayEnd - calDayStart }, (_, i) => (
                          <div
                            key={i}
                            className="border-b cursor-pointer transition-colors"
                            style={{ height: ROW_H, borderColor: 'var(--border)' }}
                            onClick={() => openNewEvent(toDateStr(day))}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          />
                        ))}

                        {/* Indikátor aktuálního času */}
                        {isToday && nowTopPx !== null && (
                          <div className="absolute left-0 right-0 pointer-events-none" style={{ top: nowTopPx, zIndex: 5 }}>
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

                        {/* Timed events – s detekcí překrytí */}
                        {layoutTimedEvents(timedEvs).map(ev => {
                          const topPx = Math.max(0, (ev._startMin - calDayStart * 60) * (ROW_H / 60));
                          const heightPx = Math.max(20, (ev._endMin - ev._startMin) * (ROW_H / 60));
                          const colW = 100 / ev._totalCols;
                          const leftPct = ev._col * colW;
                          return (
                            <div
                              key={ev.id}
                              className="absolute rounded px-2 py-1 text-xs font-medium overflow-hidden cursor-pointer"
                              style={{
                                top: topPx,
                                height: heightPx,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${colW}% - 4px)`,
                                background: ev.color + '33',
                                color: ev.color,
                                border: `1px solid ${ev.color}66`,
                                lineHeight: '15px',
                                zIndex: ev._col + 1,
                              }}
                              onClick={e => {
                                e.stopPropagation();
                                const orig = events.find(x => x.id === ev.source_id);
                                if (orig) openEditEvent(orig);
                              }}
                              title={ev.title}
                            >
                              <div className="font-semibold truncate pr-4">{ev.start_time?.slice(0, 5)} {ev.title}</div>
                              {heightPx > 35 && ev.end_time && (
                                <div className="opacity-70">{ev.end_time.slice(0, 5)}</div>
                              )}
                              {ev.source === 'manual' && (
                                <div className="absolute top-1 right-1" style={{ opacity: 0.55 }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ ROČNÍ POHLED ══════════════════════════════════════════════ */}
              {view === 'year' && (() => {
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
                                          onClick={() => { setCurrentDate(day); setMiniCalDate(day); setView('today'); }}
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
              })()}

              {/* ══ LISTOVÝ POHLED ════════════════════════════════════════════ */}
              {view === 'list' && (() => {
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
                    return { key, label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`, events: evs };
                  });

                return (
                  <div className="flex-1 overflow-auto">
                    <div className="max-w-7xl p-4">
                      {/* Vyhledávací pole */}
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
                      </div>

                      {/* Tlačítko: načíst 10 starších událostí */}
                      {!listSearch && hasMorePast && (
                        <button
                          onClick={() => setListHistoryCount(n => n + 10)}
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
                                  const isClickable = ev.source === 'manual';
                                  const evNote = notesByRef[ev.id];
                                  const noteHasContent = !!(evNote?.content || (evNote?.tasks?.length ?? 0) > 0);
                                  const isSelected = openNoteEventIds.has(ev.id);
                                  const noteVisible = isSelected || noteHasContent;
                                  return (
                                    <div key={ev.id} className="flex flex-row gap-3 items-start">
                                      <div
                                        onClick={() => { if (isClickable) { const orig = events.find(x => x.id === ev.source_id); if (orig) openEditEvent(orig); } }}
                                        className="group/ev flex-1 min-w-0 flex items-start gap-3 p-3 rounded-lg border transition-colors"
                                        style={{
                                          borderColor: 'var(--border)',
                                          background: 'var(--bg-card)',
                                          cursor: isClickable ? 'pointer' : 'default',
                                        }}
                                        onMouseEnter={e => { if (isClickable) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                                      >
                                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: ev.color }} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{ev.title}</span>
                                            {ev.source !== 'manual' && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: ev.color + '22', color: ev.color }}>
                                                {sourceBadgeLabel(ev.source)}
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
                                            setOpenNoteEventIds(prev => { const n = new Set(prev); if (n.has(ev.id)) n.delete(ev.id); else n.add(ev.id); return n; });
                                          }}
                                          className={`flex-shrink-0 p-1 rounded transition-all ${isSelected || noteHasContent ? 'opacity-70' : 'opacity-0'} group-hover/ev:opacity-100`}
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
                                      <div className="w-[520px] flex-shrink-0">
                                        {noteVisible && (
                                          <div>
                                            <NotePanel
                                              key={`inline-${ev.id}-${evNote?.id ?? 'new'}`}
                                              eventRef={ev.id}
                                              note={evNote ?? { content: '', tasks: [] }}
                                              onSave={handleNoteSave}
                                              onDelete={handleNoteDelete}
                                            />
                                          </div>
                                        )}
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
                              onClick={() => setListVisibleCount(c => c + 10)}
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
              })()}
            </>
          )}
        </div>
      </div>

      {/* ══ MODAL – Nastavení kalendáře ════════════════════════════════════════ */}
      {showCalSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl shadow-xl border p-6 overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nastavení kalendáře</h2>
              <button onClick={() => setShowCalSettings(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Rozsah hodin v časové mřížce a výchozí viditelná část při načtení.
            </p>

            {/* Rozsah dne */}
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Rozsah dne (scrollovatelná oblast)</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Začátek</label>
                <div className="relative">
                  <select
                    value={calSettingsForm.dayStart}
                    onChange={e => setCalSettingsForm(f => ({ ...f, dayStart: parseInt(e.target.value) }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Konec</label>
                <div className="relative">
                  <select
                    value={calSettingsForm.dayEnd}
                    onChange={e => setCalSettingsForm(f => ({ ...f, dayEnd: parseInt(e.target.value) }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).filter(h => h > calSettingsForm.dayStart).map(h => (
                      <option key={h} value={h}>{h === 24 ? '0:00 (půlnoc)' : `${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Viditelná část */}
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Výchozí viditelná část (při načtení stránky)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Od</label>
                <div className="relative">
                  <select
                    value={calSettingsForm.viewStart}
                    onChange={e => setCalSettingsForm(f => ({ ...f, viewStart: parseInt(e.target.value) }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {Array.from({ length: calSettingsForm.dayEnd - calSettingsForm.dayStart }, (_, i) => calSettingsForm.dayStart + i).map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Do</label>
                <div className="relative">
                  <select
                    value={calSettingsForm.viewEnd}
                    onChange={e => setCalSettingsForm(f => ({ ...f, viewEnd: parseInt(e.target.value) }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {Array.from({ length: calSettingsForm.dayEnd - calSettingsForm.dayStart }, (_, i) => calSettingsForm.dayStart + i + 1).filter(h => h > calSettingsForm.viewStart).map(h => (
                      <option key={h} value={h}>{h === 24 ? '0:00 (půlnoc)' : `${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Mimo viditelnou část lze posunout scrollováním.
            </p>

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowCalSettings(false)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={saveCalSettings}
                disabled={savingCalSettings || calSettingsForm.dayEnd <= calSettingsForm.dayStart}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {savingCalSettings ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – Nová / Upravit událost ════════════════════════════════════ */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingEvent ? 'Upravit událost' : 'Nová událost'}
              </h2>
              <button onClick={() => setShowEventForm(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Název události"
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>

              {calendars.length > 1 && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Kalendář</label>
                  <div className="relative">
                    <select
                      value={eventForm.calendar_id}
                      onChange={e => setEventForm(f => ({ ...f, calendar_id: e.target.value }))}
                      className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      {calendars.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Od *</label>
                  <input
                    type="date"
                    value={eventForm.start_date}
                    onChange={e => setEventForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Do</label>
                  <input
                    type="date"
                    value={eventForm.end_date}
                    min={eventForm.start_date}
                    onChange={e => setEventForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cal_is_all_day"
                  checked={eventForm.is_all_day}
                  onChange={e => setEventForm(f => ({ ...f, is_all_day: e.target.checked }))}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label htmlFor="cal_is_all_day" className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  Celý den
                </label>
              </div>

              {!eventForm.is_all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Čas začátku</label>
                    <input
                      type="time"
                      value={eventForm.start_time}
                      onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Čas konce</label>
                    <input
                      type="time"
                      value={eventForm.end_time}
                      onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Popis</label>
                <textarea
                  value={eventForm.description}
                  onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Volitelný popis..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm resize-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setEventForm(f => ({ ...f, color: '' }))}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                    style={{ borderColor: !eventForm.color ? 'var(--primary)' : 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                    title="Barva dle kalendáře"
                  >
                    ○
                  </button>
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEventForm(f => ({ ...f, color: c }))}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{
                        background: c,
                        boxShadow: eventForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                        transform: eventForm.color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              {editingEvent ? (
                <button
                  onClick={async () => { if (confirm('Opravdu smazat tuto událost?')) { await deleteEvent(editingEvent.id); } }}
                  disabled={deletingEventId === editingEvent.id}
                  className="px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Smazat
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => setShowEventForm(false)} className="px-4 py-2 rounded-lg text-sm border transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Zrušit
                </button>
                <button
                  onClick={saveEvent}
                  disabled={savingEvent || !eventForm.title.trim() || !eventForm.start_date}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingEvent ? 'Ukládám...' : editingEvent ? 'Uložit' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – Přidat / Upravit ICS odběr ═══════════════════════════════ */}
      {showSubForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl shadow-xl border p-6 overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '88vh' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingSub ? 'Upravit ICS kalendář' : 'Přidat ICS kalendář'}
              </h2>
              <button onClick={() => { setShowSubForm(false); setEditingSub(null); }} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Průvodce napojením Google / Microsoft kalendáře */}
            <div className="mb-4 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setShowIcsGuide(g => !g)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-active)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              >
                <div className="flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Jak získat ICS odkaz? (Google, Outlook, Apple)
                </div>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: showIcsGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showIcsGuide && (
                <div className="divide-y text-xs overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: 320 }}>

                  {/* Google Kalendář */}
                  <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      Google Kalendář
                    </div>
                    <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                      <li>Otevři <span className="font-medium">calendar.google.com</span></li>
                      <li>Klikni na ⚙️ vpravo nahoře → <span className="font-medium">Nastavení</span></li>
                      <li>V levém panelu klikni na název svého kalendáře</li>
                      <li>Sjeď dolů na sekci <span className="font-medium">„Integrace kalendáře"</span></li>
                      <li>Zkopíruj <span className="font-medium">„Tajná adresa ve formátu iCal"</span> <span style={{ color: 'var(--text-muted)' }}>(soukromý) nebo „Veřejná adresa ve formátu iCal" (veřejný)</span></li>
                    </ol>
                    <div className="mt-2 px-2 py-1.5 rounded font-mono text-[10px] break-all" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                      https://calendar.google.com/calendar/ical/…/basic.ics
                    </div>
                  </div>

                  {/* Microsoft Outlook */}
                  <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="3"/>
                      </svg>
                      Microsoft Outlook
                    </div>
                    <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                      <li>Přejdi na <span className="font-medium">outlook.live.com</span> → Kalendář</li>
                      <li>Klikni na ⚙️ → <span className="font-medium">„Zobrazit všechna nastavení Outlooku"</span></li>
                      <li>Přejdi do <span className="font-medium">Kalendář → Sdílené kalendáře</span></li>
                      <li>V sekci <span className="font-medium">„Publikovat kalendář"</span> zvol kalendář a nastav <span className="font-medium">„Může zobrazovat všechny podrobnosti"</span></li>
                      <li>Klikni na <span className="font-medium">Publikovat</span> a zkopíruj <span className="font-medium">ICS odkaz</span></li>
                    </ol>
                    <div className="mt-2 px-2 py-1.5 rounded font-mono text-[10px] break-all" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                      https://outlook.live.com/owa/calendar/…/calendar.ics
                    </div>
                  </div>

                  {/* Apple Kalendář */}
                  <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06z"/><path d="M10 2c1 .5 2 2 2 5"/>
                      </svg>
                      Apple Kalendář (iCloud)
                    </div>
                    <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                      <li>Otevři <span className="font-medium">icloud.com/calendar</span></li>
                      <li>Klikni na ikonu sdílení (☁️) vedle názvu kalendáře v levém panelu</li>
                      <li>Zaškrtni <span className="font-medium">„Veřejný kalendář"</span></li>
                      <li>Zkopíruj zobrazený ICS odkaz</li>
                    </ol>
                  </div>

                  {/* Wedos / Roundcube */}
                  <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-1.5 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="8 2 8 6"/><polyline points="16 2 16 6"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="7" y1="14" x2="9" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/>
                      </svg>
                      Wedos / Roundcube webmail
                    </div>
                    <p className="mb-2" style={{ color: 'var(--text-muted)' }}>
                      Wedos používá webmail Roundcube s pluginem Kalendář, který ICS export podporuje.
                    </p>
                    <ol className="space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                      <li>Přihlas se do webmailu: <span className="font-medium">webmail.wedos.com</span></li>
                      <li>Klikni na <span className="font-medium">Kalendář</span> v horním menu</li>
                      <li>V levém panelu klikni pravým tlačítkem na název kalendáře</li>
                      <li>Zvolte <span className="font-medium">„Sdílet / Exportovat"</span> nebo <span className="font-medium">„Vlastnosti"</span></li>
                      <li>Zkopíruj ICS odkaz (URL zakončené <span className="font-mono">.ics</span>)</li>
                    </ol>
                    <div className="mt-2 p-2 rounded text-[10px]" style={{ background: '#fef3c7', color: '#92400e' }}>
                      💡 Pokud tvůj webmail ICS URL přímo nenabízí, zkus v nastavení kalendáře hledat „CalDAV", „Sdílet" nebo „Publikovat".
                    </div>
                  </div>

                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input
                  type="text"
                  value={subForm.name}
                  onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Např. Firemní kalendář"
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ICS URL *</label>
                <input
                  type="url"
                  value={subForm.url}
                  onChange={e => { setSubForm(f => ({ ...f, url: e.target.value })); setSubUrlError(''); }}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: subUrlError ? '#ef4444' : 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
                {subUrlError ? (
                  <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{subUrlError}</p>
                ) : (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Odkaz na ICS/iCal soubor (Google, Outlook, Apple, ...)</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setSubForm(f => ({ ...f, color: c }))}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{
                        background: c,
                        boxShadow: subForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                        transform: subForm.color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              {editingSub ? (
                <button
                  onClick={async () => {
                    if (confirm(`Odebrat odběr „${editingSub.name}"?`)) {
                      await deleteSubscription(editingSub.id);
                      setShowSubForm(false);
                      setEditingSub(null);
                    }
                  }}
                  className="px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Odebrat
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSubForm(false); setEditingSub(null); }}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveSubscription}
                  disabled={savingSub || !subForm.name.trim() || !subForm.url.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingSub ? 'Ukládám...' : editingSub ? 'Uložit' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – Nový / Upravit kalendář ══════════════════════════════════ */}
      {showCalendarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingCalendar ? 'Upravit kalendář' : 'Nový kalendář'}
              </h2>
              <button onClick={() => setShowCalendarForm(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input
                  type="text"
                  value={calendarForm.name}
                  onChange={e => setCalendarForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Název kalendáře"
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCalendarForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{
                        background: c,
                        boxShadow: calendarForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                        transform: calendarForm.color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {editingCalendar && (
              <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                💡 Budoucí verze umožní sdílení kalendáře s ostatními členy workspace.
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              {editingCalendar && !editingCalendar.is_default ? (
                <button
                  onClick={async () => { if (confirm('Smazat tento kalendář? Budou smazány i všechny jeho události.')) { await deleteCalendar(editingCalendar.id); setShowCalendarForm(false); } }}
                  className="px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Smazat
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => setShowCalendarForm(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Zrušit
                </button>
                <button
                  onClick={saveCalendar}
                  disabled={savingCalendar || !calendarForm.name.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingCalendar ? 'Ukládám...' : editingCalendar ? 'Uložit' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}

// ─── Vnější komponenta ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <CalendarContent />
    </WorkspaceProvider>
  );
}
