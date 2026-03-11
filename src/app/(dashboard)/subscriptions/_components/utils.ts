import type { SubscriptionFrequency } from '@/types/database';

export function toMonthly(price: number, freq: SubscriptionFrequency): number {
  switch (freq) {
    case 'monthly': return price;
    case 'quarterly': return price / 3;
    case 'yearly': return price / 12;
    case 'biennial': return price / 24;
    case 'one_time': return 0;
  }
}

export function toYearly(price: number, freq: SubscriptionFrequency): number {
  switch (freq) {
    case 'monthly': return price * 12;
    case 'quarterly': return price * 4;
    case 'yearly': return price;
    case 'biennial': return price / 2;
    case 'one_time': return 0;
  }
}

export function getFaviconUrl(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; }
}

export function fmtPrice(n: number, currency: string): string {
  const display = currency === 'CZK' ? 'Kč' : currency;
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + display;
}

export function fmtDate(d: string | null): string {
  if (!d) return '–';
  const dt = new Date(d);
  return dt.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
