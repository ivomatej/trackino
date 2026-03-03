'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { VacationEntry, VacationAllowance, Profile } from '@/types/database';

interface VacationEntryWithProfile extends VacationEntry {
  profile?: Profile;
}

function VacationContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership } = useWorkspace();
  const { isWorkspaceAdmin } = usePermissions();

  const [entries, setEntries] = useState<VacationEntryWithProfile[]>([]);
  const [allowance, setAllowance] = useState<VacationAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filtr uživatele (admins vidí vše)
  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  // Formulář
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formUserId, setFormUserId] = useState('');

  const currentYear = new Date().getFullYear();

  // Výpočet pracovních dnů (pondělí–pátek)
  function calcWorkDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  const computedDays = formStartDate && formEndDate ? calcWorkDays(formStartDate, formEndDate) : 0;

  // ─── Sync: Dovolená → Plánovač ─────────────────────────────────────────────

  const syncVacationToPlanner = async (startDate: string, endDate: string, userId: string, workspaceId: string) => {
    // Najdi stav "Dovolená" v Plánovači
    const { data: statuses } = await supabase
      .from('trackino_availability_statuses')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    const vs = (statuses ?? []).find((s: { id: string; name: string }) =>
      s.name.trim().toLowerCase() === 'dovolená'
    );
    if (!vs) return; // Stav "Dovolená" v Plánovači neexistuje, přeskočit

    // Sestav seznam všech dnů v rozsahu (včetně víkendů – Plánovač je zobrazuje)
    const dates: string[] = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    if (dates.length === 0) return;

    // Upsert availability pro každý den
    await supabase.from('trackino_availability').upsert(
      dates.map(date => ({
        workspace_id: workspaceId,
        user_id: userId,
        date,
        half: 'full',
        status_id: vs.id,
        note: '',
      })),
      { onConflict: 'workspace_id,user_id,date,half' }
    );
  };

  const removeVacationFromPlanner = async (startDate: string, endDate: string, userId: string, workspaceId: string) => {
    // Najdi stav "Dovolená" v Plánovači
    const { data: statuses } = await supabase
      .from('trackino_availability_statuses')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    const vs = (statuses ?? []).find((s: { id: string; name: string }) =>
      s.name.trim().toLowerCase() === 'dovolená'
    );
    if (!vs) return;

    // Smaž availability záznamy kde status = Dovolená a half = full pro dané dny
    await supabase.from('trackino_availability')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status_id', vs.id)
      .eq('half', 'full')
      .gte('date', startDate)
      .lte('date', endDate);
  };

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    // Načíst dovolenou pro aktuální rok
    const { data: allowData } = await supabase
      .from('trackino_vacation_allowances')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('year', currentYear)
      .maybeSingle();
    setAllowance(allowData as VacationAllowance | null);

    // Načíst záznamy dovolené
    let query = supabase
      .from('trackino_vacation_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .gte('start_date', `${currentYear}-01-01`)
      .lte('end_date', `${currentYear}-12-31`)
      .order('start_date', { ascending: false });

    if (!isWorkspaceAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data: entriesData } = await query;
    const allEntries = (entriesData ?? []) as VacationEntry[];

    // Načíst profily pro adminy
    if (isWorkspaceAdmin && allEntries.length > 0) {
      const userIds = [...new Set(allEntries.map(e => e.user_id))];
      const { data: profilesData } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', userIds);
      const profileMap: Record<string, Profile> = {};
      (profilesData ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
      setEntries(allEntries.map(e => ({ ...e, profile: profileMap[e.user_id] })));

      // Profily pro filtr
      const { data: membersData } = await supabase
        .from('trackino_workspace_members')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('approved', true)
        .eq('can_use_vacation', true);
      const memberUserIds = (membersData ?? []).map((m: { user_id: string }) => m.user_id);
      if (memberUserIds.length > 0) {
        const { data: allProfilesData } = await supabase
          .from('trackino_profiles')
          .select('*')
          .in('id', memberUserIds);
        setAllProfiles((allProfilesData ?? []) as Profile[]);
      }
    } else {
      setEntries(allEntries.map(e => ({ ...e })));
      setAllProfiles([]);
    }

    setFormUserId(user.id);
    setLoading(false);
  }, [currentWorkspace, user, isWorkspaceAdmin, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addEntry = async () => {
    if (!currentWorkspace || !user || !formStartDate || !formEndDate || computedDays === 0) return;
    setSaving(true);
    const targetUserId = (isWorkspaceAdmin && formUserId && formUserId !== user.id) ? formUserId : user.id;
    await supabase.from('trackino_vacation_entries').insert({
      workspace_id: currentWorkspace.id,
      user_id: targetUserId,
      start_date: formStartDate,
      end_date: formEndDate,
      days: computedDays,
      note: formNote.trim(),
    });
    // Sync do Plánovače: nastav stav "Dovolená" pro všechny dny v rozsahu
    await syncVacationToPlanner(formStartDate, formEndDate, targetUserId, currentWorkspace.id);
    setFormStartDate('');
    setFormEndDate('');
    setFormNote('');
    setShowForm(false);
    setSaving(false);
    fetchData();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Opravdu smazat tento záznam dovolené?')) return;
    // Najdi záznam před smazáním (potřebujeme start_date, end_date, user_id pro sync)
    const entry = entries.find(e => e.id === id);
    await supabase.from('trackino_vacation_entries').delete().eq('id', id);
    // Sync do Plánovače: odeber stav "Dovolená" pro dny záznamu
    if (entry && currentWorkspace) {
      await removeVacationFromPlanner(entry.start_date, entry.end_date, entry.user_id, currentWorkspace.id);
    }
    fetchData();
  };

  // Přepočítat dny dle aktuálního filtru
  const viewUserId = isWorkspaceAdmin && selectedUserId !== 'me' ? selectedUserId : (user?.id ?? '');
  const filteredEntries = selectedUserId === 'all' && isWorkspaceAdmin
    ? entries
    : entries.filter(e => e.user_id === viewUserId);

  const usedDays = filteredEntries.reduce((sum, e) => sum + (e.days ?? 0), 0);
  const totalDays = allowance?.days_per_year ?? null;
  const remainingDays = totalDays !== null ? totalDays - usedDays : null;

  const canUseVacation = currentMembership?.can_use_vacation ?? false;

  if (!canUseVacation && !isWorkspaceAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Dovolená</h1>
          <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              Nemáte nastaven nárok na dovolenou. Kontaktujte administrátora workspace.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${parseInt(day)}.${parseInt(m)}.${y}`;
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        {/* Hlavička */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dovolená</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Přehled dovolené za rok {currentYear}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Filtr uživatele – jen pro adminy */}
            {isWorkspaceAdmin && allProfiles.length > 0 && (
              <div className="relative">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="pl-3 pr-8 py-2 rounded-lg border text-sm appearance-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="me">Moje dovolená</option>
                  <option value="all">Všichni</option>
                  {allProfiles.filter(p => p.id !== user?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--primary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Přidat dovolenou
            </button>
          </div>
        </div>

        {/* Statistiky */}
        {selectedUserId !== 'all' && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border px-4 py-4 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>{usedDays}</div>
              <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Čerpáno</div>
            </div>
            <div className="rounded-xl border px-4 py-4 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold tabular-nums" style={{ color: remainingDays !== null && remainingDays < 0 ? 'var(--danger)' : 'var(--success, #16a34a)' }}>
                {remainingDays !== null ? remainingDays : '—'}
              </div>
              <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Zbývá</div>
            </div>
            <div className="rounded-xl border px-4 py-4 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {totalDays ?? '—'}
              </div>
              <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Celkový nárok</div>
            </div>
          </div>
        )}

        {totalDays === null && selectedUserId !== 'all' && (
          <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: '#f59e0b', background: '#fffbeb', color: '#92400e' }}>
            Pro rok {currentYear} není nastaven celkový nárok dovolené.
            {isWorkspaceAdmin && <> Nastavte ho v <a href="/settings" className="underline font-medium">Nastavení → Dovolené</a>.</>}
          </div>
        )}

        {/* Formulář přidání */}
        {showForm && (
          <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat dovolenou</h3>

            {/* Výběr uživatele – jen pro adminy */}
            {isWorkspaceAdmin && allProfiles.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Uživatel</label>
                <div className="relative">
                  <select
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className={inputCls + ' pr-8 appearance-none cursor-pointer'}
                    style={inputStyle}
                  >
                    <option value={user?.id ?? ''}>Já ({allProfiles.find(p => p.id === user?.id)?.display_name ?? 'Já'})</option>
                    {allProfiles.filter(p => p.id !== user?.id).map(p => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum od</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum do</label>
                <input
                  type="date"
                  value={formEndDate}
                  min={formStartDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {computedDays > 0 && (
              <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                Pracovních dní: <strong style={{ color: 'var(--text-primary)' }}>{computedDays}</strong>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Poznámka (volitelně)</label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="např. Dovolená v Chorvatsku"
                className={inputCls}
                style={inputStyle}
                onKeyDown={(e) => { if (e.key === 'Enter') addEntry(); if (e.key === 'Escape') setShowForm(false); }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setFormStartDate(''); setFormEndDate(''); setFormNote(''); }}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={addEntry}
                disabled={saving || !formStartDate || !formEndDate || computedDays === 0}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {saving ? 'Ukládám...' : 'Přidat'}
              </button>
            </div>
          </div>
        )}

        {/* Seznam záznamů */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div
            className="rounded-xl border px-6 py-12 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Žádné záznamy dovolené pro rok {currentYear}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {/* Hlavička tabulky */}
            <div
              className="grid gap-4 px-4 py-2.5 border-b text-xs font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', gridTemplateColumns: isWorkspaceAdmin ? '1fr auto auto auto auto' : '1fr auto auto auto' }}
            >
              {isWorkspaceAdmin && <span>Uživatel</span>}
              <span>Od</span>
              <span>Do</span>
              <span>Dní</span>
              <span>Poznámka</span>
              <span></span>
            </div>
            {filteredEntries.map(entry => (
              <div
                key={entry.id}
                className="grid gap-4 px-4 py-3 border-b last:border-b-0 items-center group transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  gridTemplateColumns: isWorkspaceAdmin && selectedUserId === 'all' ? '1fr auto auto auto auto auto' : 'auto auto auto auto auto',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {isWorkspaceAdmin && selectedUserId === 'all' && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}
                    >
                      {entry.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.profile?.display_name ?? 'Neznámý'}</span>
                  </div>
                )}
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(entry.start_date)}</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(entry.end_date)}</span>
                <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--primary)' }}>{entry.days} d</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{entry.note || '—'}</span>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  title="Smazat záznam"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function VacationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <VacationContent />
    </WorkspaceProvider>
  );
}
