'use client';

import Link from 'next/link';

interface SidebarHeaderProps {
  currentWorkspaceName: string;
  onClose: () => void;
  onCollapseDesktop?: () => void;
}

export function SidebarHeader({ currentWorkspaceName, onClose, onCollapseDesktop }: SidebarHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 h-[var(--topbar-height)] border-b" style={{ borderColor: 'var(--border)' }}>
      <Link href="/" onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'var(--primary)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Trackino</div>
          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {currentWorkspaceName}
          </div>
        </div>
      </Link>
      {/* Zavřít – pouze mobil */}
      <button
        onClick={onClose}
        className="lg:hidden p-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {/* Collapse – pouze desktop */}
      {onCollapseDesktop && (
        <button
          onClick={onCollapseDesktop}
          className="hidden lg:flex p-1.5 rounded-lg transition-colors"
          title="Skrýt panel"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
