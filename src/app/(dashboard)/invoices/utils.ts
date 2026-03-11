import type { InvoiceStatus } from '@/types/database';

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}.${parseInt(m)}.${y}`;
}

export function fmtMonth(year: number, month: number): string {
  const months = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  return `${months[month - 1]} ${year}`;
}

export function getPreviousMonthPeriod(): { year: number; month: number } {
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() je 0-indexed
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { year, month };
}

// Fakturaci lze podat od 1. dne aktuálního měsíce (za předchozí měsíc)
export function canSubmitInvoice(): boolean {
  return true; // vždy od 1. dne aktuálního měsíce - kontrolujeme jen dostupnost předchozího měsíce
}

// Převede jméno na slug pro název souboru (odstraní diakritiku, mezery → pomlčky)
export function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Zpracovává se',
  approved: 'Schváleno',
  paid: 'Proplaceno',
  cancelled: 'Stornováno',
  returned: 'Vráceno k opravě',
};

export const STATUS_COLORS: Record<InvoiceStatus, { bg: string; color: string }> = {
  pending: { bg: '#fef9c3', color: '#854d0e' },
  approved: { bg: '#dbeafe', color: '#1e40af' },
  paid: { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#dc2626' },
  returned: { bg: '#ffedd5', color: '#c2410c' },
};

export const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
export const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };
