// Trackino – Monitoring: sběr DB metrik
// Spouštěno Vercel Cron Jobem (0 3 * * *) nebo ručně z dashboardu.
// Vyžaduje MONITORING_SECRET nebo CRON_SECRET v Authorization hlavičce.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkDbSizeAlert } from '@/lib/monitoring/alerts';
import { METRICS_SAMPLE_RATE } from '@/lib/monitoring/thresholds';

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

interface MetricInsert {
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  tags?: Record<string, unknown>;
}

async function saveMetrics(metrics: MetricInsert[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  await supabase.from('trackino_metrics').insert(
    metrics.map(m => ({ ...m, recorded_at: now }))
  );
}

async function countRows(table: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

// ─── Typy z DB funkcí ────────────────────────────────────────────────────────

interface TableSizeRow {
  table_name: string;
  size_mb: number;
  row_count: number;
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: Record<string, unknown> = {
    collectedAt: new Date().toISOString(),
    metricsCount: 0,
    sampleRate: METRICS_SAMPLE_RATE,
  };

  const metrics: MetricInsert[] = [];

  // ── 1. Celková velikost databáze ──────────────────────────────────────────
  try {
    const { data: sizeData, error: sizeErr } = await supabase
      .rpc('trackino_monitoring_db_size_mb') as { data: number | null; error: unknown };

    if (sizeErr) {
      console.error('[Monitoring] Chyba při načítání velikosti DB:', sizeErr);
      results.dbSizeError = String(sizeErr);
    } else {
      const sizeMb = sizeData ?? 0;
      metrics.push({
        metric_name: 'db_size_mb',
        metric_value: sizeMb,
        metric_unit: 'MB',
      });
      results.dbSizeMb = sizeMb;

      // Zkontroluj alerty
      await checkDbSizeAlert(sizeMb);
    }
  } catch (err) {
    console.error('[Monitoring] Výjimka při DB size:', err);
    results.dbSizeError = String(err);
  }

  // ── 2. Velikosti tabulek (top 10) ─────────────────────────────────────────
  try {
    const { data: tableData, error: tableErr } = await supabase
      .rpc('trackino_monitoring_table_sizes') as { data: TableSizeRow[] | null; error: unknown };

    if (tableErr) {
      console.error('[Monitoring] Chyba při načítání velikostí tabulek:', tableErr);
      results.tableSizesError = String(tableErr);
    } else {
      const rows = tableData ?? [];

      // Ulož každou tabulku jako samostatnou metriku
      for (const row of rows) {
        metrics.push({
          metric_name: 'table_size_mb',
          metric_value: row.size_mb,
          metric_unit: 'MB',
          tags: { table: row.table_name, row_count: row.row_count },
        });
      }

      results.topTables = rows.slice(0, 10);
    }
  } catch (err) {
    console.error('[Monitoring] Výjimka při table sizes:', err);
    results.tableSizesError = String(err);
  }

  // ── 3. Počty řádků v kritických tabulkách ────────────────────────────────
  const criticalTables = [
    'trackino_time_entries',
    'trackino_workspaces',
    'trackino_workspace_members',
    'trackino_audit_log',
    'trackino_metrics',
    'trackino_monitoring_alerts',
  ];

  const rowCounts: Record<string, number> = {};
  await Promise.all(
    criticalTables.map(async (table) => {
      try {
        const count = await countRows(table);
        rowCounts[table] = count;
        metrics.push({
          metric_name: 'row_count',
          metric_value: count,
          metric_unit: 'rows',
          tags: { table },
        });
      } catch (err) {
        console.error(`[Monitoring] Chyba při počítání řádků ${table}:`, err);
      }
    })
  );
  results.rowCounts = rowCounts;

  // ── 4. Počet aktivních workspace a uživatelů ──────────────────────────────
  try {
    const { count: workspaceCount } = await supabase
      .from('trackino_workspaces')
      .select('*', { count: 'exact', head: true });

    const { count: userCount } = await supabase
      .from('trackino_workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('approved', true);

    metrics.push(
      {
        metric_name: 'workspace_count',
        metric_value: workspaceCount ?? 0,
        metric_unit: 'workspaces',
      },
      {
        metric_name: 'active_user_count',
        metric_value: userCount ?? 0,
        metric_unit: 'users',
      }
    );
    results.workspaceCount = workspaceCount;
    results.activeUserCount = userCount;
  } catch (err) {
    console.error('[Monitoring] Chyba při počítání workspace/uživatelů:', err);
  }

  // ── 5. Uložit všechny metriky ─────────────────────────────────────────────
  try {
    if (metrics.length > 0) {
      await saveMetrics(metrics);
    }
    results.metricsCount = metrics.length;
  } catch (err) {
    console.error('[Monitoring] Chyba při ukládání metrik:', err);
    results.savingError = String(err);
  }

  return NextResponse.json({ ok: true, ...results });
}

// Vercel Cron Jobs volají GET, dashboard může volat i POST
export const POST = GET;
