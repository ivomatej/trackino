'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { useRouter } from 'next/navigation';
import type { Workspace, WorkspaceMember, Profile, Tariff, UserRole } from '@/types/database';

const TARIFF_LABELS: Record<Tariff, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Max',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlastník',
  admin: 'Admin',
  manager: 'Team Manager',
  member: 'Člen',
};

interface WorkspaceWithMembers extends Workspace {
  memberCount?: number;
}

interface MemberWithProfile extends WorkspaceMember {
  profile?: Profile;
}

function AdminContent() {
  const { profile } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<WorkspaceWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editTariff, setEditTariff] = useState<Tariff>('free');
  const [editSaving, setEditSaving] = useState(false);

  // Členové editovaného workspace
  const [wsMembers, setWsMembers] = useState<MemberWithProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Nový workspace
  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsTariff, setNewWsTariff] = useState<Tariff>('free');
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

    if (data) {
      const ws = data as Workspace[];
      // Načteme počty členů
      const counts = await Promise.all(
        ws.map(w =>
          supabase
            .from('trackino_workspace_members')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', w.id)
            .eq('approved', true)
        )
      );
      setWorkspaces(ws.map((w, i) => ({ ...w, memberCount: counts[i].count ?? 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const openEdit = async (ws: Workspace) => {
    setEditingWorkspace(ws);
    setEditName(ws.name);
    setEditTariff(ws.tariff);
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
      .insert({ name: newWsName.trim(), slug, created_by: profile.id, join_code: joinCode, tariff: newWsTariff })
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
    fetchWorkspaces();
  };

  const saveEdit = async () => {
    if (!editingWorkspace) return;
    setEditSaving(true);
    await supabase
      .from('trackino_workspaces')
      .update({ name: editName.trim(), tariff: editTariff })
      .eq('id', editingWorkspace.id);
    setEditSaving(false);
    setEditingWorkspace(null);
    fetchWorkspaces();
  };

  const toggleLock = async (ws: Workspace) => {
    const newLocked = !ws.locked;
    const label = newLocked ? 'zamknout' : 'odemknout';
    if (!confirm(`Opravdu chcete ${label} workspace "${ws.name}"?`)) return;
    await supabase
      .from('trackino_workspaces')
      .update({ locked: newLocked })
      .eq('id', ws.id);
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
    // Zkusit najít uživatele podle emailu
    const { data: foundProfile } = await supabase
      .from('trackino_profiles')
      .select('id')
      .eq('email', inviteEmail.trim().toLowerCase())
      .single();

    if (foundProfile) {
      // Přidat přímo
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
      // Uložit pozvánku s kódem
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

  if (!isMasterAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Přístup odepřen – pouze Master Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Správa workspace</h1>
        <button
          onClick={() => { setShowNewWs(v => !v); setNewWsName(''); setNewWsTariff('free'); }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--primary)' }}
        >
          + Nový workspace
        </button>
      </div>

      {showNewWs && (
        <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Nový workspace</div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Název workspace"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
            <div className="relative flex-shrink-0">
              <select
                value={newWsTariff}
                onChange={(e) => setNewWsTariff(e.target.value as Tariff)}
                className="pl-3 pr-8 py-2 rounded-lg border text-sm appearance-none cursor-pointer"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
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

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Načítám...</div>
      ) : (
        <div className="space-y-3">
          {workspaces.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné workspace.</p>
          )}
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{ws.name}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                    >
                      {TARIFF_LABELS[ws.tariff]}
                    </span>
                    {ws.locked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                        Zamčeno
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {ws.memberCount} {ws.memberCount === 1 ? 'člen' : ws.memberCount && ws.memberCount < 5 ? 'členové' : 'členů'} · kód: <span className="font-mono">{ws.join_code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLock(ws)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                    style={{ borderColor: 'var(--border)', color: ws.locked ? '#16a34a' : '#dc2626' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {ws.locked ? 'Odemknout' : 'Zamknout'}
                  </button>
                  <button
                    onClick={() => openEdit(ws)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                    style={{ background: 'var(--primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Upravit
                  </button>
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
              <button onClick={() => setEditingWorkspace(null)} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

              {/* Členové */}
              <div>
                <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Členové</div>
                {membersLoading ? (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Načítám...</div>
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
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
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
                    {inviting ? '...' : 'Přidat'}
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
                {editSaving ? 'Ukládám...' : 'Uložit změny'}
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
