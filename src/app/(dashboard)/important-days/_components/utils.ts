import type { ImportantDayRecurring } from '@/types/database';

export function formatDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export function recurringLabel(r: ImportantDayRecurring): string {
  switch (r) {
    case 'weekly':  return 'Každý týden';
    case 'monthly': return 'Každý měsíc';
    case 'yearly':  return 'Každý rok';
    default:        return '';
  }
}
