// Trackino – Openprovider kontrola dostupnosti domén
// POST /api/openprovider/check
// Body: { domains: { name: string; extension: string }[] }
// Response: { results: { domain: string; status: string; premium?: boolean }[] }

import { NextRequest, NextResponse } from 'next/server';
import { openproviderFetch, hasOpenproviderCredentials } from '@/lib/openprovider';
import { rateLimitOpenprovider } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Rate limit
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous';
  const { success } = await rateLimitOpenprovider.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' },
      { status: 429 },
    );
  }

  if (!hasOpenproviderCredentials()) {
    return NextResponse.json(
      { error: 'Openprovider přihlašovací údaje nejsou nakonfigurovány.' },
      { status: 503 },
    );
  }

  let body: { domains?: { name: string; extension: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Neplatný JSON.' }, { status: 400 });
  }

  const domains = body.domains;
  if (!Array.isArray(domains) || domains.length === 0) {
    return NextResponse.json(
      { error: 'Pole domains je povinné a nesmí být prázdné.' },
      { status: 400 },
    );
  }
  if (domains.length > 50) {
    return NextResponse.json(
      { error: 'Maximálně 50 domén na jeden požadavek.' },
      { status: 400 },
    );
  }

  try {
    const res = await openproviderFetch('/domains/check', {
      method: 'POST',
      body: JSON.stringify({ domains }),
    });

    const data = await res.json();

    if (data.code !== 0) {
      return NextResponse.json(
        { error: data.desc ?? 'Chyba Openprovider API.' },
        { status: 502 },
      );
    }

    // Normalizujeme odpověď
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (data.data?.results ?? []).map((r: any) => ({
      domain: `${r.domain?.name ?? ''}.${r.domain?.extension ?? ''}`,
      status: r.status ?? 'error',
      premium: r.premium ?? false,
      price: r.price ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[openprovider/check]', err);
    return NextResponse.json(
      { error: 'Interní chyba serveru.' },
      { status: 500 },
    );
  }
}
