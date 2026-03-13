'use client';

import { useEffect } from 'react';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import ImportantDaysContent from './_components/ImportantDaysContent';

function ImportantDaysPage() {
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (currentWorkspace && !currentWorkspace) router.push('/');
  }, [currentWorkspace, router]);

  return (
    <DashboardLayout moduleName="Důležité dny">
      <div className="p-6">
        <ImportantDaysContent />
      </div>
    </DashboardLayout>
  );
}

export default function ImportantDaysPageWrapper() {
  return (
    <WorkspaceProvider>
      <ImportantDaysPage />
    </WorkspaceProvider>
  );
}
