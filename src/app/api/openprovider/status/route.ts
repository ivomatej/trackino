// Trackino – Openprovider status připojení
// GET /api/openprovider/status
// Response: { configured: boolean; connected?: boolean; error?: string }

import { NextResponse } from 'next/server';
import { openproviderFetch, hasOpenproviderCredentials } from '@/lib/openprovider';

export async function GET() {
  const configured = hasOpenproviderCredentials();

  if (!configured) {
    return NextResponse.json({ configured: false });
  }

  try {
    const res = await openproviderFetch('/domains/check', {
      method: 'POST',
      body: JSON.stringify({ domains: [{ name: 'test', extension: 'cz' }] }),
    });

    const data = await res.json();
    const connected = data.code === 0;

    return NextResponse.json({ configured: true, connected });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba';
    return NextResponse.json({ configured: true, connected: false, error: message });
  }
}
