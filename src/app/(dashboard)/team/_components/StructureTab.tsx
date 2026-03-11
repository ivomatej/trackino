'use client';

import type { Department, Category, Task } from '@/types/database';
import type { Tab } from './types';
import { TrashIcon, inputCls, inputStyle } from './types';

interface TabLabels {
  singular: string;
  placeholder: string;
}

interface Props {
  isWorkspaceAdmin: boolean;
  activeTab: Tab;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  formName: string;
  setFormName: (v: string) => void;
  formDepartment: string;
  setFormDepartment: (v: string) => void;
  formProject: string;
  setFormProject: (v: string) => void;
  formCategory: string;
  setFormCategory: (v: string) => void;
  saving: boolean;
  loading: boolean;
  departments: Department[];
  categories: Category[];
  tasks: Task[];
  projects: { id: string; name: string }[];
  saveItem: () => void;
  resetForm: () => void;
  deleteItem: (table: string, id: string, name: string) => void;
  tabLabels: Record<string, TabLabels>;
}

export default function StructureTab({
  isWorkspaceAdmin, activeTab,
  showForm, setShowForm,
  formName, setFormName,
  formDepartment, setFormDepartment,
  formProject, setFormProject,
  formCategory, setFormCategory,
  saving, loading,
  departments, categories, tasks, projects,
  saveItem, resetForm, deleteItem, tabLabels,
}: Props) {
  return (
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
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={tabLabels[activeTab]?.placeholder}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveItem(); if (e.key === 'Escape') resetForm(); }}
              className={inputCls}
              style={inputStyle}
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

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {activeTab === 'departments' && departments.map(item => (
            <div
              key={item.id}
              className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              {isWorkspaceAdmin && (
                <button
                  onClick={() => deleteItem('trackino_departments', item.id, item.name)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}

          {activeTab === 'categories' && categories.map(item => {
            const dept = departments.find(d => d.id === item.department_id);
            return (
              <div
                key={item.id}
                className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                  {dept && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>({dept.name})</span>}
                </div>
                {isWorkspaceAdmin && (
                  <button
                    onClick={() => deleteItem('trackino_categories', item.id, item.name)}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            );
          })}

          {activeTab === 'tasks' && tasks.map(item => {
            const proj = projects.find(p => p.id === item.project_id);
            const cat = categories.find(c => c.id === item.category_id);
            return (
              <div
                key={item.id}
                className="px-4 sm:px-6 py-3 flex items-center justify-between border-b last:border-b-0 transition-colors"
                style={{ borderColor: 'var(--border)' }}
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
                {isWorkspaceAdmin && (
                  <button
                    onClick={() => deleteItem('trackino_tasks', item.id, item.name)}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <TrashIcon />
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
  );
}
