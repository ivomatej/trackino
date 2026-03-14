'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';

// ─── Interní komponenta ───────────────────────────────────────────────────────

function ResearchGeosContent() {
  const { hasModule, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (!wsLoading && !hasModule('research')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  if (wsLoading) {
    return (
      <DashboardLayout moduleName="GEOs — Research">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout moduleName="GEOs — Research">
      <div className="max-w-2xl">
        {/* Záhlaví */}
        <div className="mb-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            GEOs
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Detailní informace o státech — legislativa, business potenciál, ekonomické metriky,
            zvyky obyvatel a svátky. Rozšíření dat ze stávajícího modulu Nastavení → GEOs.
          </p>
        </div>

        {/* Placeholder */}
        <div
          className="rounded-xl border p-10 flex flex-col items-center justify-center text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <svg
            width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="mb-4 opacity-25" style={{ color: 'var(--text-muted)' }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Tento modul se připravuje.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────

export default function ResearchGeosPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <ResearchGeosContent />
    </WorkspaceProvider>
  );
}
