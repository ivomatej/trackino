'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskItem { id: string; text: string; checked: boolean; }

interface Note {
  id: string; workspace_id: string; user_id: string;
  title: string; content: string; tasks: TaskItem[];
  folder_id: string | null; is_favorite: boolean; is_important: boolean;
  is_archived: boolean; created_at: string; updated_at: string;
}

interface NoteFolder {
  id: string; workspace_id: string; name: string;
  parent_id: string | null; owner_id: string; is_shared: boolean;
  sort_order: number; created_at: string; updated_at: string;
}

interface FolderShare { id: string; folder_id: string; user_id: string | null; }

interface Member { user_id: string; display_name: string; avatar_color: string; email?: string; }

interface CalEventNote {
  event_ref: string; event_id: string; title: string; date: string;
  content: string; tasks: TaskItem[]; is_favorite: boolean; is_important: boolean;
}

type NoteFilter =
  | { type: 'inbox' }
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'important' }
  | { type: 'recent' }
  | { type: 'archive' }
  | { type: 'calendar_events' }
  | { type: 'folder'; folderId: string };

// ─── Utils ────────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DEPTH = 5;

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function linkifyHtml(html: string): string {
  return html.replace(/(?<!["'>])(https?:\/\/[^\s<>"'\]]+)/g, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">${url}</a>`
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── FolderTree ──────────────────────────────────────────────────────────────
function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare, userId, items, depth = 0, parentId = null,
}: {
  folders: NoteFolder[]; selectedId: string | null; expanded: Set<string>;
  onSelect: (id: string) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: NoteFolder) => void; onDelete: (f: NoteFolder) => void;
  onShare: (f: NoteFolder) => void; userId: string;
  items: { folder_id: string | null }[];
  depth?: number; parentId?: string | null;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const children = folders.filter(f => f.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isExpanded = expanded.has(folder.id);
        const isSelected = selectedId === folder.id;
        const isOwner = folder.owner_id === userId;
        const itemCount = items.filter(b => b.folder_id === folder.id).length;
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 px-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSelected ? 'var(--bg-active)' : 'transparent' }}
              onClick={() => onSelect(folder.id)}>
              <button type="button" onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ color: 'var(--text-muted)', opacity: hasChildren ? 1 : 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExpanded ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {folder.name}
              </span>
              {itemCount > 0 && (
                <span className="text-[10px] px-1.5 py-0 rounded-full flex-shrink-0 sm:group-hover/folder:hidden" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{itemCount}</span>
              )}
              <div className="sm:hidden flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (openMenu === folder.id) { setOpenMenu(null); setMenuPos(null); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      setOpenMenu(folder.id);
                    }
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md"
                  style={{ color: 'var(--text-muted)', background: openMenu === folder.id ? 'var(--bg-hover)' : 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {openMenu === folder.id && menuPos && (
                  <div className="fixed z-[9999] rounded-lg border shadow-lg py-1 min-w-[160px]"
                    style={{ top: menuPos.top, right: menuPos.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    {depth < MAX_DEPTH - 1 && (
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onAddSub(folder.id, depth + 1); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Přidat podsložku
                      </button>
                    )}
                    {isOwner && (
                      <>
                        <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onShare(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          Sdílet
                        </button>
                        <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onEdit(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Přejmenovat
                        </button>
                        <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                          style={{ color: 'var(--danger)' }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); onDelete(folder); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
                          Smazat
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="hidden sm:flex sm:opacity-0 sm:group-hover/folder:opacity-100 items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_DEPTH - 1 && (
                  <button type="button" title="Přidat podsložku" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {isOwner && (
                  <>
                    <button type="button" title="Sdílet" onClick={e => { e.stopPropagation(); onShare(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                      style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button type="button" title="Přejmenovat" onClick={e => { e.stopPropagation(); onEdit(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" title="Smazat" onClick={e => { e.stopPropagation(); onDelete(folder); }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--danger)' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {isExpanded && (
              <FolderTree folders={folders} selectedId={selectedId} expanded={expanded}
                onSelect={onSelect} onToggle={onToggle} onAddSub={onAddSub}
                onEdit={onEdit} onDelete={onDelete} onShare={onShare}
                userId={userId} items={items} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── buildFolderFlat ──────────────────────────────────────────────────────────
function buildFolderFlat(
  folders: NoteFolder[],
  parentId: string | null = null,
  depth = 0
): Array<{ folder: NoteFolder; depth: number }> {
  const result: Array<{ folder: NoteFolder; depth: number }> = [];
  const children = folders.filter(f => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
  for (const f of children) {
    result.push({ folder: f, depth });
    result.push(...buildFolderFlat(folders, f.id, depth + 1));
  }
  return result;
}

// ─── NoteEditor ──────────────────────────────────────────────────────────────
function NoteEditor({
  note, onSave, onBack, onDelete, folders, onMove,
}: {
  note: Note | null;
  onSave: (title: string, content: string, tasks: TaskItem[], meta: { is_favorite: boolean; is_important: boolean }) => Promise<void>;
  onBack: () => void;
  onDelete: (id: string) => void;
  folders?: NoteFolder[];
  onMove?: (noteId: string, folderId: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState(note?.title === 'Nová poznámka' ? '' : (note?.title ?? ''));
  const [content, setContent] = useState(note?.content ?? '');
  const [tasks, setTasks] = useState<TaskItem[]>(note?.tasks ?? []);
  const [isFavorite, setIsFavorite] = useState(note?.is_favorite ?? false);
  const [isImportant, setIsImportant] = useState(note?.is_important ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const taskRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  // Zavři move menu při kliknutí mimo
  useEffect(() => {
    if (!showMoveMenu) return;
    const handler = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoveMenu]);

  // Sync when note changes (switching notes)
  useEffect(() => {
    const rawTitle = note?.title ?? '';
    setTitle(rawTitle === 'Nová poznámka' ? '' : rawTitle);
    setContent(note?.content ?? '');
    setTasks(note?.tasks ?? []);
    setIsFavorite(note?.is_favorite ?? false);
    setIsImportant(note?.is_important ?? false);
    if (editorRef.current) editorRef.current.innerHTML = note?.content ?? '';
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSave = useCallback((t: string, c: string, tk: TaskItem[], fav: boolean, imp: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await onSave(t, c, tk, { is_favorite: fav, is_important: imp });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, [onSave]);

  function execFmt(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  function handleEditorInput() {
    const c = editorRef.current?.innerHTML ?? '';
    setContent(c);
    triggerSave(title, c, tasks, isFavorite, isImportant);
  }

  function handleEditorBlur() {
    const linked = linkifyHtml(editorRef.current?.innerHTML ?? '');
    if (editorRef.current) editorRef.current.innerHTML = linked;
    const c = linked;
    setContent(c);
    triggerSave(title, c, tasks, isFavorite, isImportant);
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    if ((node.parentElement)?.closest('a')) return;
    const text = node.textContent ?? '';
    const cursorPos = range.startOffset;
    const urlMatch = text.slice(0, cursorPos).match(/(https?:\/\/[^\s<>"'\]]+)$/);
    if (!urlMatch) return;
    e.preventDefault();
    const url = urlMatch[1];
    const urlStart = cursorPos - url.length;
    const beforeText = text.slice(0, urlStart);
    const afterText = text.slice(cursorPos);
    const parent = node.parentNode!;
    const refNode = node.nextSibling;
    parent.removeChild(node);
    const ins = (n: Node) => parent.insertBefore(n, refNode ?? null);
    if (beforeText) ins(document.createTextNode(beforeText));
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.cssText = 'color:var(--primary);text-decoration:underline';
    a.textContent = url;
    ins(a);
    let cursorNode: Text;
    let cursorOffset: number;
    if (e.key === 'Enter') {
      ins(document.createElement('br'));
      cursorNode = document.createTextNode(afterText); ins(cursorNode); cursorOffset = 0;
    } else {
      cursorNode = document.createTextNode(' ' + afterText); ins(cursorNode); cursorOffset = 1;
    }
    const nr = document.createRange();
    nr.setStart(cursorNode, cursorOffset); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    const c = editorRef.current?.innerHTML ?? '';
    setContent(c);
    triggerSave(title, c, tasks, isFavorite, isImportant);
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  function handleTitleChange(v: string) {
    setTitle(v);
    triggerSave(v, content, tasks, isFavorite, isImportant);
  }

  function addTask() {
    const newTask: TaskItem = { id: nanoid(), text: '', checked: false };
    const next = [...tasks, newTask];
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant);
    setTimeout(() => taskRefs.current.get(newTask.id)?.focus(), 50);
  }

  function toggleTask(id: string) {
    const next = tasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant);
  }

  function updateTaskText(id: string, text: string) {
    const next = tasks.map(t => t.id === id ? { ...t, text } : t);
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant);
  }

  function removeTask(id: string) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant);
  }

  function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    triggerSave(title, content, tasks, next, isImportant);
  }

  function toggleImportant() {
    const next = !isImportant;
    setIsImportant(next);
    triggerSave(title, content, tasks, isFavorite, next);
  }

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', padding: '3px 4px', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Zpět
        </button>
        <div className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {saving ? 'Ukládám…' : saved ? '✓ Uloženo' : note ? fmtDate(note.updated_at) : ''}
        </div>
        {/* Move to folder button */}
        {onMove && folders && (
          <div className="relative" ref={moveMenuRef}>
            <button onClick={() => setShowMoveMenu(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }} title="Přesunout do složky"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            {showMoveMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border shadow-lg z-50 py-1 overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přesunout do</div>
                <button onClick={async () => { await onMove(note!.id, null); setShowMoveMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                  style={{ color: note?.folder_id === null ? 'var(--primary)' : 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Doručené
                </button>
                {buildFolderFlat(folders).map(({ folder: f, depth }) => (
                  <button key={f.id} onClick={async () => { await onMove(note!.id, f.id); setShowMoveMenu(false); }}
                    className="w-full text-left py-1.5 text-xs flex items-center gap-2 transition-colors"
                    style={{
                      paddingLeft: depth * 14 + 12,
                      paddingRight: 12,
                      color: note?.folder_id === f.id ? 'var(--primary)' : depth > 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => { if (confirm('Smazat tuto poznámku?')) onDelete(note!.id); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      {/* Title */}
      <div className="px-4 md:px-6 pt-5 pb-2 flex-shrink-0">
        <input
          type="text"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
          autoFocus={note?.title === 'Nová poznámka'}
          placeholder="Název poznámky"
          className="w-full text-xl font-semibold bg-transparent border-none outline-none text-base sm:text-xl"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      {/* Toolbar + meta flags */}
      <div className="px-4 pb-2 flex items-center gap-1 flex-wrap flex-shrink-0">
        {(['bold', 'italic', 'underline'] as const).map((cmd, idx) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); execFmt(cmd); }} style={btnStyle} title={['Tučné', 'Kurzíva', 'Podtržené'][idx]}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontWeight: idx === 0 ? 700 : undefined, fontStyle: idx === 1 ? 'italic' : undefined, textDecoration: idx === 2 ? 'underline' : undefined }}>{['B', 'I', 'U'][idx]}</span>
          </button>
        ))}
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
        <button onMouseDown={e => { e.preventDefault(); execFmt('insertUnorderedList'); }} style={btnStyle} title="Odrážkový seznam"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button onMouseDown={e => { e.preventDefault(); execFmt('insertOrderedList'); }} style={btnStyle} title="Číselný seznam"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
            <path d="M4 6h1v4" strokeLinecap="round"/><path d="M4 10h2" strokeLinecap="round"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeLinecap="round"/>
          </svg>
        </button>
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
        {/* Meta flags */}
        <button onMouseDown={e => { e.preventDefault(); toggleImportant(); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
          style={{ background: isImportant ? '#fee2e2' : 'transparent', color: isImportant ? '#dc2626' : 'var(--text-muted)', borderColor: isImportant ? '#fca5a5' : 'var(--border)' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill={isImportant ? '#dc2626' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          Důležitá
        </button>
        <button onMouseDown={e => { e.preventDefault(); toggleFavorite(); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
          style={{ background: isFavorite ? '#fef3c7' : 'transparent', color: isFavorite ? '#d97706' : 'var(--text-muted)', borderColor: isFavorite ? '#fcd34d' : 'var(--border)' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill={isFavorite ? '#d97706' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Oblíbená
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Rich text editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onBlur={handleEditorBlur}
          onKeyDown={handleEditorKeyDown}
          onClick={handleEditorClick}
          className="px-4 md:px-6 py-2 min-h-[120px] outline-none text-sm leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
          data-placeholder="Začni psát…"
        />

        {/* Checklist */}
        <div className="mx-4 md:mx-6 my-3 border rounded-xl px-3 md:px-3 py-3 md:py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Úkoly</div>
          <div className="space-y-2 md:space-y-1">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2.5 md:gap-2 group/task">
                <input type="checkbox" checked={task.checked} onChange={() => toggleTask(task.id)}
                  className="w-5 h-5 md:w-3.5 md:h-3.5 flex-shrink-0 cursor-pointer rounded" style={{ accentColor: '#9ca3af' }} />
                <input
                  ref={el => { if (el) taskRefs.current.set(task.id, el); else taskRefs.current.delete(task.id); }}
                  type="text" value={task.text}
                  onChange={e => updateTaskText(task.id, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addTask(); }
                    if (e.key === 'Backspace' && task.text === '') { e.preventDefault(); removeTask(task.id); }
                  }}
                  className="flex-1 bg-transparent outline-none min-w-0 text-base md:text-xs py-1 md:py-0"
                  style={{ color: task.checked ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.checked ? 'line-through' : 'none' }}
                  placeholder="Úkol…"
                />
                <button onClick={() => removeTask(task.id)}
                  className="opacity-60 md:opacity-0 md:group-hover/task:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity p-1.5 md:p-0"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-[9px] md:h-[9px]">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button onClick={addTask} className="flex items-center gap-1.5 md:gap-1 text-sm md:text-[11px] mt-2.5 md:mt-1.5 py-1 md:py-0 transition-colors"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="md:w-2 md:h-2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Přidat úkol
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CalEventNoteEditor ───────────────────────────────────────────────────────
function CalEventNoteEditor({
  note, onSave, onBack,
}: {
  note: CalEventNote;
  onSave: (eventRef: string, content: string, tasks: TaskItem[], meta: { is_favorite: boolean; is_important: boolean }) => Promise<void>;
  onBack: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState(note.content);
  const [tasks, setTasks] = useState<TaskItem[]>(note.tasks);
  const [isFavorite, setIsFavorite] = useState(note.is_favorite);
  const [isImportant, setIsImportant] = useState(note.is_important);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const taskRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setContent(note.content); setTasks(note.tasks); setIsFavorite(note.is_favorite); setIsImportant(note.is_important);
    if (editorRef.current) editorRef.current.innerHTML = note.content;
  }, [note.event_ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSave = useCallback((c: string, tk: TaskItem[], fav: boolean, imp: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await onSave(note.event_ref, c, tk, { is_favorite: fav, is_important: imp });
      setSaving(false);
    }, 800);
  }, [onSave, note.event_ref]);

  function execFmt(cmd: string) { document.execCommand(cmd, false, undefined); editorRef.current?.focus(); }

  function handleInput() {
    const c = editorRef.current?.innerHTML ?? '';
    setContent(c);
    triggerSave(c, tasks, isFavorite, isImportant);
  }

  function handleBlur() {
    const linked = linkifyHtml(editorRef.current?.innerHTML ?? '');
    if (editorRef.current) editorRef.current.innerHTML = linked;
    setContent(linked);
    triggerSave(linked, tasks, isFavorite, isImportant);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    if ((node.parentElement)?.closest('a')) return;
    const text = node.textContent ?? '';
    const cursorPos = range.startOffset;
    const urlMatch = text.slice(0, cursorPos).match(/(https?:\/\/[^\s<>"'\]]+)$/);
    if (!urlMatch) return;
    e.preventDefault();
    const url = urlMatch[1];
    const urlStart = cursorPos - url.length;
    const beforeText = text.slice(0, urlStart);
    const afterText = text.slice(cursorPos);
    const parent = node.parentNode!;
    const refNode = node.nextSibling;
    parent.removeChild(node);
    const ins = (n: Node) => parent.insertBefore(n, refNode ?? null);
    if (beforeText) ins(document.createTextNode(beforeText));
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.cssText = 'color:var(--primary);text-decoration:underline';
    a.textContent = url;
    ins(a);
    let cursorNode: Text;
    let cursorOffset: number;
    if (e.key === 'Enter') {
      ins(document.createElement('br'));
      cursorNode = document.createTextNode(afterText); ins(cursorNode); cursorOffset = 0;
    } else {
      cursorNode = document.createTextNode(' ' + afterText); ins(cursorNode); cursorOffset = 1;
    }
    const nr = document.createRange();
    nr.setStart(cursorNode, cursorOffset); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr);
    const c = editorRef.current?.innerHTML ?? '';
    setContent(c);
    triggerSave(c, tasks, isFavorite, isImportant);
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  function addTask() {
    const newTask: TaskItem = { id: nanoid(), text: '', checked: false };
    const next = [...tasks, newTask];
    setTasks(next); triggerSave(content, next, isFavorite, isImportant);
    setTimeout(() => taskRefs.current.get(newTask.id)?.focus(), 50);
  }

  function toggleTask(id: string) {
    const next = tasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    setTasks(next); triggerSave(content, next, isFavorite, isImportant);
  }

  function updateTaskText(id: string, text: string) {
    const next = tasks.map(t => t.id === id ? { ...t, text } : t);
    setTasks(next); triggerSave(content, next, isFavorite, isImportant);
  }

  function removeTask(id: string) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next); triggerSave(content, next, isFavorite, isImportant);
  }

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', padding: '3px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', fontSize: 11,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Zpět
        </button>
        <div className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>{saving ? 'Ukládám…' : fmtDate(note.date)}</div>
        <button onClick={() => router.push('/calendar')} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Otevřít v Kalendáři
        </button>
      </div>
      <div className="px-6 pt-5 pb-1 flex-shrink-0">
        <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{note.title}</div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Poznámka k události v Kalendáři · nelze přesouvat</div>
      </div>
      <div className="px-4 pb-2 flex items-center gap-1 flex-wrap flex-shrink-0">
        {(['bold', 'italic', 'underline'] as const).map((cmd, idx) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); execFmt(cmd); }} style={btnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontWeight: idx === 0 ? 700 : undefined, fontStyle: idx === 1 ? 'italic' : undefined, textDecoration: idx === 2 ? 'underline' : undefined }}>{['B', 'I', 'U'][idx]}</span>
          </button>
        ))}
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px' }} />
        <button onMouseDown={e => { e.preventDefault(); execFmt('insertUnorderedList'); }} style={btnStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px' }} />
        <button onMouseDown={e => { e.preventDefault(); setIsFavorite(n => { const next = !n; triggerSave(content, tasks, next, isImportant); return next; }); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
          style={{ background: isFavorite ? '#fef3c7' : 'transparent', color: isFavorite ? '#d97706' : 'var(--text-muted)', borderColor: isFavorite ? '#fcd34d' : 'var(--border)' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill={isFavorite ? '#d97706' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Oblíbená
        </button>
        <button onMouseDown={e => { e.preventDefault(); setIsImportant(n => { const next = !n; triggerSave(content, tasks, isFavorite, next); return next; }); }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
          style={{ background: isImportant ? '#fee2e2' : 'transparent', color: isImportant ? '#dc2626' : 'var(--text-muted)', borderColor: isImportant ? '#fca5a5' : 'var(--border)' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill={isImportant ? '#dc2626' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          Důležitá
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          className="px-4 md:px-6 py-2 min-h-[120px] outline-none text-sm leading-relaxed"
          style={{ color: 'var(--text-primary)' }} data-placeholder="Obsah poznámky…" />
        <div className="mx-4 md:mx-6 my-3 border rounded-xl px-3 py-3 md:py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Úkoly</div>
          <div className="space-y-2 md:space-y-1">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2.5 md:gap-2 group/task">
                <input type="checkbox" checked={task.checked} onChange={() => toggleTask(task.id)} className="w-5 h-5 md:w-3.5 md:h-3.5 flex-shrink-0 cursor-pointer" style={{ accentColor: '#9ca3af' }} />
                <input ref={el => { if (el) taskRefs.current.set(task.id, el); else taskRefs.current.delete(task.id); }}
                  type="text" value={task.text}
                  onChange={e => updateTaskText(task.id, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } if (e.key === 'Backspace' && task.text === '') { e.preventDefault(); removeTask(task.id); } }}
                  className="flex-1 bg-transparent outline-none min-w-0 text-base md:text-xs py-1 md:py-0"
                  style={{ color: task.checked ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.checked ? 'line-through' : 'none' }}
                  placeholder="Úkol…" />
                <button onClick={() => removeTask(task.id)} className="opacity-60 md:opacity-0 md:group-hover/task:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity p-1.5 md:p-0"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-[9px] md:h-[9px]"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
          <button onClick={addTask} className="flex items-center gap-1.5 md:gap-1 text-sm md:text-[11px] mt-2.5 md:mt-1.5 py-1 md:py-0" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="md:w-2 md:h-2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Přidat úkol
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function NotebookContent() {
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
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [authorExpanded, setAuthorExpanded] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);

  // Archive multi-select
  const [archiveSelected, setArchiveSelected] = useState<Set<string>>(new Set());

  // Move note dropdown
  const [moveDropdown, setMoveDropdown] = useState<{ noteId: string; top: number; right: number } | null>(null);

  // Folder modal
  const [folderModal, setFolderModal] = useState<{ open: boolean; parentId: string | null; editing: NoteFolder | null }>({ open: false, parentId: null, editing: null });
  const [folderName, setFolderName] = useState('');

  // Share modal
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: NoteFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

  const wsId = currentWorkspace?.id;
  const userId = user?.id ?? '';

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
    const { data: noteData } = await supabase
      .from('trackino_calendar_event_notes')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('user_id', userId);
    if (!noteData) return;
    const uuidNotes = noteData.filter(n => UUID_RE.test(n.event_ref));
    if (uuidNotes.length === 0) { setCalEventNotes([]); return; }
    const eventIds = uuidNotes.map(n => n.event_ref);
    const { data: evData } = await supabase
      .from('trackino_calendar_events')
      .select('id, title, start_date')
      .in('id', eventIds);
    if (!evData) return;
    const evMap: Record<string, { title: string; start_date: string }> = {};
    for (const e of evData) evMap[e.id] = { title: e.title, start_date: e.start_date };
    const result: CalEventNote[] = uuidNotes
      .filter(n => evMap[n.event_ref])
      .map(n => ({
        event_ref: n.event_ref,
        event_id: n.event_ref,
        title: evMap[n.event_ref].title,
        date: evMap[n.event_ref].start_date,
        content: n.content ?? '',
        tasks: Array.isArray(n.tasks) ? n.tasks : [],
        is_favorite: n.is_favorite ?? false,
        is_important: n.is_important ?? false,
      }));
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
      folder_id: folderId, is_favorite: false, is_important: false, is_archived: false,
    }).select().single();
    if (!error && data) {
      await fetchNotes();
      const newNote = { ...data, tasks: [] };
      setSelectedNote(newNote);
      setSelectedCalNote(null);
    }
  }

  async function saveNote(noteId: string, title: string, content: string, tasks: TaskItem[], meta: { is_favorite: boolean; is_important: boolean }) {
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

  async function toggleFlag(note: Note, field: 'is_favorite' | 'is_important') {
    const val = !note[field];
    await supabase.from('trackino_notes').update({ [field]: val, updated_at: new Date().toISOString() }).eq('id', note.id);
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, [field]: val } : n));
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
    if (!confirm(`Smazat složku "${f.name}"? Poznámky se přesunou do Inboxu.`)) return;
    await supabase.from('trackino_note_folders').delete().eq('id', f.id);
    await fetchAll();
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
      base = notes.filter(n => n.folder_id === listFilter.folderId && !n.is_archived);
    } else base = notes.filter(n => !n.is_archived);

    if (qLow) base = base.filter(n => n.title.toLowerCase().includes(qLow) || stripHtml(n.content).toLowerCase().includes(qLow));
    if (listFilter?.type !== 'recent') {
      base = [...base].sort((a, b) => sortBy === 'title' ? a.title.localeCompare(b.title, 'cs') : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return base;
  })();

  const filteredCalNotes = (() => {
    const q = searchQ.trim().toLowerCase();
    let base = calEventNotes;
    if (q) base = base.filter(n => n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q));
    return [...base].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    setSelectedNote(null);
    setSelectedCalNote(null);
    setArchiveSelected(new Set());
    setShowLeftPanel(false);
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
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Poznámky</h1>
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
          <NavBtn active={listFilter?.type === 'inbox' || (!listFilter && true)} onClick={() => selectFilter({ type: 'inbox' })} count={inboxCount}
            label="Inbox"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>} />
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
            userId={userId}
            items={notes}
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
                  const active = listFilter?.type === 'folder' ? false : false; // authors filter not implemented as NoteFilter yet
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
              {!isRecent && !showCalEventNotes && (
                <div className="relative flex-shrink-0">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'title')}
                    className="text-base sm:text-sm border rounded-lg pl-3 pr-8 py-1.5 appearance-none cursor-pointer"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}>
                    <option value="date">Nejnovější</option>
                    <option value="title">Název A–Z</option>
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
                    className="group flex items-start gap-3 px-4 py-3 md:py-3 border-b transition-colors"
                    style={{ borderColor: 'var(--border)' }}
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
                      {/* Line 1: Title + flags */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{note.title || 'Bez názvu'}</span>
                        {note.is_favorite && <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" className="flex-shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
                        {note.is_important && <svg width="10" height="10" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" strokeWidth="1" className="flex-shrink-0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
                      </div>
                      {/* Line 2: Preview */}
                      {stripHtml(note.content) && <p className="hidden sm:block text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{stripHtml(note.content).slice(0, 150)}</p>}
                      {/* Line 3: Date + Author */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(note.updated_at)}</span>
                        {authorName && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {authorName}</span>}
                      </div>
                    </div>
                    {/* Actions – bigger on mobile */}
                    <div className="flex items-center gap-1.5 md:gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                      {/* Important toggle */}
                      <button onClick={e => { e.stopPropagation(); toggleFlag(note, 'is_important'); }}
                        className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-lg"
                        style={{ color: note.is_important ? '#dc2626' : 'var(--text-muted)' }} title={note.is_important ? 'Odebrat důležité' : 'Označit jako důležité'}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={note.is_important ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3 md:h-3">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                      </button>
                      {/* Favorite toggle */}
                      <button onClick={e => { e.stopPropagation(); toggleFlag(note, 'is_favorite'); }}
                        className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-lg"
                        style={{ color: note.is_favorite ? '#f59e0b' : 'var(--text-muted)' }} title={note.is_favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={note.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3 md:h-3">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                      {/* Move (only for non-archived) */}
                      {!note.is_archived && (
                        <button onClick={e => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMoveDropdown({ noteId: note.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        }}
                          className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-lg" title="Přesunout do složky"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3 md:h-3">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            <polyline points="12 11 12 17"/><polyline points="9 14 12 17 15 14"/>
                          </svg>
                        </button>
                      )}
                      {/* Archive / Unarchive */}
                      <button onClick={e => { e.stopPropagation(); toggleArchive(note); }}
                        className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-lg" title={note.is_archived ? 'Obnovit z archivu' : 'Archivovat'}
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {note.is_archived ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3 md:h-3"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3 md:h-3"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
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
          <div className="fixed z-50 rounded-lg border shadow-lg py-1 min-w-[200px] max-h-60 overflow-y-auto"
            style={{ top: moveDropdown.top, right: moveDropdown.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přesunout do</div>
            <button className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}
              onClick={() => moveNote(moveDropdown.noteId, null)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
              Inbox (nezařazené)
            </button>
            {buildFolderFlat(folders).map(({ folder, depth }) => (
              <button key={folder.id} className="w-full text-left py-2 text-sm hover:bg-[var(--bg-hover)] flex items-center gap-2"
                style={{ paddingLeft: depth * 14 + 12, paddingRight: 12, color: depth > 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                onClick={() => moveNote(moveDropdown.noteId, folder.id)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {folder.name}
              </button>
            ))}
          </div>
        </>
      )}

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

// ─── Styles for contenteditable placeholder ───────────────────────────────────
const editorStyles = `
  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    pointer-events: none;
  }
`;

// ─── Page export ──────────────────────────────────────────────────────────────
export default function NotebookPage() {
  return (
    <WorkspaceProvider>
      <DashboardLayout showTimer={false}>
        <style>{editorStyles}</style>
        <NotebookContent />
      </DashboardLayout>
    </WorkspaceProvider>
  );
}
