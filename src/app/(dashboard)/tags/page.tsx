'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Tag } from '@/types/database';

const TAG_COLORS = [
  '#8b5cf6', '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

function TagsContent() {
  const { currentWorkspace, loading } = useWorkspace();
  const { isWorkspaceAdmin } = usePermissions();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoadingData(true);
    const { data } = await supabase.from('trackino_tags').select('*').eq('workspace_id', currentWorkspace.id).order('name');
    setTags((data ?? []) as Tag[]);
    setLoadingData(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const resetForm = () => {
    setShowForm(false); setEditingId(null); setName(''); setColor(TAG_COLORS[0]);
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id); setName(tag.name); setColor(tag.color); setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace || !name.trim()) return;
    setSaving(true);

    if (editingId) {
      await supabase.from('trackino_tags').update({ name: name.trim(), color }).eq('id', editingId);
    } else {
      await supabase.from('trackino_tags').insert({ workspace_id: currentWorkspace.id, name: name.trim(), color });
    }

    setSaving(false);
    resetForm();
    fetchTags();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('trackino_tags').delete().eq('id', id);
    fetchTags();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentWorkspace) return <WorkspaceSelector />;

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Štítky</h1>
          {isWorkspaceAdmin && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              + Nový štítek
            </button>
          )}
        </div>

        {/* Formulář */}
        {showForm && (
          <div className="mb-6 p-4 rounded-xl border animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {editingId ? 'Upravit štítek' : 'Nový štítek'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Název štítku" autoFocus className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Barva</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{ background: c, outline: color === c ? '2px solid #000' : 'none', outlineOffset: '2px' }}
                    />
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

        {/* Seznam štítků */}
        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné štítky.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <div
                key={tag.id}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{tag.name}</span>
                {isWorkspaceAdmin && (
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => startEdit(tag)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Upravit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Smazat"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TagsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [authLoading, user, router]);
  if (authLoading || !user) return null;
  return <WorkspaceProvider><TagsContent /></WorkspaceProvider>;
}

export default TagsPage;
