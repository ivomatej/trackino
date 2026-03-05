'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Client, Project, ClientProject } from '@/types/database';

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

function ClientsContent() {
  const { currentWorkspace, loading } = useWorkspace();
  const { isWorkspaceAdmin } = usePermissions();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientProjects, setClientProjects] = useState<ClientProject[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [clientSearch, setClientSearch] = useState('');

  // Formulář
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoadingData(true);

    const [cRes, pRes, cpRes] = await Promise.all([
      supabase.from('trackino_clients').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_projects').select('*').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_client_projects').select('*'),
    ]);

    setClients((cRes.data ?? []) as Client[]);
    setProjects((pRes.data ?? []) as Project[]);
    setClientProjects((cpRes.data ?? []) as ClientProject[]);
    setLoadingData(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setColor(COLORS[0]);
    setSelectedProjectIds([]);
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setColor(client.color);
    setSelectedProjectIds(clientProjects.filter(cp => cp.client_id === client.id).map(cp => cp.project_id));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !name.trim()) return;
    setSaving(true);

    if (editingId) {
      // Aktualizace
      await supabase.from('trackino_clients').update({ name: name.trim(), color }).eq('id', editingId);
      // Smazat staré vazby a vytvořit nové
      await supabase.from('trackino_client_projects').delete().eq('client_id', editingId);
      if (selectedProjectIds.length > 0) {
        await supabase.from('trackino_client_projects').insert(
          selectedProjectIds.map(pid => ({ client_id: editingId, project_id: pid }))
        );
      }
    } else {
      // Nový klient
      const { data } = await supabase.from('trackino_clients')
        .insert({ workspace_id: currentWorkspace.id, name: name.trim(), color })
        .select().single();
      if (data && selectedProjectIds.length > 0) {
        await supabase.from('trackino_client_projects').insert(
          selectedProjectIds.map(pid => ({ client_id: data.id, project_id: pid }))
        );
      }
    }

    setSaving(false);
    resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('trackino_clients').delete().eq('id', id);
    fetchData();
  };

  const getClientProjects = (clientId: string) => {
    const pids = clientProjects.filter(cp => cp.client_id === clientId).map(cp => cp.project_id);
    return projects.filter(p => pids.includes(p.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentWorkspace) return <WorkspaceSelector />;

  const inputCls = "w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Klienti</h1>
          {isWorkspaceAdmin && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              + Nový klient
            </button>
          )}
        </div>

        {/* Formulář */}
        {showForm && (
          <div className="mb-6 p-4 rounded-xl border animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {editingId ? 'Upravit klienta' : 'Nový klient'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Název klienta" autoFocus className={inputCls} style={inputStyle} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Barva</label>
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{ background: c, outline: color === c ? '2px solid #000' : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Přiřazené projekty</label>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-input)' }}>
                  {projects.length === 0 ? (
                    <p className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>Žádné projekty</p>
                  ) : projects.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs" style={{ color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(p.id)}
                        onChange={(e) => {
                          setSelectedProjectIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                        }}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={resetForm} className="flex-1 py-2 rounded-lg border text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                {saving ? 'Ukládám...' : editingId ? 'Uložit' : 'Vytvořit'}
              </button>
            </div>
          </div>
        )}

        {/* Vyhledávání */}
        {!loadingData && clients.length > 0 && (
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
              placeholder="Hledat klienta..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch('')}
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

        {/* Seznam klientů */}
        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádní klienti.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.filter(c =>
              !clientSearch.trim() || c.name.toLowerCase().includes(clientSearch.toLowerCase())
            ).length === 0 ? (
              <div className="text-center py-8 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné výsledky hledání.</p>
              </div>
            ) : null}
            {clients.filter(c =>
              !clientSearch.trim() || c.name.toLowerCase().includes(clientSearch.toLowerCase())
            ).map(client => {
              const cProjects = getClientProjects(client.id);
              return (
                <div
                  key={client.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border group"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: client.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{client.name}</div>
                    {cProjects.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {cProjects.map(p => (
                          <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isWorkspaceAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(client)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(client.id)} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [authLoading, user, router]);
  if (authLoading || !user) return null;
  return <WorkspaceProvider><ClientsContent /></WorkspaceProvider>;
}

export default ClientsPage;
