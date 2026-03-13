import type { TaskItem, NoteFolder } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_DEPTH = 5;

// ─── String helpers ───────────────────────────────────────────────────────────
export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function htmlToPlainText(html: string, tasks?: TaskItem[]): string {
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

export function linkifyHtml(html: string): string {
  return html.replace(/(?<!["'>])(https?:\/\/[^\s<>"'\]]+)/g, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">${url}</a>`
  );
}

// ─── Inline task blok helpers ─────────────────────────────────────────────────
export function createTaskItemHtml(id: string): string {
  return `<div class="nb-tb-item" data-checked="false" data-tb-taskid="${id}" style="display:flex;align-items:center;gap:6px;padding:2px 0"><span class="nb-tb-chk" style="flex-shrink:0;cursor:pointer;font-size:14px;user-select:none;width:16px;line-height:1;text-align:center">☐</span><span class="nb-tb-txt" contenteditable="true" data-placeholder="Úkol…" style="flex:1;outline:none;font-size:13px;min-width:0;color:var(--text-primary);line-height:1.5"></span><span class="nb-tb-del" style="cursor:pointer;font-size:14px;color:var(--text-muted);user-select:none;padding:0 4px">×</span></div>`;
}

export function createTaskBlockHtml(): string {
  const blockId = nanoid();
  const itemId = nanoid();
  return `<div class="nb-task-block" contenteditable="false" data-nb-tb="${blockId}" style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:6px 0;background:var(--bg-hover);display:block;position:relative"><span class="nb-tb-remove-block" style="position:absolute;top:5px;right:8px;cursor:pointer;font-size:14px;line-height:1;color:var(--text-muted);user-select:none;padding:2px 4px;border-radius:4px" title="Smazat blok">×</span><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px;user-select:none">Úkoly</div><div class="nb-tb-items">${createTaskItemHtml(itemId)}</div><div class="nb-tb-add" style="font-size:11px;cursor:pointer;padding:3px 0;margin-top:4px;user-select:none">+ Přidat úkol</div></div><br>`;
}

// ─── Date / time helpers ───────────────────────────────────────────────────────
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtEventDate(date: string) {
  const d = new Date(date + 'T00:00:00');
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export function fmtEventTime(startTime: string | null, endTime: string | null) {
  if (!startTime) return '';
  const s = startTime.slice(0, 5);
  return endTime ? `${s}–${endTime.slice(0, 5)}` : s;
}

// ─── Other helpers ────────────────────────────────────────────────────────────
export function getDuplicateTitle(title: string, existingTitles: string[]) {
  const base = title.replace(/ - kopie( \d+)?$/, '');
  if (!existingTitles.includes(base + ' - kopie')) return base + ' - kopie';
  let n = 2;
  while (existingTitles.includes(`${base} - kopie ${n}`)) n++;
  return `${base} - kopie ${n}`;
}

export function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Folder utilities ──────────────────────────────────────────────────────────
export function getDescendantFolderIds(folderId: string, allFolders: NoteFolder[]): string[] {
  const result: string[] = [folderId];
  const children = allFolders.filter(f => f.parent_id === folderId);
  for (const child of children) {
    result.push(...getDescendantFolderIds(child.id, allFolders));
  }
  return result;
}

export function buildFolderBreadcrumb(folderId: string | null, allFolders: NoteFolder[]): NoteFolder[] {
  if (!folderId) return [];
  const folder = allFolders.find(f => f.id === folderId);
  if (!folder) return [];
  return [...buildFolderBreadcrumb(folder.parent_id, allFolders), folder];
}

export function buildFolderFlat(
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

// ─── CSS Styles ───────────────────────────────────────────────────────────────
export const editorStyles = `
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
