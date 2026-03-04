'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';

// ─── Interní komponenta ───────────────────────────────────────────────────────

function KnowledgeBaseContent() {
  const { currentWorkspace, loading: wsLoading, hasModule } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (!wsLoading && !hasModule('knowledge_base')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Záhlaví */}
        <div className="mb-8">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Znalostní báze</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Interní wiki a znalostní databáze vašeho týmu
          </p>
        </div>

        {/* Placeholder */}
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Ikona */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--bg-hover)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="12" y1="7" x2="16" y2="7" />
              <line x1="12" y1="11" x2="16" y2="11" />
              <line x1="12" y1="15" x2="14" y2="15" />
            </svg>
          </div>

          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Znalostní báze – připravujeme
          </h2>
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            Tento modul bude sloužit jako interní wiki pro váš tým – sdílejte postupy,
            návody a firemní znalosti na jednom místě. Funkce bude dostupná v příští verzi.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Připravujeme
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <KnowledgeBaseContent />
    </WorkspaceProvider>
  );
}
