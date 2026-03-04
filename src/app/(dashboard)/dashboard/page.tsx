'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Dashboard byl přesunut na hlavní stránku (/).
// Tento redirect zajišťuje zpětnou kompatibilitu pro záložky a staré odkazy.
export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
