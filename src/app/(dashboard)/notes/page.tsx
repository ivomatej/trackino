'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { TimeEntry, Profile, Project } from '@/types/database';

interface NoteEntry {
  id: string;
  entry: TimeEntry;
  profile?: Profile;
  project?: Project;
}

function NotesContent() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { isManager, isWorkspaceAdmin } = usePermissions();
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    // Načíst všechny záznamy s manažerskou poznámkou
    const { data: entriesData } = await supabase
      .from('trackino_time_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .neq('manager_note', '')
      .not('manager_note', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100);

    const allEntries = (entriesData ?? []).filter((e: TimeEntry) => e.manager_note && e.manager_note.trim() !== '') as TimeEntry[];

    // Načíst projekty
    const { data: projectsData } = await supabase
      .from('trackino_projects')
      .select('*')
      .eq('workspace_id', currentWorkspace.id);
    const projectMap: Record<string, Project> = {};
    (projectsData ?? []).forEach((p: Project) => { projectMap[p.id] = p; });

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

    const noteEntries: NoteEntry[] = allEntries.map(e => ({
      id: e.id,
      entry: e,
      profile: profileMap[e.user_id],
      project: e.project_id ? projectMap[e.project_id] : undefined,
    }));

    setNotes(noteEntries);
    setLoading(false);
  }, [currentWorkspace, user]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  if (!isManager && !isWorkspaceAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Poznámky</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k zobrazení poznámek.</p>
        </div>
      </DashboardLayout>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  // Unikátní uživatelé
  const uniqueUsers = [...new Set(notes.map(n => n.entry.user_id))].map(uid => profiles[uid]).filter(Boolean);

  const filteredNotes = selectedUser === 'all'
    ? notes
    : notes.filter(n => n.entry.user_id === selectedUser);

  const saveNote = async (entryId: string) => {
    if (noteText.trim()) {
      await supabase.from('trackino_time_entries').update({ manager_note: noteText.trim() }).eq('id', entryId);
    } else {
      await supabase.from('trackino_time_entries').update({ manager_note: '' }).eq('id', entryId);
    }
    setEditingNote(null);
    fetchNotes();
  };

  const deleteNote = async (entryId: string) => {
    await supabase.from('trackino_time_entries').update({ manager_note: '' }).eq('id', entryId);
    fetchNotes();
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Poznámky</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Manažerské poznámky k záznamům
            </p>
          </div>

          {uniqueUsers.length > 1 && (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="all">Všichni ({notes.length})</option>
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
        ) : filteredNotes.length === 0 ? (
          <div
            className="rounded-xl border px-6 py-12 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Zatím žádné manažerské poznámky.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                className="rounded-lg border px-4 py-3 group"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: note.profile?.avatar_color ?? 'var(--primary)' }}
                  >
                    {note.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {note.profile?.display_name ?? 'Neznámý'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(note.entry.start_time)} · {formatDuration(note.entry.duration ?? 0)}
                      </span>
                      {note.project && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: note.project.color }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{note.project.name}</span>
                        </span>
                      )}
                    </div>

                    {note.entry.description && (
                      <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {note.entry.description}
                      </div>
                    )}

                    {/* Poznámka */}
                    {editingNote === note.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveNote(note.id); if (e.key === 'Escape') setEditingNote(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                        <button onClick={() => saveNote(note.id)} className="px-2 py-1 rounded text-xs font-medium text-white" style={{ background: 'var(--primary)' }}>
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2">
                        <div
                          className="text-xs px-2 py-1 rounded flex-1 cursor-pointer"
                          style={{ background: 'var(--warning-light, rgba(234,179,8,0.1))', color: 'var(--warning, #ca8a04)' }}
                          onClick={() => { setEditingNote(note.id); setNoteText(note.entry.manager_note || ''); }}
                        >
                          <span className="font-medium">Poznámka:</span> {note.entry.manager_note}
                        </div>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                          title="Smazat poznámku"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
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

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <NotesContent />
    </WorkspaceProvider>
  );
}
