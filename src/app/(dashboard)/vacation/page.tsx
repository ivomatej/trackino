'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { VacationEntry, VacationAllowance, Profile, ManagerAssignment } from '@/types/database';

// Dovolená delší než tento počet pracovních dnů vyžaduje schválení nadřízeného.
const APPROVAL_THRESHOLD = 3;

interface VacationEntryWithProfile extends VacationEntry {
  profile?: Profile;
  reviewerProfile?: Profile;
}

type ActiveTab = 'records' | 'requests';

function VacationContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, managerAssignments } = useWorkspace();
  const { isWorkspaceAdmin, isManager } = usePermissions();

  const [entries, setEntries] = useState<VacationEntryWithProfile[]>([]);
  const [allowance, setAllowance] = useState<VacationAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');

  // Filtr uživatele (admins vidí vše)
  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  // Formulář
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formUserId, setFormUserId] = useState('');

  // Schvalování
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  // ID podřízených aktuálního managera
  const subordinateUserIds = (managerAssignments ?? [])
    .filter((a: ManagerAssignment) => a.manager_user_id === user?.id)
    .map((a: ManagerAssignment) => a.member_user_id);

  // Tab Žádosti vidí admin i manager
  const canSeeRequests = isWorkspaceAdmin || isManager;

  // Výpočet pracovních dnů (pondělí–pátek)
  function calcWorkDays(start: string, end: string): number {
    const cur = new Date(start + 'T12:00:00');
    const end_ = new Date(end + 'T12:00:00');
    if (end_ < cur) return 0;
    let count = 0;
    while (cur <= end_) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  const computedDays = formStartDate && formEndDate ? calcWorkDays(formStartDate, formEndDate) : 0;

  // ─── Sync: Dovolená → Plánovač ─────────────────────────────────────────────

  const syncVacationToPlanner = async (startDate: string, endDate: string, userId: string, workspaceId: string) => {
    const { data: statuses } = await supabase
      .from('trackino_availability_statuses')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    const vs = (statuses ?? []).find((s: { id: string; name: string }) =>
      s.name.trim().toLowerCase() === 'dovolená'
    );
    if (!vs) return;

    const dates: string[] = [];
    const cur = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    if (dates.length === 0) return;

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
    const { data: statuses } = await supabase
      .from('trackino_availability_statuses')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    const vs = (statuses ?? []).find((s: { id: string; name: string }) =>
      s.name.trim().toLowerCase() === 'dovolená'
    );
    if (!vs) return;
    await supabase.from('trackino_availability')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status_id', vs.id)
      .eq('half', 'full')
      .gte('date', startDate)
      .lte('date', endDate);
  };

  // ─── Data loading ───────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    // Fond dovolené pro aktuální rok
    const { data: allowData } = await supabase
      .from('trackino_vacation_allowances')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('year', currentYear)
      .maybeSingle();
    setAllowance(allowData as VacationAllowance | null);

    // Záznamy dovolené (všechny statusy)
    let query = supabase
      .from('trackino_vacation_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .gte('start_date', `${currentYear}-01-01`)
      .lte('end_date', `${currentYear}-12-31`)
      .order('start_date', { ascending: false });

    if (isWorkspaceAdmin) {
      // Admin vidí vše
    } else if (isManager && subordinateUserIds.length > 0) {
      query = query.in('user_id', [user.id, ...subordinateUserIds]);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data: entriesData } = await query;
    const allEntries = (entriesData ?? []) as VacationEntry[];

    // Profily uživatelů
    const userIds = [...new Set(allEntries.map(e => e.user_id))];
    const profileMap: Record<string, Profile> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', userIds);
      (profilesData ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
    }

    // Profily reviewerů
    const reviewerIds = [...new Set(allEntries.filter(e => e.reviewed_by).map(e => e.reviewed_by as string))];
    const reviewerMap: Record<string, Profile> = {};
    if (reviewerIds.length > 0) {
      const { data: reviewersData } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', reviewerIds);
      (reviewersData ?? []).forEach((p: Profile) => { reviewerMap[p.id] = p; });
    }

    setEntries(allEntries.map(e => ({
      ...e,
      profile: profileMap[e.user_id],
      reviewerProfile: e.reviewed_by ? reviewerMap[e.reviewed_by] : undefined,
    })));

    // Profily pro filtr (admin)
    if (isWorkspaceAdmin) {
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
      setAllProfiles([]);
    }

    setFormUserId(user.id);
    setLoading(false);
  }, [currentWorkspace, user, isWorkspaceAdmin, isManager, currentYear, subordinateUserIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Akce ──────────────────────────────────────────────────────────────────

  const addEntry = async () => {
    if (!currentWorkspace || !user || !formStartDate || !formEndDate || computedDays === 0) return;
    setSaving(true);
    const targetUserId = (isWorkspaceAdmin && formUserId && formUserId !== user.id) ? formUserId : user.id;
    // Admin zakládá za jiného → vždy schváleno; uživatel sám: > práh → pending
    const needsApproval = targetUserId === user.id && !isWorkspaceAdmin && computedDays > APPROVAL_THRESHOLD;
    const status = needsApproval ? 'pending' : 'approved';

    await supabase.from('trackino_vacation_entries').insert({
      workspace_id: currentWorkspace.id,
      user_id: targetUserId,
      start_date: formStartDate,
      end_date: formEndDate,
      days: computedDays,
      note: formNote.trim(),
      status,
    });

    // Sync do Plánovače jen pro schválené záznamy
    if (status === 'approved') {
      await syncVacationToPlanner(formStartDate, formEndDate, targetUserId, currentWorkspace.id);
    }

    setFormStartDate('');
    setFormEndDate('');
    setFormNote('');
    setShowForm(false);
    setSaving(false);
    fetchData();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Opravdu smazat tento záznam dovolené?')) return;
    const entry = entries.find(e => e.id === id);
    await supabase.from('trackino_vacation_entries').delete().eq('id', id);
    // Planner sync jen pro approved záznamy
    if (entry && entry.status === 'approved' && currentWorkspace) {
      await removeVacationFromPlanner(entry.start_date, entry.end_date, entry.user_id, currentWorkspace.id);
    }
    fetchData();
  };

  const approveEntry = async (id: string) => {
    if (!user || !currentWorkspace) return;
    setApproving(id);
    await supabase.from('trackino_vacation_entries').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: '',
    }).eq('id', id);
    const entry = entries.find(e => e.id === id);
    if (entry) {
      await syncVacationToPlanner(entry.start_date, entry.end_date, entry.user_id, currentWorkspace.id);
    }
    setApproving(null);
    fetchData();
  };

  const rejectEntry = async () => {
    if (!user || !rejectModal) return;
    setRejecting(true);
    await supabase.from('trackino_vacation_entries').update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: rejectModal.note.trim(),
    }).eq('id', rejectModal.id);
    setRejecting(false);
    setRejectModal(null);
    fetchData();
  };

  // ─── Computed data ──────────────────────────────────────────────────────────

  const viewUserId = isWorkspaceAdmin && selectedUserId !== 'me' ? selectedUserId : (user?.id ?? '');

  // Schválené záznamy dle filtru (pro Záznamy tab)
  const approvedEntries = selectedUserId === 'all' && isWorkspaceAdmin
    ? entries.filter(e => e.status === 'approved')
    : entries.filter(e => e.user_id === viewUserId && e.status === 'approved');

  // Vlastní čekající/zamítnuté žádosti (pro uživatele v Záznamy tabu)
  const myPendingRejectedEntries = entries.filter(
    e => e.user_id === user?.id && (e.status === 'pending' || e.status === 'rejected')
  );

  // Čekající žádosti od ostatních (pro Žádosti tab)
  const pendingRequestEntries = entries.filter(
    e => e.status === 'pending' && e.user_id !== user?.id
  );

  // Statistiky: jen schválené záznamy
  const usedDays = (selectedUserId === 'all' && isWorkspaceAdmin
    ? entries.filter(e => e.status === 'approved')
    : entries.filter(e => e.user_id === viewUserId && e.status === 'approved')
  ).reduce((sum, e) => sum + (e.days ?? 0), 0);

  const totalDays = allowance?.days_per_year ?? null;
  const remainingDays = totalDays !== null ? totalDays - usedDays : null;
  const canUseVacation = currentMembership?.can_use_vacation ?? false;

  // Vstupní stráž: bez nároku a bez admin/manager role
  if (!canUseVacation && !isWorkspaceAdmin && !isManager) {
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

  // Přidávání: admin přidává za sebe nebo jiného
  const isAddingForOther = isWorkspaceAdmin && formUserId && formUserId !== user?.id;
  const willNeedApproval = !isAddingForOther && computedDays > APPROVAL_THRESHOLD;

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
            {isWorkspaceAdmin && allProfiles.length > 0 && activeTab === 'records' && (
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
            {(canUseVacation || isWorkspaceAdmin) && activeTab === 'records' && (
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
            )}
          </div>
        </div>

        {/* Tabs: Záznamy / Žádosti */}
        {canSeeRequests && (
          <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
            {([
              { key: 'records' as ActiveTab, label: 'Záznamy' },
              { key: 'requests' as ActiveTab, label: 'Žádosti' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
                {tab.key === 'requests' && pendingRequestEntries.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
                    style={{ background: '#ef4444' }}
                  >
                    {pendingRequestEntries.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* Tab: Záznamy                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'records' && (
          <>
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
                    <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum do</label>
                    <input type="date" value={formEndDate} min={formStartDate} onChange={(e) => setFormEndDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>

                {computedDays > 0 && (
                  <div className="mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                    <span>Pracovních dní: <strong style={{ color: 'var(--text-primary)' }}>{computedDays}</strong></span>
                    {willNeedApproval && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                        ⏳ Vyžaduje schválení nadřízeného
                      </span>
                    )}
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
                    {saving ? 'Ukládám...' : willNeedApproval ? 'Odeslat žádost' : 'Přidat'}
                  </button>
                </div>
              </div>
            )}

            {/* Seznam schválených záznamů */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : approvedEntries.length === 0 ? (
              <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Žádné schválené záznamy dovolené pro rok {currentYear}.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div
                  className="grid gap-4 px-4 py-2.5 border-b text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', gridTemplateColumns: isWorkspaceAdmin && selectedUserId === 'all' ? '1fr auto auto auto auto auto' : 'auto auto auto auto auto' }}
                >
                  {isWorkspaceAdmin && selectedUserId === 'all' && <span>Uživatel</span>}
                  <span>Od</span><span>Do</span><span>Dní</span><span>Poznámka</span><span></span>
                </div>
                {approvedEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="grid gap-4 px-4 py-3 border-b last:border-b-0 items-center group transition-colors"
                    style={{ borderColor: 'var(--border)', gridTemplateColumns: isWorkspaceAdmin && selectedUserId === 'all' ? '1fr auto auto auto auto auto' : 'auto auto auto auto auto' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {isWorkspaceAdmin && selectedUserId === 'all' && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}>
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
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Sekce: Moje čekající a zamítnuté žádosti */}
            {!loading && myPendingRejectedEntries.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Moje žádosti</h3>
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  {myPendingRejectedEntries.map(entry => (
                    <div key={entry.id} className="px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          {entry.status === 'pending' ? (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                              ⏳ Čeká na schválení
                            </span>
                          ) : (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                              ✕ Zamítnuto
                            </span>
                          )}
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {formatDate(entry.start_date)} – {formatDate(entry.end_date)}
                          </span>
                          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--primary)' }}>{entry.days} d</span>
                          {entry.note && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {entry.note}</span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="flex-shrink-0 p-1 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Smazat žádost"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                      {entry.status === 'rejected' && entry.reviewer_note && (
                        <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          <strong>Důvod zamítnutí:</strong> {entry.reviewer_note}
                        </div>
                      )}
                      {entry.status === 'rejected' && !entry.reviewer_note && (
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Zamítnuto bez uvedení důvodu.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* Tab: Žádosti (manager / admin)                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'requests' && (
          <>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              {isWorkspaceAdmin
                ? 'Čekající žádosti o dovolenou od všech členů workspace.'
                : 'Čekající žádosti o dovolenou od vašich podřízených.'}
            </p>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pendingRequestEntries.length === 0 ? (
              <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné čekající žádosti k vyřízení. 🎉</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequestEntries.map(entry => (
                  <div key={entry.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-4">
                      {/* Info o uživateli a záznamu */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}
                        >
                          {entry.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {entry.profile?.display_name ?? 'Neznámý uživatel'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {formatDate(entry.start_date)} – {formatDate(entry.end_date)}
                            </span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                              {entry.days} pracovních dnů
                            </span>
                          </div>
                          {entry.note && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                              Poznámka: {entry.note}
                            </p>
                          )}
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Podáno {new Date(entry.created_at).toLocaleDateString('cs-CZ')}
                          </p>
                        </div>
                      </div>
                      {/* Akce */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => approveEntry(entry.id)}
                          disabled={approving === entry.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: '#16a34a' }}
                        >
                          {approving === entry.id ? '...' : '✓ Schválit'}
                        </button>
                        <button
                          onClick={() => setRejectModal({ id: entry.id, note: '' })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
                          style={{ borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          ✕ Zamítnout
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Zamítnutí ── */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Zamítnout žádost</h2>
              <button
                onClick={() => setRejectModal(null)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Důvod zamítnutí (volitelně)
              </label>
              <textarea
                value={rejectModal.note}
                onChange={e => setRejectModal(m => m ? { ...m, note: e.target.value } : null)}
                rows={3}
                placeholder="např. V daném termínu je plánovaný důležitý projekt."
                className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Zrušit
              </button>
              <button
                onClick={rejectEntry}
                disabled={rejecting}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ background: '#ef4444' }}
              >
                {rejecting ? 'Ukládám…' : 'Zamítnout'}
              </button>
            </div>
          </div>
        </div>
      )}
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
