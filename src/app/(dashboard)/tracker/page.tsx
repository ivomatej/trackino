'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import DashboardLayout from '@/components/DashboardLayout';
import TimeEntryList from '@/components/TimeEntryList';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function TrackerAppContent() {
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
      <TrackerContent />
    </WorkspaceProvider>
  );
}

function TrackerContent() {
  const { currentWorkspace, loading } = useWorkspace();
  const [refreshKey, setRefreshKey] = useState(0);
  const [timerPlayData, setTimerPlayData] = useState<{
    description: string; projectId: string; categoryId: string; taskId: string; tagIds: string[]; ts: number;
  } | null>(null);

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
    <DashboardLayout moduleName="Měřič" showTimer onTimerEntryChanged={() => setRefreshKey(k => k + 1)} timerPlayData={timerPlayData}>
      <div>
        {/* Hlavička stránky */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Měřič
          </h1>
        </div>

        <TimeEntryList
          refreshKey={refreshKey}
          onPlay={(data) => setTimerPlayData({ ...data, ts: Date.now() })}
        />
      </div>
    </DashboardLayout>
  );
}

export default function TrackerPage() {
  return <TrackerAppContent />;
}
