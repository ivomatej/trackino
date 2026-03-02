'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Project, Category, Task, TimeEntry } from '@/types/database';

interface TimerBarProps {
  onEntryChanged?: () => void;
}

type EntryMode = 'timer' | 'manual';

export default function TimerBar({ onEntryChanged }: TimerBarProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [mode, setMode] = useState<EntryMode>('timer');
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

  // Manual mode state
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('10:00');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');

  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const taskPickerRef = useRef<HTMLDivElement>(null);

  // Zavírání pickerů klikem mimo
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false);
        setProjectSearch('');
      }
      if (taskPickerRef.current && !taskPickerRef.current.contains(e.target as Node)) {
        setShowTaskPicker(false);
        setTaskSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      const start = new Date(entry.start_time).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }
  }, [user, currentWorkspace]);

  useEffect(() => { fetchData(); checkRunningTimer(); }, [fetchData, checkRunningTimer]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startTimer = async () => {
    if (!user || !currentWorkspace) return;
    const { data, error } = await supabase
      .from('trackino_time_entries')
      .insert({
        workspace_id: currentWorkspace.id, user_id: user.id,
        description: description.trim(),
        project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
        start_time: new Date().toISOString(), is_running: true,
      })
      .select().single();
    if (!error && data) { setActiveEntry(data as TimeEntry); setIsRunning(true); setElapsed(0); }
  };

  const stopTimer = async () => {
    if (!activeEntry) return;
    const duration = Math.floor((Date.now() - new Date(activeEntry.start_time).getTime()) / 1000);
    await supabase.from('trackino_time_entries').update({
      end_time: new Date().toISOString(), duration, is_running: false,
      description: description.trim(),
      project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
    }).eq('id', activeEntry.id);
    setIsRunning(false); setActiveEntry(null); setElapsed(0);
    setDescription(''); setSelectedProject(''); setSelectedCategory(''); setSelectedTask('');
    onEntryChanged?.();
  };

  const discardTimer = async () => {
    if (!activeEntry) return;
    await supabase.from('trackino_time_entries').delete().eq('id', activeEntry.id);
    setIsRunning(false); setActiveEntry(null); setElapsed(0);
    setDescription(''); setSelectedProject(''); setSelectedCategory(''); setSelectedTask('');
  };

  // Manual entry save
  const saveManualEntry = async () => {
    if (!user || !currentWorkspace) return;
    const start = new Date(`${manualDate}T${manualStart}:00`);
    const end = new Date(`${manualDate}T${manualEnd}:00`);
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (duration <= 0) {
      setManualError('Konec musí být po začátku');
      return;
    }

    setManualError('');
    setManualSaving(true);

    const { error: dbError } = await supabase
      .from('trackino_time_entries')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        description: description.trim(),
        project_id: selectedProject || null,
        category_id: selectedCategory || null,
        task_id: selectedTask || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration,
        is_running: false,
      });

    setManualSaving(false);

    if (dbError) {
      setManualError(dbError.message);
    } else {
      setDescription('');
      setSelectedProject('');
      setSelectedCategory('');
      setSelectedTask('');
      setManualStart('09:00');
      setManualEnd('10:00');
      setManualDate(new Date().toISOString().split('T')[0]);
      onEntryChanged?.();
    }
  };

  const manualDurationPreview = () => {
    const start = new Date(`${manualDate}T${manualStart}:00`);
    const end = new Date(`${manualDate}T${manualEnd}:00`);
    const diff = (end.getTime() - start.getTime()) / 1000;
    if (diff <= 0) return '0:00:00';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = Math.floor(diff % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const selectedProjectObj = projects.find(p => p.id === selectedProject);

  // Filter projects by search
  const filteredProjects = projects.filter(p => {
    if (!projectSearch) return true;
    const q = projectSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.client && p.client.toLowerCase().includes(q));
  });

  // Group projects by client
  const projectsByClient = filteredProjects.reduce<Record<string, Project[]>>((acc, p) => {
    const client = p.client || 'Bez klienta';
    if (!acc[client]) acc[client] = [];
    acc[client].push(p);
    return acc;
  }, {});

  // Filter categories/tasks by search
  const filteredCategories = categories.filter(c => {
    if (!taskSearch) return true;
    return c.name.toLowerCase().includes(taskSearch.toLowerCase());
  });
  const filteredTasks = tasks.filter(t => {
    if (!taskSearch) return true;
    return t.name.toLowerCase().includes(taskSearch.toLowerCase());
  });

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full">
      {/* Popis – omezená šířka na desktopu */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Na čem pracuješ?"
        className="flex-1 min-w-0 max-w-md px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && mode === 'timer' && !isRunning) startTimer();
          if (e.key === 'Enter' && mode === 'manual') saveManualEntry();
        }}
      />

      {/* Projekt picker */}
      <div className="relative hidden sm:block" ref={projectPickerRef}>
        <button
          onClick={() => { setShowProjectPicker(!showProjectPicker); setShowTaskPicker(false); setProjectSearch(''); }}
          className="p-2 rounded-lg transition-colors relative"
          style={{ color: selectedProject ? selectedProjectObj?.color ?? 'var(--primary)' : 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title={selectedProjectObj?.name ?? 'Projekt'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {selectedProject && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: selectedProjectObj?.color ?? 'var(--primary)' }} />
          )}
        </button>

        {showProjectPicker && (
          <div
            className="absolute top-full right-0 mt-1 rounded-lg border shadow-lg z-50 max-h-80 overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: '320px' }}
          >
            {/* Vyhledávání */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Hledat projekt nebo klienta..."
                className="w-full px-2.5 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto py-1">
              <button
                onClick={() => { setSelectedProject(''); setShowProjectPicker(false); setProjectSearch(''); }}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Žádný projekt
              </button>

              {Object.entries(projectsByClient).map(([client, clientProjects]) => (
                <div key={client}>
                  {/* Klient header */}
                  <div
                    className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider mt-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {client}
                  </div>
                  {clientProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProject(p.id); setShowProjectPicker(false); setProjectSearch(''); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2"
                      style={{ color: 'var(--text-primary)', background: p.id === selectedProject ? 'var(--bg-active)' : 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = p.id === selectedProject ? 'var(--bg-active)' : 'transparent'}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              ))}

              {filteredProjects.length === 0 && projectSearch && (
                <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Žádné výsledky pro &ldquo;{projectSearch}&rdquo;
                </div>
              )}
              {projects.length === 0 && (
                <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Vytvořte projekt v sekci Projekty.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task/Category picker */}
      <div className="relative hidden sm:block" ref={taskPickerRef}>
        <button
          onClick={() => { setShowTaskPicker(!showTaskPicker); setShowProjectPicker(false); setTaskSearch(''); }}
          className="p-2 rounded-lg transition-colors"
          style={{ color: selectedTask || selectedCategory ? 'var(--primary)' : 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Kategorie / Úkol"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path d="M6 6h.008v.008H6V6z" />
          </svg>
        </button>

        {showTaskPicker && (
          <div
            className="absolute top-full right-0 mt-1 rounded-lg border shadow-lg z-50 max-h-80 overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: '320px' }}
          >
            {/* Vyhledávání */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Hledat kategorii nebo úkol..."
                className="w-full px-2.5 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto py-1">
              {/* Kategorie */}
              {(filteredCategories.length > 0 || (!taskSearch && categories.length > 0)) && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Kategorie
                  </div>
                  <button
                    onClick={() => { setSelectedCategory(''); }}
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Žádná
                  </button>
                  {filteredCategories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCategory(c.id); }}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors truncate"
                      style={{ color: 'var(--text-primary)', background: c.id === selectedCategory ? 'var(--bg-active)' : 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = c.id === selectedCategory ? 'var(--bg-active)' : 'transparent'}
                    >
                      {c.name}
                    </button>
                  ))}
                </>
              )}

              {/* Úkoly */}
              {(filteredTasks.length > 0 || (!taskSearch && tasks.length > 0)) && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider mt-1 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    Úkoly
                  </div>
                  <button
                    onClick={() => { setSelectedTask(''); }}
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Žádný
                  </button>
                  {filteredTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTask(t.id); }}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors truncate"
                      style={{ color: 'var(--text-primary)', background: t.id === selectedTask ? 'var(--bg-active)' : 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = t.id === selectedTask ? 'var(--bg-active)' : 'transparent'}
                    >
                      {t.name}
                    </button>
                  ))}
                </>
              )}

              {filteredCategories.length === 0 && filteredTasks.length === 0 && taskSearch && (
                <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Žádné výsledky pro &ldquo;{taskSearch}&rdquo;
                </div>
              )}

              {categories.length === 0 && tasks.length === 0 && (
                <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Vytvořte kategorie a úkoly v sekci Tým.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Oddělovač */}
      <div className="hidden sm:block w-px h-6" style={{ background: 'var(--border)' }} />

      {/* Timer / Manual mode content */}
      {mode === 'timer' ? (
        <>
          {/* Čas – JetBrains Mono font */}
          <div
            className="text-lg sm:text-xl font-bold tabular-nums min-w-[85px] sm:min-w-[100px] text-center"
            style={{
              color: isRunning ? 'var(--primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-jetbrains), monospace',
              letterSpacing: '0.02em',
            }}
          >
            {formatTime(elapsed)}
          </div>

          {/* Start/Stop/Discard */}
          {!isRunning ? (
            <button
              onClick={startTimer}
              className="px-4 sm:px-6 py-2 rounded-lg text-white font-semibold text-sm transition-colors whitespace-nowrap flex-shrink-0"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              START
            </button>
          ) : (
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={stopTimer}
                className="px-4 sm:px-6 py-2 rounded-lg text-white font-semibold text-sm transition-colors whitespace-nowrap"
                style={{ background: 'var(--danger)' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                STOP
              </button>
              <button
                onClick={discardTimer}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Zahodit"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manual mode – compact inline inputs */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="hidden sm:block px-2 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', width: '130px' }}
            />
            <input
              type="time"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="px-2 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', width: '80px' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
            <input
              type="time"
              value={manualEnd}
              onChange={(e) => setManualEnd(e.target.value)}
              className="px-2 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', width: '80px' }}
            />
          </div>

          {/* Duration preview */}
          <div
            className="text-sm font-bold tabular-nums min-w-[70px] text-center hidden sm:block"
            style={{
              color: 'var(--primary)',
              fontFamily: 'var(--font-jetbrains), monospace',
            }}
          >
            {manualDurationPreview()}
          </div>

          {/* Error indicator */}
          {manualError && (
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--danger)' }} title={manualError}>!</span>
          )}

          {/* Uložit */}
          <button
            onClick={saveManualEntry}
            disabled={manualSaving}
            className="px-4 sm:px-5 py-2 rounded-lg text-white font-semibold text-sm transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          >
            {manualSaving ? '...' : 'PŘIDAT'}
          </button>
        </>
      )}

      {/* Přepínač timer/manual – ikonka */}
      {!isRunning && (
        <button
          onClick={() => setMode(mode === 'timer' ? 'manual' : 'timer')}
          className="p-2 rounded-lg transition-colors flex-shrink-0"
          style={{ color: mode === 'manual' ? 'var(--primary)' : 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title={mode === 'timer' ? 'Přepnout na manuální zadání' : 'Přepnout na timer'}
        >
          {mode === 'timer' ? (
            /* Ikona pro manuální – list s perem */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          ) : (
            /* Ikona pro timer – hodiny */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
