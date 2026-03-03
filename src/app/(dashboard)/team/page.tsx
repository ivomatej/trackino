'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import type { Department, Category, Task, WorkspaceMember, Profile, UserRole } from '@/types/database';

type Tab = 'members' | 'departments' | 'categories' | 'tasks';

const AVATAR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Team Manager',
  member: 'Člen',
};

interface MemberWithProfile extends WorkspaceMember {
  profile?: Profile;
}

function TeamContent() {
  const { user } = useAuth();
  const { currentWorkspace, userRole, refreshWorkspace } = useWorkspace();
  const { isWorkspaceAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<Tab>('members');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Formulářové stavy
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formProject, setFormProject] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;

    const [deptRes, catRes, taskRes, projRes, memRes] = await Promise.all([
      supabase.from('trackino_departments').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_projects').select('id, name').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_workspace_members').select('*').eq('workspace_id', currentWorkspace.id),
    ]);

    setDepartments((deptRes.data ?? []) as Department[]);
    setCategories((catRes.data ?? []) as Category[]);
    setTasks((taskRes.data ?? []) as Task[]);
    setProjects((projRes.data ?? []) as { id: string; name: string }[]);

    // Fetch profiles for members
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
    } else {
      setMembers([]);
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

  const copyJoinCode = async () => {
    if (!currentWorkspace?.join_code) return;
    try {
      await navigator.clipboard.writeText(currentWorkspace.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback pro starší prohlížeče
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
      if (!error) {
        await refreshWorkspace();
      }
    } catch (err) {
      console.warn('Chyba při generování kódu:', err);
    }
    setRegenerating(false);
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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'members', label: 'Členové', count: members.length },
    { key: 'departments', label: 'Oddělení', count: departments.length },
    { key: 'categories', label: 'Kategorie', count: categories.length },
    { key: 'tasks', label: 'Úkoly', count: tasks.length },
  ];

  const tabLabels: Record<string, { singular: string; placeholder: string }> = {
    departments: { singular: 'oddělení', placeholder: 'např. Marketing' },
    categories: { singular: 'kategorii', placeholder: 'např. Copywriting' },
    tasks: { singular: 'úkol', placeholder: 'např. Tvorba příspěvku na social' },
  };

  if (!currentWorkspace) return null;

  // Počet aktivních uživatelů (měřil čas za posledních 30 dní)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const inputCls = "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tým & Struktura</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Členové, oddělení, kategorie a úkoly
            </p>
          </div>
        </div>

        {/* Taby */}
        <div className="flex gap-1 mb-6 rounded-lg p-1" style={{ background: 'var(--bg-hover)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); resetForm(); }}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
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

        {/* ========== TAB: ČLENOVÉ ========== */}
        {activeTab === 'members' && (
          <>
            {/* Kód pro připojení */}
            {isWorkspaceAdmin && currentWorkspace.join_code && (
              <div className="mb-6 p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Kód pro připojení</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Sdílejte tento kód s novými členy. Zadají ho při registraci.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Kód */}
                  <div
                    className="flex-1 px-4 py-3 rounded-lg border font-mono text-2xl font-bold tracking-[0.3em] text-center select-all"
                    style={{
                      background: 'var(--bg-hover)',
                      borderColor: 'var(--border)',
                      color: 'var(--primary)',
                      letterSpacing: '0.3em',
                    }}
                  >
                    {currentWorkspace.join_code}
                  </div>

                  {/* Kopírovat */}
                  <button
                    onClick={copyJoinCode}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap"
                    style={{
                      borderColor: codeCopied ? 'var(--success)' : 'var(--border)',
                      background: codeCopied ? 'var(--bg-hover)' : 'var(--bg-input)',
                      color: codeCopied ? 'var(--success)' : 'var(--text-secondary)',
                    }}
                    title="Kopírovat kód"
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

                {/* Jak to funguje */}
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Jak to funguje:</strong>{' '}
                    Nový člen se zaregistruje na přihlašovací stránce a zadá tento kód do pole „Kód workspace". Po ověření e-mailu bude automaticky přidán jako člen.
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

            {/* Seznam členů */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(member => {
                  const p = member.profile;
                  const initials = p?.display_name ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
                  const isCurrentUser = member.user_id === user?.id;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg border group"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: p?.avatar_color ?? 'var(--primary)' }}
                      >
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {p?.display_name ?? 'Neznámý'}
                          </span>
                          {isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>Ty</span>}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p?.email}</div>
                      </div>

                      {/* Role */}
                      {isWorkspaceAdmin && !isCurrentUser ? (
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.id, e.target.value as UserRole)}
                          className="px-2 py-1 rounded-md border text-xs"
                          style={inputStyle}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Team Manager</option>
                          <option value="member">Člen</option>
                        </select>
                      ) : (
                        <span
                          className="text-xs px-2 py-1 rounded-md"
                          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                        >
                          {ROLE_LABELS[member.role] ?? member.role}
                        </span>
                      )}

                      {/* Sazba */}
                      {member.hourly_rate !== null && (
                        <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                          {member.hourly_rate} Kč/h
                        </span>
                      )}

                      {/* Odebrat */}
                      {isWorkspaceAdmin && !isCurrentUser && member.role !== 'owner' && (
                        <button
                          onClick={() => removeMember(member.id, p?.display_name ?? '')}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Odebrat z workspace"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ========== TAB: ODDĚLENÍ / KATEGORIE / ÚKOLY ========== */}
        {activeTab !== 'members' && (
          <>
            {/* Přidat nový */}
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

            {/* Formulář */}
            {showForm && (
              <div className="rounded-xl border p-5 mb-4 animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="space-y-3">
                  <input
                    type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder={tabLabels[activeTab]?.placeholder} autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') saveItem(); if (e.key === 'Escape') resetForm(); }}
                    className={inputCls} style={inputStyle}
                  />
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

            {/* Seznam */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {activeTab === 'departments' && departments.map(item => (
                  <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 group transition-colors" style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                    {isWorkspaceAdmin && (
                      <button onClick={() => deleteItem('trackino_departments', item.id, item.name)} className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    )}
                  </div>
                ))}

                {activeTab === 'categories' && categories.map(item => {
                  const dept = departments.find(d => d.id === item.department_id);
                  return (
                    <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 group transition-colors" style={{ borderColor: 'var(--border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        {dept && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({dept.name})</span>}
                      </div>
                      {isWorkspaceAdmin && (
                        <button onClick={() => deleteItem('trackino_categories', item.id, item.name)} className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}

                {activeTab === 'tasks' && tasks.map(item => {
                  const proj = projects.find(p => p.id === item.project_id);
                  const cat = categories.find(c => c.id === item.category_id);
                  return (
                    <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 group transition-colors" style={{ borderColor: 'var(--border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        <div className="flex gap-2 mt-0.5">
                          {proj && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{proj.name}</span>}
                          {cat && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {cat.name}</span>}
                        </div>
                      </div>
                      {isWorkspaceAdmin && (
                        <button onClick={() => deleteItem('trackino_tasks', item.id, item.name)} className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}

                {((activeTab === 'departments' && departments.length === 0) ||
                  (activeTab === 'categories' && categories.length === 0) ||
                  (activeTab === 'tasks' && tasks.length === 0)) && (
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
