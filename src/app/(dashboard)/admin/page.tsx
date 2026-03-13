'use client';

import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { AdminContent } from './_components/AdminContent';

export default function AdminPage() {
  return (
    <WorkspaceProvider>
      <DashboardLayout moduleName="Admin">
        <AdminContent />
      </DashboardLayout>
    </WorkspaceProvider>
  );
}
