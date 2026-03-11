'use client';

import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { AiAssistantContent } from './_components/AiAssistantContent';

export default function AiAssistantPage() {
  return (
    <WorkspaceProvider>
      <AiAssistantContent />
    </WorkspaceProvider>
  );
}
