'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { TimeEntry, Project, Profile, Tag } from '@/types/database';

interface SubordinateEntry extends TimeEntry {
  profile?: Profile;
  project?: Project;
  tagNames?: { name: string; color: string }[];
}

function SubordinatesContent() {
  const { user } = useAuth();
  const { currentWorkspace, isManagerOf, managerAssignments, userRole } = useWorkspace();
  const { isWorkspaceAdmin, isManager } = usePermissions();
  const [entries, setEntries] = useState<SubordinateEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');

  // Pro adminy: vidí vše; pro managery: jen podřízení
  const getSubordinateIds = useCallback((): string[] => {
    if (isWorkspaceAdmin) {
      // Admin vidí všechny mimo sebe
      return []; // prázdné = všichni
    }
    // Manager vidí jen své podřízené
    return managerAssignments.map(a => a.member_user_id);
  }, [isWorkspaceAdmin, managerAssignments]);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    const subIds = getSubordinateIds();

    // Načíst záznamy podřízených (posledních 7 dní)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let query = supabase
      .from('trackino_time_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_running', false)
      .gte('start_time', weekAgo.toISOString())
      .neq('user_id', user.id) // Ne vlastní záznamy
      .order('start_time', { ascending: false })
      .limit(200);

    // Pokud nejsme admin, filtrovat jen podřízené
    if (subIds.length > 0) {
      query = query.in('user_id', subIds);
    }

    const { data: entriesData } = await query;
    const allEntries = (entriesData ?? []) as TimeEntry[];

    // Načíst projekty
    const { data: projectsData } = await supabase
      .from('trackino_projects')
      .select('*')
      .eq('workspace_id', currentWorkspace.id);

    const projectMap: Record<string, Project> = {};
    (projectsData ?? []).forEach((p: Project) => { projectMap[p.id] = p; });
    setProjects(projectMap);

    // Načíst profily
    const userIds = [...new Set(allEntries.map(e => e.user_id))];
    const profileMap: Record<string, Profile> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', userIds);
      (profilesData ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
    }
    setProfiles(profileMap);

    // Načíst tagy pro záznamy
    const entryIds = allEntries.map(e => e.id);
    const entryTagMap: Record<string, string[]> = {};
    if (entryIds.length > 0) {
      const { data: etData } = await supabase
        .from('trackino_time_entry_tags')
        .select('time_entry_id, tag_id')
        .in('time_entry_id', entryIds);
      (etData ?? []).forEach((et: { time_entry_id: string; tag_id: string }) => {
        if (!entryTagMap[et.time_entry_id]) entryTagMap[et.time_entry_id] = [];
        entryTagMap[et.time_entry_id].push(et.tag_id);
      });
    }

    // Načíst všechny tagy
    const { data: tagsData } = await supabase
      .from('trackino_tags')
      .select('*')
      .eq('workspace_id', currentWorkspace.id);
    const tagMap: Record<string, Tag> = {};
    (tagsData ?? []).forEach((t: Tag) => { tagMap[t.id] = t; });

    // Sestavit záznamy s profily a projekty
    const enriched: SubordinateEntry[] = allEntries.map(e => ({
      ...e,
      profile: profileMap[e.user_id],
      project: e.project_id ? projectMap[e.project_id] : undefined,
      tagNames: (entryTagMap[e.id] ?? []).map(tid => tagMap[tid]).filter(Boolean).map(t => ({ name: t.name, color: t.color })),
    }));

    setEntries(enriched);
    setLoading(false);
  }, [currentWorkspace, user, getSubordinateIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!isManager && !isWorkspaceAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Podřízení</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k zobrazení podřízených.</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  };

  // Unikátní uživatelé pro filtr
  const uniqueUsers = [...new Set(entries.map(e => e.user_id))].map(uid => profiles[uid]).filter(Boolean);

  // Filtrované záznamy
  const filteredEntries = selectedUser === 'all'
    ? entries
    : entries.filter(e => e.user_id === selectedUser);

  const saveNote = async (entryId: string) => {
    await supabase.from('trackino_time_entries').update({ manager_note: noteText }).eq('id', entryId);
    setEditingNote(null);
    fetchData();
  };

  const saveDescription = async (entryId: string) => {
    await supabase.from('trackino_time_entries').update({ description: editDesc }).eq('id', entryId);
    setEditingEntry(null);
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Podřízení</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Záznamy podřízených za posledních 7 dní
            </p>
          </div>

          {/* Filtr podle uživatele */}
          {uniqueUsers.length > 1 && (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="all">Všichni ({entries.length})</option>
              {uniqueUsers.map(u => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div
            className="rounded-xl border px-6 py-12 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {managerAssignments.length === 0 && !isWorkspaceAdmin
                ? 'Nemáte přiřazené žádné podřízené. Kontaktujte administrátora.'
                : 'Žádné záznamy podřízených za posledních 7 dní.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map(entry => (
              <div
                key={entry.id}
                className="rounded-lg border px-4 py-3 group transition-colors"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}
                  >
                    {entry.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {entry.profile?.display_name ?? 'Neznámý'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(entry.start_time)} · {formatTime(entry.start_time)} – {entry.end_time ? formatTime(entry.end_time) : '...'}
                      </span>
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatDuration(entry.duration ?? 0)}
                      </span>
                    </div>

                    {/* Popis – inline editace */}
                    {editingEntry === entry.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveDescription(entry.id); if (e.key === 'Escape') setEditingEntry(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                        <button onClick={() => saveDescription(entry.id)} className="px-2 py-1 rounded text-xs font-medium text-white" style={{ background: 'var(--primary)' }}>
                          OK
                        </button>
                      </div>
                    ) : (
                      <div
                        className="text-sm mt-0.5 cursor-pointer"
                        style={{ color: entry.description ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                        onClick={() => { setEditingEntry(entry.id); setEditDesc(entry.description || ''); }}
                      >
                        {entry.description || '(bez popisu)'}
                      </div>
                    )}

                    {/* Projekt + tagy */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {entry.project && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: entry.project.color }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.project.name}</span>
                        </span>
                      )}
                      {entry.tagNames?.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: tag.color + '20', color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Manager poznámka */}
                    {editingNote === entry.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveNote(entry.id); if (e.key === 'Escape') setEditingNote(null); }}
                          autoFocus
                          placeholder="Napište poznámku..."
                          className="flex-1 px-2 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                        <button onClick={() => saveNote(entry.id)} className="px-2 py-1 rounded text-xs font-medium text-white" style={{ background: 'var(--primary)' }}>
                          OK
                        </button>
                      </div>
                    ) : entry.manager_note ? (
                      <div
                        className="mt-2 text-xs px-2 py-1 rounded cursor-pointer"
                        style={{ background: 'var(--warning-light, rgba(234,179,8,0.1))', color: 'var(--warning, #ca8a04)' }}
                        onClick={() => { setEditingNote(entry.id); setNoteText(entry.manager_note || ''); }}
                        title="Klikněte pro úpravu poznámky"
                      >
                        <span className="font-medium">Poznámka:</span> {entry.manager_note}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingNote(entry.id); setNoteText(''); }}
                        className="mt-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        + Přidat poznámku
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function SubordinatesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <SubordinatesContent />
    </WorkspaceProvider>
  );
}
