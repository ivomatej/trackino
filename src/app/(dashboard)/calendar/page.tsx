'use client';
// ─── Calendar Module – Entry Point ────────────────────────────────────────────
// Orchestrátor přesunut do components/CalendarContent.tsx.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import CalendarContent from './components/CalendarContent';

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <CalendarContent />
    </WorkspaceProvider>
  );
}
