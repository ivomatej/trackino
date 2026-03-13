'use client';

import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { NotebookContent } from './_components/NotebookContent';
import { editorStyles } from './_components/utils';

export default function NotebookPage() {
  return (
    <WorkspaceProvider>
      <DashboardLayout moduleName="Notebook" showTimer={false}>
        <style>{editorStyles}</style>
        <NotebookContent />
      </DashboardLayout>
    </WorkspaceProvider>
  );
}
