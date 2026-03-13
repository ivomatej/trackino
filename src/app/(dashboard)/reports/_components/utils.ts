import type { MemberRate } from '@/types/database';
import type { DatePreset } from './types';

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateGroup(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1); // Po
    return { from: isoDate(d), to: today };
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  return { from: today, to: today };
}

export function fmtCost(amount: number): string {
  return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function getRateForEntry(
  userId: string,
  entryDate: string,
  userToMemberId: Record<string, string>,
  ratesByMemberId: Record<string, MemberRate[]>,
): number | null {
  const memberId = userToMemberId[userId];
  if (!memberId) return null;
  const rates = ratesByMemberId[memberId] ?? [];
  const match = rates
    .filter(r => r.valid_from <= entryDate && (r.valid_to === null || r.valid_to >= entryDate))
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  return match?.hourly_rate ?? null;
}
