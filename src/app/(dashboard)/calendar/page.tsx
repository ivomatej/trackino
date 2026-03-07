'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import type { Calendar, CalendarEvent, CalendarShare, CalendarSharePref, CalendarEventAttendee, VacationEntry, ImportantDay, CalendarSubscription } from '@/types/database';
import { getCzechHolidays } from '@/lib/czech-calendar';
import { getCzechNamedayForDate } from '@/lib/czech-namedays';

// ─── Local Types ─────────────────────────────────────────────────────────────

interface DisplayEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  color: string;
  source: 'manual' | 'vacation' | 'important_day' | 'subscription' | 'holiday' | 'shared' | 'birthday' | 'nameday';
  source_id: string;
  calendar_id?: string;
  description?: string;
  location?: string;
  url?: string;
  reminder_minutes?: number | null;
  is_all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  // Sdílené události
  is_shared?: boolean;
  show_details?: boolean;
  shared_owner_name?: string;
  shared_calendar_name?: string;
  // Účastnické události (kde user je účastník, ne vlastník)
  attendee_status?: 'pending' | 'accepted' | 'declined';
  event_owner_id?: string;
}

/** Sdílený kalendář (přijatý od jiného uživatele) */
interface SharedCalendarInfo {
  share_id: string;
  calendar_id: string;         // ID kalendáře vlastníka (nebo subscription ID)
  type: 'calendar' | 'subscription';
  name: string;
  owner_name: string;
  owner_user_id: string;
  base_color: string;          // barva z DB
  show_details: boolean;
  is_enabled: boolean;         // preference příjemce
  color_override: string | null;
}

/** Člen workspace s profilem */
interface MemberWithProfile {
  user_id: string;
  display_name: string;
  avatar_color: string;
}

/** Člen workspace s narozeninami (pro Narozeniny v kalendáři) */
interface BirthdayMember {
  user_id: string;
  display_name: string;
  birth_date: string; // YYYY-MM-DD
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

    // ID vždy obsahuje datum+čas – zajišťuje unikátnost i pro události se stejným
    // UID prefixem a pro opakující se série (každý výskyt je samostatný).
    const uidClean = uid.replace(/[^a-zA-Z0-9@._-]/g, '').slice(0, 40);
    const eventId = `sub-${subId}-${uidClean}-${startDate}${startTime ? '-' + startTime.replace(':', '') : ''}`;

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
  if (source === 'nameday') return 'Jmeniny';
  if (source === 'birthday') return 'Narozeniny';
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

/** Poznámka, jejíž původní událost již neexistuje */
interface OrphanNote {
  id: string;
  event_ref: string;
  event_title: string;
  event_date: string;
  content: string;
  tasks: TaskItem[];
  is_important: boolean;
  is_done: boolean;
  is_favorite: boolean;
  updated_at: string;
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
  const [copied, setCopied] = useState(false);

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
    navigator.clipboard.writeText(combined.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
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
          <button onMouseDown={e => { e.preventDefault(); copyContent(); }} style={{ ...btnStyle, color: copied ? '#22c55e' : 'var(--text-secondary)' }} title={copied ? 'Zkopírováno!' : 'Kopírovat obsah'} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {copied ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
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
              style={{ accentColor: '#9ca3af' }}
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
  const { currentWorkspace, currentMembership } = useWorkspace();
  const today = useMemo(() => new Date(), []);

  // Oprávnění: může vidět narozeniny kolegů
  const canViewBirthdays = (profile?.is_master_admin ?? false)
    || (currentMembership?.role === 'owner' || currentMembership?.role === 'admin')
    || (currentMembership?.can_view_birthdays ?? false);

  const [view, setView] = useState<ViewType>(() => {
    if (typeof window === 'undefined') return 'week';
    const saved = localStorage.getItem('trackino_calendar_view') as ViewType | null;
    return (saved && (['today', 'week', 'month', 'year', 'list'] as string[]).includes(saved)) ? saved as ViewType : 'week';
  });
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
  const [showCalSettings, setShowCalSettings] = useState(false);
  const [savingCalSettings, setSavingCalSettings] = useState(false);
  const [calSettingsForm, setCalSettingsForm] = useState({ viewStart: 9, viewEnd: 17 });

  // Formulář události
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    location: '',
    url: '',
    attendee_ids: [] as string[],
    reminder_minutes: null as number | null,
    start_date: '',
    end_date: '',
    is_all_day: true,
    start_time: '',
    end_time: '',
    color: '',
    calendar_id: '',
  });
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  // Načtené attendees (event_id → list)
  const [eventAttendees, setEventAttendees] = useState<Record<string, CalendarEventAttendee[]>>({});
  // Sdílení kalendářů
  const [calendarShares, setCalendarShares] = useState<CalendarShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedCalendarInfo[]>([]);
  const [sharePrefs, setSharePrefs] = useState<Record<string, CalendarSharePref>>({});
  const [sharedEvents, setSharedEvents] = useState<DisplayEvent[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingCalendar, setSharingCalendar] = useState<Calendar | null>(null);
  const [sharingSubscription, setSharingSubscription] = useState<CalendarSubscription | null>(null);
  const [shareModalState, setShareModalState] = useState<{
    shareWithWorkspace: boolean;
    workspaceShowDetails: boolean;
    userShares: { user_id: string; enabled: boolean; show_details: boolean }[];
  }>({ shareWithWorkspace: false, workspaceShowDetails: true, userShares: [] });
  const [savingShare, setSavingShare] = useState(false);
  const [sharedCalExpanded, setSharedCalExpanded] = useState(true);
  // Workspace členové (pro attendee picker + share modal)
  const [workspaceMembers, setWorkspaceMembers] = useState<MemberWithProfile[]>([]);
  // RSVP modal – zobrazí se při kliknutí na událost kde jsem účastník
  const [rsvpModalEvent, setRsvpModalEvent] = useState<DisplayEvent | null>(null);
  // Detail modal – zobrazí se při kliknutí na JAKOUKOLIV událost
  const [detailEvent, setDetailEvent] = useState<DisplayEvent | null>(null);

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
  // Ref pro outer wrapper týdenního/denního pohledu (useLayoutEffect nastavuje výšku)
  const calWeekWrapperRef = useRef<HTMLDivElement>(null);

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

  // Jmeniny – toggle (localStorage, default zapnuto)
  const [showNamedays, setShowNamedays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_namedays') !== '0';
  });

  // Narozeniny – toggle (localStorage, default zapnuto)
  const [showBirthdays, setShowBirthdays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_birthdays') !== '0';
  });

  // Státní svátky – barva (localStorage)
  const [holidayColor, setHolidayColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#ef4444';
    return localStorage.getItem('trackino_cal_holiday_color') ?? '#ef4444';
  });

  // Jmeniny – barva (localStorage)
  const [namedayColor, setNamedayColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#7c3aed';
    return localStorage.getItem('trackino_cal_nameday_color') ?? '#7c3aed';
  });

  // Narozeniny – barva (localStorage)
  const [birthdayColor, setBirthdayColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#ec4899';
    return localStorage.getItem('trackino_cal_birthday_color') ?? '#ec4899';
  });

  // Narozeniny – členové workspace
  const [birthdayMembers, setBirthdayMembers] = useState<BirthdayMember[]>([]);

  // Dovolená – toggle + barva (localStorage)
  const [showVacation, setShowVacation] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_vacation') !== '0';
  });
  const [vacationColor, setVacationColor] = useState<string>(() => {
    if (typeof window === 'undefined') return '#0ea5e9';
    return localStorage.getItem('trackino_cal_vacation_color') ?? '#0ea5e9';
  });

  // Důležité dny – toggle + barva override (null = individuální barvy)
  const [showImportantDays, setShowImportantDays] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('trackino_cal_important_days') !== '0';
  });
  const [importantDaysColor, setImportantDaysColor] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('trackino_cal_important_days_color');
    return saved && saved !== 'null' ? saved : null;
  });

  // Chyba při ukládání sdílení
  const [shareError, setShareError] = useState('');

  // Collapse stav sekcí v levém panelu
  const [myCalExpanded, setMyCalExpanded] = useState(true);
  const [extCalExpanded, setExtCalExpanded] = useState(true);
  const [autoExpanded, setAutoExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(true);

  // Poznámky k událostem – vybraná událost pro pravý panel
  const [openNoteEventIds, setOpenNoteEventIds] = useState<Set<string>>(new Set());
  const [notesByRef, setNotesByRef] = useState<Record<string, EventNote>>({});
  const notesLoadedRefs = useRef<Set<string>>(new Set());

  // Sirotčí poznámky (bez přiřazené události)
  const [showOrphanPanel, setShowOrphanPanel] = useState(false);
  const [orphanNotes, setOrphanNotes] = useState<OrphanNote[]>([]);
  const [orphanLoading, setOrphanLoading] = useState(false);

  const initializedRef = useRef(false);

  // ── (calendar_day_start/end z profilu se již nepoužívají – grid je vždy 0–24) ──

  // ── Výška calWeekWrapperRef = celá dostupná výška viewportu ─────────────
  // ── Výška pro týdenní pohled ───────────────────────────────────────────────
  // Jen pro 'week' – today view používá přirozené CSS výšky (flex-1 chain funguje).
  // loading v deps: wrapper neexistuje při loading=true (spinner nahrazuje obsah),
  // takže potřebujeme re-run až když loading=false a wrapper se poprvé připojí.
  useLayoutEffect(() => {
    const wrapper = calWeekWrapperRef.current;
    const grid = weekGridRef.current;
    if (!wrapper || view !== 'week') return;

    const applyHeight = () => {
      const wRect = wrapper.getBoundingClientRect();
      const totalH = window.innerHeight - wRect.top;
      if (totalH <= 60) return; // bezpečnostní guard: wrapper mimo viewport
      wrapper.style.height = `${totalH}px`;
      if (grid) {
        void wrapper.offsetHeight; // force reflow
        const headerH = Math.max(0, grid.getBoundingClientRect().top - wRect.top);
        grid.style.height = `${Math.max(60, totalH - headerH)}px`;
      }
    };

    applyHeight();
    window.addEventListener('resize', applyHeight);
    return () => window.removeEventListener('resize', applyHeight);
  }, [view, loading]); // loading: wrapper se připojí až když loading=false

  // ── Scroll na calViewStart ─────────────────────────────────────────────────
  // useLayoutEffect: synchronní scroll před prvním malováním (mobil – bez záblesku).
  // useEffect s double-rAF: záložní scroll po stabilizaci layoutu (desktop – flex-1
  // chain se může ustálit až po prvním paint, proto rAF zajistí správný scrollTop).
  useLayoutEffect(() => {
    if (view !== 'week' && view !== 'today') return;
    if (loading) return;
    const grid = weekGridRef.current;
    if (!grid) return;
    grid.scrollTop = calViewStart * ROW_H;
  }, [loading, view, calViewStart]);

  useEffect(() => {
    if (view !== 'week' && view !== 'today') return;
    if (loading) return;
    const target = calViewStart * ROW_H;
    // double-rAF: počká 2 paint cykly, než flex-1 ustálí výšky → funguje na desktopu
    let r1: number, r2: number;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (weekGridRef.current) weekGridRef.current.scrollTop = target;
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [loading, view, calViewStart]);

  // Aktualizace aktuálního času každou minutu
  useEffect(() => {
    const tick = () => setNowTime(new Date());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Uložení pohledu do localStorage při každé změně
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trackino_calendar_view', view);
    }
  }, [view]);

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
            const parsed = parseICS(text, sub.id, sub.color);
            if (!cancelled) allEvents.push(...parsed);
            // Ulož do ICS cache pokud je tato subscription sdílená
            const isShared = calendarShares.some(sh => sh.calendar_id === sub.id);
            if (isShared && currentWorkspace && parsed.length > 0) {
              const cacheRows = parsed.map(ev => ({
                subscription_id: sub.id,
                workspace_id: currentWorkspace.id,
                uid: ev.id, // unikátní ID z parseICS
                title: ev.title,
                description: ev.description ?? '',
                start_date: ev.start_date,
                end_date: ev.end_date,
                start_time: ev.start_time ?? null,
                end_time: ev.end_time ?? null,
                is_all_day: ev.is_all_day,
                synced_at: new Date().toISOString(),
              }));
              // Upsert do cache
              await supabase.from('trackino_ics_event_cache')
                .upsert(cacheRows, { onConflict: 'subscription_id,uid' });
            }
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

  // ── Načtení členů workspace ────────────────────────────────────────────────

  const fetchWorkspaceMembers = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    // Krok 1: načti user_id všech členů workspace
    const { data: membersData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id);
    if (!membersData || membersData.length === 0) return;
    const userIds = membersData
      .map((m: Record<string, unknown>) => m.user_id as string)
      .filter(uid => uid !== user.id); // vyfiltruj sebe
    if (userIds.length === 0) { setWorkspaceMembers([]); return; }
    // Krok 2: načti profily
    const { data: profilesData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, avatar_color')
      .in('id', userIds);
    const members: MemberWithProfile[] = (profilesData ?? []).map((p: Record<string, string>) => ({
      user_id: p.id,
      display_name: p.display_name ?? 'Uživatel',
      avatar_color: p.avatar_color ?? '#6b7280',
    }));
    setWorkspaceMembers(members);
  }, [user, currentWorkspace]);

  // ── Načtení narozenin členů workspace ─────────────────────────────────────

  const fetchBirthdayMembers = useCallback(async () => {
    if (!user || !currentWorkspace || !canViewBirthdays) { setBirthdayMembers([]); return; }
    const { data: membersData } = await supabase
      .from('trackino_workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id);
    if (!membersData || membersData.length === 0) { setBirthdayMembers([]); return; }
    const userIds = membersData.map((m: Record<string, unknown>) => m.user_id as string);
    const { data: profilesData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, birth_date')
      .in('id', userIds)
      .not('birth_date', 'is', null);
    setBirthdayMembers(
      (profilesData ?? [])
        .filter((p: Record<string, unknown>) => p.birth_date)
        .map((p: Record<string, unknown>) => ({
          user_id: p.id as string,
          display_name: (p.display_name as string) ?? 'Uživatel',
          birth_date: p.birth_date as string,
        }))
    );
  }, [user, currentWorkspace, canViewBirthdays]);

  // ── Načtení sdílení (vlastní kalendáře → co sdílím) ───────────────────────

  const fetchCalendarShares = useCallback(async (calIds: string[], subIds: string[]) => {
    if (!user) return;
    const allIds = [...calIds, ...subIds];
    if (allIds.length === 0) { setCalendarShares([]); return; }
    const { data } = await supabase
      .from('trackino_calendar_shares')
      .select('*')
      .in('calendar_id', allIds);
    setCalendarShares((data ?? []) as CalendarShare[]);
  }, [user]);

  // ── Načtení kalendářů sdílených se mnou ───────────────────────────────────

  const fetchSharedWithMe = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    // Najdi shares kde jsem příjemcem (user_id = já) nebo workspace-wide
    const { data: shares } = await supabase
      .from('trackino_calendar_shares')
      .select('*')
      .or(`shared_with_user_id.eq.${user.id},share_with_workspace.eq.true`);
    if (!shares || shares.length === 0) { setSharedWithMe([]); return; }

    // Načti preference příjemce
    const { data: prefs } = await supabase
      .from('trackino_calendar_share_prefs')
      .select('*')
      .eq('user_id', user.id);
    const prefsMap: Record<string, CalendarSharePref> = {};
    for (const p of (prefs ?? [])) prefsMap[p.calendar_id] = p as CalendarSharePref;
    setSharePrefs(prefsMap);

    // Unikátní calendar IDs ze shares
    const calIds = [...new Set(shares.map((s: Record<string, unknown>) => s.calendar_id as string))];

    // Načti data kalendářů (vlastní calendars)
    const { data: cals } = await supabase
      .from('trackino_calendars')
      .select('id, name, color, owner_user_id')
      .in('id', calIds);

    // Načti data ICS subscriptions
    const { data: subs } = await supabase
      .from('trackino_calendar_subscriptions')
      .select('id, name, color, user_id')
      .in('id', calIds);

    // Načti jména vlastníků
    const ownerIds = [
      ...new Set([
        ...(cals ?? []).map((c: Record<string, unknown>) => c.owner_user_id as string),
        ...(subs ?? []).map((s: Record<string, unknown>) => s.user_id as string),
      ])
    ].filter(id => id !== user.id);

    const ownerNames: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name')
        .in('id', ownerIds);
      for (const p of (profiles ?? [])) {
        ownerNames[p.id] = p.display_name ?? 'Uživatel';
      }
    }

    // Sestav SharedCalendarInfo – filtruj kalendáře které nejsou moje
    const result: SharedCalendarInfo[] = [];
    const seenCalIds = new Set<string>();

    for (const share of shares as CalendarShare[]) {
      if (seenCalIds.has(share.calendar_id)) continue; // deduplicate

      const cal = (cals ?? []).find((c: Record<string, unknown>) => c.id === share.calendar_id);
      const sub = (subs ?? []).find((s: Record<string, unknown>) => s.id === share.calendar_id);

      if (!cal && !sub) continue;

      const ownerUserId = cal
        ? (cal as Record<string, unknown>).owner_user_id as string
        : (sub as Record<string, unknown>).user_id as string;

      // Přeskoč vlastní kalendáře (sdílel bys sám sobě)
      if (ownerUserId === user.id) continue;

      seenCalIds.add(share.calendar_id);
      const pref = prefsMap[share.calendar_id];

      result.push({
        share_id: share.id,
        calendar_id: share.calendar_id,
        type: cal ? 'calendar' : 'subscription',
        name: cal
          ? (cal as Record<string, unknown>).name as string
          : (sub as Record<string, unknown>).name as string,
        owner_name: ownerNames[ownerUserId] ?? 'Uživatel',
        owner_user_id: ownerUserId,
        base_color: cal
          ? (cal as Record<string, unknown>).color as string
          : (sub as Record<string, unknown>).color as string,
        show_details: share.show_details,
        is_enabled: pref?.is_enabled ?? true,
        color_override: pref?.color_override ?? null,
      });
    }

    setSharedWithMe(result);
  }, [user, currentWorkspace]);

  // ── Načtení událostí ze sdílených kalendářů ────────────────────────────────

  const fetchSharedEvents = useCallback(async (shared: SharedCalendarInfo[]) => {
    if (!user || !currentWorkspace) return;
    const result: DisplayEvent[] = [];
    const enabledShared = shared.filter(s => s.is_enabled);
    if (enabledShared.length === 0) { setSharedEvents([]); return; }

    // Ruční kalendáře – načti events
    const calShared = enabledShared.filter(s => s.type === 'calendar');
    if (calShared.length > 0) {
      const calIds = calShared.map(s => s.calendar_id);
      const { data: evs } = await supabase
        .from('trackino_calendar_events')
        .select('*')
        .in('calendar_id', calIds)
        .order('start_date');
      for (const ev of (evs ?? []) as CalendarEvent[]) {
        const info = calShared.find(s => s.calendar_id === ev.calendar_id);
        if (!info) continue;
        const color = info.color_override ?? info.base_color;
        result.push({
          id: `shared-${ev.id}`,
          title: info.show_details ? ev.title : 'Nemá čas',
          start_date: ev.start_date,
          end_date: ev.end_date,
          color,
          source: 'shared',
          source_id: ev.id,
          calendar_id: ev.calendar_id,
          description: info.show_details ? ev.description : '',
          location: info.show_details ? ev.location : '',
          url: info.show_details ? ev.url : '',
          is_all_day: ev.is_all_day,
          start_time: ev.start_time,
          end_time: ev.end_time,
          is_shared: true,
          show_details: info.show_details,
          shared_owner_name: info.owner_name,
          shared_calendar_name: info.name,
        });
      }
    }

    // ICS subscriptions – načti z cache
    const subShared = enabledShared.filter(s => s.type === 'subscription');
    if (subShared.length > 0) {
      const subIds = subShared.map(s => s.calendar_id);
      const { data: cached } = await supabase
        .from('trackino_ics_event_cache')
        .select('*')
        .in('subscription_id', subIds);
      for (const ev of (cached ?? [])) {
        const info = subShared.find(s => s.calendar_id === ev.subscription_id);
        if (!info) continue;
        const color = info.color_override ?? info.base_color;
        result.push({
          id: `shared-ics-${ev.id}`,
          title: info.show_details ? ev.title : 'Nemá čas',
          start_date: ev.start_date,
          end_date: ev.end_date,
          color,
          source: 'shared',
          source_id: ev.id,
          description: info.show_details ? ev.description : '',
          is_all_day: ev.is_all_day,
          start_time: ev.start_time,
          end_time: ev.end_time,
          is_shared: true,
          show_details: info.show_details,
          shared_owner_name: info.owner_name,
          shared_calendar_name: info.name,
        });
      }
    }

    setSharedEvents(result);
  }, [user, currentWorkspace]);

  // ── Načtení účastníků událostí ─────────────────────────────────────────────

  const fetchAttendees = useCallback(async (eventIds: string[]) => {
    if (!user || !currentWorkspace || eventIds.length === 0) return;
    const { data } = await supabase
      .from('trackino_calendar_event_attendees')
      .select('*')
      .in('event_id', eventIds);
    const map: Record<string, CalendarEventAttendee[]> = {};
    for (const a of (data ?? []) as CalendarEventAttendee[]) {
      if (!map[a.event_id]) map[a.event_id] = [];
      map[a.event_id].push(a);
    }
    setEventAttendees(map);
  }, [user, currentWorkspace]);

  // ── Načtení událostí kde jsem účastník ────────────────────────────────────

  const [attendeeEvents, setAttendeeEvents] = useState<DisplayEvent[]>([]);

  const fetchAttendeeEvents = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    // Najdi záznamy kde jsem účastník
    const { data: myAttendances } = await supabase
      .from('trackino_calendar_event_attendees')
      .select('event_id, status')
      .eq('user_id', user.id)
      .eq('workspace_id', currentWorkspace.id);
    if (!myAttendances || myAttendances.length === 0) { setAttendeeEvents([]); return; }

    const eventIds = myAttendances.map((a: Record<string, unknown>) => a.event_id as string);
    const { data: evs } = await supabase
      .from('trackino_calendar_events')
      .select('*')
      .in('id', eventIds);

    const result: DisplayEvent[] = [];
    for (const ev of (evs ?? []) as CalendarEvent[]) {
      const att = myAttendances.find((a: Record<string, unknown>) => a.event_id === ev.id);
      result.push({
        id: `attendee-${ev.id}`,
        title: ev.title,
        start_date: ev.start_date,
        end_date: ev.end_date,
        color: ev.color ?? '#f59e0b',
        source: 'manual',
        source_id: ev.id,
        description: ev.description,
        location: ev.location,
        url: ev.url,
        is_all_day: ev.is_all_day,
        start_time: ev.start_time,
        end_time: ev.end_time,
        attendee_status: att?.status as 'pending' | 'accepted' | 'declined',
        event_owner_id: ev.user_id,
      });
    }
    setAttendeeEvents(result);
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
        // Načti attendees pro vlastní události
        await fetchAttendees(calIds.length > 0 ? (evs ?? []).map((e: Record<string, unknown>) => e.id as string) : []);
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
  }, [user, currentWorkspace, fetchAttendees]);

  useEffect(() => {
    fetchData();
    fetchSubscriptions();
    fetchWorkspaceMembers();
    fetchAttendeeEvents();
    fetchBirthdayMembers();
  }, [fetchData, fetchSubscriptions, fetchWorkspaceMembers, fetchAttendeeEvents, fetchBirthdayMembers]);

  // Načtení sdílení po načtení kalendářů a subscriptions
  useEffect(() => {
    if (calendars.length > 0 || subscriptions.length > 0) {
      const calIds = calendars.map(c => c.id);
      const subIds = subscriptions.map(s => s.id);
      fetchCalendarShares(calIds, subIds);
    }
  }, [calendars, subscriptions, fetchCalendarShares]);

  // Načtení sdílených kalendářů (kde jsem příjemce) + jejich událostí
  useEffect(() => {
    fetchSharedWithMe().then(async () => {
      // sharedWithMe se nastaví v fetchSharedWithMe, useEffect níže ho zpracuje
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSharedWithMe]);

  useEffect(() => {
    fetchSharedEvents(sharedWithMe);
  }, [sharedWithMe, fetchSharedEvents]);

  // ── CRUD – Události ───────────────────────────────────────────────────────

  function openNewEvent(date?: string) {
    const d = date ?? toDateStr(currentDate);
    setEditingEvent(null);
    const defaultCalId = calendars.find(c => c.is_default)?.id ?? calendars[0]?.id ?? '';
    setEventForm({
      title: '',
      description: '',
      location: '',
      url: '',
      attendee_ids: [],
      reminder_minutes: null,
      start_date: d,
      end_date: d,
      is_all_day: true,
      start_time: '',
      end_time: '',
      color: '',
      calendar_id: defaultCalId,
    });
    setAttendeeSearch('');
    setShowAttendeeDropdown(false);
    setShowEventForm(true);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    // Načti existující attendees pro tento event
    const existingAttendees = eventAttendees[ev.id]?.map(a => a.user_id) ?? [];
    setEventForm({
      title: ev.title,
      description: ev.description,
      location: ev.location ?? '',
      url: ev.url ?? '',
      attendee_ids: existingAttendees,
      reminder_minutes: ev.reminder_minutes ?? null,
      start_date: ev.start_date,
      end_date: ev.end_date,
      is_all_day: ev.is_all_day,
      start_time: ev.start_time ?? '',
      end_time: ev.end_time ?? '',
      color: ev.color ?? '',
      calendar_id: ev.calendar_id,
    });
    setAttendeeSearch('');
    setShowAttendeeDropdown(false);
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
        location: eventForm.location,
        url: eventForm.url,
        reminder_minutes: eventForm.reminder_minutes,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || eventForm.start_date,
        is_all_day: eventForm.is_all_day,
        start_time: eventForm.is_all_day ? null : (eventForm.start_time || null),
        end_time: eventForm.is_all_day ? null : (eventForm.end_time || null),
        color: eventForm.color || null,
        source: 'manual' as const,
        source_id: null,
      };
      let savedEventId: string;
      if (editingEvent) {
        await supabase.from('trackino_calendar_events').update(payload).eq('id', editingEvent.id);
        savedEventId = editingEvent.id;
      } else {
        const { data: inserted } = await supabase
          .from('trackino_calendar_events')
          .insert(payload)
          .select('id')
          .single();
        savedEventId = inserted?.id ?? '';
      }
      // Uložit attendees
      if (savedEventId) {
        // Zachovaj stávající accepted/declined, odstraň ty co byli odebrání, přidej nové
        const existing = eventAttendees[savedEventId] ?? [];
        const toKeep = existing.filter(a => eventForm.attendee_ids.includes(a.user_id));
        const toAdd = eventForm.attendee_ids.filter(uid => !existing.find(a => a.user_id === uid));
        const toRemove = existing.filter(a => !eventForm.attendee_ids.includes(a.user_id));

        if (toRemove.length > 0) {
          await supabase.from('trackino_calendar_event_attendees')
            .delete()
            .in('id', toRemove.map(a => a.id));
        }
        if (toAdd.length > 0) {
          await supabase.from('trackino_calendar_event_attendees')
            .insert(toAdd.map(uid => ({
              event_id: savedEventId,
              workspace_id: currentWorkspace.id,
              user_id: uid,
              status: 'pending',
            })));
        }
        void toKeep; // zachovány v DB
      }
      setShowEventForm(false);
      await Promise.all([fetchData(), fetchAttendeeEvents()]);
    } finally {
      setSavingEvent(false);
    }
  }

  // ── RSVP – přijetí/odmítnutí události jako účastník ──────────────────────

  async function respondToAttendance(eventSourceId: string, status: 'accepted' | 'declined') {
    if (!user || !currentWorkspace) return;
    await supabase
      .from('trackino_calendar_event_attendees')
      .update({ status })
      .eq('event_id', eventSourceId)
      .eq('user_id', user.id);
    await fetchAttendeeEvents();
  }

  async function deleteEvent(id: string) {
    setDeletingEventId(id);
    await supabase.from('trackino_calendar_events').delete().eq('id', id);
    setDeletingEventId(null);
    setShowEventForm(false);
    await fetchData();
  }

  // ── Sdílení kalendáře ─────────────────────────────────────────────────────

  function openShareModal(cal?: Calendar, sub?: CalendarSubscription) {
    setSharingCalendar(cal ?? null);
    setSharingSubscription(sub ?? null);
    const calId = cal?.id ?? sub?.id ?? '';
    // Načti aktuální shares pro tento kalendář
    const existing = calendarShares.filter(s => s.calendar_id === calId);
    const wsShare = existing.find(s => s.share_with_workspace);
    const userShares = existing
      .filter(s => !s.share_with_workspace && s.shared_with_user_id)
      .map(s => ({
        user_id: s.shared_with_user_id!,
        enabled: true,
        show_details: s.show_details,
      }));
    setShareModalState({
      shareWithWorkspace: !!wsShare,
      workspaceShowDetails: wsShare?.show_details ?? true,
      userShares,
    });
    setShowShareModal(true);
  }

  async function saveShare() {
    if (!currentWorkspace) return;
    const calId = sharingCalendar?.id ?? sharingSubscription?.id ?? '';
    if (!calId) return;
    setSavingShare(true);
    setShareError('');
    try {
      // Smaž všechny stávající shares pro tento kalendář
      await supabase.from('trackino_calendar_shares').delete().eq('calendar_id', calId);
      // Vlož nové
      const toInsert: Partial<CalendarShare>[] = [];
      if (shareModalState.shareWithWorkspace) {
        toInsert.push({
          calendar_id: calId,
          shared_with_user_id: null,
          share_with_workspace: true,
          show_details: shareModalState.workspaceShowDetails,
          can_edit: false,
        });
      }
      for (const us of shareModalState.userShares) {
        if (!us.enabled) continue;
        toInsert.push({
          calendar_id: calId,
          shared_with_user_id: us.user_id,
          share_with_workspace: false,
          show_details: us.show_details,
          can_edit: false,
        });
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from('trackino_calendar_shares').insert(toInsert);
        if (error) {
          console.error('saveShare error:', error);
          setShareError('Uložení se nezdařilo. Zkontrolujte, zda byla spuštěna SQL migrace pro sdílení externích kalendářů.');
          return;
        }
      }
      setShowShareModal(false);
      // Refresh shares
      const calIds = calendars.map(c => c.id);
      const subIds = subscriptions.map(s => s.id);
      await fetchCalendarShares(calIds, subIds);
    } finally {
      setSavingShare(false);
    }
  }

  async function updateSharePref(calendarId: string, update: Partial<CalendarSharePref>) {
    if (!user) return;
    await supabase.from('trackino_calendar_share_prefs')
      .upsert({ calendar_id: calendarId, user_id: user.id, ...update },
               { onConflict: 'calendar_id,user_id' });
    setSharePrefs(prev => ({
      ...prev,
      [calendarId]: { ...prev[calendarId], ...update } as CalendarSharePref,
    }));
    // Refresh sdílených událostí
    const updated = sharedWithMe.map(s =>
      s.calendar_id === calendarId
        ? { ...s, ...update, is_enabled: update.is_enabled ?? s.is_enabled, color_override: update.color_override ?? s.color_override }
        : s
    );
    setSharedWithMe(updated);
    await fetchSharedEvents(updated);
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
    meta: { is_important: boolean; is_done: boolean; is_favorite: boolean } = { is_important: false, is_done: false, is_favorite: false },
    eventTitle = '',
    eventDate = ''
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
          event_title: eventTitle,
          event_date: eventDate,
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

  /** Načte všechny poznámky a najde ty bez přiřazené události */
  async function fetchOrphanNotes() {
    if (!currentWorkspace || !user) return;
    setOrphanLoading(true);

    // 1. Načti všechny poznámky uživatele v tomto workspace
    const { data: allNotes, error } = await supabase
      .from('trackino_calendar_event_notes')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error || !allNotes) { setOrphanLoading(false); return; }

    // 2. Aktuálně viditelné event_refs (z displayEvents)
    const visibleRefs = new Set(displayEvents.map(ev => ev.id));

    // 3. Pro ruční události (UUID – nezačínají na 'sub-') ověř existenci v DB
    const uuidRefs = allNotes.map(n => n.event_ref).filter(r => !r.startsWith('sub-'));
    const existingManualIds = new Set<string>();
    if (uuidRefs.length > 0) {
      const { data: existing } = await supabase
        .from('trackino_calendar_events')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .in('id', uuidRefs);
      existing?.forEach(e => existingManualIds.add(e.id));
    }

    // 4. Vyfiltruj sirotky
    const orphans = allNotes.filter(n => {
      if (n.event_ref.startsWith('sub-')) {
        // ICS událost: sirotek pokud není ve viditelném rozsahu (24 měsíců zpět)
        return !visibleRefs.has(n.event_ref);
      } else {
        // Ruční událost: sirotek pokud neexistuje v DB
        return !existingManualIds.has(n.event_ref);
      }
    });

    setOrphanNotes(orphans as OrphanNote[]);
    setOrphanLoading(false);
  }

  /** Trvale smaže sirotčí poznámku */
  async function deleteOrphanNote(id: string) {
    await supabase.from('trackino_calendar_event_notes').delete().eq('id', id);
    setOrphanNotes(prev => prev.filter(n => n.id !== id));
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

  function saveCalSettings() {
    // Viditelná část – zaklampovat na 0–24 a uložit do localStorage
    const vs = Math.max(0, Math.min(23, calSettingsForm.viewStart));
    const ve = Math.max(vs + 1, Math.min(24, calSettingsForm.viewEnd));
    setCalViewStart(vs);
    setCalViewEnd(ve);
    localStorage.setItem('trackino_cal_view_start', String(vs));
    localStorage.setItem('trackino_cal_view_end', String(ve));
    setShowCalSettings(false);
    // Explicitní scroll po zavření modalu
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (weekGridRef.current) {
          weekGridRef.current.scrollTop = vs * ROW_H;
        }
      });
    });
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
      const start = getMonday(currentDate); start.setHours(0, 0, 0, 0);
      const end = addDays(start, 6); end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { start: addDays(getMonday(start), -7), end: addDays(end, 14) };
    } else if (view === 'today') {
      const todayStart = new Date(currentDate); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(currentDate); todayEnd.setHours(23, 59, 59, 999);
      return { start: todayStart, end: todayEnd };
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
          color: holidayColor,
          source: 'holiday',
          source_id: dateStr,
          is_all_day: true,
        });
      }
    }
    return result;
  }, [showHolidays, visibleRange, holidayColor]);

  // ── České jmeniny ──────────────────────────────────────────────────────────

  const namedayEvents = useMemo<DisplayEvent[]>(() => {
    if (!showNamedays) return [];
    const result: DisplayEvent[] = [];
    const { start, end } = visibleRange;
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const name = getCzechNamedayForDate(cur);
      if (name) {
        const dateStr = toDateStr(cur);
        result.push({
          id: `nameday-${dateStr}`,
          title: name,
          start_date: dateStr,
          end_date: dateStr,
          color: namedayColor,
          source: 'nameday',
          source_id: dateStr,
          is_all_day: true,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [showNamedays, visibleRange, namedayColor]);

  // ── Narozeniny kolegů ──────────────────────────────────────────────────────

  const birthdayEvents = useMemo<DisplayEvent[]>(() => {
    if (!showBirthdays || !canViewBirthdays || birthdayMembers.length === 0) return [];
    const result: DisplayEvent[] = [];
    const startYear = visibleRange.start.getFullYear();
    const endYear = visibleRange.end.getFullYear();
    for (const member of birthdayMembers) {
      const parts = member.birth_date.split('-');
      if (parts.length < 3) continue;
      const mm = parts[1];
      const dd = parts[2];
      for (let year = startYear; year <= endYear; year++) {
        const dateStr = `${year}-${mm}-${dd}`;
        const d = parseDate(dateStr);
        d.setHours(0, 0, 0, 0);
        if (d >= visibleRange.start && d <= visibleRange.end) {
          result.push({
            id: `birthday-${member.user_id}-${year}`,
            title: `🎂 ${member.display_name}`,
            start_date: dateStr,
            end_date: dateStr,
            color: birthdayColor,
            source: 'birthday',
            source_id: member.user_id,
            is_all_day: true,
          });
        }
      }
    }
    return result;
  }, [showBirthdays, canViewBirthdays, birthdayMembers, visibleRange, birthdayColor]);

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

    if (showVacation) {
      for (const v of vacationEntries) {
        result.push({
          id: `vacation-${v.id}`,
          title: 'Dovolená',
          start_date: v.start_date,
          end_date: v.end_date,
          color: vacationColor,
          source: 'vacation',
          source_id: v.id,
          description: v.note || '',
          is_all_day: true,
        });
      }
    }

    if (showImportantDays) {
      for (const day of importantDays) {
        const occs = getImportantDayOccurrences(day, visibleRange.start, visibleRange.end);
        for (const occ of occs) {
          result.push({
            id: `importantday-${day.id}-${occ.start}`,
            title: day.title,
            start_date: occ.start,
            end_date: occ.end,
            color: importantDaysColor ?? day.color,
            source: 'important_day',
            source_id: day.id,
            description: day.note || '',
            is_all_day: true,
          });
        }
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

    // Sdílené kalendáře (od ostatních uživatelů)
    for (const ev of sharedEvents) {
      const evStart = parseDate(ev.start_date);
      const evEnd = parseDate(ev.end_date);
      if (evStart <= visibleRange.end && evEnd >= visibleRange.start) {
        result.push(ev);
      }
    }

    // Účastnické události (kde jsem pozván)
    for (const ev of attendeeEvents) {
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

    // Jmeniny
    for (const ev of namedayEvents) {
      result.push(ev);
    }

    // Narozeniny kolegů
    for (const ev of birthdayEvents) {
      result.push(ev);
    }

    return result.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
  }, [events, vacationEntries, importantDays, calendars, selectedCalendarIds, visibleRange, subscriptionEvents, sharedEvents, attendeeEvents, czechHolidayEvents, namedayEvents, birthdayEvents, showVacation, vacationColor, showImportantDays, importantDaysColor]);

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
    return (
      <div
        onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
        className={`${compact ? 'px-1 py-0.5 text-[10px] leading-[14px]' : 'px-1.5 py-0.5 text-xs'} rounded font-medium ${wrap ? 'break-words' : 'truncate'}`}
        style={{
          background: ev.color + '22',
          color: ev.color,
          border: ev.attendee_status === 'pending' ? `2px dashed ${ev.color}` : `1px solid ${ev.color}44`,
          cursor: 'pointer',
        }}
        title={ev.attendee_status === 'pending' ? `${ev.title} – čeká na potvrzení` : ev.title}
      >
        {ev.attendee_status === 'pending' ? '? ' : ''}
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
  // Grid je vždy 0–24h; aktuální čas je vždy viditelný pokud existuje
  const nowTopPx = nowTotalMin * (ROW_H / 60);

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
              {v === 'today' ? 'Den' : v === 'week' ? 'Týden' : v === 'month' ? 'Měsíc' : v === 'year' ? 'Rok' : 'Seznam'}
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
                  {/* Sdílet */}
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
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
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
                      {/* Sdílet */}
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
                  {/* Dovolená */}
                  <div className="flex items-center gap-1.5 py-0.5 group/vacrow">
                    <button
                      role="checkbox"
                      aria-checked={showVacation}
                      onClick={() => { setShowVacation(p => { const v = !p; localStorage.setItem('trackino_cal_vacation', v ? '1' : '0'); return v; }); }}
                      className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                      style={{ background: showVacation ? vacationColor : 'transparent', borderColor: vacationColor }}
                    >
                      {showVacation && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Dovolená</span>
                    <div className="relative opacity-0 group-hover/vacrow:opacity-100 transition-opacity flex-shrink-0 group/vacdot">
                      <button
                        className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all"
                        style={{ background: vacationColor }}
                        title="Změnit barvu"
                      />
                      <div className="absolute right-0 top-5 z-20 hidden group-hover/vacdot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                        {DEFAULT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => { setVacationColor(c); localStorage.setItem('trackino_cal_vacation_color', c); }}
                            className="w-4 h-4 rounded-full transition-all"
                            style={{ background: c, boxShadow: vacationColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }}
                          />
                        ))}
                        <button
                          onClick={() => { setVacationColor('#0ea5e9'); localStorage.setItem('trackino_cal_vacation_color', '#0ea5e9'); }}
                          className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          title="Výchozí barva"
                        >○</button>
                      </div>
                    </div>
                  </div>
                  {/* Důležité dny */}
                  <div className="flex items-center gap-1.5 py-0.5 group/idaysrow">
                    <button
                      role="checkbox"
                      aria-checked={showImportantDays}
                      onClick={() => { setShowImportantDays(p => { const v = !p; localStorage.setItem('trackino_cal_important_days', v ? '1' : '0'); return v; }); }}
                      className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                      style={{ background: showImportantDays ? (importantDaysColor ?? '#f59e0b') : 'transparent', borderColor: importantDaysColor ?? '#f59e0b' }}
                    >
                      {showImportantDays && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Důležité dny</span>
                    <div className="relative opacity-0 group-hover/idaysrow:opacity-100 transition-opacity flex-shrink-0 group/idaysdot">
                      <button
                        className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all"
                        style={{ background: importantDaysColor ?? 'linear-gradient(135deg, #f59e0b, #8b5cf6)' }}
                        title="Změnit barvu (přebije individuální barvy)"
                      />
                      <div className="absolute right-0 top-5 z-20 hidden group-hover/idaysdot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                        {DEFAULT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => { setImportantDaysColor(c); localStorage.setItem('trackino_cal_important_days_color', c); }}
                            className="w-4 h-4 rounded-full transition-all"
                            style={{ background: c, boxShadow: importantDaysColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }}
                          />
                        ))}
                        <button
                          onClick={() => { setImportantDaysColor(null); localStorage.setItem('trackino_cal_important_days_color', 'null'); }}
                          className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          title="Individuální barvy"
                        >○</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* SDÍLENÉ KALENDÁŘE – zobrazí se jen pokud existují sdílené */}
            {sharedWithMe.length > 0 && (
              <div className="mb-3">
                <div className="mb-2">
                  <button
                    onClick={() => setSharedCalExpanded(p => !p)}
                    className="flex items-center gap-1 text-[10px] font-semibold tracking-wider"
                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    SDÍLENÉ KALENDÁŘE
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sharedCalExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>
                {sharedCalExpanded && sharedWithMe.map(shared => (
                  <div key={shared.share_id} className="flex items-center gap-1.5 py-0.5 group/shared">
                    {/* Toggle viditelnosti */}
                    <button
                      role="checkbox"
                      aria-checked={shared.is_enabled}
                      onClick={() => updateSharePref(shared.calendar_id, { is_enabled: !shared.is_enabled })}
                      className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                      style={{
                        background: shared.is_enabled ? (shared.color_override ?? shared.base_color) : 'transparent',
                        borderColor: shared.color_override ?? shared.base_color,
                      }}
                    >
                      {shared.is_enabled && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    {/* Název + vlastník */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs block truncate" style={{ color: 'var(--text-primary)' }}>{shared.name}</span>
                      <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>{shared.owner_name}</span>
                    </div>
                    {/* Barevná tečka s color pickerem – viditelná na hover */}
                    <div className="relative opacity-0 group-hover/shared:opacity-100 transition-opacity flex-shrink-0 group/colorpick">
                      <button
                        className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all"
                        style={{ background: shared.color_override ?? shared.base_color }}
                        title="Změnit barvu"
                      />
                      <div className="absolute right-0 top-5 z-20 hidden group-hover/colorpick:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                        {DEFAULT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => updateSharePref(shared.calendar_id, { color_override: c })}
                            className="w-4 h-4 rounded-full transition-all"
                            style={{ background: c, boxShadow: (shared.color_override ?? shared.base_color) === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }}
                          />
                        ))}
                        <button
                          onClick={() => updateSharePref(shared.calendar_id, { color_override: null })}
                          className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          title="Výchozí barva"
                        >○</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                <>
                  {/* Státní svátky */}
                  <div className="flex items-center gap-1.5 py-0.5 group/holrow">
                    <button
                      role="checkbox"
                      aria-checked={showHolidays}
                      onClick={() => { setShowHolidays(p => { const v = !p; localStorage.setItem('trackino_cal_holidays', v ? '1' : '0'); return v; }); }}
                      className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                      style={{ background: showHolidays ? holidayColor : 'transparent', borderColor: holidayColor }}
                    >
                      {showHolidays && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Státní svátky</span>
                    <div className="relative opacity-0 group-hover/holrow:opacity-100 transition-opacity flex-shrink-0 group/holdot">
                      <button
                        className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all"
                        style={{ background: holidayColor }}
                        title="Změnit barvu"
                      />
                      <div className="absolute right-0 top-5 z-20 hidden group-hover/holdot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                        {DEFAULT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => { setHolidayColor(c); localStorage.setItem('trackino_cal_holiday_color', c); }}
                            className="w-4 h-4 rounded-full transition-all"
                            style={{ background: c, boxShadow: holidayColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }}
                          />
                        ))}
                        <button
                          onClick={() => { setHolidayColor('#ef4444'); localStorage.setItem('trackino_cal_holiday_color', '#ef4444'); }}
                          className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          title="Výchozí barva"
                        >○</button>
                      </div>
                    </div>
                  </div>
                  {/* Jmeniny */}
                  <div className="flex items-center gap-1.5 py-0.5 group/ndrow">
                    <button
                      role="checkbox"
                      aria-checked={showNamedays}
                      onClick={() => { setShowNamedays(p => { const v = !p; localStorage.setItem('trackino_cal_namedays', v ? '1' : '0'); return v; }); }}
                      className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                      style={{ background: showNamedays ? namedayColor : 'transparent', borderColor: namedayColor }}
                    >
                      {showNamedays && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Jmeniny</span>
                    <div className="relative opacity-0 group-hover/ndrow:opacity-100 transition-opacity flex-shrink-0 group/nddot">
                      <button
                        className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all"
                        style={{ background: namedayColor }}
                        title="Změnit barvu"
                      />
                      <div className="absolute right-0 top-5 z-20 hidden group-hover/nddot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                        {DEFAULT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => { setNamedayColor(c); localStorage.setItem('trackino_cal_nameday_color', c); }}
                            className="w-4 h-4 rounded-full transition-all"
                            style={{ background: c, boxShadow: namedayColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }}
                          />
                        ))}
                        <button
                          onClick={() => { setNamedayColor('#7c3aed'); localStorage.setItem('trackino_cal_nameday_color', '#7c3aed'); }}
                          className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          title="Výchozí barva"
                        >○</button>
                      </div>
                    </div>
                  </div>
                  {/* Narozeniny */}
                  {canViewBirthdays && (
                    <div className="flex items-center gap-1.5 py-0.5 group/bdrow">
                      <button
                        role="checkbox"
                        aria-checked={showBirthdays}
                        onClick={() => { setShowBirthdays(p => { const v = !p; localStorage.setItem('trackino_cal_birthdays', v ? '1' : '0'); return v; }); }}
                        className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors cursor-pointer"
                        style={{ background: showBirthdays ? birthdayColor : 'transparent', borderColor: birthdayColor }}
                      >
                        {showBirthdays && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                      <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Narozeniny</span>
                      <div className="relative opacity-0 group-hover/bdrow:opacity-100 transition-opacity flex-shrink-0 group/bddot">
                        <button
                          className="w-3 h-3 rounded-full border border-transparent hover:border-white/30 transition-all"
                          style={{ background: birthdayColor }}
                          title="Změnit barvu"
                        />
                        <div className="absolute right-0 top-5 z-20 hidden group-hover/bddot:flex flex-wrap gap-1 p-2 rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 112 }}>
                          {DEFAULT_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => { setBirthdayColor(c); localStorage.setItem('trackino_cal_birthday_color', c); }}
                              className="w-4 h-4 rounded-full transition-all"
                              style={{ background: c, boxShadow: birthdayColor === c ? `0 0 0 1.5px white, 0 0 0 3px ${c}` : 'none' }}
                            />
                          ))}
                          <button
                            onClick={() => { setBirthdayColor('#ec4899'); localStorage.setItem('trackino_cal_birthday_color', '#ec4899'); }}
                            className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px]"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                            title="Výchozí barva"
                          >○</button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Nastavení kalendáře */}
            <div className="border-t pt-3 pb-4" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => { setCalSettingsForm({ viewStart: calViewStart, viewEnd: calViewEnd }); setShowCalSettings(true); }}
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
                                <EventPill key={ev.id} ev={ev} compact wrap />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Časová mřížka – POUZE tato část scrolluje vertikálně */}
                  <div ref={weekGridRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ minHeight: 0 }}>
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
                              onClick={() => openNewEvent(toDateStr(day))}
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
                                onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
                                title={ev.title}
                              >
                                <div className="font-semibold truncate pr-3">{ev.start_time?.slice(0, 5)} {ev.title}</div>
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
              )}

              {/* ══ DNES POHLED ══════════════════════════════════════════════ */}
              {view === 'today' && (() => {
                const day = currentDate;
                const isToday = isSameDay(day, today);
                const timedEvs = eventsOnDay(day).filter(ev => !ev.is_all_day && ev.start_time);
                const allDayEvs = eventsOnDay(day).filter(ev => ev.is_all_day || !ev.start_time);
                return (
                  <div ref={calWeekWrapperRef} className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 320, overflowY: 'hidden' }}>
                    {/* All-day strip – MIMO scroll kontejner, vždy viditelné */}
                    {allDayEvs.length > 0 && (
                      <div className="flex-shrink-0 flex border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                        <div className="flex-shrink-0 border-r text-[10px] px-1 py-1 flex items-center" style={{ width: 56, borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                          celý den
                        </div>
                        <div className="flex-1 p-1 flex flex-col gap-0.5">
                          {allDayEvs.map(ev => <EventPill key={ev.id} ev={ev} compact />)}
                        </div>
                      </div>
                    )}

                    {/* Časová mřížka – POUZE tato část scrolluje vertikálně */}
                    <div ref={weekGridRef} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
                    <div className="flex">
                      {/* Sloupec hodin */}
                      <div className="flex-shrink-0 border-r" style={{ width: 56, borderColor: 'var(--border)' }}>
                        {Array.from({ length: 24 }, (_, i) => (
                          <div key={i} className="relative border-b" style={{ height: ROW_H, borderColor: 'var(--border)' }}>
                            <span className="absolute text-[10px] right-1.5 top-1" style={{ color: 'var(--text-muted)' }}>
                              {String(i).padStart(2, '0')}:00
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
                        {Array.from({ length: 24 }, (_, i) => (
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
                        {isToday && (
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
                          const topPx = Math.max(0, ev._startMin * (ROW_H / 60));
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
                              onClick={e => { e.stopPropagation(); setDetailEvent(ev); }}
                              title={ev.title}
                            >
                              <div className="font-semibold truncate pr-4">{ev.start_time?.slice(0, 5)} {ev.title}</div>
                              {heightPx > 35 && ev.end_time && (
                                <div className="opacity-70">{ev.end_time.slice(0, 5)}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
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

                // Červená linka aktuálního času – najdi první event který je "v budoucnosti" vůči now
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
                                const tasksDone = on.tasks.filter(t => t.checked).length;
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
                                    {/* Barevný proužek / ikonka stavu */}
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
                                  const evNote = notesByRef[ev.id];
                                  const noteHasContent = !!(evNote?.content || (evNote?.tasks?.length ?? 0) > 0);
                                  const isSelected = openNoteEventIds.has(ev.id);
                                  const noteVisible = isSelected || noteHasContent;
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
                                        className="group/ev w-full md:flex-1 min-w-0 flex items-start gap-3 p-3 rounded-lg border transition-colors"
                                        style={{
                                          borderColor: 'var(--border)',
                                          background: 'var(--bg-card)',
                                          cursor: 'pointer',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                                      >
                                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: ev.color }} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{ev.title}</span>
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
                                        {/* Tlačítko pro toggle inline poznámky (skryto pro jmeniny/narozeniny) */}
                                        <button
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (ev.source === 'nameday' || ev.source === 'birthday') return;
                                            setOpenNoteEventIds(prev => { const n = new Set(prev); if (n.has(ev.id)) n.delete(ev.id); else n.add(ev.id); return n; });
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
              Nastavte, od které hodiny se má kalendář otevřít. Záhlaví s dny zůstane při scrollu ukotveno. Celý den (0–23 h) je dostupný scrollem.
            </p>

            {/* Viditelná část */}
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Počáteční pozice při otevření</p>
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
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Do</label>
                <div className="relative">
                  <select
                    value={calSettingsForm.viewEnd}
                    onChange={e => setCalSettingsForm(f => ({ ...f, viewEnd: parseInt(e.target.value) }))}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).filter(h => h > calSettingsForm.viewStart).map(h => (
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
              Příklad: Od 9:00 → kalendář se otevře s řádkem 9:00 hned pod záhlavím.
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
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--primary)' }}
              >
                Uložit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – Nová / Upravit událost ════════════════════════════════════ */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl shadow-xl border overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }}>
            <div className="p-6">
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
                {/* Název */}
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

                {/* Kalendář */}
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

                {/* Datum Od / Do */}
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

                {/* Celý den */}
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

                {/* Časy */}
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

                {/* Místo */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Místo</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Adresa nebo název místa"
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Účastníci */}
                {workspaceMembers.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Účastníci</label>
                    {/* Tagy + vyhledávání */}
                    <div
                      className="min-h-[38px] px-2 py-1.5 rounded-lg border flex flex-wrap gap-1 items-center cursor-text"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}
                      onClick={() => setShowAttendeeDropdown(true)}
                    >
                      {eventForm.attendee_ids.map(uid => {
                        const member = workspaceMembers.find(m => m.user_id === uid);
                        if (!member) return null;
                        return (
                          <span
                            key={uid}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white flex-shrink-0"
                            style={{ background: member.avatar_color }}
                          >
                            {member.display_name}
                            <button
                              onClick={e => { e.stopPropagation(); setEventForm(f => ({ ...f, attendee_ids: f.attendee_ids.filter(id => id !== uid) })); }}
                              className="ml-0.5 hover:opacity-70"
                            >
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                      <input
                        type="text"
                        value={attendeeSearch}
                        onChange={e => { setAttendeeSearch(e.target.value); setShowAttendeeDropdown(true); }}
                        onFocus={() => setShowAttendeeDropdown(true)}
                        onBlur={() => setTimeout(() => setShowAttendeeDropdown(false), 150)}
                        placeholder={eventForm.attendee_ids.length === 0 ? 'Přidat účastníka...' : ''}
                        className="flex-1 min-w-[80px] bg-transparent text-base sm:text-sm outline-none"
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>
                    {/* Dropdown */}
                    {showAttendeeDropdown && (
                      <div className="relative z-10">
                        <div
                          className="absolute left-0 right-0 rounded-lg border shadow-lg overflow-y-auto"
                          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: 180, top: 2 }}
                        >
                          {workspaceMembers
                            .filter(m => !eventForm.attendee_ids.includes(m.user_id) && m.display_name.toLowerCase().includes(attendeeSearch.toLowerCase()))
                            .map(m => (
                              <button
                                key={m.user_id}
                                onMouseDown={() => {
                                  setEventForm(f => ({ ...f, attendee_ids: [...f.attendee_ids, m.user_id] }));
                                  setAttendeeSearch('');
                                  setShowAttendeeDropdown(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                                  {m.display_name.slice(0, 1).toUpperCase()}
                                </span>
                                {m.display_name}
                              </button>
                            ))}
                          {workspaceMembers.filter(m => !eventForm.attendee_ids.includes(m.user_id) && m.display_name.toLowerCase().includes(attendeeSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Žádní účastníci nenalezeni</div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* RSVP stav účastníků (při editaci) */}
                    {editingEvent && (eventAttendees[editingEvent.id]?.length ?? 0) > 0 && (
                      <div className="mt-2 space-y-1 px-1">
                        <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Stav pozvání:</p>
                        {eventAttendees[editingEvent.id].map(att => {
                          const member = workspaceMembers.find(m => m.user_id === att.user_id);
                          return (
                            <div key={att.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: member?.avatar_color ?? '#6b7280' }}>
                                {(member?.display_name ?? '?').slice(0, 1).toUpperCase()}
                              </span>
                              <span className="flex-1 truncate">{member?.display_name ?? 'Uživatel'}</span>
                              {att.status === 'accepted' && <span className="font-medium" style={{ color: '#22c55e' }}>✓ Přijato</span>}
                              {att.status === 'declined' && <span className="font-medium" style={{ color: '#ef4444' }}>✗ Odmítnuto</span>}
                              {att.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>? Čeká</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* URL */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>URL</label>
                  <input
                    type="url"
                    value={eventForm.url}
                    onChange={e => setEventForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Upozornění */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Upozornění</label>
                  <div className="relative">
                    <select
                      value={eventForm.reminder_minutes === null ? '' : String(eventForm.reminder_minutes)}
                      onChange={e => setEventForm(f => ({ ...f, reminder_minutes: e.target.value === '' ? null : parseInt(e.target.value) }))}
                      className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Bez upozornění</option>
                      <option value="5">5 minut před</option>
                      <option value="15">15 minut před</option>
                      <option value="30">30 minut před</option>
                      <option value="60">1 hodinu před</option>
                      <option value="1440">1 den před</option>
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Poznámka (přejmenováno z Popis) */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
                  <textarea
                    value={eventForm.description}
                    onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Volitelná poznámka..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm resize-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Barva */}
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


            <div className="flex items-center justify-between mt-6">
              {editingCalendar && !editingCalendar.is_default ? (
                <button
                  onClick={async () => { if (confirm('Odstranit tento kalendář? Budou smazány i všechny jeho události.')) { await deleteCalendar(editingCalendar.id); setShowCalendarForm(false); } }}
                  className="px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Odstranit
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

      {/* ══ MODAL – Nastavení sdílení ══════════════════════════════════════════ */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl shadow-xl border overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '88vh' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Sdílení: {sharingCalendar?.name ?? sharingSubscription?.name}
                </h2>
                <button onClick={() => setShowShareModal(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Sdílet s celým workspace */}
                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="share_workspace"
                        checked={shareModalState.shareWithWorkspace}
                        onChange={e => setShareModalState(s => ({ ...s, shareWithWorkspace: e.target.checked }))}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <label htmlFor="share_workspace" className="text-sm cursor-pointer font-medium" style={{ color: 'var(--text-primary)' }}>
                        Sdílet s celým workspace
                      </label>
                    </div>
                    {shareModalState.shareWithWorkspace && (
                      <div className="flex items-center gap-1.5 text-xs flex-shrink-0 ml-3" style={{ color: 'var(--text-muted)' }}>
                        <span>Detaily</span>
                        <button
                          onClick={() => setShareModalState(s => ({ ...s, workspaceShowDetails: !s.workspaceShowDetails }))}
                          className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                          style={{ background: shareModalState.workspaceShowDetails ? 'var(--primary)' : 'var(--border)' }}
                        >
                          <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm" style={{ left: shareModalState.workspaceShowDetails ? '18px' : '2px' }} />
                        </button>
                      </div>
                    )}
                  </div>
                  {shareModalState.shareWithWorkspace && !shareModalState.workspaceShowDetails && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Ostatní uvidí pouze „Nemá čas" – bez názvů ani detailů událostí.
                    </p>
                  )}
                </div>

                {/* Konkrétní uživatelé */}
                {workspaceMembers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Nebo konkrétní uživatelé:</p>
                    <div className="space-y-2.5">
                      {workspaceMembers.map(member => {
                        const existing = shareModalState.userShares.find(u => u.user_id === member.user_id);
                        const isEnabled = existing?.enabled ?? false;
                        const showDetails = existing?.show_details ?? true;
                        return (
                          <div key={member.user_id} className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: member.avatar_color }}>
                              {member.display_name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{member.display_name}</span>
                            {isEnabled && (
                              <div className="flex items-center gap-1 text-xs flex-shrink-0 mr-1" style={{ color: 'var(--text-muted)' }}>
                                <span>Detaily</span>
                                <button
                                  onClick={() => {
                                    setShareModalState(s => ({
                                      ...s,
                                      userShares: s.userShares.map(u => u.user_id === member.user_id ? { ...u, show_details: !u.show_details } : u),
                                    }));
                                  }}
                                  className="w-7 h-3.5 rounded-full relative transition-colors flex-shrink-0"
                                  style={{ background: showDetails ? 'var(--primary)' : 'var(--border)' }}
                                >
                                  <span className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: showDetails ? '15px' : '2px' }} />
                                </button>
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setShareModalState(s => {
                                  const has = s.userShares.find(u => u.user_id === member.user_id);
                                  if (has) {
                                    return { ...s, userShares: s.userShares.filter(u => u.user_id !== member.user_id) };
                                  } else {
                                    return { ...s, userShares: [...s.userShares, { user_id: member.user_id, enabled: true, show_details: true }] };
                                  }
                                });
                              }}
                              className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                              style={{ background: isEnabled ? 'var(--primary)' : 'var(--border)' }}
                            >
                              <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm" style={{ left: isEnabled ? '18px' : '2px' }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {workspaceMembers.length === 0 && (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                    Ve workspace nejsou žádní další členové.
                  </p>
                )}
              </div>

              {shareError && (
                <p className="mt-4 text-xs rounded-lg px-3 py-2" style={{ color: '#ef4444', background: '#ef444415' }}>
                  {shareError}
                </p>
              )}

              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => { setShowShareModal(false); setShareError(''); }}
                  className="px-4 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveShare}
                  disabled={savingShare}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingShare ? 'Ukládám...' : 'Uložit sdílení'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – RSVP (přijetí/odmítnutí pozvánky) ════════════════════════ */}
      {rsvpModalEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRsvpModalEvent(null)}>
          <div className="w-full max-w-sm rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Pozvánka na událost</h2>
              <button onClick={() => setRsvpModalEvent(null)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* Info o události */}
            <div className="p-3 rounded-lg mb-4" style={{ background: rsvpModalEvent.color + '15', border: `1px solid ${rsvpModalEvent.color}44` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: rsvpModalEvent.color }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rsvpModalEvent.title}</span>
              </div>
              <p className="text-xs ml-[18px]" style={{ color: 'var(--text-secondary)' }}>
                {rsvpModalEvent.start_date === rsvpModalEvent.end_date
                  ? parseDate(rsvpModalEvent.start_date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
                  : `${parseDate(rsvpModalEvent.start_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })} – ${parseDate(rsvpModalEvent.end_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })}`
                }
                {rsvpModalEvent.start_time ? ` · ${rsvpModalEvent.start_time.slice(0, 5)}${rsvpModalEvent.end_time ? `–${rsvpModalEvent.end_time.slice(0, 5)}` : ''}` : ''}
              </p>
              {rsvpModalEvent.location && (
                <p className="text-xs ml-[18px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {rsvpModalEvent.location}
                </p>
              )}
            </div>
            {/* Aktuální stav */}
            <p className="text-xs mb-4 text-center" style={{ color: 'var(--text-muted)' }}>
              Tvůj stav:{' '}
              <span style={{ color: rsvpModalEvent.attendee_status === 'accepted' ? '#22c55e' : rsvpModalEvent.attendee_status === 'declined' ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600 }}>
                {rsvpModalEvent.attendee_status === 'accepted' ? '✓ Přijato' : rsvpModalEvent.attendee_status === 'declined' ? '✗ Odmítnuto' : '? Čeká na odpověď'}
              </span>
            </p>
            {/* RSVP tlačítka */}
            <div className="flex gap-2">
              <button
                onClick={async () => { await respondToAttendance(rsvpModalEvent.source_id, 'accepted'); setRsvpModalEvent(null); }}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-85"
                style={{ background: '#22c55e' }}
              >
                ✓ Přijmout
              </button>
              <button
                onClick={async () => { await respondToAttendance(rsvpModalEvent.source_id, 'declined'); setRsvpModalEvent(null); }}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-85"
                style={{ background: '#ef4444' }}
              >
                ✗ Odmítnout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – DETAIL UDÁLOSTI ═══════════════════════════════════════════ */}
      {detailEvent && (() => {
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
            <div className="w-full max-w-md rounded-xl shadow-xl border flex flex-col overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
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
                <button onClick={() => setDetailEvent(null)} className="p-1 rounded flex-shrink-0 hover:opacity-60 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Tělo */}
              <div className="overflow-y-auto px-5 pb-5 space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {/* Datum + čas */}
                <div className="flex items-start gap-2.5">
                  <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div>
                    <div>{dateStr}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{timeStr}</div>
                  </div>
                </div>

                {/* Místo */}
                {ev.location && (
                  <div className="flex items-start gap-2.5">
                    <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>{ev.location}</span>
                  </div>
                )}

                {/* URL */}
                {ev.url && (
                  <div className="flex items-start gap-2.5">
                    <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" className="underline break-all hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }}>{ev.url}</a>
                  </div>
                )}

                {/* Popis / poznámka */}
                {ev.description && (
                  <div className="flex items-start gap-2.5">
                    <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                    <span className="whitespace-pre-wrap">{ev.description}</span>
                  </div>
                )}

                {/* Sdíleno od */}
                {(isShared || isAttendee) && ev.shared_owner_name && (
                  <div className="flex items-center gap-2.5">
                    <svg className="flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{isAttendee ? 'Organizátor:' : 'Sdíleno od:'} <strong>{ev.shared_owner_name}</strong></span>
                  </div>
                )}

                {/* Účastníci (pro vlastní události) */}
                {attendeeList.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Účastníci</span>
                    </div>
                    <div className="space-y-1 pl-5">
                      {attendeeList.map(att => {
                        const m = workspaceMembers.find(x => x.user_id === att.user_id);
                        const statusIcon = att.status === 'accepted' ? '✓' : att.status === 'declined' ? '✗' : '?';
                        const statusColor = att.status === 'accepted' ? '#22c55e' : att.status === 'declined' ? '#ef4444' : '#9ca3af';
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
                    <svg className="flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    <span>{ev.reminder_minutes < 60 ? `${ev.reminder_minutes} min` : ev.reminder_minutes === 60 ? '1 hodina' : '1 den'} před událostí</span>
                  </div>
                )}

                {/* RSVP status pro attendee */}
                {isAttendee && (
                  <div className="pt-1">
                    {ev.attendee_status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { await respondToAttendance(ev.source_id, 'accepted'); setDetailEvent(null); }}
                          className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-85"
                          style={{ background: '#22c55e' }}
                        >✓ Přijmout</button>
                        <button
                          onClick={async () => { await respondToAttendance(ev.source_id, 'declined'); setDetailEvent(null); }}
                          className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-85"
                          style={{ background: '#ef4444' }}
                        >✗ Odmítnout</button>
                      </div>
                    ) : (
                      <div className="text-center text-xs py-1 rounded-lg" style={{ background: ev.attendee_status === 'accepted' ? '#22c55e22' : '#ef444422', color: ev.attendee_status === 'accepted' ? '#22c55e' : '#ef4444' }}>
                        {ev.attendee_status === 'accepted' ? '✓ Přijato' : '✗ Odmítnuto'}
                      </div>
                    )}
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Upravit
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
