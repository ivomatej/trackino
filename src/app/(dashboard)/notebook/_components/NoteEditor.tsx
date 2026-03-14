'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, NoteFolder, TaskItem } from './types';
import { nanoid, fmtDate, linkifyHtml, htmlToPlainText, buildFolderFlat, buildFolderBreadcrumb, createTaskItemHtml, createTaskBlockHtml } from './utils';

export function NoteEditor({
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
  const [moveMenuPos, setMoveMenuPos] = useState<{ top?: number; bottom?: number; right?: number } | null>(null);
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
            <button onClick={(e) => {
                if (showMoveMenu) { setShowMoveMenu(false); return; }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const openUpward = spaceBelow < 250;
                setMoveMenuPos({
                  top: openUpward ? undefined : rect.bottom + 4,
                  bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
                  right: window.innerWidth - rect.right,
                });
                setShowMoveMenu(true);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }} title="Přesunout do složky"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            {showMoveMenu && moveMenuPos && (
              <div className="fixed z-[9999] w-48 rounded-xl border shadow-lg py-1 overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', top: moveMenuPos.top, bottom: moveMenuPos.bottom, right: moveMenuPos.right }}>
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
