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
  hardware:    'Hardware a zařízení',
  software:    'Software a licence',
  access:      'Přístupy a oprávnění',
  office:      'Pracovní prostor a vybavení',
  financial:   'Finanční žádosti',
  hr:          'HR a personální žádosti',
  education:   'Vzdělávání a rozvoj',
  travel:      'Cestování a služební cesty',
  benefits:    'Benefity a odměňování',
  recruitment: 'Nábor a posílení týmu',
  security:    'Bezpečnost a compliance',
  it_support:  'Technická podpora a IT servis',
  legal:       'Právní a administrativní',
};

const REQUEST_TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'hardware',    label: 'Hardware a zařízení' },
  { value: 'software',    label: 'Software a licence' },
  { value: 'access',      label: 'Přístupy a oprávnění' },
  { value: 'office',      label: 'Pracovní prostor a vybavení' },
  { value: 'financial',   label: 'Finanční žádosti' },
  { value: 'hr',          label: 'HR a personální žádosti' },
  { value: 'education',   label: 'Vzdělávání a rozvoj' },
  { value: 'travel',      label: 'Cestování a služební cesty' },
  { value: 'benefits',    label: 'Benefity a odměňování' },
  { value: 'recruitment', label: 'Nábor a posílení týmu' },
  { value: 'security',    label: 'Bezpečnost a compliance' },
  { value: 'it_support',  label: 'Technická podpora a IT servis' },
  { value: 'legal',       label: 'Právní a administrativní' },
];

// ─── Průvodce kategoriemi ──────────────────────────────────────────────────

const CATEGORY_GUIDE: { title: string; desc: string }[] = [
  { title: 'Hardware a zařízení', desc: 'Počítače, monitory, klávesnice, myši, telefony, tablety, tiskárny, headset, webkamery, externí disky, UPS záložní zdroje, ergonomické vybavení (podložky, stojany na monitor).' },
  { title: 'Software a licence', desc: 'Nové aplikace, rozšíření stávajících licencí, upgrady verzí, přístupy k SaaS nástrojům (Notion, Asana, Adobe, AI nástroje…), vývojářské nástroje, antivirus.' },
  { title: 'Přístupy a oprávnění', desc: 'Přístup do systémů, sdílených složek, databází, adminská práva, VPN, přístupy k externím službám a API, zrušení přístupů při odchodu.' },
  { title: 'Pracovní prostor a vybavení kanceláře', desc: 'Kancelářský nábytek, stůl/křeslo, kuchyňské vybavení, úprava pracovního místa, klimatizace/topení, parkovací místo.' },
  { title: 'Finanční žádosti', desc: 'Proplacení výdajů (cestovné, ubytování, nákupy), zálohy na akce nebo projekty, navýšení rozpočtu projektu, nákupy nad rámec běžného schválení.' },
  { title: 'HR a personální žádosti', desc: 'Změna pracovní doby nebo úvazku, práce z domova (home office), dovolená nad rámec standardu, studijní volno, osobní volno, přestup na jinou pozici, žádost o přidání člověka do týmu.' },
  { title: 'Vzdělávání a rozvoj', desc: 'Kurzy, školení, certifikace, konference, knihy a vzdělávací materiály, mentoring, jazykové kurzy.' },
  { title: 'Cestování a služební cesty', desc: 'Schválení služební cesty, letenky, ubytování, pronájem auta, denní diety, žádost o firemní kartu.' },
  { title: 'Benefity a odměňování', desc: 'Žádost o benefit (Multisport, stravenky, penzijní příspěvek…), změna benefitů, mimořádná odměna/bonus, žádost o navýšení mzdy.' },
  { title: 'Nábor a posílení týmu', desc: 'Žádost o nového zaměstnance nebo externisty, rozšíření kapacity týmu, schválení spolupráce s agenturou nebo freelancerem.' },
  { title: 'Bezpečnost a compliance', desc: 'Hlášení bezpečnostního incidentu, žádost o bezpečnostní audit, změna přístupových hesel systémů, GDPR žádosti.' },
  { title: 'Technická podpora a IT servis', desc: 'Oprava nebo výměna zařízení, servisní zásah, obnova dat, pomoc s nastavením systému.' },
  { title: 'Právní a administrativní', desc: 'Žádost o potvrzení zaměstnání, výplatní páska, pracovní smlouva, souhlas s vedlejší výdělečnou činností.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Typy ────────────────────────────────────────────────────────────────────

interface RequestWithProfile extends TrackingRequest {
  profile?: Profile;
  reviewerProfile?: Profile;
}

type ActiveTab = 'mine' | 'pending' | 'archive';

// ─── Interní komponenta ───────────────────────────────────────────────────────

function RequestsContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [myRequests, setMyRequests] = useState<RequestWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithProfile[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('mine');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formType, setFormType] = useState<RequestType>('hardware');
  const [formTitle, setFormTitle] = useState('');
  const [formNote, setFormNote] = useState('');

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  // Průvodce kategoriemi – rozbalení
  const [showGuide, setShowGuide] = useState(false);

  // Oprávnění – kdo může zpracovávat žádosti
  const canProcessRequests = useMemo(
    () => isWorkspaceAdmin || isManager || isMasterAdmin || (currentMembership?.can_process_requests ?? false),
    [isWorkspaceAdmin, isManager, isMasterAdmin, currentMembership]
  );

  // Redirect pokud modul není dostupný (čekáme na načtení workspace)
  useEffect(() => {
    if (!wsLoading && !hasModule('requests')) router.replace('/');
  }, [wsLoading, hasModule, router]);

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

    // Čekající žádosti ostatních (pro reviewery) + archiv
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

      // Archiv – všechny schválené/zamítnuté v celém workspace
      const { data: archData } = await supabase
        .from('trackino_requests')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false });

      const archReqs = (archData ?? []) as RequestWithProfile[];

      if (archReqs.length > 0) {
        // Potřebujeme profily jak podavatelů, tak recenzentů
        const allIds = [...new Set([
          ...archReqs.map(r => r.user_id),
          ...archReqs.filter(r => r.reviewed_by).map(r => r.reviewed_by!),
        ])];
        const { data: archProfData } = await supabase
          .from('trackino_profiles')
          .select('id, display_name, avatar_color')
          .in('id', allIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const archProfMap = Object.fromEntries((archProfData ?? []).map((p: any) => [p.id, p as Profile]));
        archReqs.forEach(r => {
          r.profile = archProfMap[r.user_id];
          if (r.reviewed_by) r.reviewerProfile = archProfMap[r.reviewed_by];
        });
      }
      setArchivedRequests(archReqs);
    }

    setLoading(false);
  }, [user, currentWorkspace, canProcessRequests]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Akce ──────────────────────────────────────────────────────────────────

  const submitRequest = async () => {
    if (!user || !currentWorkspace) return;
    if (!formTitle.trim()) return;

    setSaving(true);
    await supabase.from('trackino_requests').insert({
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      type: formType,
      title: formTitle.trim(),
      note: formNote.trim(),
      status: 'pending',
    });
    setSaving(false);
    setShowForm(false);
    setFormTitle('');
    setFormNote('');
    setFormType('hardware');
    fetchData();
  };

  const approveRequest = async (req: RequestWithProfile) => {
    if (!user || !currentWorkspace) return;
    setApproving(req.id);
    await supabase.from('trackino_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_note: '',
    }).eq('id', req.id);
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
  const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        {/* Záhlaví */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Žádosti</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Podávejte formální žádosti svému nadřízenému ke schválení
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nová žádost
          </button>
        </div>

        {/* Průvodce kategoriemi */}
        <div className="mb-5 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setShowGuide(g => !g)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Průvodce kategoriemi – co kam spadá
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showGuide && (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {CATEGORY_GUIDE.map(cat => (
                <div key={cat.title} className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{cat.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Záložky */}
        {canProcessRequests && (
          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'var(--bg-hover)' }}>
            {([
              { key: 'mine' as ActiveTab, label: 'Moje žádosti', count: 0 },
              { key: 'pending' as ActiveTab, label: 'Ke zpracování', count: pendingRequests.length },
              { key: 'archive' as ActiveTab, label: 'Archiv', count: 0 },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'var(--danger)' }}
                  >
                    {tab.count}
                  </span>
                )}
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

                  {req.note && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                  )}

                  {/* Akce */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => setRejectModal({ id: req.id, note: '' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                      style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Zamítnout
                    </button>
                    <button
                      onClick={() => approveRequest(req)}
                      disabled={approving === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--success)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {approving === req.id ? '...' : 'Schválit'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Archiv ── */}
        {activeTab === 'archive' && canProcessRequests && (
          <div className="space-y-3">
            {archivedRequests.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Archiv je prázdný. Vyřízené žádosti se zde zobrazí po schválení nebo zamítnutí.</p>
              </div>
            ) : (
              <>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  {archivedRequests.length} vyřízených žádostí · seřazeno od nejnovějšího rozhodnutí
                </p>
                {archivedRequests.map(req => (
                  <div key={req.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Levá část: avatar + info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: req.profile?.avatar_color ?? 'var(--primary)' }}
                        >
                          {req.profile ? initials(req.profile.display_name) : '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {req.profile?.display_name ?? 'Neznámý uživatel'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                              {REQUEST_TYPE_LABELS[req.type]}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Podáno {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                            </span>
                          </div>
                          <h3 className="font-semibold text-sm mt-1.5" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
                          {req.note && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                          )}
                          {/* Info o vyřízení */}
                          {req.reviewerProfile && req.reviewed_at && (
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                              {req.status === 'approved' ? 'Schválil/a' : 'Zamítnul/a'}{' '}
                              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {req.reviewerProfile.display_name}
                              </span>
                              {' · '}
                              {new Date(req.reviewed_at).toLocaleDateString('cs-CZ')}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Badge stavu – pouze Schváleno vpravo nahoře */}
                      <div className="flex-shrink-0">
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Schváleno
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Badge Zamítnuto + Důvod zamítnutí – pod hlavním obsahem */}
                    {req.status === 'rejected' && (
                      <>
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Zamítnuto
                          </span>
                        </div>
                        <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          {req.reviewer_note
                            ? <><strong>Důvod zamítnutí:</strong> {req.reviewer_note}</>
                            : 'Zamítnuto bez uvedení důvodu.'}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL – Nová žádost ════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Kategorie žádosti</label>
                <div className="relative">
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as RequestType)}
                    className={inputCls + ' appearance-none pr-8'}
                    style={inputStyle}
                  >
                    {REQUEST_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Název */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Stručný název žádosti"
                  className={inputCls}
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Poznámka */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  rows={3}
                  placeholder="Doplňující informace, zdůvodnění žádosti..."
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
                disabled={saving || !formTitle.trim()}
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
          <div className="w-full max-w-sm rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Zamítnout žádost</h2>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Důvod zamítnutí (volitelné)</label>
              <textarea
                value={rejectModal.note}
                onChange={e => setRejectModal(m => m ? { ...m, note: e.target.value } : m)}
                rows={3}
                placeholder="Proč se žádost zamítá..."
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
                style={{ background: 'var(--danger)' }}
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
