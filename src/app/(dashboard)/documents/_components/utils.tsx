import React from 'react';

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(name: string): string {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getFileIcon(mime: string | null): React.ReactElement {
  const color = mime?.startsWith('image/') ? '#10b981'
    : mime === 'application/pdf' ? '#ef4444'
    : mime?.includes('word') ? '#3b82f6'
    : mime?.includes('excel') || mime?.includes('sheet') || mime?.includes('csv') ? '#16a34a'
    : mime?.includes('powerpoint') || mime?.includes('presentation') ? '#f97316'
    : '#6b7280';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
export const inputStyle: React.CSSProperties = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };
