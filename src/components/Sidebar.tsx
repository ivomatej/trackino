'use client';

import { useState, useMemo, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useTheme } from './ThemeProvider';
import { isWorkspaceAdmin as checkWsAdmin, isManager as checkIsManager, canAccessAuditLog as checkAuditAccess, isMasterAdmin as checkMasterAdmin } from '@/lib/permissions';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Ikony jako konstanty
const ICONS = {
  timer: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  planner: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  reports: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  projects: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  team: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  audit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  help: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  bug: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.88 1.88" /><path d="M14.12 3.88L16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg>,
  docs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  clients: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  tags: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path d="M6 6h.008v.008H6V6z" /></svg>,
  subordinates: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>,
  notes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  admin: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { currentWorkspace, userRole } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const [showUserPanel, setShowUserPanel] = useState(false);

  // Dynamicky sestavit navigaci dle oprávnění
  const navGroups = useMemo<NavGroup[]>(() => {
    const isAdmin = checkWsAdmin(userRole);
    const isManagerOrAdmin = checkIsManager(userRole) || isAdmin;
    const showAudit = checkAuditAccess(userRole, profile ?? null, currentWorkspace?.tariff);
    const masterAdmin = checkMasterAdmin(profile ?? null);
    const hideTagsGlobally = currentWorkspace?.hide_tags_globally ?? false;

    const trackingItems: NavItem[] = [
      { label: 'Time Tracker', href: '/', icon: ICONS.timer },
      { label: 'Plánovač', href: '/planner', icon: ICONS.planner },
    ];

    // Podřízení a Poznámky – viditelné jen pro managery a adminy
    if (isManagerOrAdmin) {
      trackingItems.push(
        { label: 'Podřízení', href: '/subordinates', icon: ICONS.subordinates },
        { label: 'Poznámky', href: '/notes', icon: ICONS.notes },
      );
    }

    const spravaManagedItems: NavItem[] = [
      { label: 'Projekty', href: '/projects', icon: ICONS.projects },
      { label: 'Klienti', href: '/clients', icon: ICONS.clients },
    ];

    // Štítky – skryté pro běžné členy pokud je zapnuto hide_tags_globally
    if (!hideTagsGlobally || isAdmin) {
      spravaManagedItems.push({ label: 'Štítky', href: '/tags', icon: ICONS.tags });
    }

    spravaManagedItems.push({ label: 'Tým', href: '/team', icon: ICONS.team });

    const groups: NavGroup[] = [
      {
        title: 'SLEDOVÁNÍ',
        items: trackingItems,
      },
      {
        title: 'ANALÝZA',
        items: [
          { label: 'Reporty', href: '/reports', icon: ICONS.reports },
        ],
      },
      {
        title: 'SPRÁVA',
        items: spravaManagedItems,
      },
    ];

    // Nastavení – pouze pro admin/owner
    if (isAdmin) {
      groups[2].items.push(
        { label: 'Nastavení', href: '/settings', icon: ICONS.settings },
      );
    }

    // Audit log – jen při tarifu Max + admin/master admin
    if (showAudit) {
      groups[2].items.push(
        { label: 'Audit log', href: '/audit', icon: ICONS.audit },
      );
    }

    // Správa systému – jen pro Master Admin
    if (masterAdmin) {
      groups.push({
        title: 'SYSTÉM',
        items: [
          { label: 'Správa workspace', href: '/admin', icon: ICONS.admin },
        ],
      });
    }

    return groups;
  }, [userRole, profile, currentWorkspace?.tariff, currentWorkspace?.hide_tags_globally]);

  const initials = profile?.display_name
    ? profile.display_name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.charAt(0).toUpperCase() ?? '?');

  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          color: active ? 'var(--primary)' : 'var(--text-secondary)',
          background: active ? 'var(--bg-active)' : 'transparent',
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent'; }}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };

  const bottomItems: NavItem[] = [
    { label: 'Nápověda', href: '/help', icon: ICONS.help },
    { label: 'Nahlásit chybu', href: '/bugs', icon: ICONS.bug },
    { label: 'Dokumentace', href: '/changelog', icon: ICONS.docs },
  ];

  return (
    <>
      {/* Overlay pro mobil */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-50 w-[var(--sidebar-width)] flex flex-col
          border-r transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Logo + Workspace */}
        <div className="flex items-center gap-3 px-4 h-[var(--topbar-height)] border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'var(--primary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Trackino</div>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {currentWorkspace?.name ?? ''}
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigace se skupinami */}
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <div
                className="px-3 py-1.5 text-[10px] font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map(renderNavItem)}
              </div>
            </div>
          ))}

          {/* Spodní sekce */}
          <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-0.5">
              {bottomItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      background: active ? 'var(--bg-active)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent'; }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User panel */}
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {showUserPanel && (
            <div className="px-4 py-3 border-b animate-fade-in" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Vzhled</div>
              <div className="flex gap-1 mb-3">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                    style={{
                      background: theme === t ? 'var(--primary)' : 'var(--bg-hover)',
                      color: theme === t ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {t === 'light' ? 'Světlý' : t === 'dark' ? 'Tmavý' : 'Auto'}
                  </button>
                ))}
              </div>
              <button
                onClick={signOut}
                className="w-full px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Odhlásit se
              </button>
            </div>
          )}

          <button
            onClick={() => setShowUserPanel(!showUserPanel)}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: profile?.avatar_color ?? 'var(--primary)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{profile?.display_name ?? profile?.email ?? 'Uživatel'}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: 'var(--text-muted)', transform: showUserPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
