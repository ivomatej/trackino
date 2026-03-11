import type { KbFolder } from '@/types/database';

// ── Helper funkce ──────────────────────────────────────────────────────────────

export function getDepth(folder: KbFolder, all: KbFolder[]): number {
  let d = 0; let cur: KbFolder | undefined = folder;
  while (cur?.parent_id) { cur = all.find(f => f.id === cur!.parent_id); d++; }
  return d;
}

export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getFolderPath(folderId: string | null, folders: KbFolder[]): string {
  if (!folderId) return '';
  const parts: string[] = [];
  let current: KbFolder | undefined = folders.find(f => f.id === folderId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
  }
  return parts.join(' / ');
}

export function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'stranka';
}

export function generatePublicToken(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}
