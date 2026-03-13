// ─── Helpers ─────────────────────────────────────────────────────────────────

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Sdílené styly formulářových prvků ───────────────────────────────────────

export const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text-primary)',
} as const;

export const inputCls =
  'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
