'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { Category } from '@/types/database';
import { getWorkspaceToday } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatHMFull(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} h ${m} min`;
}

const COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Preset = 'today' | 'week' | 'month' | 'custom';

interface CategoryStats {
  categoryId: string | null;
  name: string;
  totalSeconds: number;
  count: number;
  color: string;
}

// ─── Custom tooltip for PieChart ──────────────────────────────────────────────

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: CategoryStats }> }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
      <div className="font-semibold mb-0.5">{d.name}</div>
      <div>{formatHMFull(d.totalSeconds)}</div>
      <div style={{ color: 'var(--text-muted)' }}>{d.count} záznamů</div>
    </div>
  );
};

// ─── Custom tooltip for BarChart ──────────────────────────────────────────────

const BarTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryStats }> }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 shadow-lg text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
      <div className="font-semibold mb-0.5">{d.name}</div>
      <div>{formatHMFull(d.totalSeconds)}</div>
      <div style={{ color: 'var(--text-muted)' }}>{d.count} záznamů</div>
    </div>
  );
};

// ─── Main content ─────────────────────────────────────────────────────────────

function CategoryReportContent() {
  const { user } = useAuth();
  const { currentWorkspace, loading, managerAssignments } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin, isManager } = usePermissions();

  const canAdmin = isWorkspaceAdmin || isMasterAdmin;
  // Dnešní datum v timezone workspace (YYYY-MM-DD)
  const today = getWorkspaceToday(currentWorkspace?.timezone ?? 'Europe/Prague');
  const monday = toDateStr(getMonday(new Date(today + 'T12:00:00')));

  const [preset, setPreset] = useState<Preset>('week');
  const [from, setFrom] = useState(monday);
  const [to, setTo] = useState(today);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rawEntries, setRawEntries] = useState<Array<{ category_id: string | null; duration: number | null }>>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ─── Preset date ranges ────────────────────────────────────────────────────

  const applyPreset = useCallback((p: Preset) => {
    const t = getWorkspaceToday(currentWorkspace?.timezone ?? 'Europe/Prague');
    const nowDate = new Date(t + 'T12:00:00');
    if (p === 'today') {
      setFrom(t); setTo(t);
    } else if (p === 'week') {
      setFrom(toDateStr(getMonday(nowDate)));
      setTo(t);
    } else if (p === 'month') {
      const first = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
      setFrom(toDateStr(first));
      setTo(t);
    }
    setPreset(p);
  }, [currentWorkspace?.timezone]);

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoadingData(true);

    // Fetch categories
    const { data: cats } = await supabase
      .from('trackino_categories')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('name');
    setCategories((cats ?? []) as Category[]);

    // Determine visible user IDs
    let visibleUserIds: string[] | null = null; // null = all
    if (!canAdmin) {
      if (isManager) {
        const subordinateIds = managerAssignments.map(a => a.member_user_id);
        visibleUserIds = Array.from(new Set([user.id, ...subordinateIds]));
      } else {
        visibleUserIds = [user.id];
      }
    }

    // Fetch time entries
    let query = supabase
      .from('trackino_time_entries')
      .select('category_id, duration')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_running', false)
      .gte('start_time', from + 'T00:00:00')
      .lte('start_time', to + 'T23:59:59');

    if (visibleUserIds) {
      query = query.in('user_id', visibleUserIds);
    }

    const { data: entries } = await query;
    setRawEntries((entries ?? []) as Array<{ category_id: string | null; duration: number | null }>);
    setLoadingData(false);
  }, [currentWorkspace, user, from, to, canAdmin, isManager, managerAssignments]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Aggregation ──────────────────────────────────────────────────────────

  const stats = useMemo((): CategoryStats[] => {
    const map: Record<string, { totalSeconds: number; count: number }> = {};
    rawEntries.forEach(e => {
      const key = e.category_id ?? '__none__';
      if (!map[key]) map[key] = { totalSeconds: 0, count: 0 };
      map[key].totalSeconds += e.duration ?? 0;
      map[key].count += 1;
    });

    const catMap: Record<string, string> = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    return Object.entries(map)
      .map(([key, val], idx): CategoryStats => ({
        categoryId: key === '__none__' ? null : key,
        name: key === '__none__' ? 'Bez kategorie' : (catMap[key] ?? 'Neznámá'),
        totalSeconds: val.totalSeconds,
        count: val.count,
        color: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [rawEntries, categories]);

  const totalSeconds = stats.reduce((s, c) => s + c.totalSeconds, 0);
  const totalCount = stats.reduce((s, c) => s + c.count, 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentWorkspace) return <WorkspaceSelector />;

  const presets: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Dnes' },
    { key: 'week', label: 'Týden' },
    { key: 'month', label: 'Měsíc' },
    { key: 'custom', label: 'Vlastní' },
  ];

  const inputCls = 'px-3 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analýza kategorií</h1>
        </div>

        {/* Preset tabs + custom date */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
              style={{
                borderColor: preset === p.key ? 'var(--primary)' : 'var(--border)',
                background: preset === p.key ? 'var(--primary-light)' : 'var(--bg-card)',
                color: preset === p.key ? 'var(--primary)' : 'var(--text-secondary)',
              }}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={from}
                max={to}
                onChange={e => setFrom(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>–</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={e => setTo(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* Summary bar */}
        {!loadingData && stats.length > 0 && (
          <div className="flex items-center gap-6 mb-6 px-4 py-3 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Celkem odpracováno</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatHM(totalSeconds)} h</div>
            </div>
            <div className="w-px h-8" style={{ background: 'var(--border)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Záznamů</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalCount}</div>
            </div>
            <div className="w-px h-8" style={{ background: 'var(--border)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Kategorií</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.length}</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingData ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné záznamy pro vybrané období.</p>
          </div>
        ) : (
          <>
            {/* Pie + Legend row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Pie chart */}
              <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Rozložení kategorií</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={stats}
                      dataKey="totalSeconds"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={40}
                      paddingAngle={2}
                    >
                      {stats.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend / quick stats */}
              <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Kategorie</h2>
                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 256 }}>
                  {stats.map((s, idx) => {
                    const pct = totalSeconds > 0 ? Math.round((s.totalSeconds / totalSeconds) * 100) : 0;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)', minWidth: 44, textAlign: 'right' }}>{formatHM(s.totalSeconds)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Horizontal bar chart */}
            <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Odpracované hodiny dle kategorie</h2>
              <ResponsiveContainer width="100%" height={Math.max(160, stats.length * 44)}>
                <BarChart
                  data={stats}
                  layout="vertical"
                  margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickFormatter={v => formatHM(v as number)}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' as string }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12, fill: 'var(--text-primary)' as string }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="totalSeconds" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {stats.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detail table */}
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold px-4 pt-4 pb-3" style={{ color: 'var(--text-primary)' }}>Přehled kategorií</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Kategorie</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Záznamy</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Hodiny</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)', minWidth: 160 }}>Podíl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s, idx) => {
                      const pct = totalSeconds > 0 ? (s.totalSeconds / totalSeconds) * 100 : 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{s.count}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatHM(s.totalSeconds)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--bg-hover)', maxWidth: 120 }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: s.color }}
                                />
                              </div>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 36 }}>
                                {Math.round(pct)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-hover)' }}>
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Celkem</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{totalCount}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: 'var(--primary)' }}>{formatHM(totalSeconds)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>100%</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

function CategoryReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;
  return <WorkspaceProvider><CategoryReportContent /></WorkspaceProvider>;
}

export default CategoryReportPage;
