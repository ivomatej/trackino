'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import { formatPhone } from '@/lib/utils';
import type { Workspace, WorkspaceMember, Profile, Tariff, UserRole } from '@/types/database';

const TARIFF_LABELS: Record<Tariff, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Max',
};

const WS_COLORS = [
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

type WsTab = 'active' | 'archived' | 'deleted';

interface WorkspaceExt extends Workspace {
  memberCount: number;
  activeCount: number;
  adminProfile: Profile | null;
}

interface MemberWithProfile extends WorkspaceMember {
  profile?: Profile;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

function CopyBtn({
  value,
  id,
  activeId,
  setActiveId,
  size = 13,
}: {
  value: string;
  id: string;
  activeId: string | null;
  setActiveId: (v: string | null) => void;
  size?: number;
}) {
  const copied = activeId === id;
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        copyToClipboard(value);
        setActiveId(id);
        setTimeout(() => setActiveId(null), 2000);
      }}
      title={copied ? 'Zkopírováno!' : 'Kopírovat'}
      className="p-0.5 rounded transition-colors flex-shrink-0"
      style={{ color: copied ? '#16a34a' : 'var(--text-muted)' }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = 'var(--primary)'; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = copied ? '#16a34a' : 'var(--text-muted)'; }}
    >
      {copied ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function AdminContent() {
  const { profile } = useAuth();
  const { currentWorkspace } = useWorkspace();
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
    let profileMap: Record<string, Profile> = {};
    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', adminUserIds);
      (profiles ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
    }

    // Owner má přednost před adminem
    const sorted = [...adminMembers].sort(a => (a.role === 'owner' ? -1 : 1));
    const adminByWs: Record<string, Profile | null> = {};
    sorted.forEach(m => {
      if (!adminByWs[m.workspace_id]) {
        adminByWs[m.workspace_id] = profileMap[m.user_id] ?? null;
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

  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };
  const selectCls = 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none';

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

  if (!isMasterAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Přístup odepřen – pouze Master Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Správa workspace</h1>
        <button
          onClick={() => { setShowNewWs(v => !v); setNewWsName(''); setNewWsTariff('free'); }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--primary)' }}
        >
          + Nový workspace
        </button>
      </div>

      {/* Formulář nového workspace */}
      {showNewWs && (
        <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Nový workspace</div>
          <div className="flex gap-2 flex-wrap mb-3">
            <input
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Název workspace"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={inputStyle}
            />
            <div className="relative flex-shrink-0">
              <select
                value={newWsTariff}
                onChange={(e) => setNewWsTariff(e.target.value as Tariff)}
                className="pl-3 pr-8 py-2 rounded-lg border text-sm appearance-none cursor-pointer"
                style={inputStyle}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
          <div className="mb-3">
            <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Barva workspace</div>
            <div className="flex flex-wrap gap-1.5">
              {WS_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewWsColor(c)}
                  className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
                  style={{
                    background: c,
                    transform: newWsColor === c ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: newWsColor === c ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createNewWorkspace}
              disabled={creatingWs || !newWsName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {creatingWs ? 'Vytvářím...' : 'Vytvořit'}
            </button>
            <button
              onClick={() => setShowNewWs(false)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Vyhledávání */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Hledat workspace…"
          className="w-full pl-9 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          style={inputStyle}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* Záložky */}
      <div className="flex gap-1 rounded-xl p-1 mb-4" style={{ background: 'var(--bg-hover)' }}>
        {([
          { key: 'active' as WsTab,   label: 'Aktivní',      count: tabCounts.active },
          { key: 'archived' as WsTab, label: 'Archivované',  count: tabCounts.archived },
          { key: 'deleted' as WsTab,  label: 'Smazané',      count: tabCounts.deleted },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
            <span
              className="text-[10px] min-w-[18px] px-1 py-0.5 rounded-full text-center"
              style={{
                background: activeTab === tab.key ? 'var(--bg-hover)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Seznam workspace */}
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Načítám…</div>
      ) : (
        <div className="space-y-3">
          {filteredWorkspaces.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'Žádné workspace neodpovídá hledání.' : 'Žádné workspace v této kategorii.'}
            </p>
          )}

          {filteredWorkspaces.map(ws => (
            <div
              key={ws.id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
            >
              <div className="flex items-start gap-3">
                {/* Barevný avatar */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
                  style={{ background: ws.color ?? 'var(--primary)' }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>

                {/* Obsah */}
                <div className="flex-1 min-w-0">
                  {/* Název + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{ws.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                      {TARIFF_LABELS[ws.tariff]}
                    </span>
                    {ws.locked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">Zamčeno</span>
                    )}
                    {ws.archived_at && !ws.deleted_at && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f0fdf4', color: '#15803d' }}>
                        Archivováno {fmtDate(ws.archived_at)}
                      </span>
                    )}
                    {ws.deleted_at && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef2f2', color: '#dc2626' }}>
                        Smazáno {fmtDate(ws.deleted_at)}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                    {/* Kód + copy */}
                    <span className="inline-flex items-center gap-1">
                      <span>Kód:</span>
                      <span className="font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>{ws.join_code}</span>
                      <CopyBtn value={ws.join_code} id={`code-${ws.id}`} activeId={copiedId} setActiveId={setCopiedId} size={12} />
                    </span>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span>Vytvořeno {fmtDate(ws.created_at)}</span>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span>
                      {ws.memberCount} {ws.memberCount === 1 ? 'člen' : ws.memberCount < 5 ? 'členové' : 'členů'}
                    </span>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span className="inline-flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      {ws.activeCount} aktivních / 30 dní
                    </span>
                  </div>

                  {/* Admin profil */}
                  {ws.adminProfile && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                        style={{ background: ws.adminProfile.avatar_color ?? '#6366f1' }}
                      >
                        {(ws.adminProfile.display_name ?? ws.adminProfile.email ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {ws.adminProfile.display_name ?? ws.adminProfile.email}
                      </span>
                      {ws.adminProfile.email && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{ws.adminProfile.email}</span>
                          <CopyBtn value={ws.adminProfile.email} id={`email-${ws.id}`} activeId={copiedId} setActiveId={setCopiedId} size={11} />
                        </span>
                      )}
                      {ws.adminProfile.phone && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{formatPhone(ws.adminProfile.phone)}</span>
                          <CopyBtn value={ws.adminProfile.phone} id={`phone-${ws.id}`} activeId={copiedId} setActiveId={setCopiedId} size={11} />
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Akční tlačítka */}
                <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                  {!ws.deleted_at && (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          onClick={() => toggleLock(ws)}
                          className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                          style={{ borderColor: 'var(--border)', color: ws.locked ? '#16a34a' : '#dc2626' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {ws.locked ? 'Odemknout' : 'Zamknout'}
                        </button>
                        {!ws.archived_at ? (
                          <button
                            onClick={() => archiveWorkspace(ws)}
                            className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Archivovat
                          </button>
                        ) : (
                          <button
                            onClick={() => restoreWorkspace(ws)}
                            className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                            style={{ borderColor: '#16a34a', color: '#16a34a' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Obnovit
                          </button>
                        )}
                        <button
                          onClick={() => softDeleteWorkspace(ws)}
                          className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                          style={{ borderColor: 'var(--border)', color: '#dc2626' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          Smazat
                        </button>
                        <button
                          onClick={() => openEdit(ws)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors"
                          style={{ background: 'var(--primary)' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          Upravit
                        </button>
                      </div>
                    </>
                  )}
                  {ws.deleted_at && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => restoreWorkspace(ws)}
                        className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                        style={{ borderColor: '#16a34a', color: '#16a34a' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Obnovit
                      </button>
                      <button
                        onClick={() => hardDeleteWorkspace(ws)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors"
                        style={{ background: '#dc2626' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        Trvale smazat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingWorkspace(null); }}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl shadow-2xl z-10 flex flex-col"
            style={{ maxHeight: '90vh', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <h2 className="text-base font-semibold">Upravit workspace</h2>
              <button
                onClick={() => setEditingWorkspace(null)}
                className="p-1 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
              {/* Název */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název workspace</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={inputStyle}
                />
              </div>

              {/* Tarif */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tarif</label>
                <div className="relative">
                  <select
                    value={editTariff}
                    onChange={(e) => setEditTariff(e.target.value as Tariff)}
                    className={selectCls}
                    style={inputStyle}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="max">Max</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>

              {/* Barva */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Barva workspace
                  <span className="ml-2 inline-block w-3 h-3 rounded-full align-middle" style={{ background: editColor }} />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WS_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
                      style={{
                        background: c,
                        transform: editColor === c ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: editColor === c ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Členové */}
              <div>
                <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Členové</div>
                {membersLoading ? (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Načítám…</div>
                ) : wsMembers.length === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Žádní členové.</div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {wsMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: m.profile?.avatar_color ?? '#6366f1' }}
                        >
                          {(m.profile?.display_name ?? m.profile?.email ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {m.profile?.display_name ?? '—'}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{m.profile?.email}</div>
                        </div>
                        <div className="relative flex-shrink-0">
                          <select
                            value={m.role}
                            onChange={(e) => changeMemberRole(m.id, e.target.value as UserRole)}
                            className="pl-2 pr-5 py-1 rounded-md border text-xs appearance-none cursor-pointer"
                            style={inputStyle}
                          >
                            <option value="owner">Vlastník</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="member">Člen</option>
                          </select>
                          <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>
                        <button
                          onClick={() => removeMember(m.id, m.profile?.display_name ?? m.profile?.email ?? '?')}
                          className="flex-shrink-0 p-1 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Přidat člena */}
              <div>
                <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přidat / pozvat člena</div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteCode(null); }}
                    placeholder="email@priklad.cz"
                    className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    style={inputStyle}
                  />
                  <div className="relative flex-shrink-0">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="pl-2 pr-6 py-2 rounded-lg border text-xs appearance-none cursor-pointer"
                      style={inputStyle}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="member">Člen</option>
                    </select>
                    <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                  <button
                    onClick={addMemberByCode}
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                  >
                    {inviting ? '…' : 'Přidat'}
                  </button>
                </div>
                {inviteCode && (
                  <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg-hover)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Uživatel nenalezen – sdílejte kód pozvánky nebo odkaz na registraci s kódem workspace:
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono font-bold text-base tracking-widest" style={{ color: 'var(--primary)' }}>{editingWorkspace.join_code}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>← kód workspace pro registraci</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setEditingWorkspace(null)}
                className="flex-1 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zavřít
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editName.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {editSaving ? 'Ukládám…' : 'Uložit změny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <WorkspaceProvider>
      <DashboardLayout>
        <AdminContent />
      </DashboardLayout>
    </WorkspaceProvider>
  );
}
