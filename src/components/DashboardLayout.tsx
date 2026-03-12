'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import Sidebar from './Sidebar';
import TimerBar from './TimerBar';
import ErrorBoundary from './ErrorBoundary';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { SystemNotification } from '@/types/database';

interface TimerPlayData {
  description: string;
  projectId: string;
  categoryId: string;
  taskId: string;
  tagIds: string[];
  ts: number;
}

interface DashboardLayoutProps {
  children: ReactNode;
  showTimer?: boolean;
  onTimerEntryChanged?: () => void;
  timerPlayData?: TimerPlayData | null;
  /** Název modulu zobrazený v Error Boundary fallback UI */
  moduleName?: string;
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

function LockedWorkspaceScreen() {
  const { currentWorkspace } = useWorkspace();
  const { signOut } = useAuth();

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{ background: 'var(--bg-hover)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Workspace je zamčen</h2>
        {currentWorkspace && (
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>{currentWorkspace.name}</p>
        )}
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Přístup k tomuto workspace byl dočasně pozastaven správcem systému.
        </p>
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

// ─── System notification banner hook ─────────────────────────────────────────

function useSystemNotifications() {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Načti dismissed ids z localStorage
    try {
      const raw = localStorage.getItem('trackino_dismissed_notifications');
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch {}

    // Fetch aktivních oznámení
    supabase
      .from('trackino_system_notifications')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setNotifications(data as SystemNotification[]);
      });
  }, []);

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('trackino_dismissed_notifications', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Filtruj oznámení, která jsou aktuálně v časovém rozsahu a nebyla skryta
  const now = new Date();
  const visible = notifications.filter(n => {
    if (dismissed.has(n.id)) return false;
    if (n.show_from && new Date(n.show_from) > now) return false;
    if (n.show_until && new Date(n.show_until) < now) return false;
    return true;
  });

  return { visible, dismiss };
}

export default function DashboardLayout({ children, showTimer = false, onTimerEntryChanged, timerPlayData, moduleName }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('trackino_sidebar_collapsed') === '1';
  });
  // Detekce mobilního zobrazení (< 640px = breakpoint sm)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Auto-hide header při scrollu na mobilu ────────────────────────────────
  // Skryje se při scrollu dolů, zobrazí při rychlém scrollu nahoru (> 300px/s nebo > 100px nahoru)
  const [headerHidden, setHeaderHidden] = useState(false);
  const headerHiddenRef = useRef(false);
  const scrollStateRef = useRef({ lastY: 0, lastTime: 0, upDelta: 0 });

  useEffect(() => {
    if (!isMobile) {
      // Na desktopu/tabletu vždy zobrazit header
      if (headerHiddenRef.current) {
        headerHiddenRef.current = false;
        setHeaderHidden(false);
      }
      return;
    }
    const handleScroll = () => {
      const now = Date.now();
      const y = window.scrollY;
      const { lastY, lastTime, upDelta } = scrollStateRef.current;
      const deltaY = y - lastY;
      const deltaTime = Math.max(1, now - lastTime);
      const velocityPxPerSec = Math.abs(deltaY) / deltaTime * 1000;

      let newHidden = headerHiddenRef.current;
      let newUpDelta = upDelta;

      if (y < 60) {
        // Na vrcholu stránky: vždy zobrazit header
        newHidden = false;
        newUpDelta = 0;
      } else if (deltaY > 4) {
        // Scrolluje dolů → schovat
        newHidden = true;
        newUpDelta = 0;
      } else if (deltaY < -4) {
        // Scrolluje nahoru
        newUpDelta += Math.abs(deltaY);
        // Zobrazit při rychlém scrollu (> 300px/s) nebo pokud uživatel scrollnul > 100px nahoru
        if (velocityPxPerSec > 300 || newUpDelta > 100) {
          newHidden = false;
        }
      }

      scrollStateRef.current = { lastY: y, lastTime: now, upDelta: newUpDelta };

      if (newHidden !== headerHiddenRef.current) {
        headerHiddenRef.current = newHidden;
        setHeaderHidden(newHidden);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // ── Globální scrollbar auto-hide (přidá třídu is-scrolling na <html>) ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      document.documentElement.classList.add('is-scrolling');
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
        timer = null;
      }, 1000);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
      if (timer) clearTimeout(timer);
    };
  }, []);

  const toggleDesktopSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('trackino_sidebar_collapsed', next ? '1' : '0');
      }
      return next;
    });
  };

  const { isPendingApproval, isWorkspaceLocked } = useWorkspace();
  const { profile } = useAuth();
  // Master admin vidí zamčený workspace i tak (aby mohl odemknout)
  const isMasterAdmin = profile?.is_master_admin === true;
  const showLockedScreen = isWorkspaceLocked && !isMasterAdmin;

  // Timer logika
  // shouldShowTimer: zda je timer vůbec viditelný (stránka Měřič nebo timer_always_visible)
  // timerAtBottom: jen na mobilu a pokud user zapnul timer_bottom_mobile
  const shouldShowTimer = (showTimer || (profile?.timer_always_visible ?? false)) && !isPendingApproval && !showLockedScreen;
  const timerAtBottom = (profile?.timer_bottom_mobile ?? false) && isMobile;

  const { visible: activeNotifications, dismiss: dismissNotification } = useSystemNotifications();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapseDesktop={toggleDesktopSidebar}
      />

      {/* Main content – posouvá se doleva při collapse sidebaru na desktopu */}
      <div className={`${!sidebarCollapsed ? 'lg:ml-[var(--sidebar-width)]' : ''} min-h-screen flex flex-col transition-[margin] duration-200 ease-in-out`}>
        {/* Topbar s timerem – na mobilu se schová při scrollu dolů */}
        <header
          className="sticky top-0 z-30 transition-transform duration-200 ease-in-out"
          style={{
            background: 'var(--bg-card)',
            // Pouze na mobilu aplikovat transform – na desktopu headerHidden = false vždy
            transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)',
          }}
        >
          {/* Systémová oznámení – bannery nad timerem */}
          {activeNotifications.map(n => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 px-4 lg:px-6 py-2 text-sm border-b"
              style={{ background: n.color + '18', borderColor: n.color + '44' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: n.color }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {n.title && <strong className="mr-1" style={{ color: n.color }}>{n.title}:</strong>}
                  {n.message}
                </p>
              </div>
              <button
                onClick={() => dismissNotification(n.id)}
                className="flex-shrink-0 p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                title="Skrýt"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}

          {/* Horní řádek: hamburger + timer */}
          <div className="flex items-center gap-3 px-4 lg:px-6 py-2 sm:py-0 sm:h-[var(--topbar-height)] border-b" style={{ borderColor: 'var(--border)' }}>
            {/* Hamburger / Collapse toggle */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                  toggleDesktopSidebar();
                } else {
                  setSidebarOpen(true);
                }
              }}
              className="p-2 -ml-2 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title={sidebarCollapsed ? 'Zobrazit panel' : 'Skrýt panel'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Timer v hlavičce – jen pokud není přesunutý ke spodní hraně na mobilu */}
            {shouldShowTimer && !timerAtBottom ? (
              <div className="flex-1 min-w-0">
                <ErrorBoundary timerFallback>
                  <TimerBar onEntryChanged={onTimerEntryChanged} playData={timerPlayData} />
                </ErrorBoundary>
              </div>
            ) : (
              <div className="flex-1" />
            )}

          </div>
        </header>

        {/* Page content – pending screen nebo normální obsah */}
        <main
          className="flex-1 p-4 lg:p-6 flex flex-col"
          style={timerAtBottom && shouldShowTimer ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 130px)' } : undefined}
        >
          {showLockedScreen ? <LockedWorkspaceScreen /> : isPendingApproval ? <PendingApprovalScreen /> : (
            <ErrorBoundary moduleName={moduleName}>
              {children}
            </ErrorBoundary>
          )}
        </main>

        {/* Patička */}
        <footer className="py-2 px-6 text-center text-[11px] border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          {(() => {
            const start = 2026;
            const cur = new Date().getFullYear();
            return `© ${cur > start ? `${start}–${cur}` : start} Trackino`;
          })()}
        </footer>
      </div>

      {/* Timer fixně u spodní hrany – jen na mobilu pokud je timer_bottom_mobile zapnutý */}
      {shouldShowTimer && timerAtBottom && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t px-4 pt-3"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          }}
        >
          <ErrorBoundary timerFallback>
          <TimerBar onEntryChanged={onTimerEntryChanged} playData={timerPlayData} isBottomBar />
        </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
