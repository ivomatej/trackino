'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { TrackingRequest, RequestType, Profile } from '@/types/database';

// ─── Konstanty ───────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  vacation: 'Dovolená',
  software: 'Nový software',
  business_trip: 'Pracovní cesta',
  company_card: 'Firemní karta',
  other: 'Jiné',
};

const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'vacation',      label: 'Dovolená' },
  { value: 'software',      label: 'Nový software' },
  { value: 'business_trip', label: 'Pracovní cesta' },
  { value: 'company_card',  label: 'Firemní karta' },
  { value: 'other',         label: 'Jiné' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeWorkingDays(start: string, end: string): number {
  let count = 0;
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Typy ────────────────────────────────────────────────────────────────────

interface RequestWithProfile extends TrackingRequest {
  profile?: Profile;
  reviewerProfile?: Profile;
}

type ActiveTab = 'mine' | 'pending';

// ─── Interní komponenta ───────────────────────────────────────────────────────

function RequestsContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [myRequests, setMyRequests] = useState<RequestWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('mine');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formType, setFormType] = useState<RequestType>('vacation');
  const [formTitle, setFormTitle] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formVacStart, setFormVacStart] = useState('');
  const [formVacEnd, setFormVacEnd] = useState('');

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  // Oprávnění – kdo může zpracovávat žádosti
  const canProcessRequests = useMemo(
    () => isWorkspaceAdmin || isManager || isMasterAdmin || (currentMembership?.can_process_requests ?? false),
    [isWorkspaceAdmin, isManager, isMasterAdmin, currentMembership]
  );

  // Počet pracovních dnů
  const computedVacDays = useMemo(() => {
    if (formType !== 'vacation' || !formVacStart || !formVacEnd) return 0;
    if (formVacEnd < formVacStart) return 0;
    return computeWorkingDays(formVacStart, formVacEnd);
  }, [formType, formVacStart, formVacEnd]);

  // Redirect pokud modul není dostupný
  useEffect(() => {
    if (!hasModule('requests')) router.replace('/');
  }, [hasModule, router]);

  // ── Fetch dat ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);

    // Moje žádosti
    const { data: myData } = await supabase
      .from('trackino_requests')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const myReqs = (myData ?? []) as RequestWithProfile[];

    // Profily reviewerů
    const reviewerIds = [...new Set(myReqs.filter(r => r.reviewed_by).map(r => r.reviewed_by!))];
    if (reviewerIds.length > 0) {
      const { data: profData } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, avatar_color')
        .in('id', reviewerIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profMap = Object.fromEntries((profData ?? []).map((p: any) => [p.id, p as Profile]));
      myReqs.forEach(r => { if (r.reviewed_by) r.reviewerProfile = profMap[r.reviewed_by]; });
    }
    setMyRequests(myReqs);

    // Čekající žádosti ostatních (pro reviewery)
    if (canProcessRequests) {
      const { data: pendData } = await supabase
        .from('trackino_requests')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'pending')
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      const pendReqs = (pendData ?? []) as RequestWithProfile[];

      if (pendReqs.length > 0) {
        const userIds = [...new Set(pendReqs.map(r => r.user_id))];
        const { data: profData } = await supabase
          .from('trackino_profiles')
          .select('id, display_name, avatar_color')
          .in('id', userIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profMap = Object.fromEntries((profData ?? []).map((p: any) => [p.id, p as Profile]));
        pendReqs.forEach(r => { r.profile = profMap[r.user_id]; });
      }
      setPendingRequests(pendReqs);
    }

    setLoading(false);
  }, [user, currentWorkspace, canProcessRequests]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Synchronizace dovolené do Plánovače ────────────────────────────────────

  async function syncVacationToPlanner(startDate: string, endDate: string, userId: string, workspaceId: string) {
    const { data: statusData } = await supabase
      .from('trackino_availability_statuses')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    const vacStatus = (statusData ?? []).find((s: { id: string; name: string }) =>
      s.name.trim().toLowerCase() === 'dovolená'
    );
    if (!vacStatus) return;

    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      await supabase.from('trackino_availability').upsert({
        workspace_id: workspaceId,
        user_id: userId,
        date: dateStr,
        half: 'full',
        status_id: vacStatus.id,
        note: '',
      }, { onConflict: 'workspace_id,user_id,date,half' });
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ── Akce ──────────────────────────────────────────────────────────────────

  const submitRequest = async () => {
    if (!user || !currentWorkspace) return;
    if (!formTitle.trim()) return;
    if (formType === 'vacation' && (!formVacStart || !formVacEnd || formVacEnd < formVacStart)) return;

    setSaving(true);
    const payload: Record<string, unknown> = {
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      type: formType,
      title: formTitle.trim(),
      note: formNote.trim(),
      status: 'pending',
    };
    if (formType === 'vacation') {
      payload.vacation_start_date = formVacStart;
      payload.vacation_end_date = formVacEnd;
      payload.vacation_days = computedVacDays;
    }
    await supabase.from('trackino_requests').insert(payload);
    setSaving(false);
    setShowForm(false);
    setFormTitle('');
    setFormNote('');
    setFormVacStart('');
    setFormVacEnd('');
    setFormType('vacation');
    fetchData();
  };

  const approveRequest = async (req: RequestWithProfile) => {
    if (!user || !currentWorkspace) return;
    setApproving(req.id);
    const now = new Date().toISOString();
    await supabase.from('trackino_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: now,
      reviewer_note: '',
    }).eq('id', req.id);

    // Pro žádost o dovolenou vytvořit záznam v dovolené + sync s plánovačem
    if (req.type === 'vacation' && req.vacation_start_date && req.vacation_end_date) {
      const days = req.vacation_days ?? computeWorkingDays(req.vacation_start_date, req.vacation_end_date);
      const { data: vacData } = await supabase.from('trackino_vacation_entries').insert({
        workspace_id: currentWorkspace.id,
        user_id: req.user_id,
        start_date: req.vacation_start_date,
        end_date: req.vacation_end_date,
        days,
        note: req.note || '',
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: now,
        reviewer_note: '',
      }).select().single();

      if (vacData) {
        await supabase.from('trackino_requests').update({ vacation_entry_id: vacData.id }).eq('id', req.id);
        await syncVacationToPlanner(req.vacation_start_date, req.vacation_end_date, req.user_id, currentWorkspace.id);
      }
    }
    setApproving(null);
    fetchData();
  };

  const rejectRequest = async () => {
    if (!rejectModal || !user) return;
    setRejecting(true);
    await supabase.from('trackino_requests').update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: rejectModal.note,
    }).eq('id', rejectModal.id);
    setRejecting(false);
    setRejectModal(null);
    fetchData();
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Opravdu smazat tuto žádost?')) return;
    await supabase.from('trackino_requests').delete().eq('id', id);
    fetchData();
  };

  // ── Status badge ──────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: string }) {
    if (status === 'pending') return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
        Čeká na vyřízení
      </span>
    );
    if (status === 'approved') return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#d1fae5', color: '#065f46' }}>
        Schváleno
      </span>
    );
    if (status === 'rejected') return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>
        Zamítnuto
      </span>
    );
    return null;
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };
  const inputCls = 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Záhlaví */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Žádosti</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Podávejte žádosti o dovolenou, software nebo jiné potřeby
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nová žádost
          </button>
        </div>

        {/* Záložky */}
        {canProcessRequests && (
          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'var(--bg-hover)' }}>
            {([
              { key: 'mine' as ActiveTab, label: 'Moje žádosti' },
              { key: 'pending' as ActiveTab, label: `Ke zpracování${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab: Moje žádosti ── */}
        {activeTab === 'mine' && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="11" y2="17" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné žádosti. Klikněte na „Nová žádost" pro podání první žádosti.</p>
              </div>
            ) : (
              myRequests.map(req => (
                <div key={req.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                          {REQUEST_TYPE_LABELS[req.type]}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <h3 className="font-semibold text-sm mt-1.5" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                    </span>
                  </div>

                  {/* Dovolená detail */}
                  {req.type === 'vacation' && req.vacation_start_date && req.vacation_end_date && (
                    <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDateShort(req.vacation_start_date)} – {fmtDateShort(req.vacation_end_date)}
                      {req.vacation_days != null && <span className="ml-1 font-medium">({req.vacation_days} {req.vacation_days === 1 ? 'pracovní den' : req.vacation_days < 5 ? 'pracovní dny' : 'pracovních dnů'})</span>}
                    </div>
                  )}

                  {req.note && (
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                  )}

                  {/* Zamítnutí – poznámka */}
                  {req.status === 'rejected' && req.reviewer_note && (
                    <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: '#fee2e222', borderLeft: '3px solid #ef4444', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: '#ef4444' }}>Důvod zamítnutí:</strong> {req.reviewer_note}
                      {req.reviewerProfile && (
                        <span className="ml-1" style={{ color: 'var(--text-muted)' }}>— {req.reviewerProfile.display_name}</span>
                      )}
                    </div>
                  )}

                  {/* Schválení info */}
                  {req.status === 'approved' && req.reviewerProfile && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Schválil/a: {req.reviewerProfile.display_name}
                      {req.reviewed_at && ` (${new Date(req.reviewed_at).toLocaleDateString('cs-CZ')})`}
                    </p>
                  )}

                  {/* Akce – smazání zamítnutých/pending */}
                  {(req.status === 'rejected' || req.status === 'pending') && (
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => deleteRequest(req.id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Smazat
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Ke zpracování ── */}
        {activeTab === 'pending' && canProcessRequests && (
          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné čekající žádosti. Vše je vyřízeno!</p>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  {/* Uživatel */}
                  {req.profile && (
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: req.profile.avatar_color }}
                      >
                        {initials(req.profile.display_name)}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{req.profile.display_name}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                        {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                      {REQUEST_TYPE_LABELS[req.type]}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>

                  {/* Dovolená detail */}
                  {req.type === 'vacation' && req.vacation_start_date && req.vacation_end_date && (
                    <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDate(req.vacation_start_date)} – {fmtDate(req.vacation_end_date)}
                      {req.vacation_days != null && <span className="ml-1 font-medium">({req.vacation_days} {req.vacation_days === 1 ? 'pracovní den' : req.vacation_days < 5 ? 'pracovní dny' : 'pracovních dnů'})</span>}
                    </div>
                  )}

                  {req.note && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                  )}

                  {/* Akce */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => setRejectModal({ id: req.id, note: '' })}
                      className="px-3 py-1.5 rounded-lg text-sm border transition-colors"
                      style={{ borderColor: '#ef444444', color: '#ef4444' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Zamítnout
                    </button>
                    <button
                      onClick={() => approveRequest(req)}
                      disabled={approving === req.id}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                      style={{ background: '#10b981' }}
                    >
                      {approving === req.id ? 'Schvaluji...' : 'Schválit'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL – Nová žádost ════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nová žádost</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Typ */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Typ žádosti</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value as RequestType)}
                  className={inputCls}
                  style={inputStyle}
                >
                  {REQUEST_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Název */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder={
                    formType === 'vacation' ? 'např. Letní dovolená'
                    : formType === 'software' ? 'např. Adobe Photoshop licence'
                    : formType === 'business_trip' ? 'např. Konference Praha'
                    : 'Název žádosti'
                  }
                  className={inputCls}
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Dovolená – datum */}
              {formType === 'vacation' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Od *</label>
                    <input
                      type="date"
                      value={formVacStart}
                      onChange={e => setFormVacStart(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Do *</label>
                    <input
                      type="date"
                      value={formVacEnd}
                      onChange={e => setFormVacEnd(e.target.value)}
                      min={formVacStart}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  {computedVacDays > 0 && (
                    <div className="col-span-2 text-xs font-medium" style={{ color: 'var(--primary)' }}>
                      {computedVacDays} {computedVacDays === 1 ? 'pracovní den' : computedVacDays < 5 ? 'pracovní dny' : 'pracovních dnů'}
                    </div>
                  )}
                </div>
              )}

              {/* Poznámka */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  rows={3}
                  placeholder="Doplňující informace..."
                  className={inputCls}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={submitRequest}
                disabled={saving || !formTitle.trim() || (formType === 'vacation' && (!formVacStart || !formVacEnd || formVacEnd < formVacStart))}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {saving ? 'Odesílám...' : 'Odeslat žádost'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL – Zamítnutí ══════════════════════════════════════════════════ */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Zamítnout žádost</h2>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Důvod zamítnutí (volitelné)</label>
              <textarea
                value={rejectModal.note}
                onChange={e => setRejectModal(m => m ? { ...m, note: e.target.value } : m)}
                rows={3}
                placeholder="Proč se žádost zamítá..."
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', resize: 'none' }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={rejectRequest}
                disabled={rejecting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#ef4444' }}
              >
                {rejecting ? 'Zamítám...' : 'Zamítnout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────

export default function RequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <RequestsContent />
    </WorkspaceProvider>
  );
}
