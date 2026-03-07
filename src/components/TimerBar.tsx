'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { splitAtMidnight, crossesMidnight } from '@/lib/midnight-split';
import TagPicker from '@/components/TagPicker';
import type { Project, Category, Task, TimeEntry, RequiredFields, Client, ClientProject } from '@/types/database';

interface PlayData {
  description: string;
  projectId: string;
  categoryId: string;
  taskId: string;
  tagIds: string[];
  ts: number;
}

interface TimerBarProps {
  onEntryChanged?: () => void;
  playData?: PlayData | null;
  isBottomBar?: boolean;
}

export default function TimerBar({ onEntryChanged, playData, isBottomBar = false }: TimerBarProps) {
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
  const [clients, setClients] = useState<Client[]>([]);
  const [clientProjects, setClientProjects] = useState<ClientProject[]>([]);

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
  const [projectPickerPos, setProjectPickerPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [taskPickerPos, setTaskPickerPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const taskDropdownRef = useRef<HTMLDivElement>(null);

  // Zavírání pickerů klikem mimo
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node) &&
        !(projectDropdownRef.current && projectDropdownRef.current.contains(e.target as Node))
      ) {
        setShowProjectPicker(false);
        setProjectSearch('');
      }
      if (
        taskPickerRef.current && !taskPickerRef.current.contains(e.target as Node) &&
        !(taskDropdownRef.current && taskDropdownRef.current.contains(e.target as Node))
      ) {
        setShowTaskPicker(false);
        setTaskSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) return;
    const [projectsRes, categoriesRes, tasksRes, clientsRes, cpRes] = await Promise.all([
      supabase.from('trackino_projects').select('*').eq('workspace_id', currentWorkspace.id).eq('archived', false).order('name'),
      supabase.from('trackino_categories').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_tasks').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_clients').select('*').eq('workspace_id', currentWorkspace.id).order('name'),
      supabase.from('trackino_client_projects').select('*'),
    ]);
    setProjects((projectsRes.data ?? []) as Project[]);
    setCategories((categoriesRes.data ?? []) as Category[]);
    setTasks((tasksRes.data ?? []) as Task[]);
    setClients((clientsRes.data ?? []) as Client[]);
    setClientProjects((cpRes.data ?? []) as ClientProject[]);
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

  // ── Offline handling ─────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlinePendingMsg, setOfflinePendingMsg] = useState('');

  const PENDING_KEY = 'trackino_pending_stop';

  // Zpracovat čekající stop ze localStorage (po obnovení připojení nebo na mount)
  const processPendingStop = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as {
        entryId: string; startTime: string; stoppedAt: string;
        description: string; projectId: string; categoryId: string; taskId: string; tagIds: string[];
        workspaceId: string; userId: string;
      };
      // Bezpečnostní kontrola – musí patřit aktuálnímu uživateli a workspace
      if (pending.workspaceId !== currentWorkspace.id || pending.userId !== user.id) { localStorage.removeItem(PENDING_KEY); return; }
      const startTime = new Date(pending.startTime);
      const stoppedAt = new Date(pending.stoppedAt);
      const segments = splitAtMidnight(startTime, stoppedAt);
      if (segments.length === 1) {
        const duration = Math.floor((stoppedAt.getTime() - startTime.getTime()) / 1000);
        await supabase.from('trackino_time_entries').update({
          end_time: stoppedAt.toISOString(), duration, is_running: false,
          description: pending.description,
          project_id: pending.projectId || null, category_id: pending.categoryId || null, task_id: pending.taskId || null,
        }).eq('id', pending.entryId);
      } else {
        const first = segments[0];
        const firstDur = Math.floor((first.end.getTime() - first.start.getTime()) / 1000);
        await supabase.from('trackino_time_entries').update({
          end_time: first.end.toISOString(), duration: firstDur, is_running: false,
          description: pending.description,
          project_id: pending.projectId || null, category_id: pending.categoryId || null, task_id: pending.taskId || null,
        }).eq('id', pending.entryId);
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          const segDur = Math.floor((seg.end.getTime() - seg.start.getTime()) / 1000);
          const { data: newE } = await supabase.from('trackino_time_entries').insert({
            workspace_id: currentWorkspace.id, user_id: user.id,
            description: pending.description,
            project_id: pending.projectId || null, category_id: pending.categoryId || null, task_id: pending.taskId || null,
            start_time: seg.start.toISOString(), end_time: seg.end.toISOString(), duration: segDur, is_running: false,
          }).select().single();
          if (newE && pending.tagIds.length > 0) {
            await supabase.from('trackino_time_entry_tags').insert(pending.tagIds.map(tid => ({ time_entry_id: newE.id, tag_id: tid })));
          }
        }
      }
      // Tagy pro původní záznam
      await supabase.from('trackino_time_entry_tags').delete().eq('time_entry_id', pending.entryId);
      if (pending.tagIds.length > 0) {
        await supabase.from('trackino_time_entry_tags').insert(pending.tagIds.map(tid => ({ time_entry_id: pending.entryId, tag_id: tid })));
      }
      localStorage.removeItem(PENDING_KEY);
      setOfflinePendingMsg('');
      onEntryChanged?.();
    } catch {
      localStorage.removeItem(PENDING_KEY);
    }
  }, [user, currentWorkspace, onEntryChanged]);

  useEffect(() => {
    const goOnline = () => { setIsOnline(true); processPendingStop(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Zkusit zpracovat čekající stop při mountu (případ refresh po offline)
    if (navigator.onLine) processPendingStop();
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentWorkspace?.id]);

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

    // Pokud jsme offline – ulož do localStorage a zastavíme lokálně
    if (!navigator.onLine) {
      localStorage.setItem(PENDING_KEY, JSON.stringify({
        entryId: activeEntry.id,
        startTime: activeEntry.start_time,
        stoppedAt: now.toISOString(),
        description: description.trim(),
        projectId: selectedProject,
        categoryId: selectedCategory,
        taskId: selectedTask,
        tagIds: selectedTags,
        workspaceId: currentWorkspace.id,
        userId: user.id,
      }));
      setOfflinePendingMsg('Jste offline – záznam bude uložen po obnovení připojení.');
      setIsRunning(false); setActiveEntry(null); setElapsed(0);
      setDescription(''); setSelectedProject(''); setSelectedCategory(''); setSelectedTask(''); setSelectedTags([]);
      return;
    }

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

  // Spustí timer s explicitními hodnotami (používá se při "Play znovu")
  const startTimerWithValues = useCallback(async (values: {
    description: string; projectId: string; categoryId: string; taskId: string; tagIds: string[];
  }) => {
    if (!user || !currentWorkspace) return;
    const { data, error } = await supabase
      .from('trackino_time_entries')
      .insert({
        workspace_id: currentWorkspace.id, user_id: user.id,
        description: values.description.trim(),
        project_id: values.projectId || null,
        category_id: values.categoryId || null,
        task_id: values.taskId || null,
        start_time: new Date().toISOString(), is_running: true,
      })
      .select().single();
    if (!error && data) {
      const entry = data as TimeEntry;
      setActiveEntry(entry);
      setIsRunning(true);
      setElapsed(0);
      setDescription(values.description);
      setSelectedProject(values.projectId);
      setSelectedCategory(values.categoryId);
      setSelectedTask(values.taskId);
      setSelectedTags(values.tagIds);
      if (values.tagIds.length > 0) {
        await supabase.from('trackino_time_entry_tags').insert(
          values.tagIds.map(tagId => ({ time_entry_id: entry.id, tag_id: tagId }))
        );
      }
      onEntryChanged?.();
    }
  }, [user, currentWorkspace, onEntryChanged]);

  // Reaguje na požadavek "Play znovu" z TimeEntryList
  useEffect(() => {
    if (!playData || isRunning) return;
    startTimerWithValues({
      description: playData.description,
      projectId: playData.projectId,
      categoryId: playData.categoryId,
      taskId: playData.taskId,
      tagIds: playData.tagIds,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playData]);

  const discardTimer = async () => {
    if (!activeEntry) return;
    await supabase.from('trackino_time_entry_tags').delete().eq('time_entry_id', activeEntry.id);
    await supabase.from('trackino_time_entries').delete().eq('id', activeEntry.id);
    setIsRunning(false); setActiveEntry(null); setElapsed(0);
    setDescription(''); setSelectedProject(''); setSelectedCategory(''); setSelectedTask(''); setSelectedTags([]);
  };

  const selectedProjectObj = projects.find(p => p.id === selectedProject);

  // Mapa project_id → client
  const projectClientMap = clientProjects.reduce<Record<string, string>>((acc, cp) => {
    const client = clients.find(c => c.id === cp.client_id);
    if (client) acc[cp.project_id] = client.name;
    return acc;
  }, {});

  // Filter projects by search
  const filteredProjects = projects.filter(p => {
    if (!projectSearch) return true;
    const q = projectSearch.toLowerCase();
    const clientName = projectClientMap[p.id] ?? '';
    return p.name.toLowerCase().includes(q) || clientName.toLowerCase().includes(q);
  });

  // Group projects by client (from client_projects table)
  const projectsByClient = filteredProjects.reduce<Record<string, Project[]>>((acc, p) => {
    const clientName = projectClientMap[p.id] ?? 'Bez klienta';
    if (!acc[clientName]) acc[clientName] = [];
    acc[clientName].push(p);
    return acc;
  }, {});

  // Seřadit: klienti abecedně, Bez klienta na konec
  const sortedClientEntries = Object.entries(projectsByClient).sort(([a], [b]) => {
    if (a === 'Bez klienta') return 1;
    if (b === 'Bez klienta') return -1;
    return a.localeCompare(b, 'cs');
  });

  // Grouped structure: categories + their tasks (pro kategorie-úkol linking)
  const taskStructure = (() => {
    const q = taskSearch.toLowerCase();
    return categories
      .filter(cat => {
        if (!taskSearch) return true;
        const catMatches = cat.name.toLowerCase().includes(q);
        const hasMatchingTask = tasks.some(t => t.category_id === cat.id && t.name.toLowerCase().includes(q));
        return catMatches || hasMatchingTask;
      })
      .map(cat => {
        const catMatches = !taskSearch || cat.name.toLowerCase().includes(q);
        return {
          ...cat,
          matchedTasks: tasks.filter(t => t.category_id === cat.id && (catMatches || t.name.toLowerCase().includes(q))),
        };
      });
  })();

  // Úkoly bez kategorie
  const orphanTasks = tasks.filter(t =>
    !t.category_id && (!taskSearch || t.name.toLowerCase().includes(taskSearch.toLowerCase()))
  );

  // Vybraná kategorie a úkol (jako objekty)
  const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
  const selectedTaskObj = tasks.find(t => t.id === selectedTask);

  // Klient pro vybraný projekt
  const selectedProjectClientName = selectedProject ? (projectClientMap[selectedProject] ?? '') : '';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
      {/* Popis – full width na mobilu, flex-1 na desktopu */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Na čem pracuješ?"
        className="flex-1 min-w-0 px-3 py-1.5 sm:py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isRunning) startTimer();
        }}
      />

      {/* Pickers + timer + tlačítka – druhý řádek na mobilu, pokračování řádku na desktopu */}
      <div className={`flex items-center ${isBottomBar ? 'gap-3' : 'gap-2 sm:gap-3'} flex-shrink-0`}>

      {/* Projekt picker */}
      <div className="relative flex-shrink-0" ref={projectPickerRef}>
        <button
          onClick={(e) => {
            if (showProjectPicker) { setShowProjectPicker(false); setProjectSearch(''); return; }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const w = Math.min(320, window.innerWidth - 16);
            setProjectPickerPos({ top: isBottomBar ? Math.max(8, rect.top - 324) : rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)), width: w });
            setShowTaskPicker(false); setTaskSearch(''); setProjectSearch('');
            setShowProjectPicker(true);
          }}
          className={`flex items-center gap-1.5 ${isBottomBar ? 'px-2.5 py-2' : 'px-2 py-1.5'} rounded-lg transition-colors`}
          style={{
            color: selectedProject ? 'var(--text-primary)' : 'var(--text-muted)',
            background: selectedProject ? ((selectedProjectObj?.color ?? 'var(--primary)') + '18') : 'transparent',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = selectedProject ? ((selectedProjectObj?.color ?? 'var(--primary)') + '28') : 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = selectedProject ? ((selectedProjectObj?.color ?? 'var(--primary)') + '18') : 'transparent'}
          title={
            selectedProjectClientName
              ? `${selectedProjectClientName} · ${selectedProjectObj?.name}`
              : selectedProjectObj?.name ?? 'Projekt'
          }
        >
          {selectedProject ? (
            <>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: selectedProjectObj?.color ?? 'var(--primary)' }} />
              <span className="hidden sm:block text-xs truncate max-w-[140px]">
                {selectedProjectClientName ? `${selectedProjectClientName} · ` : ''}{selectedProjectObj?.name}
              </span>
            </>
          ) : (
            <svg width={isBottomBar ? 18 : 16} height={isBottomBar ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>

        {showProjectPicker && projectPickerPos && (
          <div
            ref={projectDropdownRef}
            className="fixed rounded-lg border shadow-lg z-[9999] max-h-80 overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', top: projectPickerPos?.top ?? 0, left: projectPickerPos?.left ?? 0, width: projectPickerPos?.width ?? 320 }}
          >
            {/* Vyhledávání */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Hledat projekt nebo klienta..."
                className="w-full px-2.5 py-1.5 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
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

              {sortedClientEntries.map(([client, clientProjects]) => (
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

      {/* Kategorie / Úkol picker */}
      <div className="relative flex-shrink-0" ref={taskPickerRef}>
        <button
          onClick={(e) => {
            if (showTaskPicker) { setShowTaskPicker(false); setTaskSearch(''); return; }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const w = Math.min(280, window.innerWidth - 16);
            setTaskPickerPos({ top: isBottomBar ? Math.max(8, rect.top - 324) : rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)), width: w });
            setShowProjectPicker(false); setProjectSearch(''); setTaskSearch('');
            setShowTaskPicker(true);
          }}
          className={`flex items-center gap-1.5 ${isBottomBar ? 'px-2.5 py-2' : 'px-2 py-1.5'} rounded-lg transition-colors`}
          style={{
            color: selectedTask || selectedCategory ? 'var(--primary)' : 'var(--text-muted)',
            background: (selectedTask || selectedCategory) ? 'var(--primary)18' : 'transparent',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = (selectedTask || selectedCategory) ? 'var(--primary)28' : 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = (selectedTask || selectedCategory) ? 'var(--primary)18' : 'transparent'}
          title={
            selectedCategoryObj && selectedTaskObj
              ? `${selectedCategoryObj.name} · ${selectedTaskObj.name}`
              : selectedCategoryObj?.name ?? selectedTaskObj?.name ?? 'Kategorie / Úkol'
          }
        >
          {selectedCategory || selectedTask ? (
            <>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
              <span className="hidden sm:block text-xs truncate max-w-[140px]">
                {selectedCategoryObj?.name ?? ''}
                {selectedCategoryObj && selectedTaskObj ? ' · ' : ''}
                {selectedTaskObj?.name ?? ''}
              </span>
            </>
          ) : (
            <svg width={isBottomBar ? 18 : 16} height={isBottomBar ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          )}
        </button>

        {showTaskPicker && taskPickerPos && (
          <div
            ref={taskDropdownRef}
            className="fixed rounded-lg border shadow-lg z-[9999] max-h-80 overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', top: taskPickerPos?.top ?? 0, left: taskPickerPos?.left ?? 0, width: taskPickerPos?.width ?? 280 }}
          >
            {/* Vyhledávání */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Hledat kategorii nebo úkol..."
                className="w-full px-2.5 py-1.5 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>

            <div className="overflow-y-auto py-1">
              {/* Reset */}
              {(selectedCategory || selectedTask) && (
                <button
                  onClick={() => { setSelectedCategory(''); setSelectedTask(''); }}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors border-b mb-1"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Zrušit výběr
                </button>
              )}

              {/* Kategorie s úkoly (grouped) */}
              {taskStructure.map(cat => (
                <div key={cat.id}>
                  {/* Kategorie řádek */}
                  <button
                    onClick={() => {
                      if (selectedCategory === cat.id) {
                        setSelectedCategory('');
                        setSelectedTask('');
                      } else {
                        setSelectedCategory(cat.id);
                        // Pokud vybraný úkol nepatří do nové kategorie, smaž ho
                        if (selectedTask) {
                          const taskBelongs = tasks.find(t => t.id === selectedTask)?.category_id === cat.id;
                          if (!taskBelongs) setSelectedTask('');
                        }
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
                    style={{
                      color: cat.id === selectedCategory ? 'var(--primary)' : 'var(--text-primary)',
                      background: cat.id === selectedCategory ? 'var(--bg-active)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = cat.id === selectedCategory ? 'var(--bg-active)' : 'transparent'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
                      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span className="truncate">{cat.name}</span>
                  </button>

                  {/* Úkoly pod kategorií */}
                  {cat.matchedTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedTask(t.id);
                        setShowTaskPicker(false);
                        setTaskSearch('');
                      }}
                      className="w-full text-left pl-7 pr-3 py-1.5 text-xs transition-colors truncate flex items-center gap-1.5"
                      style={{
                        color: t.id === selectedTask ? 'var(--primary)' : 'var(--text-secondary)',
                        background: t.id === selectedTask ? 'var(--bg-active)' : 'transparent',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = t.id === selectedTask ? 'var(--bg-active)' : 'transparent'}
                    >
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'currentColor', opacity: 0.4 }} />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              ))}

              {/* Úkoly bez kategorie */}
              {orphanTasks.length > 0 && (
                <>
                  {taskStructure.length > 0 && <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />}
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Bez kategorie
                  </div>
                  {orphanTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTask(t.id);
                        setSelectedCategory('');
                        setShowTaskPicker(false);
                        setTaskSearch('');
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors truncate"
                      style={{
                        color: t.id === selectedTask ? 'var(--primary)' : 'var(--text-primary)',
                        background: t.id === selectedTask ? 'var(--bg-active)' : 'transparent',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = t.id === selectedTask ? 'var(--bg-active)' : 'transparent'}
                    >
                      {t.name}
                    </button>
                  ))}
                </>
              )}

              {taskStructure.length === 0 && orphanTasks.length === 0 && taskSearch && (
                <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Žádné výsledky pro &ldquo;{taskSearch}&rdquo;
                </div>
              )}

              {categories.length === 0 && tasks.length === 0 && (
                <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Vytvořte kategorie a úkoly v sekci Tým.
                </div>
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

      {/* Offline indikátor / čekající stop */}
      {(!isOnline || offlinePendingMsg) && (
        <span
          className="text-xs whitespace-nowrap hidden sm:inline flex items-center gap-1"
          style={{ color: offlinePendingMsg ? '#d97706' : '#6b7280' }}
          title={offlinePendingMsg || 'Jste offline – timer stále běží'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
          {offlinePendingMsg ? 'Čeká na uložení' : 'Offline'}
        </span>
      )}

      {/* Oddělovač */}
      <div className="hidden sm:block w-px h-6" style={{ background: 'var(--border)' }} />

      {/* Čas – JetBrains Mono font */}
      <div
        className="text-lg sm:text-xl font-bold tabular-nums min-w-[85px] sm:min-w-[100px] text-center ml-auto sm:ml-0"
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
          className={`${isBottomBar ? 'w-11 h-11' : 'w-9 h-9'} rounded-full flex items-center justify-center text-white flex-shrink-0 transition-colors`}
          style={{ background: 'var(--primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          title="Spustit"
        >
          <svg width={isBottomBar ? 18 : 15} height={isBottomBar ? 18 : 15} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={stopTimer}
            className={`${isBottomBar ? 'w-11 h-11' : 'w-9 h-9'} rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity`}
            style={{ background: 'var(--danger)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            title="Zastavit"
          >
            <svg width={isBottomBar ? 16 : 13} height={isBottomBar ? 16 : 13} viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </button>
          <button
            onClick={discardTimer}
            className={`${isBottomBar ? 'p-2.5' : 'p-2'} rounded-lg transition-colors`}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Zahodit"
          >
            <svg width={isBottomBar ? 18 : 16} height={isBottomBar ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}

      </div>{/* /pickers row */}
    </div>
  );
}
