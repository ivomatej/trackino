'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { splitAtMidnight, crossesMidnight } from '@/lib/midnight-split';
import type { Project, Category, Task, TimeEntry, RequiredFields, Client, ClientProject } from '@/types/database';
import type { PlayData } from './types';
import { formatTime } from './utils';

interface UseTimerBarOptions {
  onEntryChanged?: () => void;
  playData?: PlayData | null;
}

export function useTimerBar({ onEntryChanged, playData }: UseTimerBarOptions) {
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
  const [projectPickerPos, setProjectPickerPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const [taskPickerPos, setTaskPickerPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
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
  // Sada ID záznamů, pro které bylo odesláno 8h varování manažerovi
  const eightHourNoteRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isRunning && activeEntry && currentWorkspace && user) {
      midnightCheckRef.current = setInterval(async () => {
        const entryStart = new Date(activeEntry.start_time);

        // ── 8h poznámka pro manažera ─────────────────────────────────────
        const elapsedSeconds = Math.floor((Date.now() - entryStart.getTime()) / 1000);
        if (
          elapsedSeconds >= 8 * 3600 &&
          selectedProject && selectedCategory && selectedTask &&
          !eightHourNoteRef.current.has(activeEntry.id)
        ) {
          eightHourNoteRef.current.add(activeEntry.id);
          const { data: curr } = await supabase
            .from('trackino_time_entries')
            .select('manager_note')
            .eq('id', activeEntry.id)
            .maybeSingle();
          if (!curr?.manager_note) {
            await supabase
              .from('trackino_time_entries')
              .update({ manager_note: 'Práce 8+h v kuse. Ověřit.' })
              .eq('id', activeEntry.id);
            onEntryChanged?.();
          }
        }

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

          // Zkopírovat tagy na starý záznam
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

  // ── Computed values ───────────────────────────────────────────────────────

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

  // Grouped structure: categories + their tasks
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

  return {
    // State
    description, setDescription,
    selectedProject, setSelectedProject,
    selectedCategory, setSelectedCategory,
    selectedTask, setSelectedTask,
    selectedTags, setSelectedTags,
    projects, categories, tasks,
    isRunning, elapsed,
    showProjectPicker, setShowProjectPicker,
    showTaskPicker, setShowTaskPicker,
    projectSearch, setProjectSearch,
    taskSearch, setTaskSearch,
    projectPickerPos, setProjectPickerPos,
    taskPickerPos, setTaskPickerPos,
    validationError,
    isOnline,
    offlinePendingMsg,
    // Refs
    projectPickerRef,
    taskPickerRef,
    projectDropdownRef,
    taskDropdownRef,
    // Actions
    startTimer,
    stopTimer,
    discardTimer,
    // Computed
    selectedProjectObj,
    filteredProjects,
    sortedClientEntries,
    taskStructure,
    orphanTasks,
    selectedCategoryObj,
    selectedTaskObj,
    selectedProjectClientName,
    // Util
    formatTime,
  };
}
