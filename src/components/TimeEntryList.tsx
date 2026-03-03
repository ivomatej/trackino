'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Project, TimeEntry, Tag } from '@/types/database';

interface TimeEntryListProps {
  refreshKey?: number;
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

export default function TimeEntryList({ refreshKey }: TimeEntryListProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [days, setDays] = useState<DayGroup[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [allTags, setAllTags] = useState<Record<string, Tag>>({});
  const [entryTagMap, setEntryTagMap] = useState<Record<string, string[]>>({}); // entryId -> tagIds[]
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  const fetchEntries = useCallback(async () => {
    if (!user || !currentWorkspace) return;

    // Načtení posledních 7 dnů
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [entriesRes, projectsRes, tagsRes] = await Promise.all([
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
    ]);

    const entries = (entriesRes.data ?? []) as TimeEntry[];
    const projectsList = (projectsRes.data ?? []) as Project[];
    const tagsList = (tagsRes.data ?? []) as Tag[];

    // Projekty do mapy
    const projectMap: Record<string, Project> = {};
    projectsList.forEach(p => { projectMap[p.id] = p; });
    setProjects(projectMap);

    // Tagy do mapy
    const tagMap: Record<string, Tag> = {};
    tagsList.forEach(t => { tagMap[t.id] = t; });
    setAllTags(tagMap);

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

    // Seskupení podle dnů
    const grouped: Record<string, EntryWithProject[]> = {};
    entries.forEach(entry => {
      const dateKey = new Date(entry.start_time).toLocaleDateString('cs-CZ');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        ...entry,
        project: entry.project_id ? projectMap[entry.project_id] : null,
      });
    });

    const today = new Date().toLocaleDateString('cs-CZ');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('cs-CZ');

    const dayGroups: DayGroup[] = Object.entries(grouped).map(([date, entries]) => ({
      date,
      label: date === today ? 'Dnes' : date === yesterday ? 'Včera' : date,
      totalSeconds: entries.reduce((sum, e) => sum + (e.duration || 0), 0),
      entries,
    }));

    setDays(dayGroups);
    setLoading(false);
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshKey]);

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
          <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>0:00:00</span>
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
          <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{day.label}</h2>
            <span className="text-sm font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
              {formatDuration(day.totalSeconds)}
            </span>
          </div>

          {/* Záznamy – subtilní oddělovače */}
          <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)' }}>
            {day.entries.map(entry => (
              <div
                key={entry.id}
                className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {/* Popis + projekt */}
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

                {/* Čas */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatTimeRange(entry.start_time, entry.end_time)}
                  </span>
                  <span className="text-sm font-mono font-medium min-w-[70px] text-right" style={{ color: 'var(--text-primary)' }}>
                    {formatDuration(entry.duration || 0)}
                  </span>

                  {/* Smazat */}
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    title="Smazat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
