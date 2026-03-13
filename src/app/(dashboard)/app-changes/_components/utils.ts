// ─── Datum ────────────────────────────────────────────────────────────────────

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ─── Styling helpers ──────────────────────────────────────────────────────────

export const inputCls =
  'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent';

export const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text-primary)',
};

export const labelCls = 'block text-xs font-medium mb-1';

export const selectCls =
  'w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent appearance-none cursor-pointer';
