'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { TimeEntry, Project, Profile } from '@/types/database';

// ── Helpers ───────────────────────────────────────────────────────────────────

type DatePreset = 'today' | 'week' | 'month' | 'custom';

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Dnes', value: 'today' },
  { label: 'Tento týden', value: 'week' },
  { label: 'Tento měsíc', value: 'month' },
  { label: 'Vlastní', value: 'custom' },
];

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = isoDate(now);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1);
    return { from: isoDate(d), to: today };
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  return { from: today, to: today };
}

interface MemberProfile {
  user_id: string;
  display_name: string;
  avatar_color: string;
}

// ── NotesContent ──────────────────────────────────────────────────────────────

function NotesContent() {
  const { user } = useAuth();
  const { currentWorkspace, isManagerOf } = useWorkspace();
  const { isManager, isWorkspaceAdmin } = usePermissions();
  const canManageNotes = isManager || isWorkspaceAdmin;

  // Filtry
  const [preset, setPreset] = useState<DatePreset>('week');
  const [customFrom, setCustomFrom] = useState(isoDate(new Date()));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [userFilter, setUserFilter] = useState<string>('all');

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtr jen s poznámkou
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);

  // Inline editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const canSeeOthers = isWorkspaceAdmin || isManager;

  const { from, to } = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPresetRange(preset);

  // Načtení členů
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace || !canSeeOthers) return;
    const { data } = await supabase
      .from('trackino_workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id);

    const userIds = (data ?? []).map((m: { user_id: string }) => m.user_id);
    if (userIds.length === 0) return;

    const { data: profilesData } = await supabase
      .from('trackino_profiles')
      .select('id, display_name, email, avatar_color')
      .in('id', userIds);

    const memberList: MemberProfile[] = (profilesData ?? []).map((p: { id: string; display_name: string; email: string; avatar_color: string }) => ({
      user_id: p.id,
      display_name: p.display_name || p.email,
      avatar_color: p.avatar_color ?? '#2563eb',
    }));

    if (isManager && !isWorkspaceAdmin) {
      setMembers(memberList.filter(m => m.user_id === user?.id || isManagerOf(m.user_id)));
    } else {
      setMembers(memberList);
    }
  }, [currentWorkspace, canSeeOthers, isManager, isWorkspaceAdmin, user, isManagerOf]);

  // Načtení záznamů
  const fetchEntries = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    const fromDt = `${from}T00:00:00.000Z`;
    const toDt = `${to}T23:59:59.999Z`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('trackino_time_entries')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .gte('start_time', fromDt)
      .lte('start_time', toDt)
      .eq('is_running', false)
      .order('start_time', { ascending: false });

    if (!canSeeOthers) {
      query = query.eq('user_id', user.id);
    } else if (userFilter !== 'all') {
      query = query.eq('user_id', userFilter);
    }

    const { data } = await query;
    const allEntries = (data ?? []) as TimeEntry[];
    setEntries(allEntries);

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
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('trackino_profiles')
        .select('*')
        .in('id', userIds);
      const profileMap: Record<string, Profile> = {};
      (profilesData ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
    }

    setLoading(false);
  }, [currentWorkspace, user, from, to, userFilter, canSeeOthers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const startEdit = (entry: TimeEntry) => {
    setEditingNoteId(entry.id);
    setNoteText(entry.manager_note ?? '');
  };

  const saveNote = async (entryId: string) => {
    setSavingNoteId(entryId);
    await supabase
      .from('trackino_time_entries')
      .update({ manager_note: noteText.trim() })
      .eq('id', entryId);
    setEditingNoteId(null);
    setSavingNoteId(null);
    // Okamžitá lokální aktualizace
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, manager_note: noteText.trim() } : e
    ));
  };

  const deleteNote = async (entryId: string) => {
    await supabase.from('trackino_time_entries').update({ manager_note: '' }).eq('id', entryId);
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, manager_note: '' } : e
    ));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  const fmtDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!canManageNotes) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Poznámky</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k zobrazení poznámek.</p>
        </div>
      </DashboardLayout>
    );
  }

  const withNotes = entries.filter(e => e.manager_note && e.manager_note.trim() !== '');

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        {/* Záhlaví */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Poznámky</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Přidávejte manažerské poznámky k záznamům — klikněte na záznam a napište poznámku
          </p>
        </div>

        {/* Filtry */}
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-3 items-end">

            {/* Období */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Období</label>
              <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-hover)' }}>
                {PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPreset(p.value)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                    style={{
                      background: preset === p.value ? 'var(--bg-card)' : 'transparent',
                      color: preset === p.value ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: preset === p.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {preset === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Od</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Do</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
              </>
            )}

            {/* Uživatel */}
            {canSeeOthers && members.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Uživatel</label>
                <div className="relative">
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="px-3 py-2 pr-8 rounded-lg border text-sm focus:outline-none appearance-none cursor-pointer"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="all">Všichni</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filtr jen s poznámkou */}
          <div className="flex items-end">
            <button
              onClick={() => setOnlyWithNotes(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors"
              style={{
                borderColor: onlyWithNotes ? 'var(--primary)' : 'var(--border)',
                background: onlyWithNotes ? 'var(--bg-active)' : 'var(--bg-input)',
                color: onlyWithNotes ? 'var(--primary)' : 'var(--text-secondary)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Jen s poznámkou
            </button>
          </div>

          {/* Statistiky */}
          {!loading && (
            <div className="flex gap-5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Záznamů celkem:{' '}
                <span className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{entries.length}</span>
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                S poznámkou:{' '}
                <span className="font-medium tabular-nums" style={{ color: 'var(--primary)' }}>{withNotes.length}</span>
              </span>
            </div>
          )}
        </div>

        {/* Záznamy */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (onlyWithNotes ? withNotes : entries).length === 0 ? (
          <div
            className="rounded-xl border px-6 py-16 text-center"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-30">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {onlyWithNotes ? 'Žádné záznamy s poznámkou pro vybrané období.' : 'Žádné záznamy pro vybrané období.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="entry-divider">
              {(onlyWithNotes ? withNotes : entries).map(entry => {
                const profile = profiles[entry.user_id];
                const project = entry.project_id ? projects[entry.project_id] : undefined;
                const hasNote = !!(entry.manager_note && entry.manager_note.trim());
                const isEditing = editingNoteId === entry.id;
                const initials = profile?.display_name
                  ?.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
                  ?? (profile?.email?.charAt(0).toUpperCase() ?? '?');

                return (
                  <div
                    key={entry.id}
                    className="px-4 py-3 transition-colors"
                    style={{
                      background: hasNote
                        ? 'color-mix(in srgb, var(--warning-light) 40%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar (viditelný jen při canSeeOthers) */}
                      {canSeeOthers && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                          style={{ background: profile?.avatar_color ?? 'var(--primary)' }}
                          title={profile?.display_name ?? ''}
                        >
                          {initials}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Řádek metadat záznamu */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {canSeeOthers && (
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                              {profile?.display_name ?? '—'}
                            </span>
                          )}
                          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {fmtDate(entry.start_time)} · {fmtTime(entry.start_time)}–{entry.end_time ? fmtTime(entry.end_time) : '?'}
                          </span>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            {fmtDuration(entry.duration ?? 0)}
                          </span>
                          {project && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: project.color }} />
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{project.name}</span>
                            </span>
                          )}
                        </div>

                        {/* Popis záznamu */}
                        {entry.description && (
                          <div className="text-sm mt-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                            {entry.description}
                          </div>
                        )}

                        {/* Oblast poznámky */}
                        {isEditing ? (
                          <div className="flex gap-2 mt-2">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(entry.id); }
                                if (e.key === 'Escape') { setEditingNoteId(null); }
                              }}
                              autoFocus
                              placeholder="Napište poznámku… (Enter = uložit, Shift+Enter = nový řádek)"
                              rows={2}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button
                                onClick={() => saveNote(entry.id)}
                                disabled={savingNoteId === entry.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 whitespace-nowrap"
                                style={{ background: 'var(--primary)' }}
                              >
                                {savingNoteId === entry.id ? '...' : 'Uložit'}
                              </button>
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                              >
                                Zrušit
                              </button>
                            </div>
                          </div>
                        ) : hasNote ? (
                          /* Existující poznámka – klikat pro editaci */
                          <div className="flex items-start gap-2 mt-2">
                            <div
                              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}
                              onClick={() => startEdit(entry)}
                              title="Klikněte pro editaci"
                            >
                              <span className="font-semibold">Poznámka:</span> {entry.manager_note}
                            </div>
                            <button
                              onClick={() => deleteNote(entry.id)}
                              className="p-1 rounded flex-shrink-0 transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                              title="Smazat poznámku"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          /* Žádná poznámka – tlačítko pro přidání */
                          <button
                            onClick={() => startEdit(entry)}
                            className="mt-1.5 text-xs flex items-center gap-1 transition-opacity opacity-0 hover:opacity-100 group-hover:opacity-60"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Přidat poznámku
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

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
