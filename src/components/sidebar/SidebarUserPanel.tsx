'use client';

import Link from 'next/link';
import type { Workspace } from '@/types/database';
import type { Profile } from '@/types/database';
import type { User } from '@supabase/supabase-js';
import { ICONS } from './icons';

interface SidebarUserPanelProps {
  showUserPanel: boolean;
  setShowUserPanel: (v: boolean) => void;
  profile: Profile | null;
  user: User | null;
  signOut: () => void;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  selectWorkspace: (ws: Workspace) => void;
  initials: string;
  pathname: string;
  onClose: () => void;
}

export function SidebarUserPanel({
  showUserPanel,
  setShowUserPanel,
  profile,
  user,
  signOut,
  workspaces,
  currentWorkspace,
  selectWorkspace,
  initials,
  pathname,
  onClose,
}: SidebarUserPanelProps) {
  return (
    <div className="border-t" style={{ borderColor: 'var(--border)' }}>
      {showUserPanel && (
        <div className="px-3 py-2 border-b animate-fade-in" style={{ borderColor: 'var(--border)' }}>

          {/* Workspace přepínač – jen pokud existuje více workspace */}
          {workspaces.length > 1 && (
            <>
              <div className="px-3 pt-0.5 pb-1">
                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Workspace</span>
              </div>
              {workspaces.map((ws: Workspace) => (
                <button
                  key={ws.id}
                  onClick={() => { selectWorkspace(ws); setShowUserPanel(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors"
                  style={{
                    color: ws.id === currentWorkspace?.id ? 'var(--primary)' : 'var(--text-secondary)',
                    background: ws.id === currentWorkspace?.id ? 'var(--bg-active)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (ws.id !== currentWorkspace?.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ws.id === currentWorkspace?.id ? 'var(--bg-active)' : 'transparent'; }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: ws.color ?? 'var(--primary)' }}
                  >
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.id === currentWorkspace?.id && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="mx-2 my-1.5 border-t" style={{ borderColor: 'var(--border)' }} />
            </>
          )}

          {/* Detailní nastavení */}
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full"
            style={{
              color: pathname === '/profile' ? 'var(--primary)' : 'var(--text-secondary)',
              background: pathname === '/profile' ? 'var(--bg-active)' : 'transparent',
            }}
            onMouseEnter={e => { if (pathname !== '/profile') e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = pathname === '/profile' ? 'var(--bg-active)' : 'transparent'; }}
          >
            {ICONS.profile}
            <span>Detailní nastavení</span>
          </Link>

          {/* Odhlásit se */}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light, #fee2e2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
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
  );
}
