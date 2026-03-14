// Trackino – Monitoring: týdenní email report
// Spouštěno Vercel Cron Jobem (0 8 * * 1 = každé pondělí v 8:00 UTC) nebo ručně.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendWeeklyReport } from '@/lib/monitoring/email';

// ─── Auth ───────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const monitoringSecret = process.env.MONITORING_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  if (monitoringSecret && token === monitoringSecret) return true;
  if (cronSecret && token === cronSecret) return true;
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ─── GET/POST handler ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Zjistit email příjemce ────────────────────────────────────────────────
  const emailTo = process.env.ALERT_EMAIL;
  let recipientEmail = emailTo ?? '';

  if (!recipientEmail) {
    const { data: adminData } = await supabase
      .from('trackino_profiles')
      .select('email')
      .eq('is_master_admin', true)
      .limit(1)
      .single();
    recipientEmail = adminData?.email ?? '';
  }

  if (!recipientEmail) {
    return NextResponse.json({ error: 'Žádný příjemce (nastavte ALERT_EMAIL)' }, { status: 400 });
  }

  // ── Načíst data pro report ────────────────────────────────────────────────

  // Aktuální velikost DB
  const { data: dbSizeData } = await supabase
    .from('trackino_metrics')
    .select('metric_value, recorded_at')
    .eq('metric_name', 'db_size_mb')
    .order('recorded_at', { ascending: false })
    .limit(2);

  const currentDbMb = (dbSizeData?.[0] as { metric_value: number } | undefined)?.metric_value ?? 0;
  const prevDbMb = (dbSizeData?.[1] as { metric_value: number } | undefined)?.metric_value ?? currentDbMb;
  const dbSizeChangeMb = parseFloat((currentDbMb - prevDbMb).toFixed(2));

  // Průměrný response time (pro budoucí použití – nyní null)
  const avgResponseMs: number | null = null;

  // Počet chyb za 7 dní
  const { data: errorData } = await supabase
    .from('trackino_metrics')
    .select('metric_value')
    .eq('metric_name', 'client_error')
    .gte('recorded_at', since7d);
  const errorCount = (errorData as { metric_value: number }[] | null)?.reduce((s, r) => s + r.metric_value, 0) ?? 0;

  // Počet workspace a uživatelů
  const { data: wsData } = await supabase
    .from('trackino_metrics')
    .select('metric_value')
    .eq('metric_name', 'workspace_count')
    .order('recorded_at', { ascending: false })
    .limit(1);
  const workspaceCount = (wsData?.[0] as { metric_value: number } | undefined)?.metric_value ?? 0;

  const { data: userdata } = await supabase
    .from('trackino_metrics')
    .select('metric_value')
    .eq('metric_name', 'active_user_count')
    .order('recorded_at', { ascending: false })
    .limit(1);
  const userCount = (userdata?.[0] as { metric_value: number } | undefined)?.metric_value ?? 0;

  // Top 3 tabulky
  const { data: tableData } = await supabase
    .from('trackino_metrics')
    .select('tags, recorded_at')
    .eq('metric_name', 'table_size_mb')
    .order('recorded_at', { ascending: false })
    .limit(50);

  const seenTables = new Set<string>();
  const topTables: Array<{ name: string; sizeMb: number; rowCount: number }> = [];
  for (const row of (tableData ?? []) as { tags: Record<string, unknown> | null }[]) {
    const tbl = row.tags?.table as string | undefined;
    if (tbl && !seenTables.has(tbl)) {
      seenTables.add(tbl);
      topTables.push({
        name: tbl,
        sizeMb: parseFloat(String(row.tags?.size_mb ?? '0')),
        rowCount: parseInt(String(row.tags?.row_count ?? '0'), 10),
      });
    }
    if (topTables.length >= 3) break;
  }

  // Nevyřešené alerty
  const { count: unresolvedAlerts } = await supabase
    .from('trackino_monitoring_alerts')
    .select('*', { count: 'exact', head: true })
    .is('resolved_at', null);

  // ── Odeslat report ────────────────────────────────────────────────────────
  await sendWeeklyReport({
    to: recipientEmail,
    weekNumber: getISOWeek(now),
    year: now.getFullYear(),
    dbSizeMb: currentDbMb,
    dbSizeChangeMb,
    avgResponseMs,
    errorCount: Math.round(errorCount),
    workspaceCount: Math.round(workspaceCount),
    userCount: Math.round(userCount),
    topTables,
    unresolvedAlerts: unresolvedAlerts ?? 0,
  });

  return NextResponse.json({
    ok: true,
    sentTo: recipientEmail,
    week: getISOWeek(now),
    year: now.getFullYear(),
  });
}

export const POST = GET;
