'use client';
// ─── Calendar Module – NotePanel ──────────────────────────────────────────────
// Přesunuto z page.tsx (ř. 558–941)

import { useRef, useState, useEffect } from 'react';
import type { EventNote, TaskItem } from '../types';
import { linkifyHtml, stripHtmlToText } from '../utils';

export default function NotePanel({
  eventRef,
  note,
  onSave,
  onDelete,
}: {
  eventRef: string;
  note: EventNote;
  onSave: (eventRef: string, content: string, tasks: TaskItem[], meta: { is_important: boolean; is_done: boolean; is_favorite: boolean }) => void;
  onDelete: (eventRef: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [localTasks, setLocalTasks] = useState<TaskItem[]>(note.tasks);
  const [isEmpty, setIsEmpty] = useState(!note.content);
  const [isDirty, setIsDirty] = useState(false);
  const savedContentRef = useRef(note.content);
  const savedTasksRef = useRef<TaskItem[]>(note.tasks);
  const taskInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [focusLastTask, setFocusLastTask] = useState(false);
  const [copied, setCopied] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref na aktuální tasks aby triggerAutoSave měl přístup k čerstvé hodnotě
  const localTasksRef = useRef<TaskItem[]>(note.tasks);

  // Meta flagy (local state + ref pro closure)
  const [isImportant, setIsImportant] = useState(note.is_important ?? false);
  const [isDone, setIsDone] = useState(note.is_done ?? false);
  const [isFavorite, setIsFavorite] = useState(note.is_favorite ?? false);
  const metaRef = useRef({ is_important: note.is_important ?? false, is_done: note.is_done ?? false, is_favorite: note.is_favorite ?? false });

  // Set initial HTML content on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = savedContentRef.current;
      setIsEmpty(!savedContentRef.current || savedContentRef.current === '<br>');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus nového úkolu po přidání přes Enter
  useEffect(() => {
    if (focusLastTask && localTasks.length > 0) {
      const lastTask = localTasks[localTasks.length - 1];
      taskInputRefs.current.get(lastTask.id)?.focus();
      setFocusLastTask(false);
    }
  }, [focusLastTask, localTasks]);

  function execFmt(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
  }

  function triggerAutoSave(tasksOverride?: TaskItem[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsDirty(true);
    saveTimerRef.current = setTimeout(() => {
      const html = editorRef.current?.innerHTML ?? '';
      const empty = !html || html === '<br>';
      const content = empty ? '' : html;
      const currentTasks = tasksOverride ?? localTasksRef.current;
      savedContentRef.current = content;
      savedTasksRef.current = currentTasks;
      onSave(eventRef, content, currentTasks, metaRef.current);
      setIsDirty(false);
    }, 1000);
  }

  function handleInput() {
    const html = editorRef.current?.innerHTML ?? '';
    const empty = !html || html === '<br>';
    setIsEmpty(empty);
    triggerAutoSave();
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Přeskočit pokud focus zůstává uvnitř panelu (např. v nb-tb-txt task bloku)
    if (e.relatedTarget && editorRef.current?.contains(e.relatedTarget as Node)) return;
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const linked = linkifyHtml(html);
    if (linked !== html) {
      editorRef.current.innerHTML = linked;
      setIsEmpty(!linked || linked === '<br>');
    }
    // Okamžitě uložit při opuštění editoru
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const content = !linked || linked === '<br>' ? '' : linked;
    savedContentRef.current = content;
    savedTasksRef.current = localTasksRef.current;
    onSave(eventRef, content, localTasksRef.current, metaRef.current);
    setIsDirty(false);
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  function save() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const html = editorRef.current?.innerHTML ?? '';
    const empty = !html || html === '<br>';
    const content = empty ? '' : html;
    savedContentRef.current = content;
    savedTasksRef.current = localTasksRef.current;
    onSave(eventRef, content, localTasksRef.current, metaRef.current);
    setIsDirty(false);
  }

  function cancel() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (editorRef.current) {
      editorRef.current.innerHTML = savedContentRef.current;
      setIsEmpty(!savedContentRef.current || savedContentRef.current === '<br>');
    }
    localTasksRef.current = savedTasksRef.current;
    setLocalTasks(savedTasksRef.current);
    setIsDirty(false);
  }

  function saveMetaImmediate(meta: { is_important: boolean; is_done: boolean; is_favorite: boolean }) {
    const html = editorRef.current?.innerHTML ?? '';
    const empty = !html || html === '<br>';
    onSave(eventRef, empty ? '' : html, localTasks, meta);
  }

  function toggleImportant() {
    const next = !isImportant;
    setIsImportant(next);
    if (next) setIsFavorite(false);
    const meta = { is_important: next, is_done: isDone, is_favorite: next ? false : isFavorite };
    metaRef.current = meta;
    saveMetaImmediate(meta);
  }

  function toggleDone() {
    const next = !isDone;
    setIsDone(next);
    const meta = { is_important: isImportant, is_done: next, is_favorite: isFavorite };
    metaRef.current = meta;
    saveMetaImmediate(meta);
  }

  function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    if (next) setIsImportant(false);
    const meta = { is_important: next ? false : isImportant, is_done: isDone, is_favorite: next };
    metaRef.current = meta;
    saveMetaImmediate(meta);
  }

  function copyContent() {
    const html = editorRef.current?.innerHTML ?? '';
    const text = stripHtmlToText(html).trim();
    const taskLines = localTasks.map(t => `${t.checked ? '✓' : '•'} ${t.text}`).join('\n');
    const combined = [text, taskLines].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(combined.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  function toggleTask(id: string) {
    const next = localTasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t);
    localTasksRef.current = next;
    setLocalTasks(next);
    triggerAutoSave(next);
  }

  function updateTaskText(id: string, text: string) {
    const next = localTasks.map(t => t.id === id ? { ...t, text } : t);
    localTasksRef.current = next;
    setLocalTasks(next);
    triggerAutoSave(next);
  }

  function addTask() {
    const next = [...localTasks, { id: crypto.randomUUID(), text: '', checked: false }];
    localTasksRef.current = next;
    setLocalTasks(next);
    setFocusLastTask(true);
    triggerAutoSave(next);
  }

  function removeTask(id: string) {
    const next = localTasks.filter(t => t.id !== id);
    localTasksRef.current = next;
    setLocalTasks(next);
    triggerAutoSave(next);
  }

  const btnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 4, color: 'var(--text-secondary)',
    background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
  } as React.CSSProperties;

  // Barva okraje a pozadí dle meta flagů
  const borderColor = isImportant ? '#ef4444' : isFavorite ? '#f59e0b' : 'var(--border)';
  const bgColor = isImportant ? '#fff1f1' : isFavorite ? '#fffbeb' : 'var(--bg-sidebar)';

  return (
    <div
      className="flex-1 min-w-0 rounded-lg border flex flex-col gap-1.5 p-2.5"
      style={{ borderColor, background: bgColor, opacity: isDone ? 0.28 : 1, transition: 'border-color 0.15s, background 0.15s' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Řádek: Toolbar vlevo + Meta tagy vpravo */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Toolbar – formátování + kopírovat + koš */}
        <div className="flex items-center gap-0.5">
          {(['bold', 'italic', 'underline'] as const).map((cmd, idx) => (
            <button
              key={cmd}
              onMouseDown={e => { e.preventDefault(); execFmt(cmd); }}
              style={{ ...btnStyle, fontWeight: idx === 0 ? 700 : undefined, fontStyle: idx === 1 ? 'italic' : undefined, textDecoration: idx === 2 ? 'underline' : undefined, fontSize: 11 }}
              title={['Tučné', 'Kurzíva', 'Podtržené'][idx]}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {['B', 'I', 'U'][idx]}
            </button>
          ))}
          <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button onMouseDown={e => { e.preventDefault(); execFmt('insertUnorderedList'); }} style={btnStyle} title="Odrážkový seznam" onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
              <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          <button onMouseDown={e => { e.preventDefault(); execFmt('insertOrderedList'); }} style={btnStyle} title="Číselný seznam" onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
              <path d="M4 6h1v4" strokeLinecap="round"/><path d="M4 10h2" strokeLinecap="round"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeLinecap="round"/>
            </svg>
          </button>
          <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button onMouseDown={e => { e.preventDefault(); copyContent(); }} style={{ ...btnStyle, color: copied ? '#22c55e' : 'var(--text-secondary)' }} title={copied ? 'Zkopírováno!' : 'Kopírovat obsah'} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {copied ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); if (confirm('Smazat celou poznámku?')) onDelete(eventRef); }}
            style={{ ...btnStyle, color: 'var(--text-muted)' }}
            title="Smazat poznámku"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
        {/* Meta tagy – Důležitá / Oblíbená / Hotovo */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onMouseDown={e => { e.preventDefault(); toggleImportant(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
            style={{
              background: isImportant ? '#fee2e2' : 'transparent',
              color: isImportant ? '#dc2626' : 'var(--text-muted)',
              borderColor: isImportant ? '#fca5a5' : 'var(--border)',
            }}
            title={isImportant ? 'Zrušit důležitou' : 'Označit jako důležitou'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill={isImportant ? '#dc2626' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            Důležitá
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); toggleFavorite(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
            style={{
              background: isFavorite ? '#fef3c7' : 'transparent',
              color: isFavorite ? '#d97706' : 'var(--text-muted)',
              borderColor: isFavorite ? '#fcd34d' : 'var(--border)',
            }}
            title={isFavorite ? 'Zrušit oblíbenou' : 'Přidat do oblíbených'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill={isFavorite ? '#d97706' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Oblíbená
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); toggleDone(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
            style={{
              background: isDone ? 'var(--bg-hover)' : 'transparent',
              color: 'var(--text-muted)',
              borderColor: 'var(--border)',
              opacity: isDone ? 0.7 : 1,
            }}
            title={isDone ? 'Znovu otevřít' : 'Označit jako hotovou'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isDone ? 3 : 2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Hotovo
          </button>
        </div>
      </div>

      {/* Contenteditable editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleBlur}
          onClick={handleEditorClick}
          className="text-xs outline-none min-h-[40px] leading-relaxed pl-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_a]:cursor-pointer"
          style={{ color: 'var(--text-primary)', caretColor: 'var(--primary)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.7 : 1 }}
        />
        {isEmpty && (
          <div className="absolute top-0 left-3 text-xs pointer-events-none select-none" style={{ color: 'var(--text-muted)' }}>
            Poznámky k události…
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="border-t pt-1.5 space-y-1 pl-2" style={{ borderColor: 'var(--border)' }}>
        {localTasks.map(task => (
          <div key={task.id} className="flex items-center gap-1.5 group/task">
            <input
              type="checkbox"
              checked={task.checked}
              onChange={() => toggleTask(task.id)}
              className="w-3 h-3 flex-shrink-0 cursor-pointer"
              style={{ accentColor: '#9ca3af' }}
            />
            <input
              ref={el => { if (el) taskInputRefs.current.set(task.id, el); else taskInputRefs.current.delete(task.id); }}
              type="text"
              value={task.text}
              onChange={e => updateTaskText(task.id, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addTask(); }
                if (e.key === 'Backspace' && task.text === '') { e.preventDefault(); removeTask(task.id); }
              }}
              className="flex-1 text-xs bg-transparent outline-none min-w-0"
              style={{
                color: task.checked ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: task.checked ? 'line-through' : 'none',
              }}
              placeholder="Úkol…"
            />
            <button
              onClick={() => removeTask(task.id)}
              className="opacity-0 group-hover/task:opacity-60 hover:!opacity-100 flex-shrink-0 transition-opacity"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={addTask}
          className="flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 0' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Přidat úkol
        </button>
      </div>

      {/* Uložit / Zrušit – zobrazí se jen když jsou neuložené změny */}
      {isDirty && (
        <div className="flex items-center justify-end gap-2 border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={cancel}
            className="px-3 py-1 rounded text-xs border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Zrušit
          </button>
          <button
            onClick={save}
            className="px-3 py-1 rounded text-xs font-medium text-white transition-opacity"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Uložit
          </button>
        </div>
      )}
    </div>
  );
}
