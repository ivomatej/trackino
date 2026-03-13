'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { ReportsContent } from './_components/ReportsContent';

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <ReportsContent />
    </WorkspaceProvider>
  );
}
