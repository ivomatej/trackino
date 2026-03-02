'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import type { Department, Category, Task } from '@/types/database';

type Tab = 'departments' | 'categories' | 'tasks';

function TeamContent() {
  const { user } = useAuth();
  const { currentWorkspace, userRole } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>('departments');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulářové stavy
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formProject, setFormProject] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const isAdmin = userRole === 'owner' || userRole === 'admin' || userRole === 'manager';

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;

    const [deptRes, catRes, taskRes, projRes] = await Promise.all([
      supabase.from('trackino_departments').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_projects').select('id, name').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
    ]);

    setDepartments((deptRes.data ?? []) as Department[]);
    setCategories((catRes.data ?? []) as Category[]);
    setTasks((taskRes.data ?? []) as Task[]);
    setProjects((projRes.data ?? []) as { id: string; name: string }[]);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormName('');
    setFormDepartment('');
    setFormProject('');
    setFormCategory('');
    setShowForm(false);
  };

  const saveItem = async () => {
    if (!currentWorkspace || !formName.trim()) return;
    setSaving(true);

    if (activeTab === 'departments') {
      await supabase.from('trackino_departments').insert({
        workspace_id: currentWorkspace.id,
        name: formName.trim(),
      });
    } else if (activeTab === 'categories') {
      await supabase.from('trackino_categories').insert({
        workspace_id: currentWorkspace.id,
        name: formName.trim(),
        department_id: formDepartment || null,
      });
    } else if (activeTab === 'tasks') {
      await supabase.from('trackino_tasks').insert({
        workspace_id: currentWorkspace.id,
        name: formName.trim(),
        project_id: formProject || null,
        category_id: formCategory || null,
      });
    }

    setSaving(false);
    resetForm();
    fetchData();
  };

  const deleteItem = async (table: string, id: string, name: string) => {
    if (!confirm(`Opravdu smazat "${name}"?`)) return;
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'departments', label: 'Oddělení', count: departments.length },
    { key: 'categories', label: 'Kategorie', count: categories.length },
    { key: 'tasks', label: 'Úkoly', count: tasks.length },
  ];

  const tabLabels: Record<Tab, { singular: string; placeholder: string }> = {
    departments: { singular: 'oddělení', placeholder: 'např. Marketing' },
    categories: { singular: 'kategorii', placeholder: 'např. Copywriting' },
    tasks: { singular: 'úkol', placeholder: 'např. Tvorba příspěvku na social' },
  };

  if (!currentWorkspace) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tým & Struktura</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Oddělení, kategorie a úkoly
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
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Přidat nový */}
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 mb-4 rounded-xl border-2 border-dashed text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            + Přidat {tabLabels[activeTab].singular}
          </button>
        )}

        {/* Formulář */}
        {showForm && (
          <div
            className="rounded-xl border p-5 mb-4 animate-fade-in"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="space-y-3">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={tabLabels[activeTab].placeholder}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveItem(); if (e.key === 'Escape') resetForm(); }}
                className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />

              {activeTab === 'categories' && (
                <select
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                >
                  <option value="">Oddělení (volitelné)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}

              {activeTab === 'tasks' && (
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formProject}
                    onChange={(e) => setFormProject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Projekt (volitelné)</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Kategorie (volitelné)</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={resetForm} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Zrušit
                </button>
                <button
                  onClick={saveItem}
                  disabled={saving || !formName.trim()}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
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
                {isAdmin && (
                  <button onClick={() => deleteItem('trackino_departments', item.id, item.name)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {activeTab === 'categories' && categories.map(item => {
              const dept = departments.find(d => d.id === item.department_id);
              return (
                <div key={item.id} className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 group transition-colors" style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                    {dept && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({dept.name})</span>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteItem('trackino_categories', item.id, item.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
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
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                    <div className="flex gap-2 mt-0.5">
                      {proj && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{proj.name}</span>}
                      {cat && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {cat.name}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteItem('trackino_tasks', item.id, item.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Prázdný stav */}
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
