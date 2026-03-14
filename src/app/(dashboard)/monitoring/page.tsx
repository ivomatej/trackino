'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
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

interface MonitoringSettings {
  resendConfigured: boolean;
  resendFrom: string;
  cronJobApiConfigured: boolean;
  cronSecretConfigured: boolean;
  alertEmail: string;
  alertEmailSource: 'env' | 'master_admin' | 'none';
  appUrl: string;
}

interface CronJobSchedule {
  minutes: number[];
  hours: number[];
  wdays: number[];
  mdays: number[];
  months: number[];
  timezone: string;
  expiresAt: number;
}

interface CronJob {
  jobId: number;
  title: string;
  url: string;
  enabled: boolean;
  schedule: CronJobSchedule;
}

// Definice monitorovacích šablon (collect + weekly-report)
const MONITORING_CRON_TEMPLATES = [
  {
    id: 'monitoring-collect',
    title: 'Trackino – Sběr DB metrik',
    urlPath: '/api/monitoring/collect',
    defaultSchedule: {
      minutes: [0], hours: [3], wdays: [-1], mdays: [-1], months: [-1],
      timezone: 'Europe/Prague', expiresAt: 0,
    } as CronJobSchedule,
    description: 'Sbírá metriky databáze (velikost, počty tabulek/řádků). Doporučeno: každou noc ve 3:00.',
    defaultLabel: 'každý den ve 3:00',
  },
  {
    id: 'monitoring-weekly-report',
    title: 'Trackino – Týdenní email report',
    urlPath: '/api/monitoring/weekly-report',
    defaultSchedule: {
      minutes: [0], hours: [8], wdays: [1], mdays: [-1], months: [-1],
      timezone: 'Europe/Prague', expiresAt: 0,
    } as CronJobSchedule,
    description: 'Odesílá týdenní souhrnný email na ALERT_EMAIL. Doporučeno: každé pondělí v 8:00.',
    defaultLabel: 'každé pondělí v 8:00',
  },
] as const;

function scheduleToLabel(s: CronJobSchedule): string {
  const hour = s.hours[0] ?? 0;
  const min = s.minutes[0] ?? 0;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const wdayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  if (s.wdays.includes(-1)) return `každý den v ${timeStr}`;
  const days = s.wdays.map(d => wdayNames[d] ?? d).join(', ');
  return `každý ${days} v ${timeStr}`;
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

function MonitoringContent() {
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

  // ── Nastavení – stav ──────────────────────────────────────────────────────
  const [settings, setSettings] = useState<MonitoringSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronMsg, setCronMsg] = useState('');
  const [cronMsgType, setCronMsgType] = useState<'ok' | 'error'>('ok');
  const [testEmailRunning, setTestEmailRunning] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState('');
  const [testEmailType, setTestEmailType] = useState<'ok' | 'error'>('ok');

  // Modal pro editaci rozvrhu
  const [editModal, setEditModal] = useState<{
    jobId?: number;   // undefined = nový job
    templateId: string;
    schedule: CronJobSchedule;
  } | null>(null);

  const settingsFetched = useRef(false);

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

  // ── Fetch nastavení + cron jobs ─────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const secret = process.env.NEXT_PUBLIC_MONITORING_SECRET ?? '';
      const res = await fetch('/api/monitoring/settings', {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data as MonitoringSettings);
      }
    } catch {
      // tiše ignorovat
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchCronJobs = useCallback(async () => {
    setCronLoading(true);
    try {
      const res = await fetch('/api/cron-jobs');
      if (res.ok) {
        const data = await res.json();
        // cron-job.org vrací { jobs: [...] }
        const jobs: CronJob[] = (data.jobs ?? []);
        // Filtrujeme jen monitoring joby (podle URL)
        const monitoringJobs = jobs.filter((j: CronJob) =>
          j.url?.includes('/api/monitoring/collect') ||
          j.url?.includes('/api/monitoring/weekly-report'),
        );
        setCronJobs(monitoringJobs);
      }
    } catch {
      // Pokud CRON_JOB_API_KEY není nastaven, ignore
    } finally {
      setCronLoading(false);
    }
  }, []);

  // Jednorázový fetch nastavení a cron jobů při načtení stránky
  useEffect(() => {
    if (!authLoading && profile?.is_master_admin && !settingsFetched.current) {
      settingsFetched.current = true;
      fetchSettings();
      fetchCronJobs();
    }
  }, [authLoading, profile, fetchSettings, fetchCronJobs]);

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

  // ── Cron job akce ────────────────────────────────────────────────────────
  const createCronJob = async (templateId: string, schedule: CronJobSchedule) => {
    const tmpl = MONITORING_CRON_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;
    setCronLoading(true);
    setCronMsg('');
    try {
      const res = await fetch('/api/cron-jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tmpl.title,
          url: tmpl.urlPath,
          schedule,
          extendedData: {
            body: JSON.stringify({ workspace_id: 'all' }),
          },
        }),
      });
      if (res.ok) {
        setCronMsg('Cron job byl úspěšně vytvořen.');
        setCronMsgType('ok');
        await fetchCronJobs();
      } else {
        const err = await res.text();
        setCronMsg(`Chyba při vytváření: ${err}`);
        setCronMsgType('error');
      }
    } catch (err) {
      setCronMsg(`Síťová chyba: ${err}`);
      setCronMsgType('error');
    }
    setCronLoading(false);
  };

  const toggleCronJob = async (jobId: number, enabled: boolean) => {
    setCronLoading(true);
    setCronMsg('');
    try {
      const res = await fetch(`/api/cron-jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setCronMsg(`Cron job byl ${enabled ? 'aktivován' : 'pozastaven'}.`);
        setCronMsgType('ok');
        await fetchCronJobs();
      } else {
        const err = await res.text();
        setCronMsg(`Chyba: ${err}`);
        setCronMsgType('error');
      }
    } catch (err) {
      setCronMsg(`Síťová chyba: ${err}`);
      setCronMsgType('error');
    }
    setCronLoading(false);
  };

  const deleteCronJob = async (jobId: number) => {
    if (!confirm('Opravdu smazat tento cron job?')) return;
    setCronLoading(true);
    setCronMsg('');
    try {
      const res = await fetch(`/api/cron-jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setCronMsg('Cron job byl smazán.');
        setCronMsgType('ok');
        await fetchCronJobs();
      } else {
        const err = await res.text();
        setCronMsg(`Chyba: ${err}`);
        setCronMsgType('error');
      }
    } catch (err) {
      setCronMsg(`Síťová chyba: ${err}`);
      setCronMsgType('error');
    }
    setCronLoading(false);
  };

  const saveEditSchedule = async () => {
    if (!editModal) return;
    setCronMsg('');
    if (editModal.jobId !== undefined) {
      // Aktualizace existujícího jobu
      setCronLoading(true);
      try {
        const res = await fetch(`/api/cron-jobs/${editModal.jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule: editModal.schedule }),
        });
        if (res.ok) {
          setCronMsg('Rozvrh byl aktualizován.');
          setCronMsgType('ok');
          setEditModal(null);
          await fetchCronJobs();
        } else {
          const err = await res.text();
          setCronMsg(`Chyba: ${err}`);
          setCronMsgType('error');
        }
      } catch (err) {
        setCronMsg(`Síťová chyba: ${err}`);
        setCronMsgType('error');
      }
      setCronLoading(false);
    } else {
      // Nový job
      setEditModal(null);
      await createCronJob(editModal.templateId, editModal.schedule);
    }
  };

  // ── Testovací email ──────────────────────────────────────────────────────
  const sendTestEmail = async () => {
    setTestEmailRunning(true);
    setTestEmailMsg('');
    try {
      const secret = process.env.NEXT_PUBLIC_MONITORING_SECRET ?? '';
      const res = await fetch('/api/monitoring/test-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTestEmailMsg(`Testovací email byl odeslán na ${data.sentTo}.`);
        setTestEmailType('ok');
      } else {
        setTestEmailMsg(data.error ?? `Chyba ${res.status}`);
        setTestEmailType('error');
      }
    } catch (err) {
      setTestEmailMsg(`Síťová chyba: ${err}`);
      setTestEmailType('error');
    }
    setTestEmailRunning(false);
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

        {/* ── Sekce: Nastavení ────────────────────────────────────────────── */}
        <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Nastavení automatizace
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Správa naplánovaných úloh a emailových alertů přes cron-job.org
            </p>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>

            {/* ── Cron joby ─────────────────────────────────────────────── */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Naplánované úlohy (cron-job.org)
                </h3>
                <button
                  onClick={() => { fetchCronJobs(); fetchSettings(); }}
                  disabled={cronLoading || settingsLoading}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
                >
                  Obnovit
                </button>
              </div>

              {/* Stav API klíče */}
              {settingsLoading ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Načítám...</p>
              ) : settings && !settings.cronJobApiConfigured ? (
                <div className="rounded-lg px-3 py-2.5 mb-4 text-xs" style={{ background: '#f59e0b18', border: '1px solid #f59e0b44', color: '#b45309' }}>
                  <strong>CRON_JOB_API_KEY</strong> není nastaven v env proměnných. Nastavte ho pro správu cron jobů z tohoto rozhraní.
                </div>
              ) : null}

              {cronMsg && (
                <div className={`rounded-lg px-3 py-2 mb-3 text-xs`} style={{
                  background: cronMsgType === 'ok' ? '#22c55e18' : '#ef444418',
                  border: `1px solid ${cronMsgType === 'ok' ? '#22c55e44' : '#ef444444'}`,
                  color: cronMsgType === 'ok' ? '#166534' : '#b91c1c',
                }}>
                  {cronMsg}
                </div>
              )}

              {/* Šablony */}
              <div className="space-y-3">
                {MONITORING_CRON_TEMPLATES.map((tmpl) => {
                  const existingJob = cronJobs.find(j =>
                    j.url?.includes(tmpl.urlPath),
                  );

                  return (
                    <div key={tmpl.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                      <div className="flex flex-wrap items-start gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {tmpl.title.replace('Trackino – ', '')}
                            </span>
                            {existingJob ? (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  background: existingJob.enabled ? '#22c55e18' : '#6b728018',
                                  color: existingJob.enabled ? '#166534' : '#6b7280',
                                }}
                              >
                                {existingJob.enabled ? 'Aktivní' : 'Pozastaveno'}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#f59e0b18', color: '#b45309' }}>
                                Není nastaven
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {tmpl.description}
                          </p>
                          {existingJob && (
                            <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                              Rozvrh: {scheduleToLabel(existingJob.schedule)}
                            </p>
                          )}
                          {!existingJob && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                              Výchozí rozvrh: {tmpl.defaultLabel}
                            </p>
                          )}
                        </div>

                        {/* Akce */}
                        <div className="flex gap-2 flex-shrink-0">
                          {existingJob ? (
                            <>
                              {/* Editace rozvrhu */}
                              <button
                                onClick={() => setEditModal({
                                  jobId: existingJob.jobId,
                                  templateId: tmpl.id,
                                  schedule: { ...existingJob.schedule },
                                })}
                                disabled={cronLoading || !settings?.cronJobApiConfigured}
                                className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                                title="Upravit rozvrh"
                              >
                                Rozvrh
                              </button>
                              {/* Toggle enable/disable */}
                              <button
                                onClick={() => toggleCronJob(existingJob.jobId, !existingJob.enabled)}
                                disabled={cronLoading || !settings?.cronJobApiConfigured}
                                className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
                              >
                                {existingJob.enabled ? 'Pozastavit' : 'Aktivovat'}
                              </button>
                              {/* Smazat */}
                              <button
                                onClick={() => deleteCronJob(existingJob.jobId)}
                                disabled={cronLoading || !settings?.cronJobApiConfigured}
                                className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                                style={{ borderColor: '#ef444440', color: '#ef4444', background: 'var(--bg-card)' }}
                              >
                                Smazat
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Vytvořit s výchozím rozvrhem */}
                              <button
                                onClick={() => setEditModal({
                                  templateId: tmpl.id,
                                  schedule: { ...tmpl.defaultSchedule },
                                })}
                                disabled={cronLoading || !settings?.cronJobApiConfigured}
                                className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity disabled:opacity-40"
                                style={{ background: 'var(--primary)' }}
                              >
                                Nastavit
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Email nastavení ───────────────────────────────────────── */}
            <div className="px-4 py-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                Email (Resend API)
              </h3>

              {settingsLoading ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Načítám...</p>
              ) : settings ? (
                <div className="space-y-3">
                  {/* Status řádky */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* RESEND_API_KEY */}
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                      <div>
                        <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>RESEND_API_KEY</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Odesílatel: {settings.resendFrom}
                        </div>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: settings.resendConfigured ? '#22c55e18' : '#ef444418',
                          color: settings.resendConfigured ? '#166534' : '#b91c1c',
                        }}
                      >
                        {settings.resendConfigured ? 'Nastaven' : 'Chybí'}
                      </span>
                    </div>

                    {/* Alert email příjemce */}
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Příjemce alertů</div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {settings.alertEmail || '–'}
                        </div>
                      </div>
                      <span
                        className="text-xs ml-2 px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: settings.alertEmailSource === 'none' ? '#ef444418' : '#22c55e18',
                          color: settings.alertEmailSource === 'none' ? '#b91c1c' : '#166534',
                        }}
                      >
                        {settings.alertEmailSource === 'env' ? 'ALERT_EMAIL' :
                         settings.alertEmailSource === 'master_admin' ? 'Master Admin' : 'Nenastaven'}
                      </span>
                    </div>
                  </div>

                  {/* Varování: neověřená odesílatelská doména */}
                  {settings.resendConfigured && settings.resendFrom && !settings.resendFrom.endsWith('@resend.dev') && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ background: '#f59e0b18', border: '1px solid #f59e0b44', color: '#92400e' }}>
                      <svg className="flex-shrink-0 mt-0.5" width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>
                        Odesílatelská doména <strong>{settings.resendFrom.split('@')[1]}</strong> musí být ověřena v Resend.{' '}
                        <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                          Ověřit doménu →
                        </a>
                        {' '}nebo nastavte <code className="px-1 rounded" style={{ background: '#f59e0b22' }}>MONITORING_EMAIL_FROM=onboarding@resend.dev</code> pro testování.
                      </span>
                    </div>
                  )}

                  {/* Anti-spam info */}
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                    Anti-spam: stejný typ alertu se odesílá max. 1× za 4 hodiny. Alerty se ukládají do DB i bez Resend API.
                  </div>

                  {/* Testovací email */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={sendTestEmail}
                      disabled={testEmailRunning || !settings.resendConfigured || settings.alertEmailSource === 'none'}
                      className="text-sm px-4 py-2 rounded-lg font-medium text-white transition-opacity disabled:opacity-40"
                      style={{ background: 'var(--primary)' }}
                      title={!settings.resendConfigured ? 'RESEND_API_KEY není nastaven' : settings.alertEmailSource === 'none' ? 'Žádný příjemce' : 'Odeslat testovací email'}
                    >
                      {testEmailRunning ? 'Odesílám...' : 'Odeslat testovací email'}
                    </button>
                    {testEmailMsg && (
                      <span
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{
                          background: testEmailType === 'ok' ? '#22c55e18' : '#ef444418',
                          color: testEmailType === 'ok' ? '#166534' : '#b91c1c',
                        }}
                      >
                        {testEmailMsg}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        </div>

        {/* ── Modal: editace rozvrhu ─────────────────────────────────────────── */}
        {editModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditModal(null); }}
          >
            <div className="rounded-xl border w-full max-w-md shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editModal.jobId !== undefined ? 'Upravit rozvrh' : 'Nastavit cron job'}
                </h3>
                <button onClick={() => setEditModal(null)} className="text-lg leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Hodina + Minuta vedle sebe */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Hodina</label>
                    <select
                      value={editModal.schedule.hours[0] ?? 3}
                      onChange={e => setEditModal(m => m && ({ ...m, schedule: { ...m.schedule, hours: [parseInt(e.target.value)] } }))}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={inputStyle}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:xx</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Minuta</label>
                    <select
                      value={editModal.schedule.minutes[0] ?? 0}
                      onChange={e => setEditModal(m => m && ({ ...m, schedule: { ...m.schedule, minutes: [parseInt(e.target.value)] } }))}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={inputStyle}
                    >
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(v => (
                        <option key={v} value={v}>:{String(v).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Dny v týdnu */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Dny v týdnu</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['–1 každý', '0 Ne', '1 Po', '2 Út', '3 St', '4 Čt', '5 Pá', '6 So'] as const).map((item) => {
                      const val = parseInt(item.toString().split(' ')[0]);
                      const label = item.toString().split(' ').slice(1).join(' ') || 'Každý';
                      const isEvery = editModal.schedule.wdays.includes(-1);
                      const isSelected = val === -1 ? isEvery : (!isEvery && editModal.schedule.wdays.includes(val));
                      return (
                        <button
                          key={val}
                          onClick={() => {
                            if (val === -1) {
                              setEditModal(m => m && ({ ...m, schedule: { ...m.schedule, wdays: [-1] } }));
                            } else {
                              setEditModal(m => {
                                if (!m) return m;
                                const cur = m.schedule.wdays.filter(d => d !== -1);
                                const next = cur.includes(val) ? cur.filter(d => d !== val) : [...cur, val];
                                return { ...m, schedule: { ...m.schedule, wdays: next.length === 0 ? [-1] : next } };
                              });
                            }
                          }}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                          style={{
                            background: isSelected ? 'var(--primary)' : 'var(--bg-hover)',
                            color: isSelected ? 'white' : 'var(--text-secondary)',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          }}
                        >
                          {val === -1 ? 'Každý den' : label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Náhled */}
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                  Spustí se: <strong style={{ color: 'var(--text-primary)' }}>{scheduleToLabel(editModal.schedule)}</strong>
                </div>
              </div>
              <div className="px-5 py-3 border-t flex gap-2 justify-end" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setEditModal(null)}
                  className="text-sm px-4 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveEditSchedule}
                  disabled={cronLoading}
                  className="text-sm px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {editModal.jobId !== undefined ? 'Uložit' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spodní padding */}
        <div className="h-4" />
      </div>
    </DashboardLayout>
  );
}

export default function MonitoringPage() {
  return (
    <WorkspaceProvider>
      <MonitoringContent />
    </WorkspaceProvider>
  );
}
