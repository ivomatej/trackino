'use client';

import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import TextConverterContent from './_components/TextConverterContent';

export default function TextConverterPage() {
  return (
    <WorkspaceProvider>
      <TextConverterContent />
    </WorkspaceProvider>
  );
}
