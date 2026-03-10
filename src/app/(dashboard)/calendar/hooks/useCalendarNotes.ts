'use client';
// ─── Calendar Module – useCalendarNotes ───────────────────────────────────────
// Funkce pro správu poznámek k událostem. Přesunuto z page.tsx (ř. 2002–2130).

import type { DisplayEvent } from '../types';
import type { TaskItem, EventNote, OrphanNote } from '../types';
import { supabase } from '@/lib/supabase';

// ─── Typy závislostí ──────────────────────────────────────────────────────────

export interface NotesDeps {
  user: { id: string } | null;
  currentWorkspace: { id: string } | null;
  notesByRef: Record<string, EventNote>;
  setNotesByRef: (n: Record<string, EventNote> | ((prev: Record<string, EventNote>) => Record<string, EventNote>)) => void;
  openNoteEventIds: Set<string>;
  setOpenNoteEventIds: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  orphanNotes: OrphanNote[];
  setOrphanNotes: (n: OrphanNote[] | ((prev: OrphanNote[]) => OrphanNote[])) => void;
  setOrphanLoading: (v: boolean) => void;
  notesLoadedRefs: React.MutableRefObject<Set<string>>;
  displayEvents: DisplayEvent[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendarNotes(deps: NotesDeps) {
  const {
    user, currentWorkspace,
    notesByRef, setNotesByRef,
    setOpenNoteEventIds,
    setOrphanNotes, setOrphanLoading,
    notesLoadedRefs,
    displayEvents,
  } = deps;

  async function fetchNotesBatch(refs: string[]) {
    if (!currentWorkspace || !user || refs.length === 0) return;
    const newRefs = refs.filter(r => !notesLoadedRefs.current.has(r));
    if (newRefs.length === 0) return;
    newRefs.forEach(r => notesLoadedRefs.current.add(r));
    const { data } = await supabase
      .from('trackino_calendar_event_notes')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .in('event_ref', newRefs);
    if (data && data.length > 0) {
      setNotesByRef(prev => {
        const next = { ...prev };
        for (const n of data) {
          next[n.event_ref] = {
            id: n.id,
            content: n.content ?? '',
            tasks: (n.tasks as TaskItem[]) ?? [],
            is_important: n.is_important ?? false,
            is_done: n.is_done ?? false,
            is_favorite: n.is_favorite ?? false,
          };
        }
        return next;
      });
    }
  }

  async function handleNoteSave(
    eventRef: string,
    content: string,
    tasks: TaskItem[],
    meta: { is_important: boolean; is_done: boolean; is_favorite: boolean } = { is_important: false, is_done: false, is_favorite: false },
    eventTitle = '',
    eventDate = ''
  ) {
    if (!currentWorkspace || !user) return;
    const { data, error } = await supabase.from('trackino_calendar_event_notes')
      .upsert(
        {
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          event_ref: eventRef,
          content,
          tasks,
          is_important: meta.is_important,
          is_done: meta.is_done,
          is_favorite: meta.is_favorite,
          event_title: eventTitle,
          event_date: eventDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,user_id,event_ref' }
      )
      .select('id')
      .single();
    if (error) {
      console.error('[Trackino] Poznámka – chyba ukládání:', error.message, error.code, error.details);
      return;
    }
    if (data) {
      setNotesByRef(prev => ({ ...prev, [eventRef]: { id: data.id, content, tasks, ...meta } }));
    }
  }

  async function handleNoteDelete(eventRef: string) {
    const existing = notesByRef[eventRef];
    if (existing?.id) {
      await supabase.from('trackino_calendar_event_notes').delete().eq('id', existing.id);
      setNotesByRef(prev => { const n = { ...prev }; delete n[eventRef]; return n; });
    }
    setOpenNoteEventIds(prev => { const n = new Set(prev); n.delete(eventRef); return n; });
  }

  async function fetchOrphanNotes() {
    if (!currentWorkspace || !user) return;
    setOrphanLoading(true);
    const { data: allNotes, error } = await supabase
      .from('trackino_calendar_event_notes')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error || !allNotes) { setOrphanLoading(false); return; }
    const visibleRefs = new Set(displayEvents.map(ev => ev.id));
    const uuidRefs = allNotes.map(n => n.event_ref).filter(r => !r.startsWith('sub-'));
    const existingManualIds = new Set<string>();
    if (uuidRefs.length > 0) {
      const { data: existing } = await supabase
        .from('trackino_calendar_events')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .in('id', uuidRefs);
      existing?.forEach(e => existingManualIds.add(e.id));
    }
    const orphans = allNotes.filter(n => {
      if (n.event_ref.startsWith('sub-')) return !visibleRefs.has(n.event_ref);
      return !existingManualIds.has(n.event_ref);
    });
    setOrphanNotes(orphans as OrphanNote[]);
    setOrphanLoading(false);
  }

  async function deleteOrphanNote(id: string) {
    await supabase.from('trackino_calendar_event_notes').delete().eq('id', id);
    setOrphanNotes(prev => prev.filter(n => n.id !== id));
  }

  return {
    fetchNotesBatch,
    handleNoteSave,
    handleNoteDelete,
    fetchOrphanNotes,
    deleteOrphanNote,
  };
}
