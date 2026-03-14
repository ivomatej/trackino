// Trackino – Openprovider /sync – POST synchronizace domén do lokální cache
// Načte všechny domény z Openprovider API a uloží je do trackino_domain_cache.
// Podporuje stránkování – prochází všechny stránky automaticky.

import { NextRequest, NextResponse } from 'next/server';
import { openproviderFetch, hasOpenproviderCredentials, formatDomainName } from '@/lib/openprovider';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  if (!hasOpenproviderCredentials()) {
    return NextResponse.json(
      { error: 'Openprovider přihlašovací údaje nejsou nakonfigurovány.' },
      { status: 503 },
    );
  }

  let workspaceId: string;
  try {
    const body = await req.json();
    workspaceId = body.workspace_id as string;
    if (!workspaceId) throw new Error('Chybí workspace_id');
  } catch {
    return NextResponse.json({ error: 'Chybí workspace_id v těle požadavku.' }, { status: 400 });
  }

  try {
    // Stránkované načítání všech domén z Openprovider
    const LIMIT = 100;
    let offset = 0;
    const allDomains: Record<string, unknown>[] = [];

    while (true) {
      const res  = await openproviderFetch(`/domains?limit=${LIMIT}&offset=${offset}`);
      const data = await res.json();

      if (data.code !== 0) throw new Error(data.desc ?? 'Chyba Openprovider API');

      const items: Record<string, unknown>[] = (data.data?.results ?? []) as Record<string, unknown>[];
      allDomains.push(...items);

      if (items.length < LIMIT) break;
      offset += LIMIT;
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    let synced = 0;

    // Uložit každou doménu do cache
    for (const domain of allDomains) {
      const nameObj = domain.name as { name?: string; extension?: string } | undefined;
      const domainName = formatDomainName(nameObj);

      // Parsování dat expirace/vytvoření
      const expirationDateRaw = domain.expiration_date as string | undefined;
      const creationDateRaw   = domain.creation_date  as string | undefined;
      const expDate = expirationDateRaw ? expirationDateRaw.split('T')[0] : null;
      const crtDate = creationDateRaw   ? creationDateRaw.split('T')[0]   : null;

      const { error } = await supabase
        .from('trackino_domain_cache')
        .upsert(
          {
            workspace_id:    workspaceId,
            openprovider_id: domain.id as number,
            domain_name:     domainName,
            status:          (domain.status as string) ?? 'active',
            expiration_date: expDate,
            creation_date:   crtDate,
            is_locked:       Boolean(domain.is_locked),
            nameservers:     (domain.name_servers ?? []) as unknown[],
            auto_renew:      Boolean(domain.is_auto_renew),
            raw_data:        domain,
            synced_at:       now,
            updated_at:      now,
          },
          { onConflict: 'workspace_id,openprovider_id' },
        );

      if (!error) synced++;
    }

    // Aktualizuj čas posledního synchronizace
    await supabase
      .from('trackino_domain_settings')
      .update({ last_sync_at: now, updated_at: now })
      .eq('workspace_id', workspaceId);

    return NextResponse.json({ synced, total: allDomains.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chyba synchronizace';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
