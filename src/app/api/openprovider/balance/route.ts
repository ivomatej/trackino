// Trackino – Openprovider /resellers/me – GET stav kreditu a info o reselleru
// Vrací aktuální zůstatek a základní informace o Openprovider účtu.

import { NextResponse } from 'next/server';
import { openproviderFetch, hasOpenproviderCredentials } from '@/lib/openprovider';

export async function GET() {
  if (!hasOpenproviderCredentials()) {
    return NextResponse.json(
      { error: 'Openprovider přihlašovací údaje nejsou nakonfigurovány.' },
      { status: 503 },
    );
  }

  try {
    const res  = await openproviderFetch('/resellers/me');
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
