'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { SubscriptionsContent } from './_components/SubscriptionsContent';

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <SubscriptionsContent />
    </WorkspaceProvider>
  );
}
