import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, parseCronBody, saveCronResult } from '@/lib/cron-handler';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;

/**
 * POST /api/cron/inactive-check
 * Zkontroluje neaktivní členy workspace (žádný záznam za N dní).
 * Volá cron-job.org každé pondělí v 8:30.
 *
 * Body: { workspace_id: string, days?: number }  (default days=14)
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaceId: string;
  let params: Record<string, unknown>;
  try {
    ({ workspaceId, params } = await parseCronBody(request));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const days = typeof params.days === 'number' ? params.days : 14;
  const supabase = getSupabaseAdmin();

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Načteme všechny aktivní členy
    const { data: members } = await supabase
      .from('trackino_workspace_members')
      .select(`
        user_id,
        trackino_profiles!inner(display_name, email)
      `)
      .eq('workspace_id', workspaceId);

    if (!members || members.length === 0) {
      await saveCronResult(workspaceId, 'inactive-check', 'Kontrola neaktivních členů', 'Žádní členové nenalezeni.');
      return NextResponse.json({ ok: true });
    }

    // Pro každého člena zkontrolujeme poslední záznam
    const inactive: { name: string; email: string; lastActivity: string | null }[] = [];

    for (const m of members) {
      const { data: lastEntry } = await supabase
        .from('trackino_time_entries')
        .select('start_time')
        .eq('workspace_id', workspaceId)
        .eq('user_id', m.user_id)
        .eq('is_running', false)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const isInactive = !lastEntry || lastEntry.start_time < cutoff;
      if (isInactive) {
        const prof = m.trackino_profiles as { display_name?: string; email?: string } | null;
        inactive.push({
          name: prof?.display_name ?? m.user_id,
          email: prof?.email ?? '',
          lastActivity: lastEntry?.start_time ?? null,
        });
      }
    }

    const cutoffDate = new Date(cutoff).toLocaleDateString('cs-CZ');
    let content: string;

    if (inactive.length === 0) {
      content = `✅ Všichni členové byli aktivní v posledních **${days} dnech** (od ${cutoffDate}).`;
    } else {
      const lines = inactive.map(u => {
        const last = u.lastActivity
          ? `naposledy aktivní ${new Date(u.lastActivity).toLocaleDateString('cs-CZ')}`
          : 'nikdy žádný záznam';
        return `- **${u.name}** (${u.email}) – ${last}`;
      });
      content = `⚠️ Nalezeno **${inactive.length} neaktivních členů** (žádný záznam za posledních ${days} dní, od ${cutoffDate}):\n\n${lines.join('\n')}`;
    }

    await saveCronResult(
      workspaceId,
      'inactive-check',
      `Kontrola neaktivních členů (${days} dní)`,
      content,
    );

    return NextResponse.json({ ok: true, inactive: inactive.length });
  } catch (err) {
    await saveCronResult(
      workspaceId,
      'inactive-check',
      'Kontrola neaktivních členů – chyba',
      String(err),
      'error',
    );
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
