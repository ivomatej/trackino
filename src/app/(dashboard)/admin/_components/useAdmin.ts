'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { WS_COLORS } from './types';
import type { Workspace, WorkspaceMember, Profile, Tariff, UserRole } from '@/types/database';
import type { WorkspaceExt, MemberWithProfile, WsTab } from './types';

export function useAdmin() {
  const { profile } = useAuth();
  const { isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<WorkspaceExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WsTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit modal
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editTariff, setEditTariff] = useState<Tariff>('free');
  const [editColor, setEditColor] = useState(WS_COLORS[0]);
  const [editSaving, setEditSaving] = useState(false);

  // Členové editovaného workspace
  const [wsMembers, setWsMembers] = useState<MemberWithProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Nový workspace
  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsTariff, setNewWsTariff] = useState<Tariff>('free');
  const [newWsColor, setNewWsColor] = useState(WS_COLORS[0]);
  const [creatingWs, setCreatingWs] = useState(false);

  // Pozvánka
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isMasterAdmin) {
      router.push('/');
    }
  }, [isMasterAdmin, loading, router]);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trackino_workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const ws = data as WorkspaceExt[];
    const wsIds = ws.map(w => w.id);

    // Počty schválených členů
    const countResults = await Promise.all(
      ws.map(w =>
        supabase
          .from('trackino_workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', w.id)
          .eq('approved', true)
      )
    );

    // Aktivní členové za posledních 30 dní (vytvořili time entry)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const { data: activeEntries } = await supabase
      .from('trackino_time_entries')
      .select('workspace_id, user_id')
      .in('workspace_id', wsIds)
      .gte('created_at', monthAgo.toISOString());

    const activeMap: Record<string, Set<string>> = {};
    (activeEntries ?? []).forEach((row: { workspace_id: string; user_id: string }) => {
      if (!activeMap[row.workspace_id]) activeMap[row.workspace_id] = new Set();
      activeMap[row.workspace_id].add(row.user_id);
    });

    // Owner / admin profily pro každý workspace
    const { data: adminMembersRaw } = await supabase
      .from('trackino_workspace_members')
      .select('workspace_id, user_id, role')
      .in('workspace_id', wsIds)
      .in('role', ['owner', 'admin'])
      .eq('approved', true);

    const adminMembers = (adminMembersRaw ?? []) as { workspace_id: string; user_id: string; role: string }[];
    const adminUserIds = [...new Set(adminMembers.map(m => m.user_id))];
    const profileMap: Record<string, Profile> = {};
    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', adminUserIds);
      (profiles ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
    }

    // Owner má přednost před adminem; Master Admin se přeskakuje
    const sorted = [...adminMembers].sort(a => (a.role === 'owner' ? -1 : 1));
    const adminByWs: Record<string, Profile | null> = {};
    sorted.forEach(m => {
      const p = profileMap[m.user_id];
      if (!adminByWs[m.workspace_id] && !p?.is_master_admin) {
        adminByWs[m.workspace_id] = p ?? null;
      }
    });

    setWorkspaces(ws.map((w, i) => ({
      ...w,
      archived_at: w.archived_at ?? null,
      deleted_at: w.deleted_at ?? null,
      memberCount: countResults[i].count ?? 0,
      activeCount: activeMap[w.id]?.size ?? 0,
      adminProfile: adminByWs[w.id] ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const openEdit = async (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditName(ws.name);
    setEditTariff(ws.tariff);
    setEditColor(ws.color ?? WS_COLORS[0]);
    setInviteEmail('');
    setInviteCode(null);
    setMembersLoading(true);
    const { data: members } = await supabase
      .from('trackino_workspace_members')
      .select('*')
      .eq('workspace_id', ws.id);
    const memberData = (members ?? []) as WorkspaceMember[];
    if (memberData.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', memberData.map(m => m.user_id));
      const pMap: Record<string, Profile> = {};
      (profiles ?? []).forEach((p: Profile) => { pMap[p.id] = p; });
      setWsMembers(memberData.map(m => ({ ...m, profile: pMap[m.user_id] })));
    } else {
      setWsMembers([]);
    }
    setMembersLoading(false);
  };

  const createNewWorkspace = async () => {
    if (!profile || !newWsName.trim()) return;
    setCreatingWs(true);
    const slug = newWsName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const joinCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const { data: ws, error } = await supabase
      .from('trackino_workspaces')
      .insert({ name: newWsName.trim(), slug, created_by: profile.id, join_code: joinCode, tariff: newWsTariff, color: newWsColor })
      .select()
      .single();
    if (!error && ws) {
      await supabase.from('trackino_workspace_members').insert({
        workspace_id: ws.id, user_id: profile.id, role: 'owner' as UserRole, approved: true,
      });
    }
    setCreatingWs(false);
    setShowNewWs(false);
    setNewWsName('');
    setNewWsTariff('free');
    setNewWsColor(WS_COLORS[0]);
    fetchWorkspaces();
  };

  const saveEdit = async () => {
    if (!editingWorkspace) return;
    setEditSaving(true);
    await supabase
      .from('trackino_workspaces')
      .update({ name: editName.trim(), tariff: editTariff, color: editColor })
      .eq('id', editingWorkspace.id);
    setEditSaving(false);
    setEditingWorkspace(null);
    fetchWorkspaces();
  };

  const toggleLock = async (ws: WorkspaceExt) => {
    const newLocked = !ws.locked;
    if (!confirm(`Opravdu chcete ${newLocked ? 'zamknout' : 'odemknout'} workspace "${ws.name}"?`)) return;
    await supabase.from('trackino_workspaces').update({ locked: newLocked }).eq('id', ws.id);
    fetchWorkspaces();
  };

  const archiveWorkspace = async (ws: WorkspaceExt) => {
    if (!confirm(`Archivovat workspace "${ws.name}"? Data zůstanou zachována, workspace půjde obnovit.`)) return;
    await supabase.from('trackino_workspaces').update({ archived_at: new Date().toISOString() }).eq('id', ws.id);
    fetchWorkspaces();
  };

  const restoreWorkspace = async (ws: WorkspaceExt) => {
    await supabase.from('trackino_workspaces').update({ archived_at: null, deleted_at: null }).eq('id', ws.id);
    fetchWorkspaces();
  };

  const softDeleteWorkspace = async (ws: WorkspaceExt) => {
    if (!confirm(`Přesunout workspace "${ws.name}" do koše? Lze obnovit ze záložky Smazané.`)) return;
    await supabase.from('trackino_workspaces').update({ deleted_at: new Date().toISOString() }).eq('id', ws.id);
    fetchWorkspaces();
  };

  const hardDeleteWorkspace = async (ws: WorkspaceExt) => {
    if (!confirm(`TRVALE SMAZAT workspace "${ws.name}"?\nTato akce je NEVRATNÁ a odstraní veškerá data.`)) return;
    if (!confirm(`Potvrzení: Workspace "${ws.name}" bude nenávratně smazán.`)) return;
    await supabase.from('trackino_workspaces').delete().eq('id', ws.id);
    fetchWorkspaces();
  };

  const changeMemberRole = async (memberId: string, role: UserRole) => {
    await supabase.from('trackino_workspace_members').update({ role }).eq('id', memberId);
    setWsMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Opravdu odebrat "${name}" z workspace?`)) return;
    await supabase.from('trackino_workspace_members').delete().eq('id', memberId);
    setWsMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const addMemberByCode = async () => {
    if (!editingWorkspace || !inviteEmail.trim()) return;
    setInviting(true);
    const { data: foundProfile } = await supabase
      .from('trackino_profiles')
      .select('id')
      .eq('email', inviteEmail.trim().toLowerCase())
      .single();
    if (foundProfile) {
      const existing = wsMembers.find(m => m.user_id === foundProfile.id);
      if (existing) {
        alert('Tento uživatel je již členem workspace.');
        setInviting(false);
        return;
      }
      const { error } = await supabase.from('trackino_workspace_members').insert({
        workspace_id: editingWorkspace.id,
        user_id: foundProfile.id,
        role: inviteRole,
        approved: true,
      });
      if (!error) {
        setInviteEmail('');
        openEdit(editingWorkspace);
      }
    } else {
      const token = generateInviteCode();
      await supabase.from('trackino_invitations').insert({
        workspace_id: editingWorkspace.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: profile?.id,
        token,
      });
      setInviteCode(token);
    }
    setInviting(false);
  };

  const tabCounts = {
    active:   workspaces.filter(w => !w.archived_at && !w.deleted_at).length,
    archived: workspaces.filter(w =>  !!w.archived_at && !w.deleted_at).length,
    deleted:  workspaces.filter(w => !!w.deleted_at).length,
  };

  const filteredWorkspaces = workspaces
    .filter(ws => {
      if (activeTab === 'active')   return !ws.archived_at && !ws.deleted_at;
      if (activeTab === 'archived') return !!ws.archived_at && !ws.deleted_at;
      if (activeTab === 'deleted')  return !!ws.deleted_at;
      return true;
    })
    .filter(ws => !searchQuery.trim() || ws.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return {
    isMasterAdmin,
    workspaces,
    loading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    copiedId,
    setCopiedId,
    editingWorkspace,
    setEditingWorkspace,
    editName,
    setEditName,
    editTariff,
    setEditTariff,
    editColor,
    setEditColor,
    editSaving,
    wsMembers,
    membersLoading,
    showNewWs,
    setShowNewWs,
    newWsName,
    setNewWsName,
    newWsTariff,
    setNewWsTariff,
    newWsColor,
    setNewWsColor,
    creatingWs,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviting,
    inviteCode,
    setInviteCode,
    openEdit,
    createNewWorkspace,
    saveEdit,
    toggleLock,
    archiveWorkspace,
    restoreWorkspace,
    softDeleteWorkspace,
    hardDeleteWorkspace,
    changeMemberRole,
    removeMember,
    addMemberByCode,
    tabCounts,
    filteredWorkspaces,
  };
}
