// Trackino – Openprovider /domains/{id} – GET detail domény
// Proxy route pro získání detailních informací o konkrétní doméně.

import { NextRequest, NextResponse } from 'next/server';
import { openproviderFetch, hasOpenproviderCredentials } from '@/lib/openprovider';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  if (!hasOpenproviderCredentials()) {
    return NextResponse.json(
      { error: 'Openprovider přihlašovací údaje nejsou nakonfigurovány.' },
      { status: 503 },
    );
  }

  const { domainId } = await params;

  if (!domainId || isNaN(Number(domainId))) {
    return NextResponse.json({ error: 'Neplatné ID domény.' }, { status: 400 });
  }

  try {
    const res  = await openproviderFetch(`/domains/${domainId}?with_additional_data=1`);
    const data = await res.json();

    if (data.code !== 0) {
      return NextResponse.json({ error: data.desc ?? 'Chyba Openprovider API' }, { status: 400 });
    }

    return NextResponse.json(data.data ?? {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chyba připojení k Openprovider';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
