'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import type { BugReport, BugStatus } from '@/types/database';
import type { UserInfo } from './types';

export function useBugs() {
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

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('trackino_bug_reports')
      .update({ master_note: '' })
      .eq('id', id);
    if (error) { alert(`Chyba při mazání poznámky: ${error.message}`); return; }
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

    const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
    let title = bug.content;
    if (tempDiv) {
      tempDiv.innerHTML = bug.content;
      title = (tempDiv.innerText ?? tempDiv.textContent ?? '').trim();
    }
    title = title.slice(0, 100).replace(/\n+/g, ' ').trim() || 'Bug z Bug logu';

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

    setMovedBugIds(prev => new Set(prev).add(bug.id));
  };

  const execCmd = (cmd: string) => { document.execCommand(cmd, false); editorRef.current?.focus(); };
  const execCmdEdit = (cmd: string) => { document.execCommand(cmd, false); editEditorRef.current?.focus(); };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const startEdit = (bug: BugReport) => {
    setExpandedId(bug.id);
    setEditingId(bug.id);
    setTimeout(() => {
      if (editEditorRef.current) editEditorRef.current.innerHTML = bug.content;
    }, 0);
  };

  const cancelEdit = () => setEditingId(null);

  const startNoteEdit = (bug: BugReport) => {
    setNoteEditId(bug.id);
    setNoteText(bug.master_note ?? '');
  };

  const cancelNoteEdit = () => setNoteEditId(null);

  const myBugs = bugs.filter(b => b.user_id === user?.id);
  const otherBugs = bugs.filter(b => b.user_id !== user?.id);

  return {
    // state
    bugs, myBugs, otherBugs,
    movedBugIds, expandedId, loading, submitting, submitError,
    editingId, noteEditId, noteText, setNoteText,
    workspaceFilter, setWorkspaceFilter,
    statusFilter, setStatusFilter,
    workspaces, userProfiles, movingId,
    // refs
    editorRef, editEditorRef,
    // actions
    fetchBugs, fetchWorkspaces,
    submitBug, updateStatus, saveNote, deleteNote, saveEdit, deleteBug, moveBugToAppChanges,
    execCmd, execCmdEdit, formatDate,
    toggleExpand, startEdit, cancelEdit, startNoteEdit, cancelNoteEdit,
    // from contexts
    isMasterAdmin,
  };
}
