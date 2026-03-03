'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { BugReport, BugStatus } from '@/types/database';

const STATUS_LABELS: Record<BugStatus, string> = {
  open: 'Otevřeno',
  in_progress: 'Řeší se',
  solved: 'Vyřešeno',
};

const STATUS_COLORS: Record<BugStatus, string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  solved: '#22c55e',
};

interface UserInfo {
  display_name: string;
  email: string;
}

function ToolbarButtons({ onCmd }: { onCmd: (cmd: string) => void }) {
  return (
    <div className="px-3 py-2 border-b flex flex-wrap gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
      {[
        { cmd: 'bold', label: <strong>B</strong>, title: 'Tučné' },
        { cmd: 'italic', label: <em>I</em>, title: 'Kurzíva' },
        { cmd: 'underline', label: <u>U</u>, title: 'Podtržení' },
      ].map(btn => (
        <button
          key={btn.cmd}
          onMouseDown={(e) => { e.preventDefault(); onCmd(btn.cmd); }}
          className="px-2 py-1 rounded text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title={btn.title}
        >
          {btn.label}
        </button>
      ))}
      <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
      <button onMouseDown={(e) => { e.preventDefault(); onCmd('insertUnorderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>• Seznam</button>
      <button onMouseDown={(e) => { e.preventDefault(); onCmd('insertOrderedList'); }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>1. Seznam</button>
    </div>
  );
}

function BugsContent() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { isMasterAdmin } = usePermissions();

  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserInfo>>({});

  const editorRef = useRef<HTMLDivElement>(null);
  const editEditorRef = useRef<HTMLDivElement>(null);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from('trackino_bug_reports').select('*').order('created_at', { ascending: false });

    if (!isMasterAdmin && currentWorkspace) {
      query = query.eq('workspace_id', currentWorkspace.id);
    } else if (isMasterAdmin && workspaceFilter !== 'all') {
      query = query.eq('workspace_id', workspaceFilter);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    const bugList = (data ?? []) as BugReport[];
    setBugs(bugList);

    // Načíst profily autorů
    const userIds = [...new Set(bugList.map(b => b.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      const profileMap: Record<string, UserInfo> = {};
      (profiles ?? []).forEach((p: { id: string; display_name: string; email: string }) => {
        profileMap[p.id] = { display_name: p.display_name, email: p.email };
      });
      setUserProfiles(profileMap);
    }

    setLoading(false);
  }, [currentWorkspace, isMasterAdmin, workspaceFilter, statusFilter]);

  const fetchWorkspaces = useCallback(async () => {
    if (!isMasterAdmin) return;
    const { data } = await supabase.from('trackino_workspaces').select('id, name').order('name');
    setWorkspaces((data ?? []) as { id: string; name: string }[]);
  }, [isMasterAdmin]);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const submitBug = async () => {
    setSubmitError('');

    if (!user) { setSubmitError('Nejste přihlášeni.'); return; }
    if (!currentWorkspace) { setSubmitError('Nebyl načten workspace – zkuste obnovit stránku.'); return; }

    const content = editorRef.current?.innerHTML ?? '';
    // Ověř, že je skutečný text (odstraní HTML tagy)
    const textOnly = editorRef.current?.innerText?.replace(/\n/g, '').trim() ?? '';
    if (!textOnly) { setSubmitError('Vyplňte prosím popis chyby.'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('trackino_bug_reports').insert({
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      content,
      status: 'open',
      master_note: '',
    });

    if (error) {
      setSubmitError(`Chyba při odesílání: ${error.message}`);
      setSubmitting(false);
      return;
    }

    if (editorRef.current) editorRef.current.innerHTML = '';
    setSubmitting(false);
    fetchBugs();
  };

  const updateStatus = async (id: string, status: BugStatus) => {
    await supabase.from('trackino_bug_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchBugs();
  };

  const saveNote = async (id: string) => {
    await supabase.from('trackino_bug_reports')
      .update({ master_note: noteText, updated_at: new Date().toISOString() })
      .eq('id', id);
    setNoteEditId(null);
    fetchBugs();
  };

  const saveEdit = async (id: string) => {
    const content = editEditorRef.current?.innerHTML ?? '';
    await supabase.from('trackino_bug_reports')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id);
    setEditingId(null);
    fetchBugs();
  };

  const deleteBug = async (id: string) => {
    if (!confirm('Opravdu smazat tento report?')) return;
    await supabase.from('trackino_bug_reports').delete().eq('id', id);
    fetchBugs();
  };

  const execCmd = (cmd: string) => { document.execCommand(cmd, false); editorRef.current?.focus(); };
  const execCmdEdit = (cmd: string) => { document.execCommand(cmd, false); editEditorRef.current?.focus(); };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const myBugs = bugs.filter(b => b.user_id === user?.id);
  const otherBugs = bugs.filter(b => b.user_id !== user?.id);

  const BugCard = ({ bug, isOwn }: { bug: BugReport; isOwn: boolean }) => {
    const userInfo = userProfiles[bug.user_id];
    const userName = userInfo?.display_name || userInfo?.email || 'Neznámý';
    const isEditing = editingId === bug.id;
    const isEditingNote = noteEditId === bug.id;

    return (
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: STATUS_COLORS[bug.status] }}>
                {STATUS_LABELS[bug.status]}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{userName}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(bug.created_at)}</span>
              {isMasterAdmin && workspaces.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                  {workspaces.find(w => w.id === bug.workspace_id)?.name ?? '—'}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {isOwn && !isEditing && (
                <button
                  onClick={() => {
                    setEditingId(bug.id);
                    setTimeout(() => { if (editEditorRef.current) editEditorRef.current.innerHTML = bug.content; }, 0);
                  }}
                  className="px-2 py-1 rounded text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Upravit
                </button>
              )}
              {(isOwn || isMasterAdmin) && !isEditing && (
                <button
                  onClick={() => deleteBug(bug.id)}
                  className="px-2 py-1 rounded text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Smazat
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="rounded-lg border overflow-hidden mb-3" style={{ borderColor: 'var(--border)' }}>
              <ToolbarButtons onCmd={execCmdEdit} />
              <div
                ref={editEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="prose prose-sm max-w-none p-3 focus:outline-none"
                style={{ color: 'var(--text-primary)', minHeight: '100px' }}
              />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: bug.content }} />
          )}

          {isEditing && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button onClick={() => saveEdit(bug.id)} className="px-4 py-1.5 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Uložit</button>
            </div>
          )}

          {/* Master Admin sekce */}
          {isMasterAdmin && !isEditing && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Stav:</span>
                {(['open', 'in_progress', 'solved'] as BugStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(bug.id, s)}
                    className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      background: bug.status === s ? STATUS_COLORS[s] : 'transparent',
                      color: bug.status === s ? 'white' : 'var(--text-secondary)',
                      borderColor: STATUS_COLORS[s],
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {bug.master_note && !isEditingNote && (
                <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Poznámka:</strong> {bug.master_note}
                </div>
              )}

              {isEditingNote ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveNote(bug.id); if (e.key === 'Escape') setNoteEditId(null); }}
                    className="flex-1 px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    placeholder="Poznámka pro uživatele..."
                    autoFocus
                  />
                  <button onClick={() => setNoteEditId(null)} className="px-2 py-1 rounded text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
                  <button onClick={() => saveNote(bug.id)} className="px-3 py-1 rounded text-xs text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
                </div>
              ) : (
                <button
                  onClick={() => { setNoteEditId(bug.id); setNoteText(bug.master_note ?? ''); }}
                  className="mt-2 text-xs"
                  style={{ color: 'var(--primary)' }}
                >
                  {bug.master_note ? 'Upravit poznámku' : '+ Přidat poznámku'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Nahlásit chybu</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Popište chybu nebo problém, který jste v aplikaci objevili
          </p>
        </div>

        {/* Formulář pro nový bug report */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nový report</h2>
          </div>
          <ToolbarButtons onCmd={execCmd} />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Popište chybu podrobně – co jste dělali, co se stalo a co jste očekávali..."
            className="prose prose-sm max-w-none p-4 focus:outline-none"
            style={{ color: 'var(--text-primary)', minHeight: '120px', cursor: 'text' }}
          />
          <div className="px-4 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
            {submitError ? (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{submitError}</p>
            ) : <span />}
            <button
              onClick={submitBug}
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {submitting ? 'Odesílám...' : 'Odeslat report'}
            </button>
          </div>
        </div>

        {/* Filtry – jen pro Master Admin */}
        {isMasterAdmin && (
          <div className="flex gap-3 flex-wrap items-center">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>FILTRY</span>
            <select
              value={workspaceFilter}
              onChange={(e) => setWorkspaceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="all">Všechny workspace</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="all">Všechny stavy</option>
              <option value="open">Otevřeno</option>
              <option value="in_progress">Řeší se</option>
              <option value="solved">Vyřešeno</option>
            </select>
          </div>
        )}

        {/* Seznam reportů */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bugs.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <p className="text-sm">Zatím žádné reporty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myBugs.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>MOJE REPORTY</div>
                <div className="space-y-3">
                  {myBugs.map(bug => <BugCard key={bug.id} bug={bug} isOwn={true} />)}
                </div>
              </div>
            )}
            {isMasterAdmin && otherBugs.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>OSTATNÍ REPORTY</div>
                <div className="space-y-3">
                  {otherBugs.map(bug => <BugCard key={bug.id} bug={bug} isOwn={false} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .prose h2 { font-size: 1.1rem; font-weight: 700; margin: 1rem 0 0.3rem; color: var(--text-primary); }
        .prose h3 { font-size: 0.95rem; font-weight: 600; margin: 0.8rem 0 0.3rem; color: var(--text-primary); }
        .prose p { margin: 0.3rem 0; color: var(--text-secondary); line-height: 1.6; }
        .prose ul { margin: 0.3rem 0 0.3rem 1.5rem; list-style-type: disc; }
        .prose ol { margin: 0.3rem 0 0.3rem 1.5rem; list-style-type: decimal; }
        .prose li { margin: 0.15rem 0; color: var(--text-secondary); }
        .prose strong { font-weight: 700; color: var(--text-primary); }
        /* V editoru – text má být primární barvy, ne sekundární */
        [contenteditable] { color: var(--text-primary); }
        [contenteditable] p { color: var(--text-primary); }
        [contenteditable] li { color: var(--text-primary); }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; }
      `}</style>
    </DashboardLayout>
  );
}

export default function BugsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <BugsContent />
    </WorkspaceProvider>
  );
}
