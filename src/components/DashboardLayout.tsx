'use client';

import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import TimerBar from './TimerBar';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardLayoutProps {
  children: ReactNode;
  showTimer?: boolean;
  onTimerEntryChanged?: () => void;
}

function PendingApprovalScreen() {
  const { currentWorkspace } = useWorkspace();
  const { signOut } = useAuth();

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Ikona hodinek */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{ background: 'var(--bg-hover)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Čeká se na schválení
        </h2>

        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          Váš přístup k workspace
        </p>
        {currentWorkspace && (
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--primary)' }}>
            {currentWorkspace.name}
          </p>
        )}
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Správce workspace musí váš účet schválit. Jakmile se tak stane, budete mít plný přístup k aplikaci.
        </p>

        <div className="p-4 rounded-xl border mb-6" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Kontaktujte správce workspace a požádejte ho o schválení vašeho účtu v sekci <strong style={{ color: 'var(--text-secondary)' }}>Tým → Členové</strong>.
          </p>
        </div>

        <button
          onClick={() => signOut()}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Odhlásit se
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children, showTimer = false, onTimerEntryChanged }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isPendingApproval } = useWorkspace();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:ml-[var(--sidebar-width)] min-h-screen flex flex-col">
        {/* Topbar s timerem */}
        <header
          className="sticky top-0 z-30"
          style={{ background: 'var(--bg-card)' }}
        >
          {/* Horní řádek: hamburger + timer */}
          <div className="flex items-center gap-3 px-4 lg:px-6 h-[var(--topbar-height)] border-b" style={{ borderColor: 'var(--border)' }}>
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

            {/* Timer v hlavičce - jen pro schválené uživatele */}
            {showTimer && !isPendingApproval ? (
              <div className="flex-1 min-w-0">
                <TimerBar onEntryChanged={onTimerEntryChanged} />
              </div>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </header>

        {/* Page content – pending screen nebo normální obsah */}
        <main className="flex-1 p-4 lg:p-6 flex flex-col">
          {isPendingApproval ? <PendingApprovalScreen /> : children}
        </main>
      </div>
    </div>
  );
}
