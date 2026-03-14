'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  DB_SIZE_WARNING_MB,
  DB_SIZE_CRITICAL_MB,
  DB_SIZE_FREE_LIMIT_MB,
  ERROR_RATE_WARNING_PCT,
  ERROR_RATE_CRITICAL_PCT,
  RESPONSE_TIME_WARNING_MS,
  RESPONSE_TIME_CRITICAL_MS,
  ERROR_COUNT_CLIENT_WARNING,
  ERROR_COUNT_CLIENT_CRITICAL,
} from '@/lib/monitoring/thresholds';
import { supabase } from '@/lib/supabase';

// ─── Typy ────────────────────────────────────────────────────────────────────

interface MetricRow {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  tags: Record<string, unknown> | null;
  recorded_at: string;
}

interface AlertRow {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric_value: number | null;
  threshold_value: number | null;
  resolved_at: string | null;
  created_at: string;
}

interface TableSizeEntry {
  table_name: string;
  size_mb: number;
  row_count: number;
  recorded_at: string;
}

interface StatusCard {
  label: string;
  value: string;
  sub?: string;
  status: 'ok' | 'warning' | 'critical' | 'unknown';
}

// ─── Pomocné funkce ──────────────────────────────────────────────────────────

function severityColor(s: 'info' | 'warning' | 'critical' | 'ok' | 'unknown'): string {
  if (s === 'critical') return '#ef4444';
  if (s === 'warning') return '#f59e0b';
  if (s === 'ok') return '#22c55e';
  return '#9ca3af';
}

function statusLabel(s: 'ok' | 'warning' | 'critical' | 'unknown'): string {
  if (s === 'ok') return 'V pořádku';
  if (s === 'warning') return 'Varování';
  if (s === 'critical') return 'Kritické';
  return 'Neznámé';
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Tooltip komponenta pro Recharts ─────────────────────────────────────────

interface TooltipPayload { name: string; value: number; unit?: string }
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg text-xs" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)'
    }}>
      <div className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong> {p.unit ?? ''}</div>
      ))}
    </div>
  );
};

// ─── Hlavní komponenta ────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [dbSizeMb, setDbSizeMb] = useState<number | null>(null);
  const [dbSizeHistory, setDbSizeHistory] = useState<{ time: string; value: number }[]>([]);
  const [errorHistory, setErrorHistory] = useState<{ time: string; errors: number; requests: number; rate: number }[]>([]);
  const [tableSizes, setTableSizes] = useState<TableSizeEntry[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [requestCount24h, setRequestCount24h] = useState<number>(0);
  const [errorCount24h, setErrorCount24h] = useState<number>(0);
  const [workspaceCount, setWorkspaceCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectRunning, setCollectRunning] = useState(false);
  const [collectMsg, setCollectMsg] = useState('');
  const [lastCollected, setLastCollected] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && profile !== null && !profile.is_master_admin) {
      router.replace('/');
    }
  }, [authLoading, profile, router]);

  // ── Načtení dat ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
    // Paralelní dotazy
    const [
      dbSizeRes,
      tableSizeRes,
      requestRes,
      errorRes,
      alertsRes,
      wsCountRes,
      userCountRes,
    ] = await Promise.all([
      supabase
        .from('trackino_metrics')
        .select('metric_value, recorded_at')
        .eq('metric_name', 'db_size_mb')
        .gte('recorded_at', since7d)
        .order('recorded_at', { ascending: true }),
      supabase
        .from('trackino_metrics')
        .select('tags, recorded_at')
        .eq('metric_name', 'table_size_mb')
        .gte('recorded_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: false }),
      supabase
        .from('trackino_metrics')
        .select('metric_value, recorded_at')
        .eq('metric_name', 'request_count')
        .gte('recorded_at', since24h),
      supabase
        .from('trackino_metrics')
        .select('metric_value, recorded_at')
        .eq('metric_name', 'client_error')
        .gte('recorded_at', since24h),
      supabase
        .from('trackino_monitoring_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('trackino_metrics')
        .select('metric_value, recorded_at')
        .eq('metric_name', 'workspace_count')
        .order('recorded_at', { ascending: false })
        .limit(1),
      supabase
        .from('trackino_metrics')
        .select('metric_value, recorded_at')
        .eq('metric_name', 'active_user_count')
        .order('recorded_at', { ascending: false })
        .limit(1),
    ]);

    // DB size history (7 dní)
    if (dbSizeRes.data) {
      const history = (dbSizeRes.data as { metric_value: number; recorded_at: string }[]).map(r => ({
        time: fmtDate(r.recorded_at),
        value: parseFloat(r.metric_value.toFixed(2)),
      }));
      setDbSizeHistory(history);
      if (history.length > 0) {
        setDbSizeMb(history[history.length - 1].value);
      }
    }

    // Poslední collect čas
    if (dbSizeRes.data && dbSizeRes.data.length > 0) {
      const last = dbSizeRes.data[dbSizeRes.data.length - 1] as { recorded_at: string };
      setLastCollected(last.recorded_at);
    }

    // Top tabulky z posledního sběru
    if (tableSizeRes.data) {
      const seen = new Set<string>();
      const tops: TableSizeEntry[] = [];
      for (const r of tableSizeRes.data as { tags: Record<string, unknown> | null; recorded_at: string }[]) {
        const tbl = r.tags?.table as string | undefined;
        if (tbl && !seen.has(tbl)) {
          seen.add(tbl);
          tops.push({
            table_name: tbl,
            size_mb: parseFloat(String(r.tags?.size_mb ?? '0')),
            row_count: parseInt(String(r.tags?.row_count ?? '0'), 10),
            recorded_at: r.recorded_at,
          });
        }
      }
      setTableSizes(tops.sort((a, b) => b.size_mb - a.size_mb).slice(0, 10));
    }

    // Počty 24h
    const rCount = (requestRes.data as { metric_value: number }[] | null)?.reduce((s, r) => s + r.metric_value, 0) ?? 0;
    const eCount = (errorRes.data as { metric_value: number }[] | null)?.reduce((s, r) => s + r.metric_value, 0) ?? 0;
    setRequestCount24h(Math.round(rCount));
    setErrorCount24h(Math.round(eCount));

    // Error history po hodinách (posledních 24h)
    const errorByHour: Record<string, { errors: number; requests: number }> = {};
    for (const r of (errorRes.data ?? []) as { metric_value: number; recorded_at: string }[]) {
      const h = new Date(r.recorded_at).toISOString().slice(0, 13);
      if (!errorByHour[h]) errorByHour[h] = { errors: 0, requests: 0 };
      errorByHour[h].errors += r.metric_value;
    }
    for (const r of (requestRes.data ?? []) as { metric_value: number; recorded_at: string }[]) {
      const h = new Date(r.recorded_at).toISOString().slice(0, 13);
      if (!errorByHour[h]) errorByHour[h] = { errors: 0, requests: 0 };
      errorByHour[h].requests += r.metric_value;
    }
    const errHist = Object.entries(errorByHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([h, d]) => ({
        time: `${new Date(h + ':00:00Z').getHours()}:00`,
        errors: Math.round(d.errors),
        requests: Math.round(d.requests),
        rate: d.requests > 0 ? parseFloat(((d.errors / d.requests) * 100).toFixed(1)) : 0,
      }));
    setErrorHistory(errHist);

    // Alerty
    if (alertsRes.data) {
      setAlerts(alertsRes.data as AlertRow[]);
    }

    // Počty workspace / uživatelů
    if (wsCountRes.data && wsCountRes.data.length > 0) {
      setWorkspaceCount((wsCountRes.data[0] as { metric_value: number }).metric_value);
    }
    if (userCountRes.data && userCountRes.data.length > 0) {
      setUserCount((userCountRes.data[0] as { metric_value: number }).metric_value);
    }

    // Zkontroluj chyby z DB dotazů
    const firstError = [dbSizeRes, tableSizeRes, requestRes, errorRes, alertsRes, wsCountRes, userCountRes]
      .find(r => r.error);
    if (firstError?.error) {
      setFetchError(`Chyba DB: ${firstError.error.message} (kód: ${firstError.error.code})`);
    }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(`Neočekávaná chyba: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && profile?.is_master_admin) {
      fetchData();
    }
  }, [authLoading, profile, fetchData]);

  // ── Ruční spuštění collect ──────────────────────────────────────────────────
  const runCollect = async () => {
    setCollectRunning(true);
    setCollectMsg('');
    try {
      const secret = process.env.NEXT_PUBLIC_MONITORING_SECRET ?? '';
      const res = await fetch('/api/monitoring/collect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCollectMsg(`Sběr dokončen – uloženo ${data.metricsCount ?? 0} metrik. DB: ${data.dbSizeMb?.toFixed(1) ?? '?'} MB`);
        await fetchData();
      } else {
        setCollectMsg(`Chyba ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      setCollectMsg(`Síťová chyba: ${err}`);
    }
    setCollectRunning(false);
  };

  // ── Status karty ────────────────────────────────────────────────────────────
  const dbStatus: StatusCard = (() => {
    if (dbSizeMb === null) return { label: 'Velikost DB', value: '–', status: 'unknown' };
    const pct = Math.round((dbSizeMb / DB_SIZE_FREE_LIMIT_MB) * 100);
    const status = dbSizeMb >= DB_SIZE_CRITICAL_MB ? 'critical' : dbSizeMb >= DB_SIZE_WARNING_MB ? 'warning' : 'ok';
    return {
      label: 'Velikost databáze',
      value: `${dbSizeMb.toFixed(1)} MB`,
      sub: `${pct} % limitu 500 MB`,
      status,
    };
  })();

  const errorRate = requestCount24h > 0
    ? parseFloat(((errorCount24h / requestCount24h) * 100).toFixed(1))
    : 0;

  const errorStatus: StatusCard = (() => {
    const status = errorCount24h >= ERROR_COUNT_CLIENT_CRITICAL ? 'critical'
      : errorCount24h >= ERROR_COUNT_CLIENT_WARNING ? 'warning'
      : errorRate >= ERROR_RATE_CRITICAL_PCT ? 'critical'
      : errorRate >= ERROR_RATE_WARNING_PCT ? 'warning'
      : 'ok';
    return {
      label: 'Klientské chyby (24h)',
      value: `${errorCount24h}`,
      sub: requestCount24h > 0 ? `error rate ${errorRate} %` : 'žádné API requesty',
      status,
    };
  })();

  const unresolvedAlerts = alerts.filter(a => !a.resolved_at);
  const alertStatus: StatusCard = {
    label: 'Aktivní alerty',
    value: `${unresolvedAlerts.length}`,
    sub: unresolvedAlerts.length > 0
      ? unresolvedAlerts.some(a => a.severity === 'critical') ? 'Obsahují kritické' : 'Jen varování'
      : 'Vše v pořádku',
    status: unresolvedAlerts.length === 0 ? 'ok'
      : unresolvedAlerts.some(a => a.severity === 'critical') ? 'critical' : 'warning',
  };

  const reqStatus: StatusCard = {
    label: 'API requesty (24h)',
    value: requestCount24h.toLocaleString('cs'),
    sub: lastCollected ? `Poslední sběr: ${fmtDate(lastCollected)}` : 'Data zatím nejsou',
    status: 'ok',
  };

  const cards: StatusCard[] = [dbStatus, errorStatus, alertStatus, reqStatus];

  // ── Loading / Auth guard ────────────────────────────────────────────────────
  if (authLoading || profile === null) return null;
  if (!profile.is_master_admin) return null;

  // ── Render ──────────────────────────────────────────────────────────────────
  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
  };

  return (
    <DashboardLayout moduleName="Monitoring">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Záhlaví */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Monitoring
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Stav databáze, chybovost a alerty
              {lastCollected && (
                <span> · Poslední sběr: {fmtDate(lastCollected)}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={runCollect}
              disabled={collectRunning}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {collectRunning ? 'Sbírám...' : 'Spustit sběr nyní'}
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              Obnovit
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
            {fetchError}
          </div>
        )}

        {collectMsg && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
            {collectMsg}
          </div>
        )}

        {/* Status karty */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border p-4"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                  {card.label}
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: severityColor(card.status) + '22',
                    color: severityColor(card.status),
                  }}
                >
                  {statusLabel(card.status)}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {loading ? '–' : card.value}
              </div>
              {card.sub && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {card.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Statistiky workspace/uživatelé */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Workspace celkem', value: workspaceCount },
            { label: 'Aktivní uživatelé', value: userCount },
          ].map(item => (
            <div key={item.label} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {loading ? '–' : (item.value ?? '–')}
              </div>
            </div>
          ))}
        </div>

        {/* Grafy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Graf: DB size (7 dní) */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Velikost databáze – 7 dní (MB)
            </h2>
            {dbSizeHistory.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Zatím žádná data. Spusťte sběr.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dbSizeHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  {/* Threshold čáry */}
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} name="DB MB" unit=" MB" />
                  {/* Referenční prahové hodnoty jako ploché data */}
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: '#f59e0b' }}>▬ Varování {DB_SIZE_WARNING_MB} MB</span>
              <span style={{ color: '#ef4444' }}>▬ Kritické {DB_SIZE_CRITICAL_MB} MB</span>
            </div>
          </div>

          {/* Graf: Klientské chyby (24h po hodinách) */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Klientské chyby – 24h (počet)
            </h2>
            {errorHistory.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Žádné chyby za posledních 24 hodin.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={errorHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} width={30} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="errors" fill="#ef4444" name="Chyby" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: '#f59e0b' }}>Varování &gt;{ERROR_COUNT_CLIENT_WARNING}</span>
              <span style={{ color: '#ef4444' }}>Kritické &gt;{ERROR_COUNT_CLIENT_CRITICAL}</span>
            </div>
          </div>
        </div>

        {/* Top 10 tabulek */}
        <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Top 10 největších tabulek
            </h2>
          </div>
          {tableSizes.length === 0 ? (
            <div className="px-4 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              Data zatím nejsou. Spusťte sběr.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Tabulka', 'Velikost (MB)', 'Počet řádků'].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-xs" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableSizes.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{row.table_name}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        {row.size_mb.toFixed(3)}
                        <div className="mt-0.5 h-1 rounded-full" style={{ background: 'var(--bg-hover)', width: 64 }}>
                          <div
                            className="h-1 rounded-full"
                            style={{
                              width: `${Math.min(100, (row.size_mb / (dbSizeMb || 1)) * 100)}%`,
                              background: 'var(--primary)',
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        {row.row_count.toLocaleString('cs')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alerty */}
        <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Alerty (posledních 20)
            </h2>
            {unresolvedAlerts.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ef444422', color: '#ef4444' }}>
                {unresolvedAlerts.length} nevyřešených
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              Žádné alerty.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Typ', 'Závažnost', 'Zpráva', 'Hodnota', 'Threshold', 'Čas', 'Vyřešeno'].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-medium text-xs" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', opacity: a.resolved_at ? 0.55 : 1 }}>
                      <td className="px-4 py-2 text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{a.alert_type}</td>
                      <td className="px-4 py-2 text-xs">
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: severityColor(a.severity) + '22', color: severityColor(a.severity) }}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>{a.message}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        {a.metric_value?.toFixed(1) ?? '–'}
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        {a.threshold_value?.toFixed(1) ?? '–'}
                      </td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {fmtTime(a.created_at)}
                      </td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {a.resolved_at ? fmtTime(a.resolved_at) : (
                          <span style={{ color: '#ef4444' }}>Nevyřešeno</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Thresholdy – přehled */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Nastavené thresholdy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: 'DB size – varování', value: `${DB_SIZE_WARNING_MB} MB`, color: '#f59e0b' },
              { label: 'DB size – kritické', value: `${DB_SIZE_CRITICAL_MB} MB`, color: '#ef4444' },
              { label: 'DB size – limit Free tier', value: `${DB_SIZE_FREE_LIMIT_MB} MB`, color: '#9ca3af' },
              { label: 'Error rate – varování', value: `${ERROR_RATE_WARNING_PCT} %`, color: '#f59e0b' },
              { label: 'Error rate – kritické', value: `${ERROR_RATE_CRITICAL_PCT} %`, color: '#ef4444' },
              { label: 'Počet chyb – varování', value: `>${ERROR_COUNT_CLIENT_WARNING}/hod`, color: '#f59e0b' },
              { label: 'Počet chyb – kritické', value: `>${ERROR_COUNT_CLIENT_CRITICAL}/hod`, color: '#ef4444' },
              { label: 'Response time – varování', value: `${RESPONSE_TIME_WARNING_MS} ms`, color: '#f59e0b' },
              { label: 'Response time – kritické', value: `${RESPONSE_TIME_CRITICAL_MS} ms`, color: '#ef4444' },
            ].map(t => (
              <div key={t.label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-hover)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t.label}</span>
                <span className="font-semibold" style={{ color: t.color }}>{t.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Thresholdy jsou definovány v <code className="font-mono">src/lib/monitoring/thresholds.ts</code>.
          </p>
        </div>

        {/* Spodní padding */}
        <div className="h-4" />
      </div>
    </DashboardLayout>
  );
}
