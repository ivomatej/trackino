// Trackino – Openprovider /domains – GET seznam domén
// Proxy route: klient volá tuto route, která volá Openprovider API server-side.

import { NextRequest, NextResponse } from 'next/server';
import { openproviderFetch, hasOpenproviderCredentials } from '@/lib/openprovider';

export async function GET(req: NextRequest) {
  if (!hasOpenproviderCredentials()) {
    return NextResponse.json(
      { error: 'Openprovider přihlašovací údaje nejsou nakonfigurovány.' },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit  = searchParams.get('limit')  ?? '100';
    const offset = searchParams.get('offset') ?? '0';
    const status = searchParams.get('status');
    const order  = searchParams.get('order');

    const query = new URLSearchParams({ limit, offset });
    if (status) query.set('status', status);
    if (order)  query.set('order_by', order);

    const res  = await openproviderFetch(`/domains?${query.toString()}`);
    const data = await res.json();

    if (data.code !== 0) {
      return NextResponse.json({ error: data.desc ?? 'Chyba Openprovider API' }, { status: 400 });
    }

    return NextResponse.json(data.data ?? { results: [], total: 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chyba připojení k Openprovider';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
