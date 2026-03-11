'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { PlannerContent } from './_components/PlannerContent';

function PlannerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <PlannerContent />
    </WorkspaceProvider>
  );
}

export default PlannerPage;
