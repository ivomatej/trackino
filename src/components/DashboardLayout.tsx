'use client';

import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import TimerBar from './TimerBar';

interface DashboardLayoutProps {
  children: ReactNode;
  showTimer?: boolean;
  onTimerEntryChanged?: () => void;
}

export default function DashboardLayout({ children, showTimer = false, onTimerEntryChanged }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:ml-[var(--sidebar-width)] min-h-screen flex flex-col">
        {/* Topbar s timerem */}
        <header
          className="sticky top-0 z-30 border-b"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Horní řádek: hamburger + timer */}
          <div className="flex items-center gap-3 px-4 lg:px-6 h-[var(--topbar-height)]">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Timer v hlavičce - vždy viditelný */}
            {showTimer ? (
              <div className="flex-1 min-w-0">
                <TimerBar onEntryChanged={onTimerEntryChanged} />
              </div>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
