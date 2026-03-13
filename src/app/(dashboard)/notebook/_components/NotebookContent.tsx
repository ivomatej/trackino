'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import type { Note, NoteFolder, FolderShare, Member, CalEventNote, NoteFilter, TaskItem } from './types';
import {
  UUID_RE, MAX_DEPTH, getInitials, stripHtml, htmlToPlainText,
  fmtDate, fmtEventDate, fmtEventTime, getDuplicateTitle,
  getDescendantFolderIds, buildFolderFlat,
} from './utils';
import { FolderTree } from './FolderTree';
import { NoteEditor } from './NoteEditor';
import { CalEventNoteEditor } from './CalEventNoteEditor';

export function NotebookContent() {
  const { user } = useAuth();
  const { currentWorkspace, hasModule } = useWorkspace();
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [shares, setShares] = useState<FolderShare[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [calEventNotes, setCalEventNotes] = useState<CalEventNote[]>([]);

  const [listFilter, setListFilter] = useState<NoteFilter>({ type: 'inbox' });
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedCalNote, setSelectedCalNote] = useState<CalEventNote | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'oldest' | 'title_desc'>('date');
  const [calNotesSortBy, setCalNotesSortBy] = useState<'date' | 'date_asc' | 'title' | 'title_desc'>('date');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [authorExpanded, setAuthorExpanded] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notebookSettings, setNotebookSettings] = useState<{
    foldersAutoOpen: boolean;
    showInbox: boolean;
    defaultSort: 'date' | 'title' | 'oldest' | 'title_desc';
    folderSortOrder: 'name' | 'created' | 'manual';
    saveFolderSort: boolean;
    showDoneFeature: boolean;
  }>({ foldersAutoOpen: false, showInbox: true, defaultSort: 'date', folderSortOrder: 'manual', saveFolderSort: false, showDoneFeature: false });
  const [folderSortCache, setFolderSortCache] = useState<Record<string, string>>({});
  const [filterSaved, setFilterSaved] = useState(false);
  const [hideDone, setHideDone] = useState(false);

  // Copy done animation (note id, or null)
  const [copyDoneNoteId, setCopyDoneNoteId] = useState<string | null>(null);

  // Archive multi-select
  const [archiveSelected, setArchiveSelected] = useState<Set<string>>(new Set());

  // Move note dropdown
  const [moveDropdown, setMoveDropdown] = useState<{ noteId: string; top?: number; bottom?: number; right: number } | null>(null);

  // Mobile note actions menu (3 dots)
  const [noteActionsMenu, setNoteActionsMenu] = useState<{ noteId: string; top?: number; bottom?: number; right: number } | null>(null);

  // Folder modal
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null; editing: NoteFolder | null }>({ open: false, parentId: null, editing: null });
  const [folderName, setFolderName] = useState('');

  // Share modal
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: NoteFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  const wsId = currentWorkspace?.id;
  const userId = user?.id ?? '';

  // ── Load settings from localStorage ─────────────────────────────────────
  useEffect(() => {
    if (!wsId) return;
    const saved = localStorage.getItem(`trackino_notebook_settings_${wsId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotebookSettings(prev => ({ ...prev, ...parsed }));
        if (parsed.defaultSort) setSortBy(parsed.defaultSort);
      } catch {}
    }
  }, [wsId]);

  // ── Folder sort cache – DB (cross-device, per-user) ──────────────────────
  const fetchNotebookPrefs = useCallback(async () => {
    if (!wsId || !userId) return;
    const { data } = await supabase
      .from('trackino_notebook_prefs')
      .select('folder_sort_cache')
      .eq('workspace_id', wsId)
      .eq('user_id', userId)
      .single();
    if (data?.folder_sort_cache) {
      setFolderSortCache(data.folder_sort_cache as Record<string, string>);
    }
  }, [wsId, userId]);

  const saveNotebookPrefs = useCallback(async (cache: Record<string, string>) => {
    if (!wsId || !userId) return;
    await supabase.from('trackino_notebook_prefs').upsert(
      { workspace_id: wsId, user_id: userId, folder_sort_cache: cache, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,user_id' }
    );
  }, [wsId, userId]);

  useEffect(() => {
    if (!wsId || !userId) return;
    fetchNotebookPrefs();
  }, [wsId, userId, fetchNotebookPrefs]);

  // ── Auto-expand folders ───────────────────────────────────────────────────
  useEffect(() => {
    if (notebookSettings.foldersAutoOpen && folders.length > 0) {
      const parentIds = new Set(folders.filter(f => f.parent_id !== null).map(f => f.parent_id!));
      setExpanded(prev => {
        const next = new Set(prev);
        for (const id of parentIds) next.add(id);
        return next;
      });
    }
  }, [notebookSettings.foldersAutoOpen, folders]);

  function saveSettings(next: typeof notebookSettings) {
    setNotebookSettings(next);
    if (wsId) localStorage.setItem(`trackino_notebook_settings_${wsId}`, JSON.stringify(next));
  }

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    if (!wsId) return;
    const { data } = await supabase.from('trackino_notes').select('*').eq('workspace_id', wsId).eq('user_id', userId).order('updated_at', { ascending: false });
    if (data) setNotes(data.map(n => ({ ...n, tasks: Array.isArray(n.tasks) ? n.tasks : [] })));
  }, [wsId, userId]);

  const fetchFolders = useCallback(async () => {
    if (!wsId) return;
    const { data } = await supabase.from('trackino_note_folders').select('*').eq('workspace_id', wsId).order('sort_order').order('name');
    if (data) setFolders(data);
  }, [wsId]);

  const fetchShares = useCallback(async () => {
    if (!wsId) return;
    const { data } = await supabase.from('trackino_note_folder_shares').select('*').eq('workspace_id', wsId);
    if (data) setShares(data);
  }, [wsId]);

  const fetchMembers = useCallback(async () => {
    if (!wsId) return;
    const { data: mData } = await supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId);
    const memberUserIds = (mData ?? []).map((m: { user_id: string }) => m.user_id);
    if (memberUserIds.length === 0) return;
    const { data: profData } = await supabase.from('trackino_profiles').select('id, display_name, email, avatar_color').in('id', memberUserIds);
    if (profData) setMembers(profData.map((p: { id: string; display_name: string | null; email: string | null; avatar_color: string | null }) => ({
      user_id: p.id,
      display_name: p.display_name ?? 'Uživatel',
      avatar_color: p.avatar_color ?? '#6366f1',
      email: p.email ?? '',
    })));
  }, [wsId]);

  const fetchCalEventNotes = useCallback(async () => {
    if (!wsId) return;
    const { data: noteData, error: noteErr } = await supabase
      .from('trackino_calendar_event_notes')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('user_id', userId);
    if (noteErr) { console.error('[Trackino] fetchCalEventNotes – dotaz selhal:', noteErr.message, noteErr.code); setCalEventNotes([]); return; }
    if (!noteData || noteData.length === 0) { setCalEventNotes([]); return; }

    const result: CalEventNote[] = [];

    // ── Ruční události (UUID event_ref) ───────────────────────────────────
    const uuidNotes = noteData.filter(n => UUID_RE.test(n.event_ref));
    if (uuidNotes.length > 0) {
      const eventIds = uuidNotes.map(n => n.event_ref);
      const { data: evData, error: evErr } = await supabase
        .from('trackino_calendar_events')
        .select('id, title, start_date, start_time, end_time, is_all_day')
        .in('id', eventIds);
      if (evErr) console.error('[Trackino] fetchCalEventNotes – calendar_events selhal:', evErr.message);
      if (evData) {
        const evMap: Record<string, { title: string; start_date: string; start_time: string | null; end_time: string | null; is_all_day: boolean }> = {};
        for (const e of evData) evMap[e.id] = { title: e.title, start_date: e.start_date, start_time: e.start_time ?? null, end_time: e.end_time ?? null, is_all_day: e.is_all_day ?? true };
        for (const n of uuidNotes) {
          const ev = evMap[n.event_ref];
          if (!ev) continue;
          const dateStr = fmtEventDate(ev.start_date);
          const timeStr = ev.is_all_day ? '' : fmtEventTime(ev.start_time, ev.end_time);
          const title = timeStr ? `${ev.title} – ${dateStr} ${timeStr}` : `${ev.title} – ${dateStr}`;
          result.push({ event_ref: n.event_ref, event_id: n.event_ref, title, date: ev.start_date, start_time: ev.start_time ?? null, end_time: ev.end_time ?? null, is_all_day: ev.is_all_day ?? true, content: n.content ?? '', tasks: Array.isArray(n.tasks) ? n.tasks : [], is_favorite: n.is_favorite ?? false, is_important: n.is_important ?? false });
        }
      }
    }

    // ── Opakující se ruční události (UUID__rec__YYYY-MM-DD) ───────────────
    const RECURRING_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})__rec__(\d{4}-\d{2}-\d{2})$/i;
    const recurringNotes = noteData.filter(n => RECURRING_RE.test(n.event_ref));
    if (recurringNotes.length > 0) {
      type RParsed = { note: typeof recurringNotes[0]; origId: string; occDate: string };
      const parsedRec: RParsed[] = [];
      for (const n of recurringNotes) {
        const m = n.event_ref.match(RECURRING_RE);
        if (m) parsedRec.push({ note: n, origId: m[1], occDate: m[2] });
      }
      if (parsedRec.length > 0) {
        const origIds = [...new Set(parsedRec.map(p => p.origId))];
        const { data: recEvData, error: recErr } = await supabase
          .from('trackino_calendar_events')
          .select('id, title, start_time, end_time, is_all_day')
          .in('id', origIds);
        if (recErr) console.error('[Trackino] fetchCalEventNotes – rec events selhal:', recErr.message);
        if (recEvData) {
          const recEvMap: Record<string, { title: string; start_time: string | null; end_time: string | null; is_all_day: boolean }> = {};
          for (const e of recEvData) recEvMap[e.id] = { title: e.title, start_time: e.start_time ?? null, end_time: e.end_time ?? null, is_all_day: e.is_all_day ?? true };
          for (const p of parsedRec) {
            const ev = recEvMap[p.origId];
            if (!ev) continue;
            const dateStr = fmtEventDate(p.occDate);
            const timeStr = ev.is_all_day ? '' : fmtEventTime(ev.start_time, ev.end_time);
            const title = timeStr ? `${ev.title} – ${dateStr} ${timeStr}` : `${ev.title} – ${dateStr}`;
            result.push({ event_ref: p.note.event_ref, event_id: p.note.event_ref, title, date: p.occDate, start_time: ev.start_time ?? null, end_time: ev.end_time ?? null, is_all_day: ev.is_all_day ?? true, content: p.note.content ?? '', tasks: Array.isArray(p.note.tasks) ? p.note.tasks : [], is_favorite: p.note.is_favorite ?? false, is_important: p.note.is_important ?? false });
          }
        }
      }
    }

    // ── ICS události (sub-...) ────────────────────────────────────────────
    const icsNotes = noteData.filter(n => n.event_ref.startsWith('sub-'));
    if (icsNotes.length > 0) {
      const icsRefs = icsNotes.map(n => n.event_ref);
      const { data: icsEvData, error: icsErr } = await supabase
        .from('trackino_ics_event_cache')
        .select('uid, title, start_date, start_time, end_time, is_all_day')
        .in('uid', icsRefs);
      if (icsErr) console.error('[Trackino] fetchCalEventNotes – ics_event_cache selhal:', icsErr.message);
      if (icsEvData) {
        const evMap: Record<string, typeof icsEvData[0]> = {};
        for (const e of icsEvData) evMap[e.uid] = e;
        for (const n of icsNotes) {
          const ev = evMap[n.event_ref];
          if (!ev) continue;
          const dateStr = fmtEventDate(ev.start_date);
          const timeStr = ev.is_all_day ? '' : fmtEventTime(ev.start_time ?? null, ev.end_time ?? null);
          const title = timeStr ? `${ev.title} – ${dateStr} ${timeStr}` : `${ev.title} – ${dateStr}`;
          result.push({ event_ref: n.event_ref, event_id: n.event_ref, title, date: ev.start_date, start_time: ev.start_time ?? null, end_time: ev.end_time ?? null, is_all_day: ev.is_all_day ?? true, content: n.content ?? '', tasks: Array.isArray(n.tasks) ? n.tasks : [], is_favorite: n.is_favorite ?? false, is_important: n.is_important ?? false });
        }
      }
    }

    // ── Dovolená (vacation-UUID) ──────────────────────────────────────────
    const VACATION_RE = /^vacation-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
    const vacNotes = noteData.filter(n => VACATION_RE.test(n.event_ref));
    if (vacNotes.length > 0) {
      const vacIds = [...new Set(vacNotes.map(n => n.event_ref.match(VACATION_RE)![1]))];
      const { data: vacData, error: vacErr } = await supabase
        .from('trackino_vacation_entries')
        .select('id, start_date, end_date')
        .in('id', vacIds);
      if (vacErr) console.error('[Trackino] fetchCalEventNotes – vacation_entries selhal:', vacErr.message);
      if (vacData) {
        const vacMap: Record<string, { start_date: string; end_date: string }> = {};
        for (const v of vacData) vacMap[v.id] = { start_date: v.start_date, end_date: v.end_date };
        for (const n of vacNotes) {
          const m = n.event_ref.match(VACATION_RE);
          if (!m) continue;
          const vac = vacMap[m[1]];
          if (!vac) continue;
          const dateStr = fmtEventDate(vac.start_date);
          const endStr = vac.start_date !== vac.end_date ? ` – ${fmtEventDate(vac.end_date)}` : '';
          const title = `Dovolená – ${dateStr}${endStr}`;
          result.push({ event_ref: n.event_ref, event_id: n.event_ref, title, date: vac.start_date, start_time: null, end_time: null, is_all_day: true, content: n.content ?? '', tasks: Array.isArray(n.tasks) ? n.tasks : [], is_favorite: n.is_favorite ?? false, is_important: n.is_important ?? false });
        }
      }
    }

    // ── Důležité dny (importantday-UUID-YYYY-MM-DD) ───────────────────────
    const IMPORTANTDAY_RE = /^importantday-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d{4}-\d{2}-\d{2})$/i;
    const impDayNotes = noteData.filter(n => IMPORTANTDAY_RE.test(n.event_ref));
    if (impDayNotes.length > 0) {
      const dayIds = [...new Set(impDayNotes.map(n => n.event_ref.match(IMPORTANTDAY_RE)![1]))];
      const { data: dayData, error: dayErr } = await supabase
        .from('trackino_important_days')
        .select('id, title')
        .in('id', dayIds);
      if (dayErr) console.error('[Trackino] fetchCalEventNotes – important_days selhal:', dayErr.message);
      if (dayData) {
        const dayMap: Record<string, { title: string }> = {};
        for (const d of dayData) dayMap[d.id] = { title: d.title };
        for (const n of impDayNotes) {
          const m = n.event_ref.match(IMPORTANTDAY_RE);
          if (!m) continue;
          const day = dayMap[m[1]];
          if (!day) continue;
          const title = `${day.title} – ${fmtEventDate(m[2])}`;
          result.push({ event_ref: n.event_ref, event_id: n.event_ref, title, date: m[2], start_time: null, end_time: null, is_all_day: true, content: n.content ?? '', tasks: Array.isArray(n.tasks) ? n.tasks : [], is_favorite: n.is_favorite ?? false, is_important: n.is_important ?? false });
        }
      }
    }

    setCalEventNotes(result);
  }, [wsId, userId]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchNotes(), fetchFolders(), fetchShares(), fetchMembers(), fetchCalEventNotes()]);
  }, [fetchNotes, fetchFolders, fetchShares, fetchMembers, fetchCalEventNotes]);

  useEffect(() => { if (wsId) fetchAll(); }, [wsId, fetchAll]);

  // ── Redirect if no module ────────────────────────────────────────────────
  useEffect(() => {
    if (wsId && !hasModule('notebook')) router.push('/');
  }, [wsId, hasModule, router]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async function createNote() {
    if (!wsId) return;
    const folderId = listFilter?.type === 'folder' ? listFilter.folderId : null;
    const { data, error } = await supabase.from('trackino_notes').insert({
      workspace_id: wsId, user_id: userId,
      title: 'Nová poznámka', content: '', tasks: [],
      folder_id: folderId, is_favorite: false, is_important: false, is_archived: false, is_done: false,
    }).select().single();
    if (!error && data) {
      await fetchNotes();
      const newNote = { ...data, tasks: [] };
      setSelectedNote(newNote);
      setSelectedCalNote(null);
    }
  }

  async function saveNote(noteId: string, title: string, content: string, tasks: TaskItem[], meta: { is_favorite: boolean; is_important: boolean; is_done: boolean }) {
    if (!wsId) return;
    await supabase.from('trackino_notes').update({ title, content, tasks, ...meta, updated_at: new Date().toISOString() }).eq('id', noteId).eq('workspace_id', wsId);
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title, content, tasks, ...meta, updated_at: new Date().toISOString() } : n));
    if (selectedNote?.id === noteId) setSelectedNote(prev => prev ? { ...prev, title, content, tasks, ...meta } : null);
  }

  async function deleteNote(id: string) {
    if (!wsId) return;
    await supabase.from('trackino_notes').delete().eq('id', id).eq('workspace_id', wsId);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
  }

  async function toggleArchive(note: Note) {
    await supabase.from('trackino_notes').update({ is_archived: !note.is_archived, updated_at: new Date().toISOString() }).eq('id', note.id);
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_archived: !n.is_archived } : n));
  }

  async function toggleFlag(note: Note, field: 'is_favorite' | 'is_important' | 'is_done') {
    const val = !note[field];
    await supabase.from('trackino_notes').update({ [field]: val, updated_at: new Date().toISOString() }).eq('id', note.id);
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, [field]: val } : n));
  }

  async function duplicateNote(note: Note) {
    if (!wsId) return;
    const newTitle = getDuplicateTitle(note.title, notes.map(n => n.title));
    const { data, error } = await supabase.from('trackino_notes').insert({
      workspace_id: wsId, user_id: userId,
      title: newTitle, content: note.content, tasks: note.tasks,
      folder_id: note.folder_id, is_favorite: false, is_important: false, is_archived: false, is_done: false,
    }).select().single();
    if (!error && data) {
      await fetchNotes();
      setSelectedNote({ ...data, tasks: Array.isArray(data.tasks) ? data.tasks : [] });
      setSelectedCalNote(null);
    }
  }

  async function moveNote(noteId: string, folderId: string | null) {
    await supabase.from('trackino_notes').update({ folder_id: folderId, updated_at: new Date().toISOString() }).eq('id', noteId);
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folder_id: folderId } : n));
    setMoveDropdown(null);
  }

  async function permanentDeleteSelected() {
    if (archiveSelected.size === 0) return;
    if (!confirm(`Trvale smazat ${archiveSelected.size} poznámek? Tuto akci nelze vrátit.`)) return;
    const ids = Array.from(archiveSelected);
    await supabase.from('trackino_notes').delete().in('id', ids);
    setNotes(prev => prev.filter(n => !archiveSelected.has(n.id)));
    setArchiveSelected(new Set());
  }

  // ── Cal event note save ───────────────────────────────────────────────────
  async function saveCalEventNote(eventRef: string, content: string, tasks: TaskItem[], meta: { is_favorite: boolean; is_important: boolean }) {
    if (!wsId) return;
    await supabase.from('trackino_calendar_event_notes')
      .update({ content, tasks, is_favorite: meta.is_favorite, is_important: meta.is_important, updated_at: new Date().toISOString() })
      .eq('workspace_id', wsId).eq('user_id', userId).eq('event_ref', eventRef);
    setCalEventNotes(prev => prev.map(n => n.event_ref === eventRef ? { ...n, content, tasks, ...meta } : n));
    if (selectedCalNote?.event_ref === eventRef) setSelectedCalNote(prev => prev ? { ...prev, content, tasks, ...meta } : null);
  }

  // ── Folder CRUD ───────────────────────────────────────────────────────────
  async function saveFolder() {
    if (!wsId || !folderName.trim()) return;
    if (folderModal.editing) {
      await supabase.from('trackino_note_folders').update({ name: folderName.trim(), updated_at: new Date().toISOString() }).eq('id', folderModal.editing.id);
    } else {
      await supabase.from('trackino_note_folders').insert({ workspace_id: wsId, name: folderName.trim(), parent_id: folderModal.parentId, owner_id: userId, is_shared: false, sort_order: folders.length });
    }
    await fetchFolders();
    setFolderModal({ open: false, parentId: null, editing: null });
    setFolderName('');
  }

  async function deleteFolder(f: NoteFolder) {
    if (!confirm(`Smazat složku "${f.name}"? Všechny poznámky (včetně podsložek) budou přesunuty do Archivu.`)) return;
    if (!wsId) return;
    // Archivuj všechny poznámky ve složce i podsložkách před smazáním
    const folderIds = getDescendantFolderIds(f.id, folders);
    const noteIds = notes
      .filter(n => n.folder_id && folderIds.includes(n.folder_id) && !n.is_archived)
      .map(n => n.id);
    if (noteIds.length > 0) {
      await supabase
        .from('trackino_notes')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .in('id', noteIds)
        .eq('workspace_id', wsId);
    }
    await supabase.from('trackino_note_folders').delete().eq('id', f.id);
    await fetchAll();
  }

  async function moveFolderPos(folderId: string, direction: 'up' | 'down') {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const siblings = folders.filter(f => f.parent_id === folder.parent_id).sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex(f => f.id === folderId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const sibling = siblings[swapIdx];
    await supabase.from('trackino_note_folders').update({ sort_order: sibling.sort_order }).eq('id', folder.id);
    await supabase.from('trackino_note_folders').update({ sort_order: folder.sort_order }).eq('id', sibling.id);
    await fetchFolders();
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  async function openShare(folder: NoteFolder) {
    const existing = shares.filter(s => s.folder_id === folder.id);
    const wsShare = existing.find(s => s.user_id === null);
    if (wsShare) { setShareType('workspace'); setShareUserIds([]); }
    else if (existing.length > 0) { setShareType('users'); setShareUserIds(existing.map(s => s.user_id!)); }
    else { setShareType('none'); setShareUserIds([]); }
    setShareModal({ open: true, folder });
  }

  async function saveShare() {
    if (!wsId || !shareModal.folder) return;
    const fid = shareModal.folder.id;
    await supabase.from('trackino_note_folder_shares').delete().eq('folder_id', fid);
    if (shareType === 'workspace') {
      await supabase.from('trackino_note_folder_shares').insert({ folder_id: fid, workspace_id: wsId, user_id: null, shared_by: userId });
    } else if (shareType === 'users' && shareUserIds.length > 0) {
      await supabase.from('trackino_note_folder_shares').insert(shareUserIds.map(uid => ({ folder_id: fid, workspace_id: wsId, user_id: uid, shared_by: userId })));
    }
    const isNowShared = shareType !== 'none';
    await supabase.from('trackino_note_folders').update({ is_shared: isNowShared }).eq('id', fid);
    await fetchAll();
    setShareModal({ open: false, folder: null });
  }

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filteredNotes = (() => {
    const qLow = searchQ.trim().toLowerCase();
    let base: Note[];
    if (!listFilter || listFilter.type === 'inbox') base = notes.filter(n => !n.folder_id && !n.is_archived);
    else if (listFilter.type === 'all') base = notes.filter(n => !n.is_archived);
    else if (listFilter.type === 'favorites') base = notes.filter(n => n.is_favorite && !n.is_archived);
    else if (listFilter.type === 'important') base = notes.filter(n => n.is_important && !n.is_archived);
    else if (listFilter.type === 'archive') base = notes.filter(n => n.is_archived);
    else if (listFilter.type === 'recent') {
      base = [...notes].filter(n => !n.is_archived).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10);
    } else if (listFilter.type === 'folder') {
      const folderIds = getDescendantFolderIds(listFilter.folderId, folders);
      base = notes.filter(n => n.folder_id && folderIds.includes(n.folder_id) && !n.is_archived);
    } else base = notes.filter(n => !n.is_archived);

    if (qLow) base = base.filter(n => n.title.toLowerCase().includes(qLow) || stripHtml(n.content).toLowerCase().includes(qLow));
    if (notebookSettings.showDoneFeature && hideDone) base = base.filter(n => !n.is_done);
    if (listFilter?.type !== 'recent') {
      base = [...base].sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title, 'cs');
        if (sortBy === 'title_desc') return b.title.localeCompare(a.title, 'cs');
        if (sortBy === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    }
    return base;
  })();

  const filteredCalNotes = (() => {
    const q = searchQ.trim().toLowerCase();
    let base = calEventNotes;
    if (q) base = base.filter(n => n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q));
    return [...base].sort((a, b) => {
      if (calNotesSortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (calNotesSortBy === 'title') return a.title.localeCompare(b.title, 'cs');
      if (calNotesSortBy === 'title_desc') return b.title.localeCompare(a.title, 'cs');
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  })();

  // Counts for left panel
  const inboxCount = notes.filter(n => !n.folder_id && !n.is_archived).length;
  const allCount = notes.filter(n => !n.is_archived).length;
  const favCount = notes.filter(n => n.is_favorite && !n.is_archived).length;
  const impCount = notes.filter(n => n.is_important && !n.is_archived).length;
  const archCount = notes.filter(n => n.is_archived).length;

  // Authors with notes
  const authorsWithNotes = members.filter(m => notes.some(n => n.user_id === m.user_id && !n.is_archived));

  // Nav button helper
  function NavBtn({ active, onClick, icon, label, count, color }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number; color?: string }) {
    const [hov, setHov] = useState(false);
    return (
      <button onClick={onClick} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
        style={{ background: active ? 'var(--bg-active)' : hov ? 'var(--bg-hover)' : 'transparent', color: color ?? (active ? 'var(--text-primary)' : 'var(--text-secondary)') }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
        {icon}
        {label}
        {count !== undefined && count > 0 && <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{count}</span>}
      </button>
    );
  }

  function selectFilter(f: NoteFilter) {
    setListFilter(f);
    if (f.type === 'folder' && notebookSettings.saveFolderSort) {
      const cached = folderSortCache[f.folderId];
      if (cached) setSortBy(cached as typeof sortBy);
    }
    setSelectedNote(null);
    setSelectedCalNote(null);
    setArchiveSelected(new Set());
    setShowLeftPanel(false);
    if (f.type === 'calendar_events' && wsId) {
      fetchCalEventNotes();
    }
  }

  const showCalEventNotes = listFilter?.type === 'calendar_events';
  const isArchive = listFilter?.type === 'archive';
  const isRecent = listFilter?.type === 'recent';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex -m-4 lg:-m-6 overflow-hidden" style={{ height: 'calc(100vh - var(--topbar-height))' }}>

      {/* Mobile overlay backdrop */}
      {showLeftPanel && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setShowLeftPanel(false)} />}

      {/* ── Left Panel ── */}
      <div className={`fixed md:static inset-y-0 left-0 z-40 md:z-auto flex flex-col border-r overflow-hidden transition-transform duration-200 flex-shrink-0
        ${showLeftPanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: 340, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0 flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Poznámky</h1>
          <button onClick={() => setShowSettings(true)} title="Nastavení poznámek"
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Hledat poznámky…"
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border text-xs outline-none text-base sm:text-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        {/* Nav */}
        <div className="px-2 py-2 border-b flex-shrink-0 space-y-0.5" style={{ borderColor: 'var(--border)' }}>
          {notebookSettings.showInbox && (
            <NavBtn active={listFilter?.type === 'inbox' || (!listFilter && true)} onClick={() => selectFilter({ type: 'inbox' })} count={inboxCount}
              label="Inbox"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>} />
          )}
          <NavBtn active={listFilter?.type === 'all'} onClick={() => selectFilter({ type: 'all' })} count={allCount}
            label="Všechny poznámky"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>} />
          {favCount > 0 && (
            <NavBtn active={listFilter?.type === 'favorites'} onClick={() => selectFilter({ type: 'favorites' })} count={favCount} color="#f59e0b"
              label="Oblíbené"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" style={{ flexShrink: 0, color: '#f59e0b' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>} />
          )}
          {impCount > 0 && (
            <NavBtn active={listFilter?.type === 'important'} onClick={() => selectFilter({ type: 'important' })} count={impCount} color="#dc2626"
              label="Důležité"
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" style={{ flexShrink: 0, color: '#dc2626' }}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>} />
          )}
          <NavBtn active={listFilter?.type === 'recent'} onClick={() => selectFilter({ type: 'recent' })}
            label="Naposledy upravené"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
          <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
          <NavBtn active={showCalEventNotes} onClick={() => selectFilter({ type: 'calendar_events' })} count={calEventNotes.length}
            label="Poznámky k událostem"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
          <NavBtn active={isArchive} onClick={() => selectFilter({ type: 'archive' })} count={archCount}
            label="Archiv"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>} />
        </div>

        {/* Folders */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Složky</span>
            <button onClick={() => { setFolderName(''); setFolderModal({ open: true, parentId: null, editing: null }); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} title="Nová složka">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <FolderTree
            folders={folders}
            selectedId={listFilter?.type === 'folder' ? listFilter.folderId : null}
            expanded={expanded}
            onSelect={id => selectFilter({ type: 'folder', folderId: id })}
            onToggle={id => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onAddSub={(parentId, depth) => { if (depth < MAX_DEPTH) { setFolderName(''); setFolderModal({ open: true, parentId, editing: null }); } }}
            onEdit={f => { setFolderName(f.name); setFolderModal({ open: true, parentId: null, editing: f }); }}
            onDelete={deleteFolder}
            onShare={openShare}
            onMoveUp={id => moveFolderPos(id, 'up')}
            onMoveDown={id => moveFolderPos(id, 'down')}
            userId={userId}
            items={notes}
            folderSortOrder={notebookSettings.folderSortOrder}
          />

          {/* Podle autora */}
          {authorsWithNotes.length > 1 && (
            <>
              <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setAuthorExpanded(p => !p)}
                  className="w-full flex items-center gap-1 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" style={{ transform: authorExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                    <path d="M3 2l4 3-4 3V2z"/>
                  </svg>
                  Podle autora
                </button>
                {authorExpanded && authorsWithNotes.map(m => {
                  const cnt = notes.filter(n => n.user_id === m.user_id && !n.is_archived).length;
                  const active = listFilter?.type === 'folder' ? false : false;
                  return (
                    <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-default"
                      style={{ color: 'var(--text-secondary)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                        {getInitials(m.display_name)}
                      </div>
                      <span className="flex-1 truncate">{m.display_name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cnt}</span>
                    </div>
                  );
                  void active;
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Mobile toggle button */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <button onClick={() => setShowLeftPanel(p => !p)} className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Panel
          </button>
          <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
            {listFilter?.type === 'inbox' ? 'Inbox'
              : listFilter?.type === 'all' ? 'Všechny poznámky'
              : listFilter?.type === 'favorites' ? 'Oblíbené'
              : listFilter?.type === 'important' ? 'Důležité'
              : listFilter?.type === 'recent' ? 'Naposledy upravené'
              : listFilter?.type === 'archive' ? 'Archiv'
              : listFilter?.type === 'calendar_events' ? 'Poznámky k událostem'
              : listFilter?.type === 'folder' ? (folders.find(f => f.id === listFilter.folderId)?.name ?? 'Složka')
              : 'Poznámky'}
          </span>
        </div>

        {/* ── Editor view (regular note) ── */}
        {selectedNote && !showCalEventNotes ? (
          <NoteEditor
            note={selectedNote}
            onSave={async (title, content, tasks, meta) => saveNote(selectedNote.id, title, content, tasks, meta)}
            onBack={() => setSelectedNote(null)}
            onDelete={async (id) => { await deleteNote(id); setSelectedNote(null); }}
            folders={folders}
            onMove={moveNote}
            onDuplicate={() => duplicateNote(selectedNote)}
            showDoneFeature={notebookSettings.showDoneFeature}
            onSelectFolder={(folderId) => setListFilter({ type: 'folder', folderId })}
          />
        ) : selectedCalNote && showCalEventNotes ? (
          /* ── Editor view (calendar event note) ── */
          <CalEventNoteEditor
            note={selectedCalNote}
            onSave={saveCalEventNote}
            onBack={() => setSelectedCalNote(null)}
          />
        ) : (
          /* ── List view ── */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              {isArchive && archiveSelected.size > 0 && (
                <button onClick={permanentDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                  style={{ background: '#ef4444' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
                  Smazat ({archiveSelected.size})
                </button>
              )}
              {isArchive && filteredNotes.length > 0 && (
                <button onClick={() => setArchiveSelected(prev => prev.size === filteredNotes.length ? new Set() : new Set(filteredNotes.map(n => n.id)))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" readOnly checked={archiveSelected.size === filteredNotes.length && filteredNotes.length > 0} className="w-3 h-3" />
                  Označit vše
                </button>
              )}
              {/* Folder name label */}
              {listFilter?.type === 'folder' && !selectedNote && (
                <span className="text-sm font-semibold truncate max-w-[480px]" style={{ color: 'var(--text-primary)' }}>
                  {folders.find(f => f.id === (listFilter as { type: 'folder'; folderId: string }).folderId)?.name ?? 'Složka'}
                </span>
              )}
              {!isRecent && !showCalEventNotes && (
                <div className="relative flex-shrink-0">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'title' | 'oldest' | 'title_desc')}
                    className="text-base sm:text-sm border rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                    <option value="date">Nejnovější</option>
                    <option value="oldest">Nejstarší</option>
                    <option value="title">Název A–Z</option>
                    <option value="title_desc">Název Z–A</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              )}
              {listFilter?.type === 'folder' && notebookSettings.saveFolderSort && !isRecent && !showCalEventNotes && (
                <button onClick={() => {
                  if (listFilter.type === 'folder') {
                    const next = { ...folderSortCache, [listFilter.folderId]: sortBy };
                    setFolderSortCache(next);
                    saveNotebookPrefs(next);
                    setFilterSaved(true);
                    setTimeout(() => setFilterSaved(false), 2000);
                  }
                }} className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
                  style={{
                    borderColor: filterSaved ? '#86efac' : 'var(--border)',
                    color: filterSaved ? '#16a34a' : 'var(--text-secondary)',
                    background: filterSaved ? '#dcfce7' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                  {filterSaved ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Uloženo
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                      </svg>
                      Uložit filtraci
                    </>
                  )}
                </button>
              )}
              {notebookSettings.showDoneFeature && !isArchive && !showCalEventNotes && (
                <button onClick={() => setHideDone(v => !v)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
                  style={{
                    borderColor: hideDone ? 'var(--primary)' : 'var(--border)',
                    color: hideDone ? 'var(--primary)' : 'var(--text-secondary)',
                    background: hideDone ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Skrýt hotové
                </button>
              )}
              {showCalEventNotes && (
                <div className="relative flex-shrink-0">
                  <select value={calNotesSortBy} onChange={e => setCalNotesSortBy(e.target.value as 'date' | 'date_asc' | 'title' | 'title_desc')}
                    className="text-base sm:text-sm border rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                    <option value="date">Nejnovější</option>
                    <option value="date_asc">Nejstarší</option>
                    <option value="title">Název A–Z</option>
                    <option value="title_desc">Název Z–A</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              )}
              {!showCalEventNotes && (
                <button onClick={createNote}
                  className="ml-auto px-3.5 py-1.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
                  style={{ background: 'var(--primary)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span className="hidden sm:inline">Nová poznámka</span>
                  <span className="sm:hidden">Nová</span>
                </button>
              )}
            </div>

            {/* Note List */}
            <div className="flex-1 overflow-y-auto">
              {/* Calendar event notes */}
              {showCalEventNotes && (
                filteredCalNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p className="text-sm">Žádné poznámky k událostem</p>
                    <p className="text-xs text-center max-w-xs">Přidej poznámky ke svým kalendářním událostem v modulu Kalendář.</p>
                  </div>
                ) : filteredCalNotes.map(note => (
                  <div key={note.event_ref}
                    className="group flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setSelectedCalNote(note); setShowLeftPanel(false); }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{note.title}</span>
                        {note.is_favorite && <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" className="flex-shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                        {note.is_important && <svg width="10" height="10" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" strokeWidth="1" className="flex-shrink-0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(note.date)}</span>
                        {stripHtml(note.content) && <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>· {stripHtml(note.content).slice(0, 80)}</span>}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-40 md:opacity-0 md:group-hover:opacity-40" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))
              )}

              {/* Regular notes */}
              {!showCalEventNotes && (
                filteredNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    <p className="text-sm">{isArchive ? 'Archiv je prázdný' : 'Žádné poznámky'}</p>
                    {!isArchive && <button onClick={createNote} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Vytvořit první poznámku</button>}
                  </div>
                ) : filteredNotes.map(note => {
                  const authorName = members.find(m => m.user_id === note.user_id)?.display_name ?? '';
                  return (
                  <div key={note.id}
                    className="group flex flex-row items-center sm:items-start gap-2 sm:gap-3 px-4 py-3 border-b transition-colors"
                    style={{ borderColor: 'var(--border)', opacity: notebookSettings.showDoneFeature && note.is_done ? 0.45 : 1 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {/* Archive checkbox */}
                    {isArchive && (
                      <input type="checkbox" checked={archiveSelected.has(note.id)}
                        onChange={() => setArchiveSelected(prev => { const n = new Set(prev); n.has(note.id) ? n.delete(note.id) : n.add(note.id); return n; })}
                        className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer mt-1" onClick={e => e.stopPropagation()} />
                    )}
                    {/* Main clickable area */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedNote(note); setShowLeftPanel(false); }}>
                      {/* Řádek 1: Název + flagy */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)', textDecoration: notebookSettings.showDoneFeature && note.is_done ? 'line-through' : 'none' }}>{note.title || 'Bez názvu'}</span>
                        {note.is_favorite && <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" className="flex-shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                        {note.is_important && <svg width="10" height="10" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" strokeWidth="1" className="flex-shrink-0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
                        {notebookSettings.showDoneFeature && note.is_done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      {/* Řádek 2 (jen desktop): Preview obsahu */}
                      {stripHtml(note.content) && <p className="hidden sm:block text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{stripHtml(note.content).slice(0, 150)}</p>}
                      {/* Řádek 2 (mobil) / Řádek 3 (desktop): Datum + Autor */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(note.updated_at)}</span>
                        {authorName && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {authorName}</span>}
                      </div>
                    </div>
                    {/* 3 tečky – jen mobil */}
                    <button className="sm:hidden flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={e => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        if (spaceBelow >= 320) {
                          setNoteActionsMenu({ noteId: note.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        } else {
                          setNoteActionsMenu({ noteId: note.id, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                        }
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    {/* Akce – jen desktop (hover) */}
                    <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Důležité */}
                      <button onClick={e => { e.stopPropagation(); toggleFlag(note, 'is_important'); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg"
                        style={{ color: note.is_important ? '#dc2626' : 'var(--text-muted)' }} title={note.is_important ? 'Odebrat důležité' : 'Označit jako důležité'}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={note.is_important ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                      </button>
                      {/* Oblíbené */}
                      <button onClick={e => { e.stopPropagation(); toggleFlag(note, 'is_favorite'); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg"
                        style={{ color: note.is_favorite ? '#f59e0b' : 'var(--text-muted)' }} title={note.is_favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={note.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                      {/* Hotovo */}
                      {notebookSettings.showDoneFeature && (
                        <button onClick={e => { e.stopPropagation(); toggleFlag(note, 'is_done'); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ color: note.is_done ? '#22c55e' : 'var(--text-muted)' }} title={note.is_done ? 'Označit jako nedokončené' : 'Označit jako hotové'}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      )}
                      {/* Kopírovat obsah */}
                      <button onClick={e => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(htmlToPlainText(note.content, note.tasks));
                        setCopyDoneNoteId(note.id);
                        setTimeout(() => setCopyDoneNoteId(null), 2000);
                      }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg" title="Kopírovat obsah"
                        style={{ color: copyDoneNoteId === note.id ? '#22c55e' : 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {copyDoneNoteId === note.id ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                      </button>
                      {/* Duplikovat (jen ne-archivované) */}
                      {!note.is_archived && (
                        <button onClick={e => { e.stopPropagation(); duplicateNote(note); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg" title="Duplikovat poznámku"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            <line x1="18" y1="12" x2="18" y2="18"/><line x1="15" y1="15" x2="21" y2="15"/>
                          </svg>
                        </button>
                      )}
                      {/* Přesunout (jen ne-archivované) */}
                      {!note.is_archived && (
                        <button onClick={e => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          if (spaceBelow >= 248) {
                            setMoveDropdown({ noteId: note.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          } else {
                            setMoveDropdown({ noteId: note.id, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                          }
                        }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg" title="Přesunout do složky"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            <polyline points="12 11 12 17"/><polyline points="9 14 12 17 15 14"/>
                          </svg>
                        </button>
                      )}
                      {/* Archivovat / Obnovit */}
                      <button onClick={e => { e.stopPropagation(); toggleArchive(note); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg" title={note.is_archived ? 'Obnovit z archivu' : 'Archivovat'}
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {note.is_archived ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Move dropdown ── */}
      {moveDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoveDropdown(null)} />
          <div className="fixed z-50 rounded-xl border shadow-lg py-1 w-48 max-h-60 overflow-y-auto"
            style={{ top: moveDropdown.top, bottom: moveDropdown.bottom, right: moveDropdown.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přesunout do</div>
            <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] flex items-center gap-2 transition-colors" style={{ color: 'var(--text-secondary)' }}
              onClick={() => moveNote(moveDropdown.noteId, null)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Inbox
            </button>
            {buildFolderFlat(folders).map(({ folder, depth }) => (
              <button key={folder.id} className="w-full text-left py-1.5 text-xs hover:bg-[var(--bg-hover)] flex items-center gap-2 transition-colors"
                style={{ paddingLeft: depth * 14 + 12, paddingRight: 12, color: depth > 0 ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                onClick={() => moveNote(moveDropdown.noteId, folder.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {folder.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Note Actions Menu (mobilní 3 tečky) ── */}
      {noteActionsMenu && (() => {
        const note = filteredNotes.find(n => n.id === noteActionsMenu.noteId);
        if (!note) return null;
        const close = () => setNoteActionsMenu(null);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={close} />
            <div className="fixed z-50 rounded-xl border shadow-lg py-1.5 w-52 overflow-hidden"
              style={{ top: noteActionsMenu.top, bottom: noteActionsMenu.bottom, right: noteActionsMenu.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              {/* Důležité */}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: note.is_important ? '#dc2626' : 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { toggleFlag(note, 'is_important'); close(); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={note.is_important ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                {note.is_important ? 'Odebrat důležité' : 'Označit jako důležité'}
              </button>
              {/* Oblíbené */}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: note.is_favorite ? '#f59e0b' : 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { toggleFlag(note, 'is_favorite'); close(); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={note.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {note.is_favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
              </button>
              {/* Hotovo */}
              {notebookSettings.showDoneFeature && (
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                  style={{ color: note.is_done ? '#22c55e' : 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => { toggleFlag(note, 'is_done'); close(); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {note.is_done ? 'Označit jako nedokončené' : 'Označit jako hotové'}
                </button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              {/* Kopírovat obsah */}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  navigator.clipboard.writeText(htmlToPlainText(note.content, note.tasks));
                  setCopyDoneNoteId(note.id); setTimeout(() => setCopyDoneNoteId(null), 2000);
                  close();
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Kopírovat obsah
              </button>
              {/* Duplikovat */}
              {!note.is_archived && (
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => { duplicateNote(note); close(); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    <line x1="18" y1="12" x2="18" y2="18"/><line x1="15" y1="15" x2="21" y2="15"/>
                  </svg>
                  Duplikovat poznámku
                </button>
              )}
              {/* Přesunout */}
              {!note.is_archived && (
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    const menuRight = noteActionsMenu.right ?? 8;
                    const menuTop = noteActionsMenu.top;
                    const menuBottom = noteActionsMenu.bottom;
                    close();
                    setTimeout(() => {
                      if (menuTop !== undefined) {
                        setMoveDropdown({ noteId: note.id, top: menuTop, right: menuRight });
                      } else {
                        setMoveDropdown({ noteId: note.id, bottom: menuBottom, right: menuRight });
                      }
                    }, 0);
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    <polyline points="12 11 12 17"/><polyline points="9 14 12 17 15 14"/>
                  </svg>
                  Přesunout do složky
                </button>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              {/* Archivovat / Obnovit */}
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { toggleArchive(note); close(); }}>
                {note.is_archived ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                )}
                {note.is_archived ? 'Obnovit z archivu' : 'Archivovat'}
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Folder Modal ── */}
      {folderModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFolderModal({ open: false, parentId: null, editing: null })}>
          <div className="rounded-xl border shadow-xl p-5 w-80" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {folderModal.editing ? 'Přejmenovat složku' : 'Nová složka'}
            </h3>
            <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Název složky"
              onKeyDown={e => e.key === 'Enter' && saveFolder()}
              className="w-full px-3 py-2 rounded-lg border mb-4 text-sm outline-none text-base sm:text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFolderModal({ open: false, parentId: null, editing: null })} className="px-3 py-1.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button onClick={saveFolder} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>
                {folderModal.editing ? 'Uložit' : 'Vytvořit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSettings(false)}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nastavení poznámek</h2>
            <div className="space-y-4">
              {/* Show Inbox */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Zobrazit Inbox</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Sekce pro poznámky bez složky</div>
                </div>
                <button type="button"
                  onClick={() => saveSettings({ ...notebookSettings, showInbox: !notebookSettings.showInbox })}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors"
                  style={{ background: notebookSettings.showInbox ? 'var(--primary)' : 'var(--border)', borderColor: notebookSettings.showInbox ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: notebookSettings.showInbox ? 'translateX(16px)' : 'translateX(0px)' }} />
                </button>
              </label>
              {/* Auto-expand folders */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Automaticky rozbalit složky</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Rozbalí všechny složky při načtení</div>
                </div>
                <button type="button"
                  onClick={() => saveSettings({ ...notebookSettings, foldersAutoOpen: !notebookSettings.foldersAutoOpen })}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors"
                  style={{ background: notebookSettings.foldersAutoOpen ? 'var(--primary)' : 'var(--border)', borderColor: notebookSettings.foldersAutoOpen ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: notebookSettings.foldersAutoOpen ? 'translateX(16px)' : 'translateX(0px)' }} />
                </button>
              </label>
              {/* Default sort */}
              <div>
                <div className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Výchozí řazení poznámek</div>
                <div className="relative">
                  <select value={notebookSettings.defaultSort}
                    onChange={e => saveSettings({ ...notebookSettings, defaultSort: e.target.value as typeof notebookSettings.defaultSort })}
                    className="w-full text-base sm:text-sm border rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer"
                    style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                    <option value="date">Nejnovější</option>
                    <option value="oldest">Nejstarší</option>
                    <option value="title">Název A–Z</option>
                    <option value="title_desc">Název Z–A</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              </div>
              {/* Folder sort order */}
              <div>
                <div className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>Řazení složek</div>
                <div className="relative">
                  <select value={notebookSettings.folderSortOrder}
                    onChange={e => saveSettings({ ...notebookSettings, folderSortOrder: e.target.value as typeof notebookSettings.folderSortOrder })}
                    className="w-full text-base sm:text-sm border rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer"
                    style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                    <option value="manual">Ručně (šipkami)</option>
                    <option value="name">Abecedně</option>
                    <option value="created">Datum vytvoření</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              </div>
              {/* Save filter per folder */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Uložit filtraci pro složku</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Každá složka si pamatuje své řazení. Tlačítko „Uložit filtraci" se zobrazí v toolbaru.</div>
                </div>
                <button type="button"
                  onClick={() => saveSettings({ ...notebookSettings, saveFolderSort: !notebookSettings.saveFolderSort })}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors"
                  style={{ background: notebookSettings.saveFolderSort ? 'var(--primary)' : 'var(--border)', borderColor: notebookSettings.saveFolderSort ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: notebookSettings.saveFolderSort ? 'translateX(16px)' : 'translateX(0px)' }} />
                </button>
              </label>
              {/* Show done feature */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Stav „Hotovo"</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Přidá tlačítko Hotovo do editoru a výpisu poznámek</div>
                </div>
                <button type="button"
                  onClick={() => saveSettings({ ...notebookSettings, showDoneFeature: !notebookSettings.showDoneFeature })}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors"
                  style={{ background: notebookSettings.showDoneFeature ? 'var(--primary)' : 'var(--border)', borderColor: notebookSettings.showDoneFeature ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: notebookSettings.showDoneFeature ? 'translateX(16px)' : 'translateX(0px)' }} />
                </button>
              </label>
            </div>
            <div className="flex justify-end mt-5">
              <button onClick={() => setShowSettings(false)} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Hotovo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareModal.open && shareModal.folder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareModal({ open: false, folder: null })}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Sdílet složku „{shareModal.folder.name}"</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její poznámky vidět</p>
            <div className="space-y-2 mb-4">
              {([
                { id: 'none' as const, label: 'Nesdílet s nikým', desc: 'Složka zůstane soukromá' },
                { id: 'workspace' as const, label: 'Celý workspace', desc: 'Vidí všichni členové' },
                { id: 'users' as const, label: 'Konkrétní uživatelé', desc: 'Vybraní členové' },
              ]).map(t => (
                <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                  style={{ borderColor: shareType === t.id ? 'var(--primary)' : 'var(--border)', background: shareType === t.id ? 'var(--bg-active)' : 'transparent' }}>
                  <input type="radio" checked={shareType === t.id} onChange={() => setShareType(t.id)} className="accent-[var(--primary)]" />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            {shareType === 'users' && (
              <div className="mb-4 max-h-48 overflow-y-auto space-y-1 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
                {members.filter(m => m.user_id !== userId).map(m => (
                  <label key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{ background: shareUserIds.includes(m.user_id) ? 'var(--bg-active)' : 'transparent' }}
                    onMouseEnter={e => { if (!shareUserIds.includes(m.user_id)) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!shareUserIds.includes(m.user_id)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <input type="checkbox" checked={shareUserIds.includes(m.user_id)}
                      onChange={() => setShareUserIds(prev => prev.includes(m.user_id) ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id])}
                      className="accent-[var(--primary)]" />
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                      {getInitials(m.display_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.display_name}</div>
                      {m.email && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShareModal({ open: false, folder: null })} className="px-3 py-1.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button onClick={saveShare} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
