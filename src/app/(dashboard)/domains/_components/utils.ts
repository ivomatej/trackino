import { EXPIRING_THRESHOLD_DAYS } from './constants';
import type { Domain, DisplayStatus } from './types';

export function daysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(expirationDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDisplayStatus(domain: Domain): DisplayStatus {
  if (domain.status === 'active' && domain.expiration_date) {
    const days = daysUntilExpiration(domain.expiration_date);
    if (days !== null && days <= EXPIRING_THRESHOLD_DAYS && days >= 0) return 'expiring';
  }
  return domain.status;
}

export function fmtDate(d: string | null): string {
  if (!d) return '–';
  const dt = new Date(d);
  return dt.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}
