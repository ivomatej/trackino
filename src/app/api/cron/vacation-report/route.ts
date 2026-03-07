import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, parseCronBody, saveCronResult } from '@/lib/cron-handler';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;

/**
 * POST /api/cron/vacation-report
 * Report čerpání dovolené za aktuální rok.
 * Volá cron-job.org první den každého měsíce v 7:00.
 *
 * Body: { workspace_id: string }
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaceId: string;
  try {
    ({ workspaceId } = await parseCronBody(request));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const year = new Date().getFullYear();

  try {
    // Schválené záznamy dovolené za aktuální rok
    const { data: vacations } = await supabase
      .from('trackino_vacation_entries')
      .select(`
        id, user_id, days, start_date, end_date, status,
        trackino_profiles!inner(display_name)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved')
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`);

    // Fondy dovolené za aktuální rok
    const { data: allowances } = await supabase
      .from('trackino_vacation_allowances')
      .select('user_id, days_per_year')
      .eq('workspace_id', workspaceId)
      .eq('year', year);

    // Agregace per user
    const byUser: Record<string, { name: string; used: number; total: number | null }> = {};

    if (vacations) {
      for (const v of vacations) {
        const uid = v.user_id as string;
        const name = (v.trackino_profiles as { display_name?: string } | null)?.display_name ?? uid;
        if (!byUser[uid]) byUser[uid] = { name, used: 0, total: null };
        byUser[uid].used += (v.days as number) ?? 0;
      }
    }

    if (allowances) {
      for (const a of allowances) {
        const uid = a.user_id as string;
        if (!byUser[uid]) byUser[uid] = { name: uid, used: 0, total: null };
        byUser[uid].total = a.days_per_year as number;
      }
    }

    const rows = Object.values(byUser).sort((a, b) => b.used - a.used);
    const todayStr = new Date().toLocaleDateString('cs-CZ');

    let content: string;
    if (rows.length === 0) {
      content = `Žádné záznamy dovolené za rok ${year}.`;
    } else {
      const lines = rows.map(r => {
        const remaining = r.total !== null ? r.total - r.used : null;
        const remainingStr = remaining !== null ? `, zbývá: **${remaining} dní**` : '';
        const totalStr = r.total !== null ? `/${r.total}` : '';
        return `- **${r.name}**: čerpáno ${r.used}${totalStr} dní${remainingStr}`;
      });
      content = `# Report dovolených ${year}\n\n*Vygenerováno: ${todayStr}*\n\n## Přehled čerpání\n\n${lines.join('\n')}`;
    }

    await saveCronResult(
      workspaceId,
      'vacation-report',
      `Report dovolených ${year}`,
      content,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    await saveCronResult(
      workspaceId,
      'vacation-report',
      'Report dovolených – chyba',
      String(err),
      'error',
    );
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
