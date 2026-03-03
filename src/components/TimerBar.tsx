'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { splitAtMidnight, crossesMidnight } from '@/lib/midnight-split';
import TagPicker from '@/components/TagPicker';
import type { Project, Category, Task, TimeEntry, RequiredFields } from '@/types/database';

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // Načíst tagy aktivního záznamu
      const { data: tagLinks } = await supabase
        .from('trackino_time_entry_tags')
        .select('tag_id')
        .eq('time_entry_id', entry.id);
      if (tagLinks) setSelectedTags(tagLinks.map((t: { tag_id: string }) => t.tag_id));
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

  // Background midnight check – každých 30s kontroluje přechod přes půlnoc
  const midnightCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && activeEntry && currentWorkspace && user) {
      midnightCheckRef.current = setInterval(async () => {
        const entryStart = new Date(activeEntry.start_time);
        if (crossesMidnight(entryStart)) {
          // Automatický split: zastavit starý záznam na půlnoci a spustit nový
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);

          const durationToMidnight = Math.floor((midnight.getTime() - entryStart.getTime()) / 1000);

          // UPDATE starý záznam – konec = půlnoc
          await supabase.from('trackino_time_entries').update({
            end_time: midnight.toISOString(), duration: durationToMidnight, is_running: false,
            description: description.trim(),
            project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
          }).eq('id', activeEntry.id);

          // Zkopírovat tagy na starý záznam (pokud ještě nemá)
          await supabase.from('trackino_time_entry_tags').delete().eq('time_entry_id', activeEntry.id);
          if (selectedTags.length > 0) {
            await supabase.from('trackino_time_entry_tags').insert(
              selectedTags.map(tagId => ({ time_entry_id: activeEntry.id, tag_id: tagId }))
            );
          }

          // Vytvořit nový running záznam od půlnoci
          const { data: newEntry } = await supabase.from('trackino_time_entries').insert({
            workspace_id: currentWorkspace.id, user_id: user.id,
            description: description.trim(),
            project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
            start_time: midnight.toISOString(), is_running: true,
          }).select().single();

          if (newEntry) {
            const entry = newEntry as TimeEntry;
            setActiveEntry(entry);
            setElapsed(Math.floor((Date.now() - midnight.getTime()) / 1000));

            // Zkopírovat tagy
            if (selectedTags.length > 0) {
              await supabase.from('trackino_time_entry_tags').insert(
                selectedTags.map(tagId => ({ time_entry_id: entry.id, tag_id: tagId }))
              );
            }
          }

          onEntryChanged?.();
        }
      }, 30000); // Kontrola každých 30s
    } else {
      if (midnightCheckRef.current) { clearInterval(midnightCheckRef.current); midnightCheckRef.current = null; }
    }
    return () => { if (midnightCheckRef.current) clearInterval(midnightCheckRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, activeEntry?.id, currentWorkspace?.id, user?.id]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Validace povinných polí
  const validateRequiredFields = (): string | null => {
    const rf = currentWorkspace?.required_fields as RequiredFields | undefined;
    if (!rf) return null;
    if (rf.description && !description.trim()) return 'Popisek je povinný';
    if (rf.project && !selectedProject) return 'Projekt je povinný';
    if (rf.category && !selectedCategory) return 'Kategorie je povinná';
    if (rf.task && !selectedTask) return 'Úkol je povinný';
    if (rf.tag && selectedTags.length === 0) return 'Štítek je povinný';
    return null;
  };

  const [validationError, setValidationError] = useState('');

  const startTimer = async () => {
    if (!user || !currentWorkspace) return;
    const vErr = validateRequiredFields();
    if (vErr) { setValidationError(vErr); setTimeout(() => setValidationError(''), 3000); return; }
    setValidationError('');
    const { data, error } = await supabase
      .from('trackino_time_entries')
      .insert({
        workspace_id: currentWorkspace.id, user_id: user.id,
        description: description.trim(),
        project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
        start_time: new Date().toISOString(), is_running: true,
      })
      .select().single();
    if (!error && data) {
      const entry = data as TimeEntry;
      setActiveEntry(entry);
      setIsRunning(true);
      setElapsed(0);
      // Uložit tagy
      if (selectedTags.length > 0) {
        await supabase.from('trackino_time_entry_tags').insert(
          selectedTags.map(tagId => ({ time_entry_id: entry.id, tag_id: tagId }))
        );
      }
    }
  };

  const stopTimer = async () => {
    if (!activeEntry || !currentWorkspace || !user) return;
    const now = new Date();
    const startTime = new Date(activeEntry.start_time);
    const segments = splitAtMidnight(startTime, now);

    if (segments.length === 1) {
      // Jednoduchý případ – nepřetéká přes půlnoc
      const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      await supabase.from('trackino_time_entries').update({
        end_time: now.toISOString(), duration, is_running: false,
        description: description.trim(),
        project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
      }).eq('id', activeEntry.id);
    } else {
      // Půlnoční split – UPDATE první segment, INSERT dalších
      const firstSeg = segments[0];
      const firstDuration = Math.floor((firstSeg.end.getTime() - firstSeg.start.getTime()) / 1000);
      await supabase.from('trackino_time_entries').update({
        end_time: firstSeg.end.toISOString(), duration: firstDuration, is_running: false,
        description: description.trim(),
        project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
      }).eq('id', activeEntry.id);

      // INSERT následujících segmentů
      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        const segDuration = Math.floor((seg.end.getTime() - seg.start.getTime()) / 1000);
        const { data: newEntry } = await supabase.from('trackino_time_entries').insert({
          workspace_id: currentWorkspace.id, user_id: user.id,
          description: description.trim(),
          project_id: selectedProject || null, category_id: selectedCategory || null, task_id: selectedTask || null,
          start_time: seg.start.toISOString(), end_time: seg.end.toISOString(),
          duration: segDuration, is_running: false,
        }).select().single();

        // Zkopírovat tagy na nový segment
        if (newEntry && selectedTags.length > 0) {
          await supabase.from('trackino_time_entry_tags').insert(
            selectedTags.map(tagId => ({ time_entry_id: newEntry.id, tag_id: tagId }))
          );
        }
      }
    }

    // Aktualizovat tagy původního záznamu
    await supabase.from('trackino_time_entry_tags').delete().eq('time_entry_id', activeEntry.id);
    if (selectedTags.length > 0) {
      await supabase.from('trackino_time_entry_tags').insert(
        selectedTags.map(tagId => ({ time_entry_id: activeEntry.id, tag_id: tagId }))
      );
    }

    setIsRunning(false); setActiveEntry(null); setElapsed(0);
    setDescription(''); setSelectedProject(''); setSelectedCategory(''); setSelectedTask(''); setSelectedTags([]);
    onEntryChanged?.();
  };

  const discardTimer = async () => {
    if (!activeEntry) return;
    await supabase.from('trackino_time_entry_tags').delete().eq('time_entry_id', activeEntry.id);
    await supabase.from('trackino_time_entries').delete().eq('id', activeEntry.id);
    setIsRunning(false); setActiveEntry(null); setElapsed(0);
    setDescription(''); setSelectedProject(''); setSelectedCategory(''); setSelectedTask(''); setSelectedTags([]);
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
        className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isRunning) startTimer();
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
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

      {/* Tag picker */}
      <TagPicker selectedTagIds={selectedTags} onChange={setSelectedTags} />

      {/* Validační chyba */}
      {validationError && (
        <span className="text-xs whitespace-nowrap hidden sm:inline" style={{ color: 'var(--danger)' }}>
          {validationError}
        </span>
      )}

      {/* Oddělovač */}
      <div className="hidden sm:block w-px h-6" style={{ background: 'var(--border)' }} />

      {/* Čas – JetBrains Mono font */}
      <div
        className="text-lg sm:text-xl font-bold tabular-nums min-w-[85px] sm:min-w-[100px] text-center"
        style={{
          color: isRunning ? 'var(--primary)' : 'var(--text-muted)',
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
    </div>
  );
}
