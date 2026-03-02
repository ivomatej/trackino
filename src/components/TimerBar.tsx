'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Project, Category, Task, TimeEntry } from '@/types/database';

interface TimerBarProps {
  onEntryChanged?: () => void;
}

export default function TimerBar({ onEntryChanged }: TimerBarProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [description, setDescription] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<string>('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showSelectors, setShowSelectors] = useState(false);

  // Načtení projektů, kategorií, úkolů
  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;

    const [projectsRes, categoriesRes, tasksRes] = await Promise.all([
      supabase
        .from('trackino_projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('archived', false)
        .order('name'),
      supabase
        .from('trackino_categories')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name'),
      supabase
        .from('trackino_tasks')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name'),
    ]);

    setProjects((projectsRes.data ?? []) as Project[]);
    setCategories((categoriesRes.data ?? []) as Category[]);
    setTasks((tasksRes.data ?? []) as Task[]);
  }, [currentWorkspace]);

  // Kontrola běžícího timeru
  const checkRunningTimer = useCallback(async () => {
    if (!user || !currentWorkspace) return;

    const { data } = await supabase
      .from('trackino_time_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .eq('is_running', true)
      .limit(1)
      .single();

    if (data) {
      const entry = data as TimeEntry;
      setActiveEntry(entry);
      setIsRunning(true);
      setDescription(entry.description || '');
      setSelectedProject(entry.project_id || '');
      setSelectedCategory(entry.category_id || '');
      setSelectedTask(entry.task_id || '');

      // Výpočet uběhlého času
      const start = new Date(entry.start_time).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchData();
    checkRunningTimer();
  }, [fetchData, checkRunningTimer]);

  // Odpočet timeru
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Formátování času
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Spuštění timeru
  const startTimer = async () => {
    if (!user || !currentWorkspace) return;

    const { data, error } = await supabase
      .from('trackino_time_entries')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        description: description.trim(),
        project_id: selectedProject || null,
        category_id: selectedCategory || null,
        task_id: selectedTask || null,
        start_time: new Date().toISOString(),
        is_running: true,
      })
      .select()
      .single();

    if (!error && data) {
      setActiveEntry(data as TimeEntry);
      setIsRunning(true);
      setElapsed(0);
    }
  };

  // Zastavení timeru
  const stopTimer = async () => {
    if (!activeEntry) return;

    const endTime = new Date().toISOString();
    const startTime = new Date(activeEntry.start_time).getTime();
    const duration = Math.floor((Date.now() - startTime) / 1000);

    await supabase
      .from('trackino_time_entries')
      .update({
        end_time: endTime,
        duration,
        is_running: false,
        description: description.trim(),
        project_id: selectedProject || null,
        category_id: selectedCategory || null,
        task_id: selectedTask || null,
      })
      .eq('id', activeEntry.id);

    setIsRunning(false);
    setActiveEntry(null);
    setElapsed(0);
    setDescription('');
    setSelectedProject('');
    setSelectedCategory('');
    setSelectedTask('');
    onEntryChanged?.();
  };

  // Zahodit (smazat běžící záznam)
  const discardTimer = async () => {
    if (!activeEntry) return;

    await supabase
      .from('trackino_time_entries')
      .delete()
      .eq('id', activeEntry.id);

    setIsRunning(false);
    setActiveEntry(null);
    setElapsed(0);
    setDescription('');
    setSelectedProject('');
    setSelectedCategory('');
    setSelectedTask('');
  };

  const selectedProjectObj = projects.find(p => p.id === selectedProject);
  const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
  const selectedTaskObj = tasks.find(t => t.id === selectedTask);

  return (
    <div
      className="rounded-xl border p-4 sm:p-6 mb-6"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {/* Hlavní řádek: popis + čas + tlačítko */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Na čem pracuješ?"
          className="flex-1 px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isRunning) startTimer();
          }}
        />

        {/* Čas */}
        <div
          className="text-2xl font-mono font-bold text-center min-w-[120px] tabular-nums"
          style={{ color: isRunning ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          {formatTime(elapsed)}
        </div>

        {/* Start/Stop */}
        {!isRunning ? (
          <button
            onClick={startTimer}
            className="px-6 py-3 rounded-lg text-white font-medium text-sm transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            style={{ background: 'var(--success)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Spustit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={stopTimer}
              className="flex-1 sm:flex-none px-6 py-3 rounded-lg text-white font-medium text-sm transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              style={{ background: 'var(--danger)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
            <button
              onClick={discardTimer}
              className="px-3 py-3 rounded-lg border text-sm transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              title="Zahodit"
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Selektory: Projekt / Kategorie / Úkol */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Projekt */}
        <div className="relative">
          <button
            onClick={() => { setShowProjectPicker(!showProjectPicker); setShowSelectors(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors"
            style={{
              borderColor: selectedProject ? selectedProjectObj?.color ?? 'var(--primary)' : 'var(--border)',
              color: selectedProject ? selectedProjectObj?.color ?? 'var(--primary)' : 'var(--text-muted)',
              background: selectedProject ? `${selectedProjectObj?.color ?? 'var(--primary)'}15` : 'transparent',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {selectedProjectObj?.name ?? 'Projekt'}
          </button>

          {showProjectPicker && (
            <div
              className="absolute top-full left-0 mt-1 w-56 rounded-lg border shadow-lg z-50 py-1 max-h-60 overflow-y-auto"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => { setSelectedProject(''); setShowProjectPicker(false); }}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Žádný projekt
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProject(p.id); setShowProjectPicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                    style={{ background: p.color }}
                  />
                  {p.name}
                  {p.client && <span style={{ color: 'var(--text-muted)' }}>– {p.client}</span>}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Žádné projekty. Vytvořte první v sekci Projekty.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kategorie + Úkol toggle */}
        <button
          onClick={() => { setShowSelectors(!showSelectors); setShowProjectPicker(false); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors"
          style={{
            borderColor: 'var(--border)',
            color: selectedCategory || selectedTask ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          {selectedCategoryObj?.name ?? selectedTaskObj?.name ?? 'Kategorie / Úkol'}
        </button>
      </div>

      {/* Rozbalené selektory */}
      {showSelectors && (
        <div className="mt-3 flex flex-col sm:flex-row gap-3 animate-fade-in">
          {/* Kategorie */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="">Kategorie</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Úkol */}
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="">Úkol</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
