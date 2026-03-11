'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import type {
  Department, Category, Task, WorkspaceMember, Profile,
  UserRole, MemberRate, CooperationType, WorkspaceBilling,
} from '@/types/database';
import { AVATAR_COLORS, type MemberWithProfile, type ManagerAssignmentRow, type Tab } from './types';

export function useTeam() {
  const { user } = useAuth();
  const { currentWorkspace, refreshWorkspace, isManagerOf } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();

  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [activeRates, setActiveRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSort, setMemberSort] = useState<'role' | 'name_asc' | 'name_desc'>('role');
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
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
  const [editCanManageSubscriptions, setEditCanManageSubscriptions] = useState(false);
  const [editCanManageDomains, setEditCanManageDomains] = useState(false);
  const [editCanManageTasks, setEditCanManageTasks] = useState(false);
  const [editCanViewBirthdays, setEditCanViewBirthdays] = useState(false);
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editCooperationTypeId, setEditCooperationTypeId] = useState<string>('');
  const [editBillingProfileId, setEditBillingProfileId] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  const [billingProfiles, setBillingProfiles] = useState<WorkspaceBilling[]>([]);
  const [cooperationTypes, setCooperationTypes] = useState<CooperationType[]>([]);

  // Manager assignments
  const [wsManagerAssignments, setWsManagerAssignments] = useState<ManagerAssignmentRow[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Hodinové sazby
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
      const { data: profiles } = await supabase.from('trackino_profiles').select('*').in('id', userIds);
      const profileMap: Record<string, Profile> = {};
      (profiles ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
      setMembers(memberData.map(m => ({ ...m, profile: profileMap[m.user_id] })));

      const memberIds = memberData.map(m => m.id);
      const { data: ratesData } = await supabase
        .from('trackino_member_rates').select('workspace_member_id, hourly_rate')
        .in('workspace_member_id', memberIds).is('valid_to', null);
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
    try { await navigator.clipboard.writeText(email); } catch {
      const el = document.createElement('textarea');
      el.value = email; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopiedEmailId(memberId);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const copyPhone = async (memberId: string, phone: string) => {
    try { await navigator.clipboard.writeText(phone); } catch {
      const el = document.createElement('textarea');
      el.value = phone; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopiedPhoneId(memberId);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const copyJoinCode = async () => {
    if (!currentWorkspace?.join_code) return;
    try {
      await navigator.clipboard.writeText(currentWorkspace.join_code);
      setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = currentWorkspace.join_code; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
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
      const { error } = await supabase.from('trackino_workspaces').update({ join_code: newCode }).eq('id', currentWorkspace.id);
      if (!error) await refreshWorkspace();
    } catch (err) { console.warn('Chyba při generování kódu:', err); }
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
    setEditCanManageSubscriptions(member.can_manage_subscriptions ?? false);
    setEditCanManageDomains(member.can_manage_domains ?? false);
    setEditCanManageTasks(member.can_manage_tasks ?? false);
    setEditCanViewBirthdays(member.can_view_birthdays ?? false);
    setEditBirthDate(member.profile?.birth_date ?? '');
    setEditCooperationTypeId(member.cooperation_type_id ?? '');
    setEditBillingProfileId(member.billing_profile_id ?? '');
    setMemberRates([]);
    setShowAddRate(false);
    setNewRateAmount('');
    setNewRateFrom('');
    setRateValidToEdits({});
    setRatesLoading(true);
    const { data } = await supabase.from('trackino_member_rates').select('*').eq('workspace_member_id', member.id).order('valid_from', { ascending: false });
    setMemberRates((data ?? []) as MemberRate[]);
    setRatesLoading(false);
  };

  const saveMemberEdit = async () => {
    if (!editingMember) return;
    setEditSaving(true);
    await Promise.all([
      supabase.from('trackino_profiles').update({
        display_name: editName.trim(), email: editEmail.trim(),
        phone: normalizePhone(editPhone), position: editPosition.trim(),
        avatar_color: editColor, birth_date: editBirthDate || null,
      }).eq('id', editingMember.user_id),
      supabase.from('trackino_workspace_members').update({
        can_use_vacation: editCanUseVacation, can_invoice: editCanInvoice,
        can_manage_billing: editCanManageBilling, can_view_audit: editCanViewAudit,
        can_process_requests: editCanProcessRequests, can_receive_feedback: editCanReceiveFeedback,
        can_manage_documents: editCanManageDocuments, can_manage_subscriptions: editCanManageSubscriptions,
        can_manage_domains: editCanManageDomains, can_manage_tasks: editCanManageTasks,
        can_view_birthdays: editCanViewBirthdays,
        cooperation_type_id: editCooperationTypeId || null,
        billing_profile_id: editBillingProfileId || null,
      }).eq('id', editingMember.id),
    ]);
    setEditSaving(false);
    setEditingMember(null);
    fetchData();
  };

  const addMemberRate = async () => {
    if (!editingMember || !newRateAmount || !newRateFrom) return;
    const rate = parseFloat(newRateAmount);
    if (isNaN(rate) || rate < 0) return;
    setAddingRate(true);
    await supabase.from('trackino_member_rates').insert({
      workspace_member_id: editingMember.id, hourly_rate: rate, valid_from: newRateFrom, valid_to: null,
    });
    setNewRateAmount(''); setNewRateFrom(''); setShowAddRate(false);
    const { data } = await supabase.from('trackino_member_rates').select('*').eq('workspace_member_id', editingMember.id).order('valid_from', { ascending: false });
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
    await supabase.from('trackino_member_rates').update({ valid_to: validTo }).eq('id', rateId);
    setMemberRates(prev => prev.map(r => r.id === rateId ? { ...r, valid_to: validTo } : r));
    setRateValidToEdits(prev => { const next = { ...prev }; delete next[rateId]; return next; });
    setSavingRateId(null);
  };

  const toggleManagerAssignment = async (memberUserId: string, managerUserId: string) => {
    if (!currentWorkspace) return;
    setSavingAssignment(true);
    const existing = wsManagerAssignments.find(
      a => a.member_user_id === memberUserId && a.manager_user_id === managerUserId
    );
    if (existing) {
      await supabase.from('trackino_manager_assignments').delete().eq('id', existing.id);
    } else {
      await supabase.from('trackino_manager_assignments').insert({
        workspace_id: currentWorkspace.id, member_user_id: memberUserId, manager_user_id: managerUserId,
      });
    }
    setSavingAssignment(false);
    fetchData();
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

  const currencySymbol = currentWorkspace?.currency === 'EUR' ? '€' : currentWorkspace?.currency === 'USD' ? '$' : 'Kč';

  const editInitials = editName.trim()
    ? editName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return {
    // Context
    user, currentWorkspace, isWorkspaceAdmin, isManager, isMasterAdmin, isManagerOf,
    // Data
    departments, categories, tasks, projects, members, activeRates,
    loading, cooperationTypes, billingProfiles, wsManagerAssignments,
    // Tab UI
    activeTab, setActiveTab, tabs, tabLabels,
    // Members UI
    memberSearch, setMemberSearch, memberSort, setMemberSort,
    codeCopied, regenerating, copiedEmailId, copiedPhoneId,
    // Form
    showForm, setShowForm, formName, setFormName,
    formDepartment, setFormDepartment, formProject, setFormProject,
    formCategory, setFormCategory, saving,
    // Edit member
    editingMember, setEditingMember,
    editName, setEditName, editEmail, setEditEmail,
    editPhone, setEditPhone, editPosition, setEditPosition,
    editColor, setEditColor, editBirthDate, setEditBirthDate,
    editCanUseVacation, setEditCanUseVacation,
    editCanInvoice, setEditCanInvoice,
    editCanManageBilling, setEditCanManageBilling,
    editCanViewAudit, setEditCanViewAudit,
    editCanProcessRequests, setEditCanProcessRequests,
    editCanReceiveFeedback, setEditCanReceiveFeedback,
    editCanManageDocuments, setEditCanManageDocuments,
    editCanManageSubscriptions, setEditCanManageSubscriptions,
    editCanManageDomains, setEditCanManageDomains,
    editCanManageTasks, setEditCanManageTasks,
    editCanViewBirthdays, setEditCanViewBirthdays,
    editCooperationTypeId, setEditCooperationTypeId,
    editBillingProfileId, setEditBillingProfileId,
    editSaving,
    // Rates
    memberRates, ratesLoading, showAddRate, setShowAddRate,
    newRateAmount, setNewRateAmount, newRateFrom, setNewRateFrom,
    addingRate, savingRateId, rateValidToEdits, setRateValidToEdits,
    savingAssignment,
    // Computed
    currencySymbol, editInitials,
    // Actions
    fetchData, resetForm, saveItem, deleteItem,
    copyEmail, copyPhone, copyJoinCode, regenerateJoinCode,
    approveMember, rejectMember, updateMemberRole, removeMember,
    openEditMember, saveMemberEdit,
    addMemberRate, deleteMemberRate, saveRateValidTo,
    toggleManagerAssignment,
  };
}
