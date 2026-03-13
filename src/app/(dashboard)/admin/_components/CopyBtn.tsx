'use client';

import { copyToClipboard } from './utils';

export function CopyBtn({
  value,
  id,
  activeId,
  setActiveId,
  size = 13,
}: {
  value: string;
  id: string;
  activeId: string | null;
  setActiveId: (v: string | null) => void;
  size?: number;
}) {
  const copied = activeId === id;
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        copyToClipboard(value);
        setActiveId(id);
        setTimeout(() => setActiveId(null), 2000);
      }}
      title={copied ? 'Zkopírováno!' : 'Kopírovat'}
      className="p-0.5 rounded transition-colors flex-shrink-0"
      style={{ color: copied ? '#16a34a' : 'var(--text-muted)' }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = 'var(--primary)'; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = copied ? '#16a34a' : 'var(--text-muted)'; }}
    >
      {copied ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
