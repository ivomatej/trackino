'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPhone, normalizePhone } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import type { Department, Category, Task, WorkspaceMember, Profile, UserRole, MemberRate, CooperationType, WorkspaceBilling } from '@/types/database';

type Tab = 'members' | 'departments' | 'categories' | 'tasks' | 'managers';

interface ManagerAssignmentRow {
  id: string;
  member_user_id: string;
  manager_user_id: string;
}

const AVATAR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlastník',
  admin: 'Admin',
  manager: 'Team Manager',
  member: 'Člen',
};

// Pořadí rolí pro řazení (nižší číslo = vyšší právo = nahoře)
const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, manager: 2, member: 3 };

interface MemberWithProfile extends WorkspaceMember {
  profile?: Profile;
}

function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}.${parseInt(m)}.${y}`;
}

function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function TeamContent() {
  const { user } = useAuth();
  const { currentWorkspace, refreshWorkspace, isManagerOf } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [activeRates, setActiveRates] = useState<Record<string, number>>({}); // workspace_member.id → aktivní sazba
  const [loading, setLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSort, setMemberSort] = useState<'role' | 'name_asc' | 'name_desc'>('role');
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Email/telefon copy state
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Edit member – základní pole
  const [editingMember, setEditingMember] = useState<MemberWithProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editColor, setEditColor] = useState(AVATAR_COLORS[0]);
  const [editCanUseVacation, setEditCanUseVacation] = useState(false);
  const [editCanInvoice, setEditCanInvoice] = useState(false);
  const [editCanManageBilling, setEditCanManageBilling] = useState(false);
  const [editCanViewAudit, setEditCanViewAudit] = useState(false);
  const [editCanProcessRequests, setEditCanProcessRequests] = useState(false);
  const [editCanReceiveFeedback, setEditCanReceiveFeedback] = useState(false);
  const [editCanManageDocuments, setEditCanManageDocuments] = useState(false);
  const [editCooperationTypeId, setEditCooperationTypeId] = useState<string>('');
  const [editBillingProfileId, setEditBillingProfileId] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  // Fakturační profily
  const [billingProfiles, setBillingProfiles] = useState<WorkspaceBilling[]>([]);

  // Cooperation types
  const [cooperationTypes, setCooperationTypes] = useState<CooperationType[]>([]);

  // Manager assignments (pro tab Manažeři)
  const [wsManagerAssignments, setWsManagerAssignments] = useState<ManagerAssignmentRow[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Edit member – hodinové sazby
  const [memberRates, setMemberRates] = useState<MemberRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [newRateAmount, setNewRateAmount] = useState('');
  const [newRateFrom, setNewRateFrom] = useState('');
  const [addingRate, setAddingRate] = useState(false);
  const [savingRateId, setSavingRateId] = useState<string | null>(null);
  const [rateValidToEdits, setRateValidToEdits] = useState<Record<string, string>>({});

  // Formulářové stavy (oddělení/kategorie/úkoly)
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formProject, setFormProject] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;

    const [deptRes, catRes, taskRes, projRes, memRes, coopRes, mgrRes, billingRes] = await Promise.all([
      supabase.from('trackino_departments').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_projects').select('id, name').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_workspace_members').select('*').eq('workspace_id', currentWorkspace.id),
      supabase.from('trackino_cooperation_types').select('*').eq('workspace_id', currentWorkspace.id).order('sort_order', { ascending: true }),
      supabase.from('trackino_manager_assignments').select('id, member_user_id, manager_user_id').eq('workspace_id', currentWorkspace.id),
      supabase.from('trackino_workspace_billing').select('*').eq('workspace_id', currentWorkspace.id).order('is_default', { ascending: false }),
    ]);

    setDepartments((deptRes.data ?? []) as Department[]);
    setCategories((catRes.data ?? []) as Category[]);
    setTasks((taskRes.data ?? []) as Task[]);
    setProjects((projRes.data ?? []) as { id: string; name: string }[]);
    setCooperationTypes((coopRes.data ?? []) as CooperationType[]);
    setWsManagerAssignments((mgrRes.data ?? []) as ManagerAssignmentRow[]);
    setBillingProfiles((billingRes.data ?? []) as WorkspaceBilling[]);

    const memberData = (memRes.data ?? []) as WorkspaceMember[];
    if (memberData.length > 0) {
      const userIds = memberData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', userIds);

      const profileMap: Record<string, Profile> = {};
      (profiles ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });

      setMembers(memberData.map(m => ({ ...m, profile: profileMap[m.user_id] })));

      // Načíst aktivní sazby pro zobrazení v seznamu
      const memberIds = memberData.map(m => m.id);
      const { data: ratesData } = await supabase
        .from('trackino_member_rates')
        .select('workspace_member_id, hourly_rate')
        .in('workspace_member_id', memberIds)
        .is('valid_to', null);
      const rMap: Record<string, number> = {};
      (ratesData ?? []).forEach((r: { workspace_member_id: string; hourly_rate: number }) => {
        rMap[r.workspace_member_id] = r.hourly_rate;
      });
      setActiveRates(rMap);
    } else {
      setMembers([]);
      setActiveRates({});
    }

    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormName(''); setFormDepartment(''); setFormProject(''); setFormCategory(''); setShowForm(false);
  };

  const saveItem = async () => {
    if (!currentWorkspace || !formName.trim()) return;
    setSaving(true);
    if (activeTab === 'departments') {
      await supabase.from('trackino_departments').insert({ workspace_id: currentWorkspace.id, name: formName.trim() });
    } else if (activeTab === 'categories') {
      await supabase.from('trackino_categories').insert({ workspace_id: currentWorkspace.id, name: formName.trim(), department_id: formDepartment || null });
    } else if (activeTab === 'tasks') {
      await supabase.from('trackino_tasks').insert({ workspace_id: currentWorkspace.id, name: formName.trim(), project_id: formProject || null, category_id: formCategory || null });
    }
    setSaving(false); resetForm(); fetchData();
  };

  const deleteItem = async (table: string, id: string, name: string) => {
    if (!confirm(`Opravdu smazat "${name}"?`)) return;
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  const copyEmail = async (memberId: string, email: string) => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const el = document.createElement('textarea');
      el.value = email;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedEmailId(memberId);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const copyPhone = async (memberId: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      const el = document.createElement('textarea');
      el.value = phone;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedPhoneId(memberId);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const copyJoinCode = async () => {
    if (!currentWorkspace?.join_code) return;
    try {
      await navigator.clipboard.writeText(currentWorkspace.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = currentWorkspace.join_code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  function generateRandomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * 32)]).join('');
  }

  const regenerateJoinCode = async () => {
    if (!currentWorkspace || !confirm('Opravdu vygenerovat nový kód? Starý kód přestane fungovat.')) return;
    setRegenerating(true);
    try {
      const newCode = generateRandomCode();
      const { error } = await supabase
        .from('trackino_workspaces')
        .update({ join_code: newCode })
        .eq('id', currentWorkspace.id);
      if (!error) await refreshWorkspace();
    } catch (err) {
      console.warn('Chyba při generování kódu:', err);
    }
    setRegenerating(false);
  };

  const approveMember = async (memberId: string) => {
    await supabase.from('trackino_workspace_members').update({ approved: true }).eq('id', memberId);
    fetchData();
  };

  const rejectMember = async (memberId: string, name: string) => {
    if (!confirm(`Zamítnout přístup pro "${name}"? Uživatel bude odebrán z workspace.`)) return;
    await supabase.from('trackino_workspace_members').delete().eq('id', memberId);
    fetchData();
  };

  const updateMemberRole = async (memberId: string, newRole: UserRole) => {
    await supabase.from('trackino_workspace_members').update({ role: newRole }).eq('id', memberId);
    fetchData();
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Opravdu odebrat "${name}" z workspace?`)) return;
    await supabase.from('trackino_workspace_members').delete().eq('id', memberId);
    fetchData();
  };

  const openEditMember = async (member: MemberWithProfile) => {
    setEditingMember(member);
    setEditName(member.profile?.display_name ?? '');
    setEditEmail(member.profile?.email ?? '');
    setEditPhone(member.profile?.phone ?? '');
    setEditPosition(member.profile?.position ?? '');
    setEditColor(member.profile?.avatar_color ?? AVATAR_COLORS[0]);
    setEditCanUseVacation(member.can_use_vacation ?? false);
    setEditCanInvoice(member.can_invoice ?? false);
    setEditCanManageBilling(member.can_manage_billing ?? false);
    setEditCanViewAudit(member.can_view_audit ?? false);
    setEditCanProcessRequests(member.can_process_requests ?? false);
    setEditCanReceiveFeedback(member.can_receive_feedback ?? false);
    setEditCanManageDocuments(member.can_manage_documents ?? false);
    setEditCooperationTypeId(member.cooperation_type_id ?? '');
    setEditBillingProfileId(member.billing_profile_id ?? '');
    setMemberRates([]);
    setShowAddRate(false);
    setNewRateAmount('');
    setNewRateFrom('');
    setRateValidToEdits({});

    setRatesLoading(true);
    const { data } = await supabase
      .from('trackino_member_rates')
      .select('*')
      .eq('workspace_member_id', member.id)
      .order('valid_from', { ascending: false });
    setMemberRates((data ?? []) as MemberRate[]);
    setRatesLoading(false);
  };

  const saveMemberEdit = async () => {
    if (!editingMember) return;
    setEditSaving(true);
    await Promise.all([
      supabase.from('trackino_profiles').update({
        display_name: editName.trim(),
        email: editEmail.trim(),
        phone: normalizePhone(editPhone),
        position: editPosition.trim(),
        avatar_color: editColor,
      }).eq('id', editingMember.user_id),
      supabase.from('trackino_workspace_members').update({
        can_use_vacation: editCanUseVacation,
        can_invoice: editCanInvoice,
        can_manage_billing: editCanManageBilling,
        can_view_audit: editCanViewAudit,
        can_process_requests: editCanProcessRequests,
        can_receive_feedback: editCanReceiveFeedback,
        can_manage_documents: editCanManageDocuments,
        cooperation_type_id: editCooperationTypeId || null,
        billing_profile_id: editBillingProfileId || null,
      }).eq('id', editingMember.id),
    ]);
    setEditSaving(false);
    setEditingMember(null);
    fetchData();
  };

  // --- Správa sazeb ---

  const addMemberRate = async () => {
    if (!editingMember || !newRateAmount || !newRateFrom) return;
    const rate = parseFloat(newRateAmount);
    if (isNaN(rate) || rate < 0) return;
    setAddingRate(true);
    await supabase.from('trackino_member_rates').insert({
      workspace_member_id: editingMember.id,
      hourly_rate: rate,
      valid_from: newRateFrom,
      valid_to: null,
    });
    setNewRateAmount('');
    setNewRateFrom('');
    setShowAddRate(false);
    const { data } = await supabase
      .from('trackino_member_rates')
      .select('*')
      .eq('workspace_member_id', editingMember.id)
      .order('valid_from', { ascending: false });
    setMemberRates((data ?? []) as MemberRate[]);
    setAddingRate(false);
  };

  const deleteMemberRate = async (rateId: string) => {
    if (!confirm('Smazat tuto sazbu?')) return;
    await supabase.from('trackino_member_rates').delete().eq('id', rateId);
    setMemberRates(prev => prev.filter(r => r.id !== rateId));
  };

  const saveRateValidTo = async (rateId: string) => {
    const validTo = rateValidToEdits[rateId];
    if (!validTo) return;
    setSavingRateId(rateId);
    await supabase.from('trackino_member_rates')
      .update({ valid_to: validTo })
      .eq('id', rateId);
    setMemberRates(prev => prev.map(r => r.id === rateId ? { ...r, valid_to: validTo } : r));
    setRateValidToEdits(prev => {
      const next = { ...prev };
      delete next[rateId];
      return next;
    });
    setSavingRateId(null);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'members', label: 'Členové', count: members.length },
    { key: 'departments', label: 'Oddělení', count: departments.length },
    { key: 'categories', label: 'Kategorie', count: categories.length },
    { key: 'tasks', label: 'Úkoly', count: tasks.length },
    ...(isWorkspaceAdmin ? [{ key: 'managers' as Tab, label: 'Manažeři', count: wsManagerAssignments.length }] : []),
  ];

  const tabLabels: Record<string, { singular: string; placeholder: string }> = {
    departments: { singular: 'oddělení', placeholder: 'např. Marketing' },
    categories: { singular: 'kategorii', placeholder: 'např. Copywriting' },
    tasks: { singular: 'úkol', placeholder: 'např. Tvorba příspěvku na social' },
  };

  if (!currentWorkspace) return null;

  const currencySymbol = currentWorkspace.currency === 'EUR' ? '€' : currentWorkspace.currency === 'USD' ? '$' : 'Kč';
  const inputCls = "w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };
  const editInitials = editName.trim()
    ? editName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tým & Struktura</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Členové, oddělení, kategorie a úkoly
            </p>
          </div>
        </div>

        {/* Taby */}
        <div className="relative mb-6">
          <div className="flex gap-1 rounded-lg p-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ background: 'var(--bg-hover)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); resetForm(); }}
                className="flex-shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
                <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{tab.count}</span>
              </button>
            ))}
          </div>
          {/* Gradient indikátor, že je možné scrollovat doprava */}
          <div className="absolute right-1 top-1 bottom-1 w-8 pointer-events-none rounded-r-lg"
            style={{ background: 'linear-gradient(to right, transparent, var(--bg-hover))' }} />
        </div>

        {/* ========== TAB: ČLENOVÉ ========== */}
        {activeTab === 'members' && (
          <>
            {isWorkspaceAdmin && currentWorkspace.join_code && (
              <div className="mb-6 p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Kód pro připojení</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Sdílejte tento kód s novými členy. Zadají ho při registraci.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 px-4 py-3 rounded-lg border font-mono text-2xl font-bold text-center select-all"
                    style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--primary)', letterSpacing: '0.3em' }}
                  >
                    {currentWorkspace.join_code}
                  </div>
                  <button
                    onClick={copyJoinCode}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap"
                    style={{
                      borderColor: codeCopied ? 'var(--success)' : 'var(--border)',
                      background: codeCopied ? 'var(--bg-hover)' : 'var(--bg-input)',
                      color: codeCopied ? 'var(--success)' : 'var(--text-secondary)',
                    }}
                  >
                    {codeCopied ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Zkopírováno
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Kopírovat
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Jak to funguje:</strong>{' '}
                    Nový člen se zaregistruje a zadá tento kód. Po registraci se objeví níže jako čekající – admin ho schválí.
                  </p>
                  <button
                    onClick={regenerateJoinCode}
                    disabled={regenerating}
                    className="mt-2 text-[11px] transition-colors disabled:opacity-50"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {regenerating ? 'Generuji...' : '↻ Vygenerovat nový kód (zneplatní starý)'}
                  </button>
                </div>
              </div>
            )}

            {/* Vyhledávání a řazení členů */}
            {!loading && members.filter(m => m.approved && (isMasterAdmin || !m.profile?.is_master_admin)).length > 0 && (
              <div className="mb-4">
                {/* Search input */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Hledat člena..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  {memberSearch && (
                    <button
                      onClick={() => setMemberSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-muted)' }}
                      title="Vymazat hledání"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Řazení */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs mr-0.5" style={{ color: 'var(--text-muted)' }}>Řadit:</span>
                  {([
                    { key: 'role' as const, label: 'Práva' },
                    { key: 'name_asc' as const, label: 'A → Z' },
                    { key: 'name_desc' as const, label: 'Z → A' },
                  ] as const).map(s => (
                    <button
                      key={s.key}
                      onClick={() => setMemberSort(s.key)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                      style={{
                        background: memberSort === s.key ? 'var(--primary)' : 'var(--bg-card)',
                        color: memberSort === s.key ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${memberSort === s.key ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <>
                {isWorkspaceAdmin && members.some(m => !m.approved) && (
                  <div className="mb-4 rounded-xl border overflow-hidden" style={{ borderColor: '#f59e0b' }}>
                    <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#fffbeb', borderBottom: '1px solid #f59e0b' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#92400e' }}>
                        Čeká na schválení
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
                          style={{ background: 'var(--danger)' }}
                        >
                          {members.filter(m => !m.approved).length}
                        </span>
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg-card)' }}>
                      {members.filter(m => !m.approved).map(member => {
                        const p = member.profile;
                        const initials = p?.display_name ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
                        return (
                          <div key={member.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 opacity-60" style={{ background: p?.avatar_color ?? '#94a3b8' }}>
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p?.display_name ?? 'Neznámý'}</div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p?.email}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => approveMember(member.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#bbf7d0'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#dcfce7'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                Schválit
                              </button>
                              <button
                                onClick={() => rejectMember(member.id, p?.display_name ?? '')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                                Zamítnout
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {members.filter(m => m.approved && (isMasterAdmin || !m.profile?.is_master_admin) && (
                    !memberSearch.trim() ||
                    m.profile?.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
                    m.profile?.email?.toLowerCase().includes(memberSearch.toLowerCase())
                  )).length === 0 && memberSearch.trim() && (
                    <div className="text-center py-8 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné výsledky hledání.</p>
                    </div>
                  )}
                  {members.filter(m => m.approved && (isMasterAdmin || !m.profile?.is_master_admin) && (
                    !memberSearch.trim() ||
                    m.profile?.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
                    m.profile?.email?.toLowerCase().includes(memberSearch.toLowerCase())
                  )).sort((a, b) => {
                    if (memberSort === 'name_asc') return (a.profile?.display_name ?? '').localeCompare(b.profile?.display_name ?? '', 'cs');
                    if (memberSort === 'name_desc') return (b.profile?.display_name ?? '').localeCompare(a.profile?.display_name ?? '', 'cs');
                    // 'role': řadit dle práv, stejná práva abecedně
                    const ra = ROLE_ORDER[a.role] ?? 99;
                    const rb = ROLE_ORDER[b.role] ?? 99;
                    if (ra !== rb) return ra - rb;
                    return (a.profile?.display_name ?? '').localeCompare(b.profile?.display_name ?? '', 'cs');
                  }).map(member => {
                    const p = member.profile;
                    const initials = p?.display_name ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
                    const isCurrentUser = member.user_id === user?.id;
                    return (
                      <div key={member.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: p?.avatar_color ?? 'var(--primary)' }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p?.display_name ?? 'Neznámý'}</span>
                            {isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>Ty</span>}
                          </div>
                          {p?.position && (
                            <div className="text-xs truncate font-medium" style={{ color: 'var(--primary)', opacity: 0.85 }}>
                              {p.position}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p?.email}</span>
                            {p?.email && (
                              <button
                                onClick={(e) => { e.stopPropagation(); copyEmail(member.id, p.email); }}
                                title="Kopírovat e-mail"
                                className="flex-shrink-0 p-0.5 rounded transition-colors"
                                style={{ color: copiedEmailId === member.id ? '#16a34a' : 'var(--text-muted)' }}
                              >
                                {copiedEmailId === member.id ? (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                )}
                              </button>
                            )}
                          </div>
                          {p?.phone && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatPhone(p.phone)}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyPhone(member.id, p.phone); }}
                                title="Kopírovat telefon"
                                className="flex-shrink-0 p-0.5 rounded transition-colors"
                                style={{ color: copiedPhoneId === member.id ? '#16a34a' : 'var(--text-muted)' }}
                              >
                                {copiedPhoneId === member.id ? (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {(activeRates[member.id] !== undefined || member.hourly_rate !== null) &&
                         (isWorkspaceAdmin || isCurrentUser || (isManager && isManagerOf(member.user_id))) && (
                          <span className="text-xs hidden sm:inline flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                            {activeRates[member.id] ?? member.hourly_rate} {currencySymbol}/h
                          </span>
                        )}

                        {isWorkspaceAdmin && member.cooperation_type_id && (() => {
                          const ct = cooperationTypes.find(c => c.id === member.cooperation_type_id);
                          return ct ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full hidden sm:inline-block flex-shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                              {ct.name}
                            </span>
                          ) : null;
                        })()}

                        {isWorkspaceAdmin && !isCurrentUser && member.role !== 'owner' ? (
                          <div className="relative flex-shrink-0">
                            <select
                              value={member.role}
                              onChange={(e) => updateMemberRole(member.id, e.target.value as UserRole)}
                              className="px-2 py-1 pr-6 rounded-md border text-base sm:text-sm appearance-none cursor-pointer"
                              style={inputStyle}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Team Manager</option>
                              <option value="member">Člen</option>
                            </select>
                            <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                            {ROLE_LABELS[member.role] ?? member.role}
                          </span>
                        )}

                        {isWorkspaceAdmin && !isCurrentUser && (
                          <button
                            onClick={() => openEditMember(member)}
                            className="p-1.5 rounded transition-colors flex-shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            title="Upravit uživatele"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}

                        {isWorkspaceAdmin && !isCurrentUser && member.role !== 'owner' && (
                          <button
                            onClick={() => removeMember(member.id, p?.display_name ?? '')}
                            className="p-1.5 rounded transition-colors flex-shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            title="Odebrat z workspace"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ========== TAB: ODDĚLENÍ / KATEGORIE / ÚKOLY ========== */}
        {activeTab !== 'members' && activeTab !== 'managers' && (
          <>
            {isWorkspaceAdmin && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 mb-4 rounded-xl border-2 border-dashed text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                + Přidat {tabLabels[activeTab]?.singular}
              </button>
            )}
            {showForm && (
              <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="space-y-3">
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={tabLabels[activeTab]?.placeholder} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveItem(); if (e.key === 'Escape') resetForm(); }} className={inputCls} style={inputStyle} />
                  {activeTab === 'categories' && (
                    <select value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className={inputCls} style={inputStyle}>
                      <option value="">Oddělení (volitelné)</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  )}
                  {activeTab === 'tasks' && (
                    <div className="grid grid-cols-2 gap-3">
                      <select value={formProject} onChange={(e) => setFormProject(e.target.value)} className={inputCls} style={inputStyle}>
                        <option value="">Projekt (volitelné)</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={inputCls} style={inputStyle}>
                        <option value="">Kategorie (volitelné)</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={resetForm} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
                    <button onClick={saveItem} disabled={saving || !formName.trim()} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                      {saving ? 'Ukládám...' : 'Přidat'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {loading ? (
              <div className="text-center py-12"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {activeTab === 'departments' && departments.map(item => (
                  <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 transition-colors" style={{ borderColor: 'var(--border)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                    {isWorkspaceAdmin && <button onClick={() => deleteItem('trackino_departments', item.id, item.name)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><TrashIcon /></button>}
                  </div>
                ))}
                {activeTab === 'categories' && categories.map(item => {
                  const dept = departments.find(d => d.id === item.department_id);
                  return (
                    <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 transition-colors" style={{ borderColor: 'var(--border)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        {dept && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({dept.name})</span>}
                      </div>
                      {isWorkspaceAdmin && <button onClick={() => deleteItem('trackino_categories', item.id, item.name)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><TrashIcon /></button>}
                    </div>
                  );
                })}
                {activeTab === 'tasks' && tasks.map(item => {
                  const proj = projects.find(p => p.id === item.project_id);
                  const cat = categories.find(c => c.id === item.category_id);
                  return (
                    <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 transition-colors" style={{ borderColor: 'var(--border)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        <div className="flex gap-2 mt-0.5">
                          {proj && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{proj.name}</span>}
                          {cat && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {cat.name}</span>}
                        </div>
                      </div>
                      {isWorkspaceAdmin && <button onClick={() => deleteItem('trackino_tasks', item.id, item.name)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}><TrashIcon /></button>}
                    </div>
                  );
                })}
                {((activeTab === 'departments' && departments.length === 0) || (activeTab === 'categories' && categories.length === 0) || (activeTab === 'tasks' && tasks.length === 0)) && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Zatím žádné {activeTab === 'departments' ? 'oddělení' : activeTab === 'categories' ? 'kategorie' : 'úkoly'}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========== TAB: MANAŽEŘI ========== */}
      {activeTab === 'managers' && isWorkspaceAdmin && (
        <div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
            Kliknutím na manažera ho přiřadíte nebo odeberete. Každý člen může mít více manažerů.
          </p>

          {loading ? (
            <div className="text-center py-12"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : members.filter(m => m.approved && m.role !== 'owner' && (isMasterAdmin || !m.profile?.is_master_admin)).length === 0 ? (
            <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádní členové.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.filter(m => m.approved && m.role !== 'owner' && (isMasterAdmin || !m.profile?.is_master_admin)).map(member => {
                const p = member.profile;
                const initials = p?.display_name ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
                const assignedManagerIds = wsManagerAssignments
                  .filter(a => a.member_user_id === member.user_id)
                  .map(a => a.manager_user_id);
                const availableManagers = members.filter(m2 =>
                  m2.approved &&
                  m2.user_id !== member.user_id &&
                  (m2.role === 'manager' || m2.role === 'admin')
                );

                const toggleManager = async (managerUserId: string) => {
                  if (!currentWorkspace) return;
                  setSavingAssignment(true);
                  const existing = wsManagerAssignments.find(
                    a => a.member_user_id === member.user_id && a.manager_user_id === managerUserId
                  );
                  if (existing) {
                    await supabase.from('trackino_manager_assignments').delete().eq('id', existing.id);
                  } else {
                    await supabase.from('trackino_manager_assignments').insert({
                      workspace_id: currentWorkspace.id,
                      member_user_id: member.user_id,
                      manager_user_id: managerUserId,
                    });
                  }
                  setSavingAssignment(false);
                  fetchData();
                };

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  >
                    {/* Avatar + jméno */}
                    <div className="flex items-center gap-3 w-52 flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: p?.avatar_color ?? 'var(--primary)' }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {p?.display_name ?? 'Neznámý'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {ROLE_LABELS[member.role] ?? member.role}
                        </div>
                      </div>
                    </div>

                    {/* Oddělovač */}
                    <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />

                    {/* Manažeři */}
                    <div className="flex flex-wrap gap-2 flex-1">
                      {availableManagers.length === 0 ? (
                        <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                          Žádní manažeři k dispozici
                        </span>
                      ) : (
                        availableManagers.map(mgr => {
                          const mgrProfile = mgr.profile;
                          const isAssigned = assignedManagerIds.includes(mgr.user_id);
                          return (
                            <button
                              key={mgr.user_id}
                              onClick={() => toggleManager(mgr.user_id)}
                              disabled={savingAssignment}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50"
                              style={{
                                background: isAssigned ? 'var(--primary)' : 'var(--bg-hover)',
                                borderColor: isAssigned ? 'var(--primary)' : 'var(--border)',
                                color: isAssigned ? '#fff' : 'var(--text-secondary)',
                              }}
                              title={isAssigned ? 'Kliknutím odeberete manažera' : 'Kliknutím přiřadíte manažera'}
                            >
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                                style={{
                                  background: isAssigned ? 'rgba(255,255,255,0.25)' : (mgrProfile?.avatar_color ?? 'var(--primary)'),
                                  color: '#fff',
                                }}
                              >
                                {mgrProfile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                              </div>
                              {mgrProfile?.display_name ?? 'Neznámý'}
                              {isAssigned && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== EDIT MEMBER MODAL ========== */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditingMember(null)} />

          <div
            className="relative w-full max-w-md rounded-xl shadow-xl z-10 flex flex-col"
            style={{ maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Upravit uživatele</h3>
              <button onClick={() => setEditingMember(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {/* Avatar + color picker */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 transition-colors" style={{ background: editColor }}>
                  {editInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Barva avatara</div>
                  <div className="flex flex-wrap gap-1.5">
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)} className="w-5 h-5 rounded-full transition-all flex-shrink-0" style={{ background: c, outline: editColor === c ? '2px solid #000' : 'none', outlineOffset: '2px' }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Jméno */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Jméno</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Jan Novák" className={inputCls} style={inputStyle} />
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>E-mail</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="jan@firma.cz" className={inputCls} style={inputStyle} />
              </div>

              {/* Telefon + Pozice */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Telefon</label>
                  <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+420 123 456 789" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Pozice</label>
                  <input type="text" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} placeholder="např. Grafik" className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Typ spolupráce */}
              {cooperationTypes.length > 0 && (
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Typ spolupráce</label>
                  <div className="relative">
                    <select
                      value={editCooperationTypeId}
                      onChange={(e) => setEditCooperationTypeId(e.target.value)}
                      className={inputCls + ' pr-8 appearance-none cursor-pointer'}
                      style={inputStyle}
                    >
                      <option value="">— Nevybráno —</option>
                      {cooperationTypes.map(ct => (
                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                      ))}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </div>
              )}

              {/* Dovolená */}
              <div className="mb-4">
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanUseVacation ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanUseVacation ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanUseVacation}
                    onChange={(e) => setEditCanUseVacation(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Může čerpat dovolenou</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Zaměstnanec s nárokem na dovolenou (HPP apod.)</span>
                  </div>
                </label>
              </div>

              {/* Fakturace */}
              <div className="mb-4 space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Fakturace</div>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanInvoice ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanInvoice ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanInvoice}
                    onChange={(e) => setEditCanInvoice(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Může fakturovat</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uživatel může podávat žádosti o proplacení faktury</span>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanManageBilling ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanManageBilling ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanManageBilling}
                    onChange={(e) => setEditCanManageBilling(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Správce fakturace</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Může stahovat faktury a označovat je jako proplacené</span>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanViewAudit ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanViewAudit ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanViewAudit}
                    onChange={(e) => setEditCanViewAudit(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Audit log</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Může zobrazit historii úprav záznamů podřízených</span>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanProcessRequests ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanProcessRequests ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanProcessRequests}
                    onChange={(e) => setEditCanProcessRequests(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Zpracovává žádosti</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Může schvalovat a zamítat žádosti zaměstnanců</span>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanReceiveFeedback ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanReceiveFeedback ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanReceiveFeedback}
                    onChange={(e) => setEditCanReceiveFeedback(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Přijímá připomínky</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Může zobrazit anonymní připomínky od kolegů</span>
                  </div>
                </label>
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: editCanManageDocuments ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = editCanManageDocuments ? 'var(--bg-active)' : 'var(--bg-hover)'}
                >
                  <input
                    type="checkbox"
                    checked={editCanManageDocuments}
                    onChange={(e) => setEditCanManageDocuments(e.target.checked)}
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Spravuje dokumenty</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Může nahrávat, mazat a spravovat složky v Dokumentech</span>
                  </div>
                </label>

                {/* Fakturační profil */}
                {billingProfiles.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Fakturační profil
                    </label>
                    <select
                      value={editBillingProfileId}
                      onChange={(e) => setEditBillingProfileId(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="">— Výchozí profil workspace —</option>
                      {billingProfiles.map(bp => (
                        <option key={bp.id} value={bp.id}>
                          {bp.name}{bp.is_default ? ' (výchozí)' : ''}
                          {bp.company_name ? ` – ${bp.company_name}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Fakturační profil se uživateli zobrazí při žádosti o fakturaci.
                    </p>
                  </div>
                )}
              </div>

              {/* Hodinové sazby */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hodinové sazby</label>
                  {!showAddRate && (
                    <button
                      onClick={() => setShowAddRate(true)}
                      className="flex items-center gap-1 text-xs font-medium transition-colors"
                      style={{ color: 'var(--primary)' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Přidat sazbu
                    </button>
                  )}
                </div>

                {/* Formulář nové sazby */}
                {showAddRate && (
                  <div className="mb-2 p-3 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <input
                          type="number" value={newRateAmount} onChange={(e) => setNewRateAmount(e.target.value)}
                          placeholder="250" min="0" step="1"
                          className="w-full px-3 py-2 pr-12 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={inputStyle}
                          onKeyDown={(e) => { if (e.key === 'Enter') addMemberRate(); }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>{currencySymbol}/h</span>
                      </div>
                      <div className="flex-1">
                        <input
                          type="date" value={newRateFrom} onChange={(e) => setNewRateFrom(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAddRate(false); setNewRateAmount(''); setNewRateFrom(''); }} className="flex-1 py-1.5 rounded-lg border text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
                      <button onClick={addMemberRate} disabled={addingRate || !newRateAmount || !newRateFrom} className="flex-1 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                        {addingRate ? '...' : 'Přidat'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Seznam sazeb */}
                {ratesLoading ? (
                  <div className="py-3 text-center"><div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : memberRates.length === 0 ? (
                  <div className="py-3 text-center text-xs rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    Zatím žádné sazby. Klikněte „Přidat sazbu".
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {memberRates.map(rate => (
                      <div key={rate.id} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                            {rate.hourly_rate} {currencySymbol}/h
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                            od {fmtDateShort(rate.valid_from)}
                          </span>
                          {rate.valid_to ? (
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                              – {fmtDateShort(rate.valid_to)}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: '#dcfce7', color: '#15803d' }}>
                              Aktivní
                            </span>
                          )}
                          <div className="flex-1" />
                          <button onClick={() => deleteMemberRate(rate.id)} className="p-1 rounded transition-colors flex-shrink-0" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <TrashIcon size={12} />
                          </button>
                        </div>

                        {/* Input pro uzavření aktivní sazby */}
                        {!rate.valid_to && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>platí do:</span>
                            <input
                              type="date"
                              value={rateValidToEdits[rate.id] ?? ''}
                              onChange={(e) => setRateValidToEdits(prev => ({ ...prev, [rate.id]: e.target.value }))}
                              className="flex-1 px-2 py-1 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                            {rateValidToEdits[rate.id] && (
                              <button
                                onClick={() => saveRateValidTo(rate.id)}
                                disabled={savingRateId === rate.id}
                                className="px-2.5 py-1 rounded-md text-xs font-medium text-white disabled:opacity-50 flex-shrink-0"
                                style={{ background: 'var(--primary)' }}
                              >
                                {savingRateId === rate.id ? '...' : '✓'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setEditingMember(null)}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Zrušit
              </button>
              <button
                onClick={saveMemberEdit}
                disabled={editSaving || !editName.trim()}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {editSaving ? 'Ukládám...' : 'Uložit jméno & barvu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function TeamPage() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <WorkspaceProvider>
      <TeamContent />
    </WorkspaceProvider>
  );
}
