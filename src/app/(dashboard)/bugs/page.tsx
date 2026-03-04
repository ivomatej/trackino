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

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)', flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-flex items-center">
      {children}
      <svg
        className="pointer-events-none absolute right-2.5"
        width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: 'var(--text-muted)' }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
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
  const [movedBugIds, setMovedBugIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
  const [movingId, setMovingId] = useState<string | null>(null);

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

    // Načíst přesunuté bugy (které mají záznam v app_changes s source_bug_id)
    if (bugList.length > 0) {
      const bugIds = bugList.map(b => b.id);
      const { data: moved } = await supabase
        .from('trackino_app_changes')
        .select('source_bug_id')
        .in('source_bug_id', bugIds);

      const movedSet = new Set<string>(
        (moved ?? [])
          .map((r: { source_bug_id: string | null }) => r.source_bug_id)
          .filter(Boolean) as string[]
      );
      setMovedBugIds(movedSet);
    } else {
      setMovedBugIds(new Set());
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
    const { error } = await supabase.from('trackino_bug_reports')
      .update({ status })
      .eq('id', id);
    if (error) { alert(`Chyba při změně stavu: ${error.message}`); return; }
    fetchBugs();
  };

  const saveNote = async (id: string) => {
    const { error } = await supabase.from('trackino_bug_reports')
      .update({ master_note: noteText })
      .eq('id', id);
    if (error) { alert(`Chyba při ukládání poznámky: ${error.message}`); return; }
    setNoteEditId(null);
    fetchBugs();
  };

  const saveEdit = async (id: string) => {
    const content = editEditorRef.current?.innerHTML ?? '';
    const { error } = await supabase.from('trackino_bug_reports')
      .update({ content })
      .eq('id', id);
    if (error) { alert(`Chyba při ukládání: ${error.message}`); return; }
    setEditingId(null);
    fetchBugs();
  };

  const deleteBug = async (id: string) => {
    if (!confirm('Opravdu smazat tento report?')) return;
    await supabase.from('trackino_bug_reports').delete().eq('id', id);
    fetchBugs();
  };

  /** Přesune bug report do Úprav aplikace (Master Admin) */
  const moveBugToAppChanges = async (bug: BugReport) => {
    setMovingId(bug.id);

    // Extrahovat prostý text jako název (prvních 100 znaků)
    const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
    let title = bug.content;
    if (tempDiv) {
      tempDiv.innerHTML = bug.content;
      title = (tempDiv.innerText ?? tempDiv.textContent ?? '').trim();
    }
    title = title.slice(0, 100).replace(/\n+/g, ' ').trim() || 'Bug z Bug logu';

    // Sestavit obsah včetně případné Master Admin poznámky
    const plainContent = bug.content.replace(/<[^>]+>/g, '').trim();
    const noteSection = bug.master_note?.trim() ? `\n\nPoznámka: ${bug.master_note.trim()}` : '';
    const fullContent = plainContent + noteSection;

    const { error } = await supabase.from('trackino_app_changes').insert({
      title,
      content: fullContent,
      type: 'bug',
      priority: 'medium',
      status: 'open',
      source_bug_id: bug.id,
    });

    setMovingId(null);
    if (error) { alert('Chyba při přesunu: ' + error.message); return; }

    // Lokálně označit jako přesunutý (bez dalšího fetch)
    setMovedBugIds(prev => new Set(prev).add(bug.id));
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
    const isExpanded = expandedId === bug.id || isEditing;
    const isMoved = movedBugIds.has(bug.id);
    const statusColor = STATUS_COLORS[bug.status];

    return (
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
          borderLeft: `4px solid ${statusColor}`,
        }}
      >
        {/* Klikatelný header */}
        <div
          className="px-4 py-3 cursor-pointer select-none"
          onClick={() => {
            if (isEditing) return;
            setExpandedId(isExpanded ? null : bug.id);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Levá část: badges + info */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                style={{ background: statusColor }}
              >
                {STATUS_LABELS[bug.status]}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{userName}</span>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                {formatDate(bug.created_at)}
              </span>
              {isMasterAdmin && workspaces.length > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                >
                  {workspaces.find(w => w.id === bug.workspace_id)?.name ?? '—'}
                </span>
              )}
              {isMoved && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                  style={{ background: '#dcfce7', color: '#15803d' }}
                >
                  Přesunuto ✓
                </span>
              )}
            </div>

            {/* Pravá část: akční tlačítka + chevron */}
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {isOwn && !isEditing && (
                <button
                  onClick={() => {
                    setExpandedId(bug.id);
                    setEditingId(bug.id);
                    setTimeout(() => {
                      if (editEditorRef.current) editEditorRef.current.innerHTML = bug.content;
                    }, 0);
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
              <div onClick={(e) => { e.stopPropagation(); if (!isEditing) setExpandedId(isExpanded ? null : bug.id); }}>
                <ChevronDown open={isExpanded} />
              </div>
            </div>
          </div>
        </div>

        {/* Rozbalitelný obsah */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {/* Content / Editor */}
            {isEditing ? (
              <div className="rounded-lg border overflow-hidden mt-3 mb-3" style={{ borderColor: 'var(--border)' }}>
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
              <div
                className="prose prose-sm max-w-none mt-3"
                dangerouslySetInnerHTML={{ __html: bug.content }}
              />
            )}

            {isEditing && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setEditingId(null); }}
                  className="px-3 py-1.5 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={() => saveEdit(bug.id)}
                  className="px-4 py-1.5 rounded-lg text-white text-sm font-medium"
                  style={{ background: 'var(--primary)' }}
                >
                  Uložit
                </button>
              </div>
            )}

            {/* Master Admin sekce */}
            {isMasterAdmin && !isEditing && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                {/* Status + Přesun tlačítko */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
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

                  {/* Přesun do Úprav aplikace – pokud přesunuto, zobraz badge; jinak tlačítko */}
                  {isMoved ? (
                    <span
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium"
                      style={{ borderColor: '#22c55e', color: '#15803d', background: '#f0fdf4' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Přesunuto
                    </span>
                  ) : (
                    <button
                      onClick={() => moveBugToAppChanges(bug)}
                      disabled={movingId === bug.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Přidat do seznamu Úpravy aplikace"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                      {movingId === bug.id ? 'Přesouvám…' : 'Úpravy aplikace'}
                    </button>
                  )}
                </div>

                {/* Poznámka (zobrazení) */}
                {bug.master_note && !isEditingNote && (
                  <div
                    className="mt-2 p-2 rounded-lg text-xs"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>Poznámka:</strong> {bug.master_note}
                  </div>
                )}

                {/* Poznámka (editace) */}
                {isEditingNote ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveNote(bug.id);
                        if (e.key === 'Escape') setNoteEditId(null);
                      }}
                      className="flex-1 px-2 py-1.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                      placeholder="Poznámka pro uživatele..."
                      autoFocus
                    />
                    <button
                      onClick={() => setNoteEditId(null)}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={() => saveNote(bug.id)}
                      className="px-3 py-1 rounded text-xs text-white"
                      style={{ background: 'var(--primary)' }}
                    >
                      Uložit
                    </button>
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
        )}
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
            <SelectWrap>
              <select
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                <option value="all">Všechny workspace</option>
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </SelectWrap>
            <SelectWrap>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              >
                <option value="all">Všechny stavy</option>
                <option value="open">Otevřeno</option>
                <option value="in_progress">Řeší se</option>
                <option value="solved">Vyřešeno</option>
              </select>
            </SelectWrap>
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
                <div className="space-y-2">
                  {myBugs.map(bug => <BugCard key={bug.id} bug={bug} isOwn={true} />)}
                </div>
              </div>
            )}
            {isMasterAdmin && otherBugs.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>OSTATNÍ REPORTY</div>
                <div className="space-y-2">
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
