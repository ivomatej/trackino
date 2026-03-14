'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';

// ─── Interní komponenta ───────────────────────────────────────────────────────

function ResearchDomainsContent() {
  const { hasModule, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (!wsLoading && !hasModule('research')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  if (wsLoading) {
    return (
      <DashboardLayout moduleName="Domény — Research">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout moduleName="Domény — Research">
      <div className="max-w-2xl">
        {/* Záhlaví */}
        <div className="mb-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Domény — Research
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Modul pro monitoring a vytipovávání domén k potenciálnímu nákupu. Sledování dostupnosti,
            WHOIS informace o vlastníkovi a evidence doménových příležitostí.
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
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
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

export default function ResearchDomainsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <ResearchDomainsContent />
    </WorkspaceProvider>
  );
}
