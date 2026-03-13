'use client';

import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { InvoicesContent } from './components/InvoicesContent';

export default function InvoicesPage() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <WorkspaceProvider>
      <InvoicesContent />
    </WorkspaceProvider>
  );
}
