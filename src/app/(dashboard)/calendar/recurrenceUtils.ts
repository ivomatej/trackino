// ─── Calendar Module – Recurrence Utilities ───────────────────────────────────
// Přesunuto z page.tsx (ř. 139–420)

import type { ImportantDay } from '@/types/database';
import { parseDate, addDays, toDateStr } from './utils';

// ─── Konstanty opakování ──────────────────────────────────────────────────────

export const RECURRENCE_OPTIONS: { value: string; label: string; separator?: boolean }[] = [
  { value: 'none', label: 'Neopakuje se' },
  { value: 'daily', label: 'Denně' },
  { value: 'weekly', label: 'Každý týden' },
  { value: 'monthly', label: 'Každý měsíc (stejný den)' },
  { value: 'yearly', label: 'Každý rok' },
  { value: '', label: '', separator: true },
  { value: 'first_day_week', label: 'Každé pondělí (1. den v týdnu)' },
  { value: 'last_day_week', label: 'Každou neděli (poslední den v týdnu)' },
  { value: 'first_day_month', label: '1. den v měsíci' },
  { value: 'last_day_month', label: 'Poslední den v měsíci' },
  { value: 'monthly_on_day', label: 'Konkrétní den v měsíci...' },
  { value: '', label: '', separator: true },
  { value: 'first_day_quarter', label: '1. den v kvartálu' },
  { value: 'last_day_quarter', label: 'Poslední den v kvartálu' },
  { value: 'first_day_year', label: '1. den v roce' },
  { value: 'last_day_year', label: 'Poslední den v roce' },
];

export function getRecurrenceLabel(type: string, day?: number | null): string {
  if (type === 'monthly_on_day' && day) return `Každého ${day}. v měsíci`;
  return RECURRENCE_OPTIONS.find(o => o.value === type)?.label ?? 'Neopakuje se';
}

// ─── Kvartální konstanty ──────────────────────────────────────────────────────

/** Kvartální začátky měsíců (0-indexed) */
const QUARTER_START_MONTHS = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
/** Kvartální konce: Mar 31, Jun 30, Sep 30, Dec 31 */
const QUARTER_END = [
  { month: 2, day: 31 }, { month: 5, day: 30 },
  { month: 8, day: 30 }, { month: 11, day: 31 },
];

// ─── expandRecurringEvent ─────────────────────────────────────────────────────

export function expandRecurringEvent(
  ev: { recurrence_type: string; recurrence_day?: number | null; start_date: string; end_date: string },
  rangeStart: Date,
  rangeEnd: Date,
): { start_date: string; end_date: string }[] {
  const rt = ev.recurrence_type;
  if (!rt || rt === 'none') {
    const s = parseDate(ev.start_date);
    const e = parseDate(ev.end_date);
    if (s <= rangeEnd && e >= rangeStart) return [{ start_date: ev.start_date, end_date: ev.end_date }];
    return [];
  }

  const origStart = parseDate(ev.start_date);
  const origEnd = parseDate(ev.end_date);
  const durationDays = Math.round((origEnd.getTime() - origStart.getTime()) / 86400000);
  const result: { start_date: string; end_date: string }[] = [];

  // Pomocná funkce: přidá výskyt, pokud je v rozsahu
  function pushOcc(d: Date) {
    const occEnd = addDays(d, durationDays);
    if (d <= rangeEnd && occEnd >= rangeStart) {
      result.push({ start_date: toDateStr(d), end_date: toDateStr(occEnd) });
    }
  }

  // Poslední den měsíce
  function lastDayOfMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  let counter = 0;
  const MAX_ITER = 2000;

  if (rt === 'daily') {
    const cur = new Date(Math.max(rangeStart.getTime(), origStart.getTime()));
    cur.setHours(0, 0, 0, 0);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      pushOcc(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
  } else if (rt === 'weekly') {
    const targetDay = origStart.getDay();
    const cur = new Date(rangeStart);
    cur.setHours(0, 0, 0, 0);
    // Posunout na nejbližší targetDay
    while (cur.getDay() !== targetDay && counter++ < 7) cur.setDate(cur.getDate() + 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      if (cur >= origStart) pushOcc(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
  } else if (rt === 'monthly') {
    const targetDay = origStart.getDate();
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      const ld = lastDayOfMonth(cur.getFullYear(), cur.getMonth());
      const d = new Date(cur.getFullYear(), cur.getMonth(), Math.min(targetDay, ld));
      if (d >= origStart) pushOcc(d);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (rt === 'yearly') {
    const targetMonth = origStart.getMonth();
    const targetDay = origStart.getDate();
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() && counter++ < MAX_ITER; y++) {
      const ld = lastDayOfMonth(y, targetMonth);
      const d = new Date(y, targetMonth, Math.min(targetDay, ld));
      if (d >= origStart) pushOcc(d);
    }
  } else if (rt === 'first_day_week') {
    // Každé pondělí
    const cur = new Date(rangeStart);
    cur.setHours(0, 0, 0, 0);
    while (cur.getDay() !== 1 && counter++ < 7) cur.setDate(cur.getDate() + 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      if (cur >= origStart) pushOcc(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
  } else if (rt === 'last_day_week') {
    // Každá neděle
    const cur = new Date(rangeStart);
    cur.setHours(0, 0, 0, 0);
    while (cur.getDay() !== 0 && counter++ < 7) cur.setDate(cur.getDate() + 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      if (cur >= origStart) pushOcc(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
  } else if (rt === 'first_day_month') {
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      if (cur >= origStart) pushOcc(new Date(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (rt === 'last_day_month') {
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      const ld = lastDayOfMonth(cur.getFullYear(), cur.getMonth());
      const d = new Date(cur.getFullYear(), cur.getMonth(), ld);
      if (d >= origStart) pushOcc(d);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (rt === 'monthly_on_day') {
    const targetDay = ev.recurrence_day ?? origStart.getDate();
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur <= rangeEnd && counter++ < MAX_ITER) {
      const ld = lastDayOfMonth(cur.getFullYear(), cur.getMonth());
      const d = new Date(cur.getFullYear(), cur.getMonth(), Math.min(targetDay, ld));
      if (d >= origStart) pushOcc(d);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (rt === 'first_day_quarter') {
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() + 1 && counter++ < MAX_ITER; y++) {
      for (const m of QUARTER_START_MONTHS) {
        const d = new Date(y, m, 1);
        if (d > rangeEnd) break;
        if (d >= origStart) pushOcc(d);
      }
    }
  } else if (rt === 'last_day_quarter') {
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() + 1 && counter++ < MAX_ITER; y++) {
      for (const qe of QUARTER_END) {
        const d = new Date(y, qe.month, qe.day);
        if (d > rangeEnd) break;
        if (d >= origStart) pushOcc(d);
      }
    }
  } else if (rt === 'first_day_year') {
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() && counter++ < MAX_ITER; y++) {
      const d = new Date(y, 0, 1);
      if (d >= origStart) pushOcc(d);
    }
  } else if (rt === 'last_day_year') {
    for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear() && counter++ < MAX_ITER; y++) {
      const d = new Date(y, 11, 31);
      if (d >= origStart) pushOcc(d);
    }
  }

  return result;
}

// ─── getImportantDayOccurrences ───────────────────────────────────────────────

export function getImportantDayOccurrences(
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
