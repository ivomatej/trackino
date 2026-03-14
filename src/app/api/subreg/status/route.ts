// Trackino – Subreg.cz status připojení
// GET /api/subreg/status
// Response: { configured: boolean; connected?: boolean; error?: string }

import { NextResponse } from 'next/server';
import { hasSubregCredentials, getSubregSsid } from '@/lib/subreg';

export async function GET() {
  const configured = hasSubregCredentials();

  if (!configured) {
    return NextResponse.json({ configured: false });
  }

  try {
    const ssid = await getSubregSsid();
    const connected = !!ssid;
    return NextResponse.json({ configured: true, connected });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba';
    return NextResponse.json({ configured: true, connected: false, error: message });
  }
}
