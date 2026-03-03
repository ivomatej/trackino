'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import type { Project, Client, ClientProject } from '@/types/database';

const PROJECT_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

function ProjectsContent() {
  const { user } = useAuth();
  const { currentWorkspace, userRole } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientProjectMap, setClientProjectMap] = useState<Record<string, string[]>>({}); // projectId -> clientIds[]
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Formulářové stavy
  const [name, setName] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  const isAdmin = userRole === 'owner' || userRole === 'admin' || userRole === 'manager';

  const fetchProjects = useCallback(async () => {
    if (!currentWorkspace) return;
    const [projectsRes, clientsRes, cpRes] = await Promise.all([
      supabase.from('trackino_projects').select('*').eq('workspace_id', currentWorkspace.id).order('archived').order('name'),
      supabase.from('trackino_clients').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_client_projects').select('*'),
    ]);

    const allProjects = (projectsRes.data ?? []) as Project[];
    const allClients = (clientsRes.data ?? []) as Client[];
    const allCp = (cpRes.data ?? []) as ClientProject[];

    setProjects(allProjects);
    setClients(allClients);

    // Sestavit mapu: projectId -> [clientId, ...]
    const cpMap: Record<string, string[]> = {};
    allCp.forEach(cp => {
      if (!cpMap[cp.project_id]) cpMap[cp.project_id] = [];
      cpMap[cp.project_id].push(cp.client_id);
    });
    setClientProjectMap(cpMap);

    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resetForm = () => {
    setName('');
    setSelectedClients([]);
    setColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
    setEditingProject(null);
    setShowForm(false);
    setShowClientPicker(false);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setSelectedClients(clientProjectMap[project.id] ?? []);
    setColor(project.color);
    setShowForm(true);
  };

  const saveProject = async () => {
    if (!currentWorkspace || !name.trim()) return;
    setSaving(true);

    let projectId: string;

    if (editingProject) {
      await supabase
        .from('trackino_projects')
        .update({ name: name.trim(), color })
        .eq('id', editingProject.id);
      projectId = editingProject.id;

      // Smazat staré klientské vazby
      await supabase.from('trackino_client_projects').delete().eq('project_id', projectId);
    } else {
      const { data } = await supabase
        .from('trackino_projects')
        .insert({
          workspace_id: currentWorkspace.id,
          name: name.trim(),
          color,
        })
        .select()
        .single();
      projectId = data?.id;
    }

    // Uložit klientské vazby
    if (projectId && selectedClients.length > 0) {
      await supabase.from('trackino_client_projects').insert(
        selectedClients.map(clientId => ({ client_id: clientId, project_id: projectId }))
      );
    }

    setSaving(false);
    resetForm();
    fetchProjects();
  };

  const toggleArchive = async (project: Project) => {
    await supabase
      .from('trackino_projects')
      .update({ archived: !project.archived })
      .eq('id', project.id);
    fetchProjects();
  };

  const deleteProject = async (project: Project) => {
    if (!confirm(`Opravdu smazat projekt "${project.name}"? Tato akce je nevratná.`)) return;
    await supabase.from('trackino_projects').delete().eq('id', project.id);
    fetchProjects();
  };

  const [projectSearch, setProjectSearch] = useState('');

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const filteredActive = projectSearch.trim()
    ? activeProjects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : activeProjects;
  const filteredArchived = projectSearch.trim()
    ? archivedProjects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : archivedProjects;

  if (!currentWorkspace) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Projekty</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Správa projektů a klientů
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nový projekt
            </button>
          )}
        </div>

        {/* Formulář */}
        {showForm && (
          <div
            className="rounded-xl border p-5 mb-6 animate-fade-in"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingProject ? 'Upravit projekt' : 'Nový projekt'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Název projektu *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="např. Web redesign"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="relative">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Klient
                </label>
                <button
                  type="button"
                  onClick={() => setShowClientPicker(!showClientPicker)}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm text-left focus:outline-none focus:ring-2 focus:ring-[var(--primary)] flex items-center justify-between"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: selectedClients.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <span className="truncate">
                    {selectedClients.length > 0
                      ? selectedClients.map(id => clients.find(c => c.id === id)?.name).filter(Boolean).join(', ')
                      : 'Vyberte klienta...'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showClientPicker && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-50 max-h-48 overflow-y-auto py-1"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  >
                    <button
                      onClick={() => { setSelectedClients([]); setShowClientPicker(false); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      Bez klienta
                    </button>
                    {clients.map(c => {
                      const isSelected = selectedClients.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedClients(selectedClients.filter(id => id !== c.id));
                            } else {
                              setSelectedClients([...selectedClients, c.id]);
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2"
                          style={{ color: 'var(--text-primary)', background: isSelected ? 'var(--bg-active)' : 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'var(--bg-active)' : 'transparent'}
                        >
                          <input type="checkbox" checked={isSelected} readOnly className="w-3.5 h-3.5 rounded" style={{ accentColor: c.color }} />
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                    {clients.length === 0 && (
                      <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                        Vytvořte klienty v sekci Klienti.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Výběr barvy */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Barva
              </label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-transform"
                    style={{
                      background: c,
                      transform: color === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: color === c ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={saveProject}
                disabled={saving || !name.trim()}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {saving ? 'Ukládám...' : editingProject ? 'Uložit' : 'Vytvořit'}
              </button>
            </div>
          </div>
        )}

        {/* Vyhledávání */}
        {!loading && projects.length > 0 && (
          <div className="relative mb-4">
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
              placeholder="Hledat projekt..."
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            {projectSearch && (
              <button
                onClick={() => setProjectSearch('')}
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
        )}

        {/* Seznam projektů */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {filteredActive.length === 0 && !showForm ? (
              <div
                className="rounded-xl border px-6 py-12 text-center"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{projectSearch ? 'Žádné výsledky hledání' : 'Zatím žádné projekty'}</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ background: 'var(--primary)' }}
                  >
                    Vytvořit první projekt
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {filteredActive.map(project => (
                  <div
                    key={project.id}
                    className="px-4 sm:px-6 py-4 flex items-center gap-4 border-b last:border-b-0 group transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: project.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {project.name}
                      </div>
                      {(clientProjectMap[project.id]?.length > 0) && (
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {clientProjectMap[project.id].map(clientId => {
                            const cl = clients.find(c => c.id === clientId);
                            if (!cl) return null;
                            return (
                              <span key={cl.id} className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: cl.color }} />
                                {cl.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(project)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Upravit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleArchive(project)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--warning)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Archivovat"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteProject(project)}
                          className="p-1.5 rounded transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          title="Smazat"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Archivované projekty */}
            {filteredArchived.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                  Archivované ({filteredArchived.length})
                </h3>
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', opacity: 0.7 }}>
                  {filteredArchived.map(project => (
                    <div
                      key={project.id}
                      className="px-4 sm:px-6 py-3 flex items-center gap-4 border-b last:border-b-0 group"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: project.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{project.name}</div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => toggleArchive(project)}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ color: 'var(--primary)' }}
                        >
                          Obnovit
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function ProjectsPage() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <ProjectsContent />
    </WorkspaceProvider>
  );
}
