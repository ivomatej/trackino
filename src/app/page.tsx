'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import DashboardLayout from '@/components/DashboardLayout';
import TimerBar from '@/components/TimerBar';
import TimeEntryList from '@/components/TimeEntryList';
import ManualTimeEntry from '@/components/ManualTimeEntry';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <WorkspaceProvider>
      <DashboardContent />
    </WorkspaceProvider>
  );
}

function DashboardContent() {
  const { currentWorkspace, loading } = useWorkspace();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showManual, setShowManual] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return <WorkspaceSelector />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Time Tracker
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Sledování odpracovaného času
            </p>
          </div>
          <button
            onClick={() => setShowManual(!showManual)}
            className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2"
            style={{
              borderColor: showManual ? 'var(--primary)' : 'var(--border)',
              color: showManual ? 'var(--primary)' : 'var(--text-secondary)',
              background: showManual ? 'var(--bg-active)' : 'transparent',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Manuální
          </button>
        </div>

        <TimerBar onEntryChanged={() => setRefreshKey(k => k + 1)} />

        {showManual && (
          <ManualTimeEntry
            onSaved={() => { setShowManual(false); setRefreshKey(k => k + 1); }}
            onCancel={() => setShowManual(false)}
          />
        )}

        <TimeEntryList refreshKey={refreshKey} />
      </div>
    </DashboardLayout>
  );
}

export default function Home() {
  return <AppContent />;
}
