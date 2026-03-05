'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { Project, TimeEntry, Tag, Category, Task } from '@/types/database';

interface PlayData {
  description: string;
  projectId: string;
  categoryId: string;
  taskId: string;
  tagIds: string[];
}

interface TimeEntryListProps {
  refreshKey?: number;
  onPlay?: (data: PlayData) => void;
}

interface EntryWithProject extends TimeEntry {
  project?: Project | null;
  tags?: Tag[];
}

interface DayGroup {
  date: string;
  label: string;
  totalSeconds: number;
  entries: EntryWithProject[];
}

export default function TimeEntryList({ refreshKey, onPlay }: TimeEntryListProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { isWorkspaceAdmin, isManager, isMasterAdmin } = usePermissions();
  const [days, setDays] = useState<DayGroup[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [allTags, setAllTags] = useState<Record<string, Tag>>({});
  const [allCategories, setAllCategories] = useState<Record<string, Category>>({});
  const [allTasks, setAllTasks] = useState<Record<string, Task>>({});
  const [entryTagMap, setEntryTagMap] = useState<Record<string, string[]>>({}); // entryId -> tagIds[]
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const canManageNotes = isMasterAdmin || isWorkspaceAdmin || isManager;

  const fetchEntries = useCallback(async () => {
    if (!user || !currentWorkspace) return;

    // Načtení posledních 7 dnů
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [entriesRes, projectsRes, tagsRes, categoriesRes, tasksRes] = await Promise.all([
      supabase
        .from('trackino_time_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('is_running', false)
        .gte('start_time', weekAgo.toISOString())
        .order('start_time', { ascending: false }),
      supabase
        .from('trackino_projects')
        .select('*')
        .eq('workspace_id', currentWorkspace.id),
      supabase
        .from('trackino_tags')
        .select('*')
        .eq('workspace_id', currentWorkspace.id),
      supabase
        .from('trackino_categories')
        .select('*')
        .eq('workspace_id', currentWorkspace.id),
      supabase
        .from('trackino_tasks')
        .select('*')
        .eq('workspace_id', currentWorkspace.id),
    ]);

    const entries = (entriesRes.data ?? []) as TimeEntry[];
    const projectsList = (projectsRes.data ?? []) as Project[];
    const tagsList = (tagsRes.data ?? []) as Tag[];
    const categoriesList = (categoriesRes.data ?? []) as Category[];
    const tasksList = (tasksRes.data ?? []) as Task[];

    // Projekty do mapy
    const projectMap: Record<string, Project> = {};
    projectsList.forEach(p => { projectMap[p.id] = p; });
    setProjects(projectMap);

    // Tagy do mapy
    const tagMap: Record<string, Tag> = {};
    tagsList.forEach(t => { tagMap[t.id] = t; });
    setAllTags(tagMap);

    // Kategorie do mapy
    const categoryMap: Record<string, Category> = {};
    categoriesList.forEach(c => { categoryMap[c.id] = c; });
    setAllCategories(categoryMap);

    // Úkoly do mapy
    const taskMap: Record<string, Task> = {};
    tasksList.forEach(t => { taskMap[t.id] = t; });
    setAllTasks(taskMap);

    // Načíst tag vazby pro všechny záznamy
    const entryIds = entries.map(e => e.id);
    const etMap: Record<string, string[]> = {};
    if (entryIds.length > 0) {
      const { data: etData } = await supabase
        .from('trackino_time_entry_tags')
        .select('time_entry_id, tag_id')
        .in('time_entry_id', entryIds);
      (etData ?? []).forEach((et: { time_entry_id: string; tag_id: string }) => {
        if (!etMap[et.time_entry_id]) etMap[et.time_entry_id] = [];
        etMap[et.time_entry_id].push(et.tag_id);
      });
    }
    setEntryTagMap(etMap);

    // Seskupení podle dnů (ISO klíč YYYY-MM-DD v lokálním čase)
    const grouped: Record<string, EntryWithProject[]> = {};
    entries.forEach(entry => {
      const d = new Date(entry.start_time);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        ...entry,
        project: entry.project_id ? projectMap[entry.project_id] : null,
      });
    });

    const todayD = new Date();
    const todayISO = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;
    const yD = new Date(Date.now() - 86400000);
    const yesterdayISO = `${yD.getFullYear()}-${String(yD.getMonth() + 1).padStart(2, '0')}-${String(yD.getDate()).padStart(2, '0')}`;

    const dayGroups: DayGroup[] = Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, grpEntries]) => ({
        date,
        label: date === todayISO ? 'Dnes' : date === yesterdayISO ? 'Včera' : date,
        totalSeconds: grpEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
        entries: grpEntries,
      }));

    setDays(dayGroups);
    setLoading(false);
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshKey]);

  const formatDayLabel = (isoDate: string): string => {
    const d = new Date(isoDate + 'T12:00:00');
    const label = d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatTimeRange = (start: string, end: string | null) => {
    const s = new Date(start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    const e = end ? new Date(end).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '...';
    return `${s} – ${e}`;
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('trackino_time_entry_tags').delete().eq('time_entry_id', id);
    await supabase.from('trackino_time_entries').delete().eq('id', id);
    fetchEntries();
  };

  const saveEdit = async (id: string) => {
    await supabase
      .from('trackino_time_entries')
      .update({ description: editDescription })
      .eq('id', id);
    setEditingEntry(null);
    fetchEntries();
  };

  const saveNote = async (entryId: string) => {
    setSavingNoteId(entryId);
    await supabase
      .from('trackino_time_entries')
      .update({ manager_note: noteText.trim() })
      .eq('id', entryId);
    // Aktualizace lokálního stavu bez refetch
    setDays(prev => prev.map(day => ({
      ...day,
      entries: day.entries.map(e =>
        e.id === entryId ? { ...e, manager_note: noteText.trim() } : e
      ),
    })));
    setSavingNoteId(null);
    setEditingNoteId(null);
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Dnes</h2>
          <span className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>0:00:00</span>
        </div>
        <div className="px-6 py-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Zatím žádné záznamy. Spusťte timer a začněte trackovat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map(day => (
        <div key={day.date} className="rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Header dne */}
          <div className="px-4 sm:px-6 py-2.5 border-b flex items-center justify-between rounded-t-xl" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
            <h2 className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {day.label === 'Dnes' || day.label === 'Včera'
                ? day.label
                : formatDayLabel(day.date)}
            </h2>
            <span className="text-xs tabular-nums font-medium" style={{ color: 'var(--text-secondary)' }}>
              {formatDuration(day.totalSeconds)}
            </span>
          </div>

          {/* Záznamy – subtilní oddělovače */}
          <div className="entry-divider">
            {day.entries.map(entry => (
              <div
                key={entry.id}
                className="px-4 sm:px-6 py-3 flex flex-col gap-2 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {/* Hlavní řádek: popis + čas + akce */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  {/* Popis + projekt + tagy */}
                  <div className="flex-1 min-w-0">
                    {editingEntry === entry.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(entry.id); if (e.key === 'Escape') setEditingEntry(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                        <button
                          onClick={() => saveEdit(entry.id)}
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ background: 'var(--primary)' }}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <div
                        className="text-sm cursor-pointer"
                        style={{ color: entry.description ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        onClick={() => { setEditingEntry(entry.id); setEditDescription(entry.description || ''); }}
                      >
                        {entry.description || '(bez popisu)'}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {entry.project && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ background: entry.project.color }}
                          />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {entry.project.name}
                          </span>
                        </span>
                      )}
                      {(entry.category_id || entry.task_id) && (() => {
                        const catName = entry.category_id ? allCategories[entry.category_id]?.name : null;
                        const taskName = entry.task_id ? allTasks[entry.task_id]?.name : null;
                        const label = [catName, taskName].filter(Boolean).join(' · ');
                        if (!label) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {(entry.project) && <span style={{ color: 'var(--border)' }}>·</span>}
                            {label}
                          </span>
                        );
                      })()}
                      {(entryTagMap[entry.id]?.length > 0) && entryTagMap[entry.id].map(tagId => {
                        const tag = allTags[tagId];
                        if (!tag) return null;
                        return (
                          <span
                            key={tagId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: tag.color + '20', color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Čas + akce */}
                  <div className="flex items-center gap-3 sm:gap-3 flex-shrink-0">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatTimeRange(entry.start_time, entry.end_time)}
                    </span>
                    <span className="text-sm tabular-nums font-medium min-w-[70px] text-right" style={{ color: 'var(--text-primary)' }}>
                      {formatDuration(entry.duration || 0)}
                    </span>

                    {/* Play – znovu spustit záznam */}
                    {onPlay && (
                      <button
                        onClick={() => onPlay({
                          description: entry.description || '',
                          projectId: entry.project_id || '',
                          categoryId: entry.category_id || '',
                          taskId: entry.task_id || '',
                          tagIds: entryTagMap[entry.id] ?? [],
                        })}
                        className="p-1.5 sm:p-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Spustit znovu"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                    )}

                    {/* Poznámka – jen pro manažery/adminy */}
                    {canManageNotes && (
                      <button
                        onClick={() => {
                          if (editingNoteId === entry.id) {
                            setEditingNoteId(null);
                          } else {
                            setEditingNoteId(entry.id);
                            setNoteText(entry.manager_note || '');
                          }
                        }}
                        title={entry.manager_note ? 'Upravit poznámku' : 'Přidat poznámku'}
                        className="p-1.5 sm:p-1 rounded transition-colors"
                        style={{ color: entry.manager_note ? '#d97706' : 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#d97706'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = entry.manager_note ? '#d97706' : 'var(--text-muted)'; }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}

                    {/* Smazat – vždy viditelné */}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1.5 sm:p-1 rounded transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      title="Smazat"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Zobrazení existující poznámky (mimo editaci) */}
                {canManageNotes && entry.manager_note && editingNoteId !== entry.id && (
                  <div
                    className="text-xs px-2.5 py-1.5 rounded-md cursor-pointer flex items-start gap-1.5"
                    style={{ background: '#f59e0b18', color: '#b45309' }}
                    onClick={() => { setEditingNoteId(entry.id); setNoteText(entry.manager_note || ''); }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>{entry.manager_note}</span>
                  </div>
                )}

                {/* Editace poznámky */}
                {canManageNotes && editingNoteId === entry.id && (
                  <div className="flex gap-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(entry.id); }
                        if (e.key === 'Escape') setEditingNoteId(null);
                      }}
                      autoFocus
                      placeholder="Interní poznámka manažera… (Enter = uložit, Shift+Enter = nový řádek)"
                      rows={2}
                      className="flex-1 px-2.5 py-1.5 rounded-md border text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      style={{ borderColor: '#f59e0b50', background: '#f59e0b08', color: 'var(--text-primary)' }}
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => saveNote(entry.id)}
                        disabled={savingNoteId === entry.id}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: 'var(--primary)' }}
                      >
                        {savingNoteId === entry.id ? '…' : '✓'}
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="px-2.5 py-1 rounded-md text-xs"
                        style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
