// ─── Calendar Module – Utility Functions ─────────────────────────────────────
// Přesunuto z page.tsx (ř. 82–138 + 422–516 + 543–557)

import type { DisplayEvent } from './types';

// ─── Datum helpers ────────────────────────────────────────────────────────────

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(str: string): Date {
  return new Date(str + 'T00:00:00');
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

export function formatWeekRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  const endStr = end.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

// ─── Konstanty ────────────────────────────────────────────────────────────────

export const DAY_NAMES_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
export const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

export const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#f43f5e', '#78716c',
  '#6b7280', '#92400e', '#a16207', '#1e3a5f',
];

/** ROW_H – px na hodinu v týdenním/denním pohledu */
export const ROW_H = 60;

// ─── ICS / iCal helpers ───────────────────────────────────────────────────────

/** Odstraní ICS escaping (\\, → ,  \\; → ;  \\n → mezera  \\\\ → \\) */
export function unescapeIcs(s: string): string {
  return s.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').replace(/\\\\/g, '\\');
}

/**
 * Převede ICS datetime hodnotu na lokální { date, time }.
 * Podporuje:
 *   - UTC čas (přípona Z):          "20260311T100000Z" → převede UTC → lokální
 *   - TZID čas (pojmenované pásmo): "20260311T110000"  + tzid "Europe/Prague" → konverze
 *   - Plovoucí čas (bez Z a TZID):  "20260311T110000"  → bere přímo jako lokální
 */
function parseIcsDt(value: string, tzid: string | null): { date: string; time: string } {
  const isUtc = value.endsWith('Z');
  const raw = value.replace(/Z$/, '');
  const isoBase = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:00`;

  let d: Date;
  if (isUtc) {
    // UTC → lokální čas prohlížeče
    d = new Date(isoBase + 'Z');
  } else if (tzid) {
    // Pojmenované časové pásmo → najdeme UTC ekvivalent pomocí Intl API
    try {
      d = parseTzIdToLocal(isoBase, tzid);
    } catch {
      // Fallback: plováme jako lokální
      d = new Date(isoBase);
    }
  } else {
    // Plovoucí čas – bere se jako lokální
    d = new Date(isoBase);
  }

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: toDateStr(d), time: `${hh}:${mm}` };
}

/**
 * Převede "naivní" lokální čas v daném časovém pásmu na Date objekt.
 * Příklad: isoBase = "2026-03-11T11:00:00", tzid = "Europe/Prague" → Date(10:00 UTC)
 */
function parseTzIdToLocal(isoBase: string, tzid: string): Date {
  // Krok 1: parsuj jako "falešné" UTC pro získání epoch ms
  const naiveMs = new Date(isoBase + 'Z').getTime();
  // Krok 2: zjisti, jak vypadá tento okamžik v cílovém TZ
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tzid,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(naiveMs));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  const tzAsUtcMs = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  ).getTime();
  // Krok 3: offset a skutečný UTC čas
  const actualUtcMs = naiveMs + (naiveMs - tzAsUtcMs);
  return new Date(actualUtcMs);
}

// Parsování ICS/iCal textu na DisplayEvent záznamy
export function parseICS(icsText: string, subId: string, color: string): DisplayEvent[] {
  // Rozloží zalomené řádky (RFC 5545 line folding)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const result: DisplayEvent[] = [];
  const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m: RegExpExecArray | null;

  while ((m = veventRe.exec(unfolded)) !== null) {
    const blk = m[1];
    // Extrahuje hodnotu vlastnosti (ignoruje parametry jako TZID=...)
    const get = (key: string) =>
      blk.match(new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:([^\\r\\n]+)`, 'i'))?.[1]?.trim() ?? '';
    // Extrahuje hodnotu TZID parametru z řádku vlastnosti
    const getTzid = (key: string) =>
      blk.match(new RegExp(`(?:^|\\n)${key};TZID=([^:;]+)`, 'i'))?.[1]?.trim() ?? null;

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
      const tzid = getTzid('DTSTART');
      const tzidEnd = getTzid('DTEND') ?? tzid;
      const s = parseIcsDt(dtstart, tzid);
      startDate = s.date;
      startTime = s.time;
      const e = parseIcsDt(dtend, tzidEnd);
      endDate = e.date;
      endTime = e.time;
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

export function eventOnDay(ev: DisplayEvent, day: Date): boolean {
  const start = parseDate(ev.start_date);
  const end = parseDate(ev.end_date);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export function sourceBadgeLabel(source: DisplayEvent['source']): string {
  if (source === 'vacation') return 'Dovolená';
  if (source === 'important_day') return 'Důležitý den';
  if (source === 'subscription') return 'Ext. kalendář';
  if (source === 'holiday') return 'Státní svátek';
  if (source === 'nameday') return 'Jmeniny';
  if (source === 'birthday') return 'Narozeniny';
  return '';
}

// ─── HTML / Note helpers ──────────────────────────────────────────────────────

/** Převede HTML na prostý text (stripuje tagy) */
export function stripHtmlToText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

/** Obalí plaintext URL v HTML do klikatelného odkazu */
export function linkifyHtml(html: string): string {
  // Pouze obalí URL které NEJSOU již uvnitř tagu (heuristika: nepředchází je href=")
  return html.replace(/(?<!["'>])(https?:\/\/[^\s<>"'\]]+)/g, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">${url}</a>`;
  });
}
