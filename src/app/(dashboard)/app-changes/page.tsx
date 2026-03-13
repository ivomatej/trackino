'use client';

import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { AppChangesContent } from './_components/AppChangesContent';

export default function AppChangesPage() {
  return (
    <WorkspaceProvider>
      <AppChangesContent />
    </WorkspaceProvider>
  );
}
