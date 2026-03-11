'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  is_archived: boolean; is_done: boolean; created_at: string; updated_at: string;
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
  start_time: string | null; end_time: string | null; is_all_day: boolean;
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

function htmlToPlainText(html: string, tasks?: TaskItem[]): string {
  // Inline task bloky – extrahuj přes DOM před string manipulation
  let baseHtml = html;
  const inlineTaskLines: string[] = [];
  if (typeof document !== 'undefined' && html.includes('nb-task-block')) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('.nb-task-block').forEach(block => {
      block.querySelectorAll('.nb-tb-item').forEach(item => {
        const checked = item.getAttribute('data-checked') === 'true';
        const txt = (item.querySelector('.nb-tb-txt') as HTMLElement | null)?.textContent?.trim() ?? '';
        if (txt) inlineTaskLines.push(`${checked ? '☑' : '☐'} ${txt}`);
      });
      block.remove();
    });
    baseHtml = tmp.innerHTML;
  }
  let text = baseHtml;
  // Kód bloky – extrahuj text před odstraněním tagů
  text = text.replace(/<pre[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi, (_, code) => {
    const plain = code
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
    return '\n' + plain.trim() + '\n';
  });
  // Blokové elementy → nový řádek
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  // Dekóduj HTML entity
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&quot;/gi, '"');
  // Odstraň zbývající HTML tagy
  text = text.replace(/<[^>]+>/g, '');
  // Max 2 prázdné řádky za sebou
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  // Přidej inline task bloky jako text
  if (inlineTaskLines.length > 0) {
    if (text) text += '\n\n';
    text += inlineTaskLines.join('\n');
  }
  // Přidej úkoly z panelu úkolů jako text
  if (tasks && tasks.length > 0) {
    const taskLines = tasks.map(t => `${t.checked ? '☑' : '☐'} ${t.text}`).join('\n');
    if (text) text += '\n\n';
    text += taskLines;
  }
  return text;
}

function linkifyHtml(html: string): string {
  return html.replace(/(?<!["'>])(https?:\/\/[^\s<>"'\]]+)/g, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">${url}</a>`
  );
}

// ─── Inline task blok helpers ─────────────────────────────────────────────────
function createTaskItemHtml(id: string): string {
  return `<div class="nb-tb-item" data-checked="false" data-tb-taskid="${id}" style="display:flex;align-items:center;gap:6px;padding:2px 0"><span class="nb-tb-chk" style="flex-shrink:0;cursor:pointer;font-size:14px;user-select:none;width:16px;line-height:1;text-align:center">☐</span><span class="nb-tb-txt" contenteditable="true" data-placeholder="Úkol…" style="flex:1;outline:none;font-size:13px;min-width:0;color:var(--text-primary);line-height:1.5"></span><span class="nb-tb-del" style="cursor:pointer;font-size:14px;color:var(--text-muted);user-select:none;padding:0 4px">×</span></div>`;
}

function createTaskBlockHtml(): string {
  const blockId = nanoid();
  const itemId = nanoid();
  return `<div class="nb-task-block" contenteditable="false" data-nb-tb="${blockId}" style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:6px 0;background:var(--bg-hover);display:block;position:relative"><span class="nb-tb-remove-block" style="position:absolute;top:5px;right:8px;cursor:pointer;font-size:14px;line-height:1;color:var(--text-muted);user-select:none;padding:2px 4px;border-radius:4px" title="Smazat blok">×</span><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px;user-select:none">Úkoly</div><div class="nb-tb-items">${createTaskItemHtml(itemId)}</div><div class="nb-tb-add" style="font-size:11px;cursor:pointer;padding:3px 0;margin-top:4px;user-select:none">+ Přidat úkol</div></div><br>`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtEventDate(date: string) {
  const d = new Date(date + 'T00:00:00');
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function fmtEventTime(startTime: string | null, endTime: string | null) {
  if (!startTime) return '';
  const s = startTime.slice(0, 5);
  return endTime ? `${s}–${endTime.slice(0, 5)}` : s;
}

function getDuplicateTitle(title: string, existingTitles: string[]) {
  const base = title.replace(/ - kopie( \d+)?$/, '');
  if (!existingTitles.includes(base + ' - kopie')) return base + ' - kopie';
  let n = 2;
  while (existingTitles.includes(`${base} - kopie ${n}`)) n++;
  return `${base} - kopie ${n}`;
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Shared folder utilities ─────────────────────────────────────────────────
function getDescendantFolderIds(folderId: string, allFolders: NoteFolder[]): string[] {
  const result: string[] = [folderId];
  const children = allFolders.filter(f => f.parent_id === folderId);
  for (const child of children) {
    result.push(...getDescendantFolderIds(child.id, allFolders));
  }
  return result;
}

function buildFolderBreadcrumb(folderId: string | null, allFolders: NoteFolder[]): NoteFolder[] {
  if (!folderId) return [];
  const folder = allFolders.find(f => f.id === folderId);
  if (!folder) return [];
  return [...buildFolderBreadcrumb(folder.parent_id, allFolders), folder];
}

// ─── FolderTree ──────────────────────────────────────────────────────────────
function FolderTree({
  folders, selectedId, expanded, onSelect, onToggle, onAddSub, onEdit, onDelete, onShare, onMoveUp, onMoveDown, userId, items, folderSortOrder = 'manual', depth = 0, parentId = null,
}: {
  folders: NoteFolder[]; selectedId: string | null; expanded: Set<string>;
  onSelect: (id: string) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string, depth: number) => void;
  onEdit: (f: NoteFolder) => void; onDelete: (f: NoteFolder) => void;
  onShare: (f: NoteFolder) => void;
  onMoveUp?: (id: string) => void; onMoveDown?: (id: string) => void;
  userId: string;
  items: { folder_id: string | null; is_archived: boolean }[];
  folderSortOrder?: 'name' | 'created' | 'manual';
  depth?: number; parentId?: string | null;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const children = folders.filter(f => f.parent_id === parentId).sort((a, b) => {
    if (folderSortOrder === 'name') return a.name.localeCompare(b.name, 'cs');
    if (folderSortOrder === 'created') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.sort_order - b.sort_order;
  });
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isExpanded = expanded.has(folder.id);
        const isSelected = selectedId === folder.id;
        const isOwner = folder.owner_id === userId;
        const descendantIds = getDescendantFolderIds(folder.id, folders);
        const itemCount = items.filter(b => b.folder_id && descendantIds.includes(b.folder_id) && !b.is_archived).length;
        return (
          <div key={folder.id}>
            <div className="group/folder relative flex items-center gap-1 py-1 px-1 rounded-lg cursor-pointer transition-colors"
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
                <span className="ml-auto mr-1 text-[10px] flex-shrink-0 sm:group-hover/folder:opacity-0 transition-opacity" style={{ color: 'var(--text-muted)' }}>{itemCount}</span>
              )}
              {/* Tři tečky: na mobilu v toku (vždy viditelné), na desktopu absolutně (hover) – nezabírá místo v layoutu */}
              <div
                className="flex-shrink-0 sm:absolute sm:right-1 sm:top-1/2 sm:-translate-y-1/2 sm:opacity-0 sm:group-hover/folder:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}>
                <button type="button"
                  onClick={e => {
                    e.stopPropagation();
                    if (openMenu === folder.id) { setOpenMenu(null); setMenuPos(null); }
                    else {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const openUpward = spaceBelow < 180;
                      setMenuPos({
                        top: openUpward ? undefined : rect.bottom + 4,
                        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                        right: window.innerWidth - rect.right,
                      });
                      setOpenMenu(folder.id);
                    }
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md"
                  style={{ color: 'var(--text-muted)', background: openMenu === folder.id ? 'var(--bg-hover)' : 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
              </div>
            </div>
            {/* Dropdown přes portál – unikne z transformovaného left panelu na document.body */}
            {openMenu === folder.id && menuPos && typeof document !== 'undefined' && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={e => { e.stopPropagation(); setOpenMenu(null); setMenuPos(null); }} />
                <div className="fixed z-[9999] rounded-lg border shadow-lg py-1 min-w-[160px]"
                  style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  onClick={e => e.stopPropagation()}>
                  {depth < MAX_DEPTH - 1 && (
                    <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={e => { e.stopPropagation(); setOpenMenu(null); onAddSub(folder.id, depth + 1); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Přidat podsložku
                    </button>
                  )}
                  {folderSortOrder === 'manual' && (
                    <>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onMoveUp?.(folder.id); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        Posunout nahoru
                      </button>
                      <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); onMoveDown?.(folder.id); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        Posunout dolů
                      </button>
                    </>
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
              </>,
              document.body
            )}
            {isExpanded && (
              <FolderTree folders={folders} selectedId={selectedId} expanded={expanded}
                onSelect={onSelect} onToggle={onToggle} onAddSub={onAddSub}
                onEdit={onEdit} onDelete={onDelete} onShare={onShare}
                onMoveUp={onMoveUp} onMoveDown={onMoveDown}
                userId={userId} items={items} folderSortOrder={folderSortOrder}
                depth={depth + 1} parentId={folder.id} />
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
  note, onSave, onBack, onDelete, folders, onMove, onDuplicate, showDoneFeature, onSelectFolder,
}: {
  note: Note | null;
  onSave: (title: string, content: string, tasks: TaskItem[], meta: { is_favorite: boolean; is_important: boolean; is_done: boolean }) => Promise<void>;
  onBack: () => void;
  onDelete: (id: string) => void;
  folders?: NoteFolder[];
  onMove?: (noteId: string, folderId: string | null) => Promise<void>;
  onDuplicate?: () => void;
  showDoneFeature?: boolean;
  onSelectFolder?: (folderId: string) => void;
}) {
  const [title, setTitle] = useState(note?.title === 'Nová poznámka' ? '' : (note?.title ?? ''));
  const [content, setContent] = useState(note?.content ?? '');
  const [tasks, setTasks] = useState<TaskItem[]>(note?.tasks ?? []);
  const [isFavorite, setIsFavorite] = useState(note?.is_favorite ?? false);
  const [isImportant, setIsImportant] = useState(note?.is_important ?? false);
  const [isDone, setIsDone] = useState(note?.is_done ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
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
    setIsDone(note?.is_done ?? false);
    if (editorRef.current) editorRef.current.innerHTML = note?.content ?? '';
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSave = useCallback((t: string, c: string, tk: TaskItem[], fav: boolean, imp: boolean, dn?: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await onSave(t, c, tk, { is_favorite: fav, is_important: imp, is_done: dn ?? false });
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
    triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
  }

  function handleEditorBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Přeskočit linkify + save pokud focus zůstává uvnitř editoru (např. v nb-tb-txt)
    if (e.relatedTarget && editorRef.current?.contains(e.relatedTarget as Node)) return;
    const linked = linkifyHtml(editorRef.current?.innerHTML ?? '');
    if (editorRef.current) editorRef.current.innerHTML = linked;
    const c = linked;
    setContent(c);
    triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Klávesy v inline task bloku (.nb-tb-txt)
    if (e.key === 'Enter' || e.key === 'Backspace') {
      const sel0 = window.getSelection();
      if (sel0 && sel0.rangeCount > 0) {
        const range0 = sel0.getRangeAt(0);
        const node0 = range0.startContainer;
        const tbTxt = (node0.nodeType === Node.TEXT_NODE ? node0.parentElement : node0 as Element)?.closest?.('.nb-tb-txt') as HTMLElement | null;
        if (tbTxt) {
          if (e.key === 'Enter') {
            e.preventDefault();
            const item = tbTxt.closest('.nb-tb-item') as HTMLElement | null;
            const itemsContainer = item?.closest('.nb-task-block')?.querySelector('.nb-tb-items') as HTMLElement | null;
            if (itemsContainer && item) {
              const newId = nanoid();
              const tmp = document.createElement('div');
              tmp.innerHTML = createTaskItemHtml(newId);
              const newItem = tmp.firstChild as HTMLElement | null;
              if (newItem) { item.after(newItem); (newItem.querySelector('.nb-tb-txt') as HTMLElement | null)?.focus(); }
              const c = editorRef.current?.innerHTML ?? '';
              setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
            }
            return;
          }
          if (e.key === 'Backspace' && range0.collapsed && range0.startOffset === 0 && tbTxt.textContent === '') {
            e.preventDefault();
            const item = tbTxt.closest('.nb-tb-item') as HTMLElement | null;
            const itemsContainer = item?.closest('.nb-task-block')?.querySelector('.nb-tb-items') as HTMLElement | null;
            if (itemsContainer && item && itemsContainer.children.length > 1) {
              const prev = item.previousElementSibling as HTMLElement | null;
              item.remove();
              prev?.querySelector<HTMLElement>('.nb-tb-txt')?.focus();
              const c = editorRef.current?.innerHTML ?? '';
              setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
            }
            return;
          }
        }
      }
    }
    // Enter uvnitř kód bloku → vloží \n místo nového bloku
    if (e.key === 'Enter') {
      const sel0 = window.getSelection();
      if (sel0 && sel0.rangeCount > 0) {
        const startNode = sel0.getRangeAt(0).startContainer;
        const pre = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode as Element)?.closest?.('pre[data-nb-code]');
        if (pre) {
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
          const c = editorRef.current?.innerHTML ?? '';
          setContent(c);
          triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
          return;
        }
      }
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    if ((node.parentElement)?.closest('a')) return;
    if ((node.parentElement)?.closest('.nb-task-block')) return;
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
    triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
  }

  function handleEditorPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      // Odstraň background barvy ze všech elementů
      tmp.querySelectorAll<HTMLElement>('*').forEach(el => {
        const style = el.getAttribute('style');
        if (style) {
          const cleaned = style
            .split(';')
            .filter(rule => {
              const prop = rule.split(':')[0]?.trim().toLowerCase() ?? '';
              return prop !== '' && !prop.startsWith('background');
            })
            .join(';')
            .replace(/;+$/, '')
            .trim();
          if (cleaned) el.setAttribute('style', cleaned);
          else el.removeAttribute('style');
        }
        el.removeAttribute('bgcolor');
      });
      document.execCommand('insertHTML', false, tmp.innerHTML);
      const c = editorRef.current?.innerHTML ?? '';
      setContent(c);
      triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
    }
    // pokud není HTML, nechej výchozí chování (vloží plain text)
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    // Inline task blok – zaškrtnutí, přidání, smazání položky
    const tbChk = (e.target as HTMLElement).closest('.nb-tb-chk');
    if (tbChk) {
      const item = tbChk.closest('.nb-tb-item') as HTMLElement | null;
      if (item) {
        const checked = item.getAttribute('data-checked') === 'true';
        item.setAttribute('data-checked', String(!checked));
        (tbChk as HTMLElement).textContent = checked ? '☐' : '☑';
        const txt = item.querySelector('.nb-tb-txt') as HTMLElement | null;
        if (txt) { txt.style.textDecoration = checked ? 'none' : 'line-through'; txt.style.color = checked ? 'var(--text-primary)' : 'var(--text-muted)'; }
      }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone); return;
    }
    const tbAdd = (e.target as HTMLElement).closest('.nb-tb-add');
    if (tbAdd) {
      const itemsContainer = tbAdd.closest('.nb-task-block')?.querySelector('.nb-tb-items') as HTMLElement | null;
      if (itemsContainer) {
        const newId = nanoid();
        const tmp = document.createElement('div');
        tmp.innerHTML = createTaskItemHtml(newId);
        const newItem = tmp.firstChild as HTMLElement | null;
        if (newItem) { itemsContainer.appendChild(newItem); (newItem.querySelector('.nb-tb-txt') as HTMLElement | null)?.focus(); }
      }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone); return;
    }
    const tbDel = (e.target as HTMLElement).closest('.nb-tb-del');
    if (tbDel) {
      const item = tbDel.closest('.nb-tb-item') as HTMLElement | null;
      if (item) { const items = item.closest('.nb-task-block')?.querySelector('.nb-tb-items'); if (items && items.children.length > 1) item.remove(); }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone); return;
    }
    const tbRemoveBlock = (e.target as HTMLElement).closest('.nb-tb-remove-block');
    if (tbRemoveBlock) {
      const block = tbRemoveBlock.closest('.nb-task-block') as HTMLElement | null;
      if (block) {
        const next = block.nextSibling;
        block.remove();
        if (next && next.nodeName === 'BR') next.parentNode?.removeChild(next);
      }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone); return;
    }
    const pre = (e.target as HTMLElement).closest('pre[data-nb-code]') as HTMLElement | null;
    if (pre) {
      const rect = pre.getBoundingClientRect();
      if (e.clientX - rect.left > rect.width - 44 && e.clientY - rect.top < 44) {
        navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '');
        pre.classList.add('nb-code-copied');
        setTimeout(() => pre.classList.remove('nb-code-copied'), 1500);
      } else {
        // Kliknutí do kód bloku – vymaž placeholder a dej kurzor na začátek
        const codeEl = pre.querySelector('code');
        if (codeEl && codeEl.textContent?.trim() === 'Kód…') {
          codeEl.textContent = '';
          const range = document.createRange();
          range.setStart(codeEl, 0);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(range); }
          const c = editorRef.current?.innerHTML ?? '';
          setContent(c);
          triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
        }
      }
    }
  }

  function handleTitleChange(v: string) {
    setTitle(v);
    triggerSave(v, content, tasks, isFavorite, isImportant, isDone);
  }

  function addTask() {
    const newTask: TaskItem = { id: nanoid(), text: '', checked: false };
    const next = [...tasks, newTask];
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant, isDone);
    setTimeout(() => taskRefs.current.get(newTask.id)?.focus(), 50);
  }

  function toggleTask(id: string) {
    const next = tasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant, isDone);
  }

  function updateTaskText(id: string, text: string) {
    const next = tasks.map(t => t.id === id ? { ...t, text } : t);
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant, isDone);
  }

  function removeTask(id: string) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next);
    triggerSave(title, content, next, isFavorite, isImportant, isDone);
  }

  function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    triggerSave(title, content, tasks, next, isImportant, isDone);
  }

  function toggleImportant() {
    const next = !isImportant;
    setIsImportant(next);
    triggerSave(title, content, tasks, isFavorite, next, isDone);
  }

  function toggleDone() {
    const next = !isDone;
    setIsDone(next);
    triggerSave(title, content, tasks, isFavorite, isImportant, next);
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
                  Inbox
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
        {/* Copy content */}
        <button onClick={() => {
          navigator.clipboard.writeText(htmlToPlainText(content, tasks));
          setCopyDone(true);
          setTimeout(() => setCopyDone(false), 2000);
        }}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: copyDone ? '#22c55e' : 'var(--text-muted)' }} title="Kopírovat obsah"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {copyDone ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
        </button>
        {/* Duplicate */}
        {onDuplicate && (
          <button onClick={onDuplicate}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }} title="Duplikovat poznámku"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              <line x1="18" y1="12" x2="18" y2="18"/><line x1="15" y1="15" x2="21" y2="15"/>
            </svg>
          </button>
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

      {/* Breadcrumb – cesta složkami */}
      {note?.folder_id && folders && folders.length > 0 && (() => {
        const crumbs = buildFolderBreadcrumb(note.folder_id, folders);
        if (!crumbs.length) return null;
        return (
          <div className="px-4 md:px-6 py-1.5 flex items-center gap-1 flex-wrap border-b flex-shrink-0 text-[11px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {crumbs.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
                <button
                  onClick={() => onSelectFolder?.(f.id)}
                  className="hover:underline transition-colors"
                  style={{
                    color: i === crumbs.length - 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                    background: 'none', border: 'none', cursor: onSelectFolder ? 'pointer' : 'default', padding: 0,
                  }}>
                  {f.name}
                </button>
              </span>
            ))}
          </div>
        );
      })()}

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
        <button onMouseDown={e => {
          e.preventDefault();
          document.execCommand('insertHTML', false, '<pre data-nb-code="1" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:6px;padding:10px 36px 10px 12px;overflow-x:auto;position:relative;font-family:monospace;font-size:12px;color:var(--text-primary);margin:4px 0;min-height:5em"><code>Kód…</code></pre><br>');
          editorRef.current?.focus();
        }} style={btnStyle} title="Kódový blok"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
        </button>
        <button onMouseDown={e => {
          e.preventDefault();
          const html = createTaskBlockHtml();
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const node = sel.getRangeAt(0).startContainer;
            const inBlock = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element)?.closest?.('.nb-task-block') as HTMLElement | null;
            if (inBlock) {
              const tmp = document.createElement('div'); tmp.innerHTML = html;
              inBlock.after(...Array.from(tmp.childNodes));
            } else { editorRef.current?.focus(); document.execCommand('insertHTML', false, html); }
          } else { editorRef.current?.focus(); document.execCommand('insertHTML', false, html); }
          const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(title, c, tasks, isFavorite, isImportant, isDone);
        }} style={btnStyle} title="Blok úkolů"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
            <polyline points="6 9 7 10 8 9"/>
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
        {showDoneFeature && (
          <button onMouseDown={e => { e.preventDefault(); toggleDone(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all"
            style={{ background: isDone ? '#dcfce7' : 'transparent', color: isDone ? '#16a34a' : 'var(--text-muted)', borderColor: isDone ? '#86efac' : 'var(--border)' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Hotovo
          </button>
        )}
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
          onPaste={handleEditorPaste}
          className="px-4 md:px-6 py-2 min-h-[120px] outline-none text-sm leading-relaxed nb-editor"
          style={{ color: 'var(--text-primary)' }}
          data-placeholder="Začni psát…"
        />

        {/* Checklist */}
        {tasks.length > 0 && (
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
        )}
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

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Přeskočit linkify + save pokud focus zůstává uvnitř editoru (např. v nb-tb-txt)
    if (e.relatedTarget && editorRef.current?.contains(e.relatedTarget as Node)) return;
    const linked = linkifyHtml(editorRef.current?.innerHTML ?? '');
    if (editorRef.current) editorRef.current.innerHTML = linked;
    setContent(linked);
    triggerSave(linked, tasks, isFavorite, isImportant);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Klávesy v inline task bloku (.nb-tb-txt)
    if (e.key === 'Enter' || e.key === 'Backspace') {
      const sel0 = window.getSelection();
      if (sel0 && sel0.rangeCount > 0) {
        const range0 = sel0.getRangeAt(0);
        const node0 = range0.startContainer;
        const tbTxt = (node0.nodeType === Node.TEXT_NODE ? node0.parentElement : node0 as Element)?.closest?.('.nb-tb-txt') as HTMLElement | null;
        if (tbTxt) {
          if (e.key === 'Enter') {
            e.preventDefault();
            const item = tbTxt.closest('.nb-tb-item') as HTMLElement | null;
            const itemsContainer = item?.closest('.nb-task-block')?.querySelector('.nb-tb-items') as HTMLElement | null;
            if (itemsContainer && item) {
              const newId = nanoid();
              const tmp = document.createElement('div');
              tmp.innerHTML = createTaskItemHtml(newId);
              const newItem = tmp.firstChild as HTMLElement | null;
              if (newItem) { item.after(newItem); (newItem.querySelector('.nb-tb-txt') as HTMLElement | null)?.focus(); }
              const c = editorRef.current?.innerHTML ?? '';
              setContent(c); triggerSave(c, tasks, isFavorite, isImportant);
            }
            return;
          }
          if (e.key === 'Backspace' && range0.collapsed && range0.startOffset === 0 && tbTxt.textContent === '') {
            e.preventDefault();
            const item = tbTxt.closest('.nb-tb-item') as HTMLElement | null;
            const itemsContainer = item?.closest('.nb-task-block')?.querySelector('.nb-tb-items') as HTMLElement | null;
            if (itemsContainer && item && itemsContainer.children.length > 1) {
              const prev = item.previousElementSibling as HTMLElement | null;
              item.remove();
              prev?.querySelector<HTMLElement>('.nb-tb-txt')?.focus();
              const c = editorRef.current?.innerHTML ?? '';
              setContent(c); triggerSave(c, tasks, isFavorite, isImportant);
            }
            return;
          }
        }
      }
    }
    // Enter uvnitř kód bloku → vloží \n místo nového bloku
    if (e.key === 'Enter') {
      const sel0 = window.getSelection();
      if (sel0 && sel0.rangeCount > 0) {
        const startNode = sel0.getRangeAt(0).startContainer;
        const pre = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode as Element)?.closest?.('pre[data-nb-code]');
        if (pre) {
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
          const c = editorRef.current?.innerHTML ?? '';
          setContent(c);
          triggerSave(c, tasks, isFavorite, isImportant);
          return;
        }
      }
    }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    if ((node.parentElement)?.closest('a')) return;
    if ((node.parentElement)?.closest('.nb-task-block')) return;
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
      return;
    }
    // Inline task blok – zaškrtnutí, přidání, smazání položky
    const tbChk = (e.target as HTMLElement).closest('.nb-tb-chk');
    if (tbChk) {
      const item = tbChk.closest('.nb-tb-item') as HTMLElement | null;
      if (item) {
        const checked = item.getAttribute('data-checked') === 'true';
        item.setAttribute('data-checked', String(!checked));
        (tbChk as HTMLElement).textContent = checked ? '☐' : '☑';
        const txt = item.querySelector('.nb-tb-txt') as HTMLElement | null;
        if (txt) { txt.style.textDecoration = checked ? 'none' : 'line-through'; txt.style.color = checked ? 'var(--text-primary)' : 'var(--text-muted)'; }
      }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(c, tasks, isFavorite, isImportant); return;
    }
    const tbAdd = (e.target as HTMLElement).closest('.nb-tb-add');
    if (tbAdd) {
      const itemsContainer = tbAdd.closest('.nb-task-block')?.querySelector('.nb-tb-items') as HTMLElement | null;
      if (itemsContainer) {
        const newId = nanoid();
        const tmp = document.createElement('div');
        tmp.innerHTML = createTaskItemHtml(newId);
        const newItem = tmp.firstChild as HTMLElement | null;
        if (newItem) { itemsContainer.appendChild(newItem); (newItem.querySelector('.nb-tb-txt') as HTMLElement | null)?.focus(); }
      }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(c, tasks, isFavorite, isImportant); return;
    }
    const tbDel = (e.target as HTMLElement).closest('.nb-tb-del');
    if (tbDel) {
      const item = tbDel.closest('.nb-tb-item') as HTMLElement | null;
      if (item) { const items = item.closest('.nb-task-block')?.querySelector('.nb-tb-items'); if (items && items.children.length > 1) item.remove(); }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(c, tasks, isFavorite, isImportant); return;
    }
    const tbRemoveBlock = (e.target as HTMLElement).closest('.nb-tb-remove-block');
    if (tbRemoveBlock) {
      const block = tbRemoveBlock.closest('.nb-task-block') as HTMLElement | null;
      if (block) {
        const next = block.nextSibling;
        block.remove();
        if (next && next.nodeName === 'BR') next.parentNode?.removeChild(next);
      }
      const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(c, tasks, isFavorite, isImportant); return;
    }
    const pre = (e.target as HTMLElement).closest('pre[data-nb-code]') as HTMLElement | null;
    if (pre) {
      const rect = pre.getBoundingClientRect();
      if (e.clientX - rect.left > rect.width - 44 && e.clientY - rect.top < 44) {
        navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '');
        pre.classList.add('nb-code-copied');
        setTimeout(() => pre.classList.remove('nb-code-copied'), 1500);
      } else {
        const codeEl = pre.querySelector('code');
        if (codeEl && codeEl.textContent?.trim() === 'Kód…') {
          codeEl.textContent = '';
          const range = document.createRange();
          range.setStart(codeEl, 0);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(range); }
          const c = editorRef.current?.innerHTML ?? '';
          setContent(c);
          triggerSave(c, tasks, isFavorite, isImportant);
        }
      }
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
        <button onClick={() => {
          localStorage.setItem('trackino_calendar_view', 'list');
          localStorage.setItem('trackino_cal_open_note_ref', note.event_ref);
          router.push('/calendar');
        }} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
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
        <button onMouseDown={e => {
          e.preventDefault();
          document.execCommand('insertHTML', false, '<pre data-nb-code="1" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:6px;padding:10px 36px 10px 12px;overflow-x:auto;position:relative;font-family:monospace;font-size:12px;color:var(--text-primary);margin:4px 0;min-height:5em"><code>Kód…</code></pre><br>');
          editorRef.current?.focus();
        }} style={btnStyle} title="Kódový blok"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
        </button>
        <button onMouseDown={e => {
          e.preventDefault();
          const html = createTaskBlockHtml();
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const node = sel.getRangeAt(0).startContainer;
            const inBlock = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element)?.closest?.('.nb-task-block') as HTMLElement | null;
            if (inBlock) {
              const tmp = document.createElement('div'); tmp.innerHTML = html;
              inBlock.after(...Array.from(tmp.childNodes));
            } else { editorRef.current?.focus(); document.execCommand('insertHTML', false, html); }
          } else { editorRef.current?.focus(); document.execCommand('insertHTML', false, html); }
          const c = editorRef.current?.innerHTML ?? ''; setContent(c); triggerSave(c, tasks, isFavorite, isImportant);
        }} style={btnStyle} title="Blok úkolů"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
            <polyline points="6 9 7 10 8 9"/>
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
          className="px-4 md:px-6 py-2 min-h-[120px] outline-none text-sm leading-relaxed nb-editor"
          style={{ color: 'var(--text-primary)' }} data-placeholder="Obsah poznámky…" />
        {tasks.length > 0 && (
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
        )}
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
    // Poznámka: trackino_ics_event_cache.uid = celý ev.id (= event_ref),
    // nikoli originální ICS UID. Stačí přímý lookup uid IN (event_refs).
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

// ─── Styles for contenteditable placeholder + code block copy button ──────────
const editorStyles = `
  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    pointer-events: none;
  }
  pre[data-nb-code] {
    position: relative;
    cursor: text;
  }
  pre[data-nb-code]::after {
    content: '';
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    opacity: 0.35;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 14px;
    border-radius: 4px;
    transition: opacity 0.15s;
  }
  pre[data-nb-code]:hover::after {
    opacity: 0.7;
  }
  pre[data-nb-code].nb-code-copied::after {
    opacity: 1 !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
  }
  .nb-tb-del { opacity: 0; transition: opacity 0.1s; }
  .nb-task-block .nb-tb-item:hover .nb-tb-del { opacity: 0.5; }
  .nb-task-block .nb-tb-item:hover .nb-tb-del:hover { opacity: 1; }
  .nb-tb-remove-block { opacity: 0; transition: opacity 0.15s; }
  .nb-task-block:hover .nb-tb-remove-block { opacity: 0.5; }
  .nb-task-block:hover .nb-tb-remove-block:hover { opacity: 1; }
  .nb-tb-txt:empty::before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; }
  .nb-tb-add { color: var(--text-muted); }
  .nb-tb-add:hover { color: var(--text-secondary); }
  .nb-editor ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
  .nb-editor ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
  .nb-editor li { margin: 0.1em 0; }
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
