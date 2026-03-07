'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Project, Category, Task } from '@/types/database';

interface ManualTimeEntryProps {
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function ManualTimeEntry({ onSaved, onCancel }: ManualTimeEntryProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTask, setSelectedTask] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;

    const [projectsRes, categoriesRes, tasksRes] = await Promise.all([
      supabase.from('trackino_projects').select('*').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
    ]);

    setProjects((projectsRes.data ?? []) as Project[]);
    setCategories((categoriesRes.data ?? []) as Category[]);
    setTasks((tasksRes.data ?? []) as Task[]);
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Výpočet trvání
  const calculateDuration = () => {
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    const diff = (end.getTime() - start.getTime()) / 1000;
    return diff;
  };

  const formatPreview = () => {
    const seconds = calculateDuration();
    if (seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const save = async () => {
    if (!user || !currentWorkspace) return;

    const duration = calculateDuration();
    if (duration <= 0) {
      setError('Konec musí být po začátku');
      return;
    }

    setError('');
    setSaving(true);

    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    const { error: dbError } = await supabase
      .from('trackino_time_entries')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        description: description.trim(),
        project_id: selectedProject || null,
        category_id: selectedCategory || null,
        task_id: selectedTask || null,
        start_time: startDateTime,
        end_time: endDateTime,
        duration: Math.floor(duration),
        is_running: false,
      });

    setSaving(false);

    if (dbError) {
      setError(dbError.message);
    } else {
      onSaved?.();
    }
  };

  return (
    <div
      className="rounded-xl border p-5 mb-6 animate-fade-in"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Manuální zadání času
        </h3>
        <span className="text-lg font-mono font-bold" style={{ color: 'var(--primary)' }}>
          {formatPreview()}
        </span>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Popis */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Na čem jste pracovali?"
        className="w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
      />

      {/* Datum + časy: mobil = Datum přes celou šířku (2/2), Od+Do vedle sebe (1/2+1/2); desktop = 3 sloupce */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div className="col-span-2 sm:col-span-1 min-w-0">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Datum</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Od</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Do</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
          />
        </div>
      </div>

      {/* Projekt / Kategorie / Úkol */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <option value="">Projekt</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <option value="">Kategorie</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="relative">
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            <option value="">Úkol</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Tlačítka */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Zrušit
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? 'Ukládám...' : 'Uložit záznam'}
        </button>
      </div>
    </div>
  );
}
