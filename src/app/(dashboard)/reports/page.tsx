'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { splitAtMidnight } from '@/lib/midnight-split';
import type { TimeEntry, Project, Category, Task, MemberRate } from '@/types/database';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateGroup(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Dnes', value: 'today' },
  { label: 'Tento týden', value: 'week' },
  { label: 'Tento měsíc', value: 'month' },
  { label: 'Vlastní', value: 'custom' },
];

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1); // Po
    return { from: isoDate(d), to: today };
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  return { from: today, to: today };
}

// ── SelectWrap – custom arrow ─────────────────────────────────────────────────

function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

// ── ReportsContent ────────────────────────────────────────────────────────────

interface MemberProfile {
  member_id: string; // workspace_member id (pro párování sazeb)
  user_id: string;
  display_name: string;
  email: string;
}

function ReportsContent() {
  const { user } = useAuth();
  const { currentWorkspace, isManagerOf } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin, canManualEntry } = usePermissions();

  // Filtry
  const [preset, setPreset] = useState<DatePreset>('week');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [userFilter, setUserFilter] = useState<string>('me');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(false);
  // Sazby (klíč = workspace_member.id)
  const [ratesByMemberId, setRatesByMemberId] = useState<Record<string, MemberRate[]>>({});
  const [userToMemberId, setUserToMemberId] = useState<Record<string, string>>({});

  // Ruční zadání
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(isoDate(new Date()));
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('10:00');
  const [manualProject, setManualProject] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualTask, setManualTask] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualForUser, setManualForUser] = useState('me');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');

  // Poznámky
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const canSeeOthers = isWorkspaceAdmin || isManager;
  const canManageNotes = isMasterAdmin || isWorkspaceAdmin || isManager;

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPresetRange(preset);

  // Načtení členů workspace + jejich sazeb
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace || !user) return;

    if (canSeeOthers) {
      // Admin/manager: načíst všechny členy a jejich sazby
      const { data: memberRows } = await supabase
        .from('trackino_workspace_members')
        .select('id, user_id')
        .eq('workspace_id', currentWorkspace.id);

      const rawMembers = (memberRows ?? []) as { id: string; user_id: string }[];
      const userIds = rawMembers.map(m => m.user_id);
      if (userIds.length === 0) return;

      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      const memberList: MemberProfile[] = (profiles ?? []).map((p: { id: string; display_name: string; email: string }) => {
        const row = rawMembers.find(r => r.user_id === p.id);
        return {
          member_id: row?.id ?? '',
          user_id: p.id,
          display_name: p.display_name || p.email,
          email: p.email,
        };
      });

      const filtered = (isManager && !isWorkspaceAdmin)
        ? memberList.filter(m => m.user_id === user.id || isManagerOf(m.user_id))
        : memberList;

      setMembers(filtered);

      const memberDbIds = memberList.map(m => m.member_id).filter(Boolean);
      if (memberDbIds.length > 0) {
        const { data: rates } = await supabase
          .from('trackino_member_rates')
          .select('*')
          .in('workspace_member_id', memberDbIds);

        const rMap: Record<string, MemberRate[]> = {};
        (rates ?? []).forEach((r: MemberRate) => {
          if (!rMap[r.workspace_member_id]) rMap[r.workspace_member_id] = [];
          rMap[r.workspace_member_id].push(r);
        });
        setRatesByMemberId(rMap);
      }

      const idMap: Record<string, string> = {};
      memberList.forEach(m => { if (m.member_id) idMap[m.user_id] = m.member_id; });
      setUserToMemberId(idMap);
    } else {
      // Běžný člen: načíst jen vlastní sazby pro výpočet nákladů
      const { data: ownRow } = await supabase
        .from('trackino_workspace_members')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .single();

      if (ownRow) {
        const { data: rates } = await supabase
          .from('trackino_member_rates')
          .select('*')
          .eq('workspace_member_id', ownRow.id);

        const rMap: Record<string, MemberRate[]> = {};
        rMap[ownRow.id] = (rates ?? []) as MemberRate[];
        setRatesByMemberId(rMap);
        setUserToMemberId({ [user.id]: ownRow.id });
      }
    }
  }, [currentWorkspace, canSeeOthers, isManager, isWorkspaceAdmin, user, isManagerOf]);

  // Načtení projektů
  const fetchProjects = useCallback(async () => {
    if (!currentWorkspace) return;
    const [pRes, cRes, tRes] = await Promise.all([
      supabase.from('trackino_projects').select('*').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
    ]);
    setProjects((pRes.data ?? []) as Project[]);
    setCategories((cRes.data ?? []) as Category[]);
    setTasks((tRes.data ?? []) as Task[]);
  }, [currentWorkspace]);

  // Načtení záznamů
  const fetchEntries = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    const fromDt = `${from}T00:00:00.000Z`;
    const toDt = `${to}T23:59:59.999Z`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('trackino_time_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .gte('start_time', fromDt)
      .lte('start_time', toDt)
      .eq('is_running', false)
      .order('start_time', { ascending: false });

    // User filter
    if (userFilter === 'me' || !canSeeOthers) {
      query = query.eq('user_id', user.id);
    } else if (userFilter !== 'all') {
      query = query.eq('user_id', userFilter);
    }

    // Project filter
    if (projectFilter !== 'all') {
      query = query.eq('project_id', projectFilter);
    }

    const { data } = await query;
    setEntries((data ?? []) as TimeEntry[]);
    setLoading(false);
  }, [currentWorkspace, user, from, to, userFilter, projectFilter, canSeeOthers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Skupiny dle dne – lokální čas (ne UTC), aby záznamy padaly do správného dne
  const groupedEntries = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const _d = new Date(e.start_time);
    const day = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(groupedEntries).sort().reverse();

  const totalSeconds = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

  // Hodinová sazba platná k danému datu pro daného uživatele
  const getRateForEntry = (userId: string, entryDate: string): number | null => {
    const memberId = userToMemberId[userId];
    if (!memberId) return null;
    const rates = ratesByMemberId[memberId] ?? [];
    const match = rates
      .filter(r => r.valid_from <= entryDate && (r.valid_to === null || r.valid_to >= entryDate))
      .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
    return match?.hourly_rate ?? null;
  };

  const totalCost = entries.reduce((sum, e) => {
    if (!e.duration) return sum;
    const _cd = new Date(e.start_time);
    const costDay = `${_cd.getFullYear()}-${String(_cd.getMonth() + 1).padStart(2, '0')}-${String(_cd.getDate()).padStart(2, '0')}`;
    const rate = getRateForEntry(e.user_id, costDay);
    return rate !== null ? sum + (e.duration / 3600) * rate : sum;
  }, 0);

  const hasCosts = totalCost > 0;

  // Per-uživatelský přehled (hodiny + náklady)
  const perUserStats = canSeeOthers
    ? Object.values(
        entries.reduce<Record<string, { userId: string; seconds: number; cost: number }>>((acc, e) => {
          if (!acc[e.user_id]) acc[e.user_id] = { userId: e.user_id, seconds: 0, cost: 0 };
          acc[e.user_id].seconds += e.duration ?? 0;
          if (e.duration) {
            const _pd = new Date(e.start_time);
            const perDay = `${_pd.getFullYear()}-${String(_pd.getMonth() + 1).padStart(2, '0')}-${String(_pd.getDate()).padStart(2, '0')}`;
            const rate = getRateForEntry(e.user_id, perDay);
            if (rate !== null) acc[e.user_id].cost += (e.duration / 3600) * rate;
          }
          return acc;
        }, {})
      ).sort((a, b) => b.seconds - a.seconds)
    : [];

  const currencySymbol = currentWorkspace?.currency === 'EUR' ? '€' : currentWorkspace?.currency === 'USD' ? '$' : 'Kč';

  function fmtCost(amount: number): string {
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }

  // Manuální zadání
  const saveManual = async () => {
    if (!user || !currentWorkspace) return;
    setManualError('');

    const startDt = new Date(`${manualDate}T${manualStart}:00`);
    const endDt = new Date(`${manualDate}T${manualEnd}:00`);

    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
      setManualError('Neplatný datum nebo čas.'); return;
    }
    if (endDt <= startDt) {
      setManualError('Čas konce musí být po čase začátku.'); return;
    }

    const targetUserId = (canManualEntry && canSeeOthers && manualForUser !== 'me') ? manualForUser : user.id;

    setManualSaving(true);
    const segments = splitAtMidnight(startDt, endDt);

    for (const seg of segments) {
      const dur = Math.round((seg.end.getTime() - seg.start.getTime()) / 1000);
      await supabase.from('trackino_time_entries').insert({
        workspace_id: currentWorkspace.id,
        user_id: targetUserId,
        project_id: manualProject || null,
        category_id: manualCategory || null,
        task_id: manualTask || null,
        description: manualDesc,
        start_time: seg.start.toISOString(),
        end_time: seg.end.toISOString(),
        duration: dur,
        is_running: false,
        manager_note: '',
      });
    }

    // Reset formuláře
    setManualDesc('');
    setManualProject('');
    setManualCategory('');
    setManualTask('');
    setManualSaving(false);
    setShowManual(false);
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Smazat záznam?')) return;
    await supabase.from('trackino_time_entries').delete().eq('id', id);
    fetchEntries();
  };

  const saveNote = async (entryId: string) => {
    setSavingNoteId(entryId);
    await supabase
      .from('trackino_time_entries')
      .update({ manager_note: noteText.trim() })
      .eq('id', entryId);
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, manager_note: noteText.trim() } : e
    ));
    setSavingNoteId(null);
    setEditingNoteId(null);
  };

  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? null;
  const taskName = (id: string | null) => tasks.find(t => t.id === id)?.name ?? null;
  const memberName = (userId: string) => members.find(m => m.user_id === userId)?.display_name ?? '—';

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">
        {/* Záhlaví */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reporty</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Přehled odpracovaného času s filtry a ručním zadáváním
            </p>
          </div>
          {canManualEntry && (
            <button
              onClick={() => setShowManual(!showManual)}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{ background: 'var(--primary)', color: 'white' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Přidat záznam
            </button>
          )}
        </div>

        {/* Formulář ručního zadání */}
        {showManual && canManualEntry && (
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ruční zadání záznamu</h2>
              <button onClick={() => setShowManual(false)} style={{ color: 'var(--text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Datum</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Začátek</label>
                <input
                  type="time"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] tabular-nums"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Konec</label>
                <input
                  type="time"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] tabular-nums"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Projekt</label>
                <SelectWrap>
                  <select
                    value={manualProject}
                    onChange={(e) => setManualProject(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    <option value="">— Bez projektu —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </SelectWrap>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategorie</label>
                <SelectWrap>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    <option value="">— Bez kategorie —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </SelectWrap>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Úkol</label>
                <SelectWrap>
                  <select
                    value={manualTask}
                    onChange={(e) => setManualTask(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    <option value="">— Bez úkolu —</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </SelectWrap>
              </div>
              {canSeeOthers && members.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Zadat za uživatele</label>
                  <SelectWrap>
                    <select
                      value={manualForUser}
                      onChange={(e) => setManualForUser(e.target.value)}
                      className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      <option value="me">Já (vlastní záznam)</option>
                      {members.filter(m => m.user_id !== user?.id).map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                      ))}
                    </select>
                  </SelectWrap>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Popis (volitelné)</label>
              <input
                type="text"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveManual(); }}
                placeholder="Co jste dělali?"
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              />
            </div>

            {manualError && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{manualError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowManual(false)}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={saveManual}
                disabled={manualSaving}
                className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {manualSaving ? 'Ukládám...' : 'Přidat záznam'}
              </button>
            </div>
          </div>
        )}

        {/* Filtry */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Časové období */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Období</label>
              <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-hover)' }}>
                {PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPreset(p.value)}
                    className="px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                    style={{
                      background: preset === p.value ? 'var(--bg-card)' : 'transparent',
                      color: preset === p.value ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: preset === p.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {p.value === 'week' ? (
                      <><span className="hidden sm:inline">Tento </span>týden</>
                    ) : p.value === 'month' ? (
                      <><span className="hidden sm:inline">Tento </span>měsíc</>
                    ) : p.label}
                  </button>
                ))}
              </div>
            </div>

            {preset === 'custom' && (
              <div className="w-full grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Od</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Do</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* User filter */}
            {canSeeOthers && members.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Uživatel</label>
                <SelectWrap>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                  >
                    <option value="me">Já</option>
                    <option value="all">Všichni</option>
                    {members.filter(m => m.user_id !== user?.id).map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                    ))}
                  </select>
                </SelectWrap>
              </div>
            )}

            {/* Project filter */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Projekt</label>
              <SelectWrap>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                >
                  <option value="all">Všechny projekty</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </SelectWrap>
            </div>
          </div>
        </div>

        {/* Souhrn */}
        <div className={`grid gap-4 ${hasCosts ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Celkem odpracováno</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {fmtDuration(totalSeconds)}
            </div>
          </div>
          {hasCosts && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Výdělek</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>
                {fmtCost(totalCost)} {currencySymbol}
              </div>
            </div>
          )}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Počet záznamů</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {entries.length}
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Průměr / den</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {sortedDays.length > 0 ? fmtDuration(Math.round(totalSeconds / sortedDays.length)) : '0:00'}
            </div>
          </div>
        </div>

        {/* Per-uživatelský přehled nákladů */}
        {canSeeOthers && !loading && perUserStats.length > 1 && (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přehled per uživatel</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {perUserStats.map(stat => {
                const name = memberName(stat.userId);
                return (
                  <div key={stat.userId} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</div>
                    <div className="text-sm tabular-nums font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDuration(stat.seconds)}
                    </div>
                    {stat.cost > 0 && (
                      <div className="text-sm tabular-nums font-semibold" style={{ color: 'var(--primary)', minWidth: '80px', textAlign: 'right' }}>
                        {fmtCost(stat.cost)} {currencySymbol}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Záznamy */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-sm">Žádné záznamy pro vybrané období</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDays.map(day => {
              const dayEntries = groupedEntries[day];
              const dayTotal = dayEntries.reduce((s, e) => s + (e.duration ?? 0), 0);
              return (
                <div key={day} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDateGroup(day + 'T12:00:00')}
                    </span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {fmtDuration(dayTotal)}
                    </span>
                  </div>
                  <div className="entry-divider">
                    {dayEntries.map(entry => {
                      const cat = categoryName(entry.category_id);
                      const task = taskName(entry.task_id);
                      const proj = projects.find(p => p.id === entry.project_id);
                      return (
                        <div key={entry.id} className="px-4 py-3">
                          <div className="flex gap-3">
                            {/* Barevný pruh projektu */}
                            <div
                              className="w-1 rounded-full flex-shrink-0 self-stretch"
                              style={{ background: proj?.color ?? 'var(--border)', minHeight: '20px' }}
                            />
                            {/* Obsah – 3 řádky */}
                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                              {/* Řádek 1: Název */}
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {entry.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                              </div>

                              {/* Řádek 2: Projekt / Kategorie / Úkol / Uživatel */}
                              {(proj || cat || (canSeeOthers && userFilter !== 'me')) && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {proj && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: proj.color + '22', color: proj.color }}>
                                      {proj.name}
                                    </span>
                                  )}
                                  {cat && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat}{task ? ` / ${task}` : ''}</span>
                                  )}
                                  {canSeeOthers && userFilter !== 'me' && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{memberName(entry.user_id)}</span>
                                  )}
                                </div>
                              )}

                              {/* Řádek 3: Čas, trvání a akce */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs tabular-nums flex-1" style={{ color: 'var(--text-muted)' }}>
                                  {fmtTime(entry.start_time)} – {entry.end_time ? fmtTime(entry.end_time) : '—'}
                                </span>
                                {(() => {
                                  if (!canSeeOthers || !entry.duration) return null;
                                  const _rd = new Date(entry.start_time);
                                  const rateDay = `${_rd.getFullYear()}-${String(_rd.getMonth() + 1).padStart(2, '0')}-${String(_rd.getDate()).padStart(2, '0')}`;
                                  const rate = getRateForEntry(entry.user_id, rateDay);
                                  if (rate === null) return null;
                                  const cost = (entry.duration / 3600) * rate;
                                  return (
                                    <div className="text-xs tabular-nums hidden sm:block text-right" style={{ color: 'var(--text-muted)', minWidth: '64px' }}>
                                      {fmtCost(cost)} {currencySymbol}
                                    </div>
                                  );
                                })()}
                                <div className="text-sm font-semibold tabular-nums w-16 text-right" style={{ color: 'var(--text-primary)' }}>
                                  {fmtDuration(entry.duration ?? 0)}
                                </div>
                                {/* Poznámka – jen pro manažery/adminy */}
                                {canManageNotes && (
                                  <button
                                    onClick={() => {
                                      if (editingNoteId === entry.id) {
                                        setEditingNoteId(null);
                                      } else {
                                        setEditingNoteId(entry.id);
                                        setNoteText(entry.manager_note || '');
                                      }
                                    }}
                                    title={entry.manager_note ? 'Upravit poznámku' : 'Přidat poznámku'}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: entry.manager_note ? '#d97706' : 'var(--text-muted)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#d97706'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = entry.manager_note ? '#d97706' : 'var(--text-muted)'; }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                )}
                                {/* Smazat */}
                                {(canManageNotes || entry.user_id === user?.id) && (
                                  <button
                                    onClick={() => deleteEntry(entry.id)}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                                    title="Smazat"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6" /><path d="M14 11v6" />
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Zobrazení existující poznámky (mimo editaci) */}
                          {canManageNotes && entry.manager_note && editingNoteId !== entry.id && (
                            <div
                              className="text-xs px-2.5 py-1.5 rounded-md cursor-pointer flex items-start gap-1.5 ml-4"
                              style={{ background: '#f59e0b18', color: '#b45309' }}
                              onClick={() => { setEditingNoteId(entry.id); setNoteText(entry.manager_note || ''); }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>{entry.manager_note}</span>
                            </div>
                          )}

                          {/* Editace poznámky */}
                          {canManageNotes && editingNoteId === entry.id && (
                            <div className="flex gap-2 ml-4">
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(entry.id); }
                                  if (e.key === 'Escape') setEditingNoteId(null);
                                }}
                                autoFocus
                                placeholder="Interní poznámka manažera… (Enter = uložit, Shift+Enter = nový řádek)"
                                rows={2}
                                className="flex-1 px-2.5 py-1.5 rounded-md border text-base sm:text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                                style={{ borderColor: '#f59e0b50', background: '#f59e0b08', color: 'var(--text-primary)' }}
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => saveNote(entry.id)}
                                  disabled={savingNoteId === entry.id}
                                  className="px-2.5 py-1 rounded-md text-xs font-medium text-white disabled:opacity-50"
                                  style={{ background: 'var(--primary)' }}
                                >
                                  {savingNoteId === entry.id ? '…' : '✓'}
                                </button>
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-2.5 py-1 rounded-md text-xs"
                                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <ReportsContent />
    </WorkspaceProvider>
  );
}
