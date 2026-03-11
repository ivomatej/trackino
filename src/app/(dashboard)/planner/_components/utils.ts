// Helper funkce pro Plánovač

import type { ImportantDay } from '@/types/database';
import type { StripItem } from './types';

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

export function formatDayName(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { weekday: 'short' });
}

export function packStripLanes(strips: StripItem[]): StripItem[][] {
  const lanes: StripItem[][] = [];
  const sorted = [...strips].sort((a, b) => a.startCol - b.startCol);
  for (const strip of sorted) {
    let placed = false;
    for (const lane of lanes) {
      if (lane[lane.length - 1].endCol < strip.startCol) {
        lane.push(strip);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([strip]);
  }
  return lanes;
}

export function getImportantDaysForDate(date: Date, importantDays: ImportantDay[]): ImportantDay[] {
  const dateStr = toDateStr(date);
  return importantDays.filter(entry => {
    if (!entry.is_recurring || entry.recurring_type === 'none') {
      return dateStr >= entry.start_date && dateStr <= entry.end_date;
    }
    const startD = new Date(entry.start_date + 'T12:00:00');
    switch (entry.recurring_type) {
      case 'weekly':  return date.getDay() === startD.getDay();
      case 'monthly': return date.getDate() === startD.getDate();
      case 'yearly':  return date.getMonth() === startD.getMonth() && date.getDate() === startD.getDate();
      default:        return false;
    }
  });
}
