export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

export const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text-primary)',
};

export const selectCls =
  'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none';
