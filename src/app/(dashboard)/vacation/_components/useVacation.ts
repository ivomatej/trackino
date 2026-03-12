'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { VacationEntry, VacationAllowance, Profile, ManagerAssignment } from '@/types/database';
import { APPROVAL_THRESHOLD, ActiveTab, VacationEntryWithProfile } from './types';
import { calcWorkDays, syncVacationToPlanner, removeVacationFromPlanner } from './utils';

export function useVacation() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, managerAssignments } = useWorkspace();
  const { isWorkspaceAdmin, isManager } = usePermissions();

  const [entries, setEntries] = useState<VacationEntryWithProfile[]>([]);
  const [allowance, setAllowance] = useState<VacationAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');

  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formUserId, setFormUserId] = useState('');

  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  // ID podřízených aktuálního managera – useMemo zabrání vzniku nového pole při každém renderu,
  // které by jinak způsobilo nekonečný cyklus useCallback → useEffect → setState → render
  const subordinateUserIds = useMemo(() =>
    (managerAssignments ?? [])
      .filter((a: ManagerAssignment) => a.manager_user_id === user?.id)
      .map((a: ManagerAssignment) => a.member_user_id),
    [managerAssignments, user]
  );

  const canSeeRequests = isWorkspaceAdmin || isManager;
  const computedDays = formStartDate && formEndDate ? calcWorkDays(formStartDate, formEndDate) : 0;

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

  const approvedEntries = selectedUserId === 'all' && isWorkspaceAdmin
    ? entries.filter(e => e.status === 'approved')
    : entries.filter(e => e.user_id === viewUserId && e.status === 'approved');

  const myPendingRejectedEntries = entries.filter(
    e => e.user_id === user?.id && (e.status === 'pending' || e.status === 'rejected')
  );

  const pendingRequestEntries = entries.filter(
    e => e.status === 'pending' && e.user_id !== user?.id
  );

  const archiveEntries = isWorkspaceAdmin
    ? entries.filter(e => e.status === 'approved' || e.status === 'rejected')
    : entries.filter(e =>
        (e.user_id === user?.id || (isManager && subordinateUserIds.includes(e.user_id))) &&
        (e.status === 'approved' || e.status === 'rejected')
      );

  const usedDays = (selectedUserId === 'all' && isWorkspaceAdmin
    ? entries.filter(e => e.status === 'approved')
    : entries.filter(e => e.user_id === viewUserId && e.status === 'approved')
  ).reduce((sum, e) => sum + (e.days ?? 0), 0);

  const totalDays = allowance?.days_per_year ?? null;
  const remainingDays = totalDays !== null ? totalDays - usedDays : null;
  const canUseVacation = currentMembership?.can_use_vacation ?? false;
  const isAddingForOther = isWorkspaceAdmin && formUserId && formUserId !== user?.id;
  const willNeedApproval = !isAddingForOther && computedDays > APPROVAL_THRESHOLD;

  return {
    // Auth/workspace
    user,
    currentWorkspace,
    isWorkspaceAdmin,
    isManager,
    // State
    entries,
    loading,
    showForm, setShowForm,
    saving,
    activeTab, setActiveTab,
    selectedUserId, setSelectedUserId,
    allProfiles,
    formStartDate, setFormStartDate,
    formEndDate, setFormEndDate,
    formNote, setFormNote,
    formUserId, setFormUserId,
    rejectModal, setRejectModal,
    rejecting,
    approving,
    currentYear,
    // Computed
    subordinateUserIds,
    canSeeRequests,
    computedDays,
    approvedEntries,
    myPendingRejectedEntries,
    pendingRequestEntries,
    archiveEntries,
    usedDays,
    totalDays,
    remainingDays,
    canUseVacation,
    isAddingForOther,
    willNeedApproval,
    // Actions
    addEntry,
    deleteEntry,
    approveEntry,
    rejectEntry,
  };
}

export type UseVacationReturn = ReturnType<typeof useVacation>;
