'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import type { KbFolder, KbPage, KbVersion, KbComment, KbReview, KbAccess, KbPageStatus } from '@/types/database';

// ── Local types ──────────────────────────────────────────────────────────────

type PageTab = 'comments' | 'history' | 'reviews' | 'access';
interface KbMember { user_id: string; display_name: string; avatar_color: string; }

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<KbPageStatus, { label: string; color: string }> = {
  draft:    { label: 'Koncept',  color: '#f59e0b' },
  active:   { label: 'Aktivní', color: '#22c55e' },
  archived: { label: 'Archiv',  color: '#6b7280' },
};

const TEMPLATES = [
  {
    id: 'blank', title: 'Prázdná stránka', description: 'Začít od nuly',
    content: '',
  },
  {
    id: 'meeting', title: 'Zápis z meetingu', description: 'Šablona pro zápis z porad',
    content: '<h2>Zápis z meetingu</h2><p><strong>Datum:</strong> </p><p><strong>Účastníci:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Program</h3><ul><li>Bod 1</li><li>Bod 2</li></ul><h3>Závěry a úkoly</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Úkol 1</li><li class="kb-check-unchecked">Úkol 2</li></ul><h3>Příští kroky</h3><p><br></p>',
  },
  {
    id: 'process', title: 'Popis procesu', description: 'Interní postup / návod',
    content: '<h2>Popis procesu</h2><p><strong>Zodpovědná osoba:</strong> </p><p><strong>Frekvence:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Popis</h3><p>Stručný popis procesu...</p><h3>Kroky</h3><ol><li>Krok 1</li><li>Krok 2</li><li>Krok 3</li></ol><h3>Poznámky</h3><div class="kb-callout" style="background:var(--bg-hover);border-left:4px solid var(--primary);padding:12px 16px;border-radius:8px;margin:8px 0">ℹ Důležité informace k procesu</div>',
  },
  {
    id: 'onboarding', title: 'Onboarding průvodce', description: 'Checklist pro nové zaměstnance',
    content: '<h2>Onboarding průvodce</h2><p>Vítejte v týmu! Tento průvodce vám pomůže v prvních dnech.</p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>První den</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Nastavit pracovní e-mail</li><li class="kb-check-unchecked">Představit se týmu</li><li class="kb-check-unchecked">Projít firemní pravidla</li></ul><h3>První týden</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Absolvovat úvodní školení</li><li class="kb-check-unchecked">Nastavit přístupy do systémů</li></ul>',
  },
  {
    id: 'project', title: 'Dokumentace projektu', description: 'Cíle a architektura projektu',
    content: '<h2>Dokumentace projektu</h2><p><strong>Vlastník projektu:</strong> </p><p><strong>Termín:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Cíl projektu</h3><p>Popis cíle...</p><h3>Rozsah</h3><ul><li>V rozsahu: </li><li>Mimo rozsah: </li></ul><h3>Technické detaily</h3><pre style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;margin:8px 0;border:1px solid var(--border)"><code>...</code></pre><h3>Rizika</h3><div class="kb-callout" style="background:var(--bg-hover);border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;margin:8px 0">⚠ Identifikovaná rizika</div>',
  },
];

const MAX_FOLDER_DEPTH = 6;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDepth(folder: KbFolder, all: KbFolder[]): number {
  let d = 0; let cur: KbFolder | undefined = folder;
  while (cur?.parent_id) { cur = all.find(f => f.id === cur!.parent_id); d++; }
  return d;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Rich Editor ───────────────────────────────────────────────────────────────

function RichEditor({ value, onChange, members, pages }: {
  value: string; onChange: (v: string) => void; members: KbMember[]; pages: KbPage[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cmd = (command: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const ins = (html: string) => {
    ref.current?.focus();
    document.execCommand('insertHTML', false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertLink = () => {
    if (!linkUrl) { setShowLinkModal(false); return; }
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    ins(`<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline">${linkText || url}</a>`);
    setShowLinkModal(false); setLinkUrl(''); setLinkText('');
  };

  const insertMention = (m: KbMember) => {
    ins(`<span class="kb-mention" data-user-id="${m.user_id}" style="color:var(--primary);font-weight:600;background:color-mix(in srgb,var(--primary) 12%,transparent);padding:1px 4px;border-radius:4px">@${m.display_name}</span>\u00a0`);
    setShowMentionPicker(false); setPickerSearch('');
  };

  const insertPageLink = (p: KbPage) => {
    ins(`<a class="kb-page-link" data-page-id="${p.id}" href="#" style="color:var(--primary);text-decoration:underline">📄 ${p.title}</a>`);
    setShowPagePicker(false); setPickerSearch('');
  };

  const filteredMembers = members.filter(m => m.display_name.toLowerCase().includes(pickerSearch.toLowerCase()));
  const filteredPages = pages.filter(p => p.title.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 15);

  const TBtn = ({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) => (
    <button type="button" title={title} onClick={onClick}
      className="px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-active)]"
      style={{ color: active ? 'var(--primary)' : 'var(--text-secondary)', background: active ? 'color-mix(in srgb,var(--primary) 10%,transparent)' : 'transparent' }}>
      {children}
    </button>
  );

  const Sep = () => <span className="w-px mx-0.5 self-stretch" style={{ background: 'var(--border)' }} />;

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
        <TBtn onClick={() => cmd('formatBlock', 'h1')} title="Nadpis 1">H1</TBtn>
        <TBtn onClick={() => cmd('formatBlock', 'h2')} title="Nadpis 2">H2</TBtn>
        <TBtn onClick={() => cmd('formatBlock', 'h3')} title="Nadpis 3">H3</TBtn>
        <Sep />
        <TBtn onClick={() => cmd('bold')} title="Tučné"><strong>B</strong></TBtn>
        <TBtn onClick={() => cmd('italic')} title="Kurzíva"><em>I</em></TBtn>
        <TBtn onClick={() => cmd('underline')} title="Podtržení"><u>U</u></TBtn>
        <Sep />
        <TBtn onClick={() => cmd('insertUnorderedList')} title="Odrážkový seznam">• Seznam</TBtn>
        <TBtn onClick={() => cmd('insertOrderedList')} title="Číslovaný seznam">1. Seznam</TBtn>
        <Sep />
        <TBtn onClick={() => ins('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><p><br></p>')} title="Oddělovač">─</TBtn>
        <TBtn onClick={() => ins('<ul class="kb-checklist"><li class="kb-check-unchecked">Položka</li></ul><p><br></p>')} title="Checklist">☐ Check</TBtn>
        <TBtn onClick={() => ins('<div class="kb-callout" style="background:var(--bg-hover);border-left:4px solid var(--primary);padding:12px 16px;border-radius:8px;margin:8px 0">ℹ Poznámka...</div><p><br></p>')} title="Callout / info box">ℹ Callout</TBtn>
        <TBtn onClick={() => ins('<details class="kb-toggle" style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0"><summary style="cursor:pointer;font-weight:600;user-select:none">Klikněte pro zobrazení</summary><p>Obsah...</p></details><p><br></p>')} title="Toggle blok">▶ Toggle</TBtn>
        <Sep />
        <TBtn onClick={() => {
          const sel = window.getSelection();
          const selected = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).toString() : '';
          ins(`<pre style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border)"><code>${selected || ''}</code></pre><p><br></p>`);
        }} title="Blok kódu">&lt;/&gt; Kód</TBtn>
        {/* Odkaz */}
        <div className="relative">
          <TBtn onClick={() => { setShowLinkModal(v => !v); setShowMentionPicker(false); setShowPagePicker(false); }} title="Vložit odkaz" active={showLinkModal}>🔗 Odkaz</TBtn>
          {showLinkModal && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg p-3 min-w-[260px]" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <input value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Text odkazu (volitelné)"
                className="w-full px-3 py-1.5 rounded border text-sm mb-2 text-base sm:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="URL (https://...)"
                className="w-full px-3 py-1.5 rounded border text-sm mb-2 text-base sm:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <div className="flex gap-2">
                <button type="button" onClick={insertLink} className="flex-1 py-1.5 rounded text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Vložit</button>
                <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 py-1.5 rounded text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>Zrušit</button>
              </div>
            </div>
          )}
        </div>
        <Sep />
        {/* @mention */}
        <div className="relative">
          <TBtn onClick={() => { setShowMentionPicker(v => !v); setShowPagePicker(false); setShowLinkModal(false); setPickerSearch(''); }} title="Zmínit uživatele" active={showMentionPicker}>@</TBtn>
          {showMentionPicker && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg min-w-[200px] max-h-[220px] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Hledat..." autoFocus
                  className="w-full px-2 py-1 rounded text-sm text-base sm:text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
              </div>
              {filteredMembers.map(m => (
                <button key={m.user_id} type="button" onClick={() => insertMention(m)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-primary)' }}>
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: m.avatar_color }}>{getInitials(m.display_name)}</div>
                  {m.display_name}
                </button>
              ))}
              {filteredMembers.length === 0 && <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Žádní uživatelé</p>}
            </div>
          )}
        </div>
        {/* /page link */}
        <div className="relative">
          <TBtn onClick={() => { setShowPagePicker(v => !v); setShowMentionPicker(false); setShowLinkModal(false); setPickerSearch(''); }} title="Odkaz na stránku" active={showPagePicker}>📄 Stránka</TBtn>
          {showPagePicker && (
            <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg min-w-[220px] max-h-[220px] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Hledat stránku..." autoFocus
                  className="w-full px-2 py-1 rounded text-sm text-base sm:text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
              </div>
              {filteredPages.map(p => (
                <button key={p.id} type="button" onClick={() => insertPageLink(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-primary)' }}>
                  <span className="text-base">📄</span>
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
              {filteredPages.length === 0 && <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Žádné stránky</p>}
            </div>
          )}
        </div>
      </div>
      {/* Editable area */}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onClick={e => {
          const preEl = (e.target as Element).closest('pre');
          if (preEl) {
            const rect = preEl.getBoundingClientRect();
            if (e.clientX > rect.right - 36 && e.clientY < rect.top + 32) {
              navigator.clipboard.writeText(preEl.querySelector('code')?.textContent ?? '').catch(() => {});
            }
          }
        }}
        className="min-h-[280px] p-4 focus:outline-none prose-kb"
        style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}
      />
      <style>{`
        .prose-kb h1{font-size:1.6em;font-weight:800;margin:16px 0 8px;line-height:1.2}
        .prose-kb h2{font-size:1.25em;font-weight:700;margin:14px 0 6px}
        .prose-kb h3{font-size:1.05em;font-weight:600;margin:10px 0 4px}
        .prose-kb ul{list-style:disc;padding-left:20px;margin:4px 0}
        .prose-kb ol{list-style:decimal;padding-left:20px;margin:4px 0}
        .prose-kb p{margin:4px 0;line-height:1.6}
        .prose-kb pre{position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border)}
        .prose-kb pre::after{content:"";position:absolute;top:8px;right:8px;width:20px;height:20px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0.5;transition:opacity 0.15s}
        .prose-kb pre:hover::after{opacity:1}
        .prose-kb .kb-checklist{list-style:none;padding-left:2px}
        .prose-kb .kb-check-unchecked::before{content:"☐";margin-right:6px;font-size:1em}
        .prose-kb .kb-check-checked::before{content:"☑";margin-right:6px;font-size:1em;color:var(--primary)}
        .prose-kb .kb-check-checked{opacity:0.55;text-decoration:line-through}
      `}</style>
    </div>
  );
}

// ── Page Viewer (view mode HTML renderer) ─────────────────────────────────────

function PageViewer({ page, onChecklistToggle, onPageLinkClick }: {
  page: KbPage; onChecklistToggle: (html: string) => void; onPageLinkClick: (id: string) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Checklist item toggle
    const li = target.closest('li.kb-check-unchecked,li.kb-check-checked') as HTMLLIElement | null;
    if (li) {
      e.preventDefault();
      const container = document.createElement('div');
      container.innerHTML = page.content;
      const allItems = Array.from(container.querySelectorAll('li.kb-check-unchecked,li.kb-check-checked'));
      const viewItems = Array.from((e.currentTarget as HTMLElement).querySelectorAll('li.kb-check-unchecked,li.kb-check-checked'));
      const idx = viewItems.indexOf(li);
      if (idx >= 0 && allItems[idx]) {
        const item = allItems[idx];
        if (item.classList.contains('kb-check-unchecked')) {
          item.classList.replace('kb-check-unchecked', 'kb-check-checked');
        } else {
          item.classList.replace('kb-check-checked', 'kb-check-unchecked');
        }
        onChecklistToggle(container.innerHTML);
      }
      return;
    }
    // Page link
    const pl = target.closest('a.kb-page-link') as HTMLAnchorElement | null;
    if (pl) { e.preventDefault(); const pid = pl.getAttribute('data-page-id'); if (pid) onPageLinkClick(pid); return; }
    // External link
    const ext = target.closest('a:not(.kb-page-link)') as HTMLAnchorElement | null;
    if (ext) { e.preventDefault(); const h = ext.getAttribute('href'); if (h && h !== '#') window.open(h, '_blank', 'noopener,noreferrer'); return; }
    // Code copy
    const pre = target.closest('pre');
    if (pre) {
      const rect = pre.getBoundingClientRect();
      if (e.clientX > rect.right - 36 && e.clientY < rect.top + 32) {
        navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? '').catch(() => {});
      }
    }
  };

  return (
    <>
      <div className="prose-kb prose-view" dangerouslySetInnerHTML={{ __html: page.content }} onClick={handleClick} style={{ color: 'var(--text-primary)' }} />
      <style>{`
        .prose-view h1{font-size:1.6em;font-weight:800;margin:16px 0 8px;line-height:1.2}
        .prose-view h2{font-size:1.25em;font-weight:700;margin:14px 0 6px}
        .prose-view h3{font-size:1.05em;font-weight:600;margin:10px 0 4px}
        .prose-view ul{list-style:disc;padding-left:20px;margin:4px 0}
        .prose-view ol{list-style:decimal;padding-left:20px;margin:4px 0}
        .prose-view p{margin:4px 0;line-height:1.6}
        .prose-view pre{position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border);cursor:default}
        .prose-view pre::after{content:"";position:absolute;top:8px;right:8px;width:20px;height:20px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0.5;transition:opacity 0.15s}
        .prose-view pre:hover::after{opacity:1}
        .prose-view .kb-checklist{list-style:none;padding-left:2px}
        .prose-view .kb-check-unchecked,.prose-view .kb-check-checked{cursor:pointer}
        .prose-view .kb-check-unchecked::before{content:"☐";margin-right:6px;font-size:1em}
        .prose-view .kb-check-checked::before{content:"☑";margin-right:6px;font-size:1em;color:var(--primary)}
        .prose-view .kb-check-checked{opacity:0.55;text-decoration:line-through}
        .prose-view details{border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0}
        .prose-view summary{cursor:pointer;font-weight:600;user-select:none}
        .prose-view .kb-toggle>summary{list-style:none}
        .prose-view .kb-toggle>summary::before{content:"▶ ";font-size:0.7em;opacity:0.6}
        .prose-view details[open]>summary::before{content:"▼ "}
        .prose-view hr{border:none;border-top:1px solid var(--border);margin:16px 0}
      `}</style>
    </>
  );
}

// ── Folder Tree ───────────────────────────────────────────────────────────────

function KbFolderTree({ folders, pages, selectedFolderId, selectedPageId, expanded, onSelectFolder, onSelectPage, onToggle, onAddSub, onEditFolder, onDeleteFolder, userId, depth = 0, parentId = null }: {
  folders: KbFolder[]; pages: KbPage[]; selectedFolderId: string | null; selectedPageId: string | null;
  expanded: Set<string>; onSelectFolder: (id: string) => void; onSelectPage: (id: string) => void;
  onToggle: (id: string) => void; onAddSub: (parentId: string, depth: number) => void;
  onEditFolder: (f: KbFolder) => void; onDeleteFolder: (f: KbFolder) => void;
  userId: string; depth?: number; parentId?: string | null;
}) {
  const children = folders.filter(f => f.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const isExp = expanded.has(folder.id);
        const isSel = selectedFolderId === folder.id;
        const fPages = pages.filter(p => p.folder_id === folder.id);
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSel ? 'var(--bg-active)' : 'transparent' }}
              onClick={() => { onSelectFolder(folder.id); onToggle(folder.id); }}>
              <button type="button" onClick={e => { e.stopPropagation(); onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  {isExp ? <path d="M2 3l3 4 3-4H2z"/> : <path d="M3 2l4 3-4 3V2z"/>}
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSel ? 600 : 400 }}>{folder.name}</span>
              <div className="opacity-0 group-hover/folder:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_FOLDER_DEPTH - 1 && (
                  <button type="button" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }} title="Přidat podsložku"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]" style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {folder.owner_id === userId && (
                  <>
                    <button type="button" onClick={e => { e.stopPropagation(); onEditFolder(folder); }} title="Přejmenovat"
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]" style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); onDeleteFolder(folder); }} title="Smazat složku"
                      className="w-5 h-5 flex items-center justify-center rounded" style={{ color: '#ef4444' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Pages in this folder */}
            {isExp && fPages.map(p => (
              <div key={p.id}
                className="flex items-center gap-1.5 py-1 rounded-lg cursor-pointer group/page transition-colors"
                style={{ paddingLeft: `${depth * 14 + 22}px`, background: selectedPageId === p.id ? 'var(--bg-active)' : 'transparent' }}
                onClick={() => onSelectPage(p.id)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="flex-1 text-xs truncate" style={{ color: selectedPageId === p.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: selectedPageId === p.id ? 500 : 400 }}>{p.title}</span>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1" style={{ background: STATUS_CONFIG[p.status].color, opacity: p.status === 'active' ? 0 : 1 }} />
              </div>
            ))}
            {/* Subfolders */}
            {isExp && (
              <KbFolderTree folders={folders} pages={pages} selectedFolderId={selectedFolderId} selectedPageId={selectedPageId}
                expanded={expanded} onSelectFolder={onSelectFolder} onSelectPage={onSelectPage} onToggle={onToggle}
                onAddSub={onAddSub} onEditFolder={onEditFolder} onDeleteFolder={onDeleteFolder}
                userId={userId} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function KnowledgeBaseContent() {
  const { user, profile } = useAuth();
  const { currentWorkspace, loading: wsLoading, hasModule } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<KbFolder[]>([]);
  const [pages, setPages] = useState<KbPage[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<KbPage | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState<KbPageStatus>('active');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editRestricted, setEditRestricted] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<KbMember[]>([]);

  const [comments, setComments] = useState<KbComment[]>([]);
  const [versions, setVersions] = useState<KbVersion[]>([]);
  const [reviews, setReviews] = useState<KbReview[]>([]);
  const [access, setAccess] = useState<KbAccess[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<PageTab>('comments');
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);

  const [leftOpen, setLeftOpen] = useState(false);

  // Folder modal
  const [folderModal, setFolderModal] = useState<{ mode: 'add' | 'edit'; parentId: string | null; depth: number; target: KbFolder | null; name: string } | null>(null);

  // Template modal
  const [templateModal, setTemplateModal] = useState<{ folderId: string | null } | null>(null);

  // Review modal
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ assigned_to: '', review_date: '', note: '' });
  const [savingReview, setSavingReview] = useState(false);

  const canAdmin = isMasterAdmin || isWorkspaceAdmin;

  // ── Guard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsLoading && !hasModule('knowledge_base')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    const wid = currentWorkspace.id;

    const [{ data: fData }, { data: pData }, { data: memData }, { data: favData }] = await Promise.all([
      supabase.from('trackino_kb_folders').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('trackino_kb_pages').select('*').eq('workspace_id', wid).order('updated_at', { ascending: false }),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wid).eq('approved', true),
      supabase.from('trackino_kb_favorites').select('page_id').eq('user_id', user.id),
    ]);

    setFolders((fData ?? []) as KbFolder[]);
    setPages((pData ?? []) as KbPage[]);
    setFavorites(new Set((favData ?? []).map((f: { page_id: string }) => f.page_id)));

    // Fetch member profiles
    const uids = ((memData ?? []) as { user_id: string }[]).map(m => m.user_id);
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from('trackino_profiles').select('id,display_name,avatar_color').in('id', uids).order('display_name');
      setMembers(((profiles ?? []) as { id: string; display_name: string; avatar_color: string }[]).map(p => ({ user_id: p.id, display_name: p.display_name, avatar_color: p.avatar_color })));
    }
  }, [currentWorkspace?.id, user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchPageDetail = useCallback(async (pageId: string) => {
    if (!currentWorkspace) return;
    const [{ data: p }, { data: c }, { data: v }, { data: r }, { data: a }] = await Promise.all([
      supabase.from('trackino_kb_pages').select('*').eq('id', pageId).single(),
      supabase.from('trackino_kb_comments').select('*').eq('page_id', pageId).order('created_at'),
      supabase.from('trackino_kb_versions').select('*').eq('page_id', pageId).order('created_at', { ascending: false }).limit(20),
      supabase.from('trackino_kb_reviews').select('*').eq('page_id', pageId).order('review_date'),
      supabase.from('trackino_kb_access').select('*').eq('page_id', pageId),
    ]);
    if (p) setSelectedPage(p as KbPage);
    setComments((c ?? []) as KbComment[]);
    setVersions((v ?? []) as KbVersion[]);
    setReviews((r ?? []) as KbReview[]);
    setAccess((a ?? []) as KbAccess[]);
  }, [currentWorkspace?.id]);

  // ── Page selection ─────────────────────────────────────────────────────────

  const selectPage = (id: string) => {
    setEditing(false);
    setSelectedPage(null);
    setComments([]); setVersions([]); setReviews([]); setAccess([]);
    setActiveTab('comments');
    fetchPageDetail(id);
  };

  // ── Can edit check ─────────────────────────────────────────────────────────

  const canEditPage = (page: KbPage) => {
    if (!user) return false;
    if (canAdmin) return true;
    if (!page.is_restricted) return true;
    return access.some(a => a.user_id === user.id && a.can_edit);
  };

  // ── Save page ──────────────────────────────────────────────────────────────

  const startEdit = (page: KbPage) => {
    setEditTitle(page.title);
    setEditContent(page.content);
    setEditStatus(page.status);
    setEditTags([...page.tags]);
    setEditRestricted(page.is_restricted);
    setEditing(true);
  };

  const savePage = async () => {
    if (!user || !currentWorkspace || !selectedPage) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = { title: editTitle.trim() || 'Bez názvu', content: editContent, status: editStatus, tags: editTags, is_restricted: editRestricted, updated_by: user.id, updated_at: now };

    if (selectedPage.id.startsWith('__new__')) {
      const { data: np } = await supabase.from('trackino_kb_pages').insert({
        workspace_id: currentWorkspace.id, folder_id: selectedPage.folder_id,
        ...payload, created_by: user.id,
      }).select().single();
      if (np) {
        // Save version
        await supabase.from('trackino_kb_versions').insert({ page_id: (np as KbPage).id, workspace_id: currentWorkspace.id, content: editContent, title: payload.title, edited_by: user.id });
        await fetchAll();
        selectPage((np as KbPage).id);
      }
    } else {
      await supabase.from('trackino_kb_pages').update(payload).eq('id', selectedPage.id);
      // Save version
      await supabase.from('trackino_kb_versions').insert({ page_id: selectedPage.id, workspace_id: currentWorkspace.id, content: editContent, title: payload.title, edited_by: user.id });
      await fetchAll();
      await fetchPageDetail(selectedPage.id);
      setEditing(false);
    }
    setSaving(false);
  };

  const cancelEdit = () => {
    if (selectedPage?.id.startsWith('__new__')) {
      setSelectedPage(null); setEditing(false);
    } else {
      setEditing(false);
    }
  };

  // ── Delete page ────────────────────────────────────────────────────────────

  const deletePage = async (id: string) => {
    if (!confirm('Smazat tuto stránku? Akce je nevratná.')) return;
    await supabase.from('trackino_kb_pages').delete().eq('id', id);
    setSelectedPage(null); setEditing(false);
    await fetchAll();
  };

  // ── New page ───────────────────────────────────────────────────────────────

  const openNewPage = (folderId: string | null) => {
    setTemplateModal({ folderId });
  };

  const createPageFromTemplate = (template: typeof TEMPLATES[0], folderId: string | null) => {
    setTemplateModal(null);
    const fake: KbPage = {
      id: '__new__', workspace_id: currentWorkspace?.id ?? '', folder_id: folderId,
      title: template.title === 'Prázdná stránka' ? 'Nová stránka' : template.title,
      content: template.content, status: 'draft', tags: [], is_restricted: false,
      created_by: user?.id ?? '', updated_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setSelectedPage(fake);
    setEditing(true);
    setEditTitle(fake.title);
    setEditContent(fake.content);
    setEditStatus('draft');
    setEditTags([]);
    setEditRestricted(false);
    setComments([]); setVersions([]); setReviews([]); setAccess([]);
  };

  // ── Checklist toggle (silent save) ────────────────────────────────────────

  const handleChecklistToggle = async (html: string) => {
    if (!selectedPage || selectedPage.id.startsWith('__new__') || !canEditPage(selectedPage)) return;
    setSelectedPage(prev => prev ? { ...prev, content: html } : prev);
    setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, content: html } : p));
    await supabase.from('trackino_kb_pages').update({ content: html, updated_by: user?.id, updated_at: new Date().toISOString() }).eq('id', selectedPage.id);
  };

  // ── Favorite toggle ───────────────────────────────────────────────────────

  const toggleFavorite = async (pageId: string) => {
    if (!user) return;
    if (favorites.has(pageId)) {
      await supabase.from('trackino_kb_favorites').delete().eq('page_id', pageId).eq('user_id', user.id);
      setFavorites(prev => { const n = new Set(prev); n.delete(pageId); return n; });
    } else {
      await supabase.from('trackino_kb_favorites').insert({ page_id: pageId, user_id: user.id });
      setFavorites(prev => new Set([...prev, pageId]));
    }
  };

  // ── Comments ──────────────────────────────────────────────────────────────

  const addComment = async () => {
    if (!user || !selectedPage || !newComment.trim() || selectedPage.id.startsWith('__new__')) return;
    setSavingComment(true);
    const { data: c } = await supabase.from('trackino_kb_comments').insert({
      page_id: selectedPage.id, workspace_id: currentWorkspace?.id, user_id: user.id, content: newComment.trim(),
    }).select().single();
    if (c) setComments(prev => [...prev, c as KbComment]);
    setNewComment('');
    setSavingComment(false);
  };

  const updateComment = async () => {
    if (!editingComment || !editingComment.content.trim()) return;
    await supabase.from('trackino_kb_comments').update({ content: editingComment.content, updated_at: new Date().toISOString() }).eq('id', editingComment.id);
    setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: editingComment.content } : c));
    setEditingComment(null);
  };

  const deleteComment = async (id: string) => {
    await supabase.from('trackino_kb_comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  // ── Version revert ────────────────────────────────────────────────────────

  const revertToVersion = async (v: KbVersion) => {
    if (!confirm('Obnovit tuto verzi? Aktuální obsah bude nahrazen.')) return;
    if (!selectedPage || !user) return;
    const now = new Date().toISOString();
    await supabase.from('trackino_kb_pages').update({ title: v.title, content: v.content, updated_by: user.id, updated_at: now }).eq('id', selectedPage.id);
    await supabase.from('trackino_kb_versions').insert({ page_id: selectedPage.id, workspace_id: currentWorkspace?.id ?? '', content: v.content, title: v.title, edited_by: user.id });
    await fetchPageDetail(selectedPage.id);
    await fetchAll();
  };

  // ── Reviews ───────────────────────────────────────────────────────────────

  const addReview = async () => {
    if (!reviewForm.assigned_to || !reviewForm.review_date || !selectedPage || !user || !currentWorkspace) return;
    setSavingReview(true);
    const { data: r } = await supabase.from('trackino_kb_reviews').insert({
      workspace_id: currentWorkspace.id, page_id: selectedPage.id.startsWith('__new__') ? null : selectedPage.id,
      assigned_to: reviewForm.assigned_to, review_date: reviewForm.review_date,
      note: reviewForm.note, created_by: user.id,
    }).select().single();
    if (r) setReviews(prev => [...prev, r as KbReview]);
    setReviewModal(false);
    setReviewForm({ assigned_to: '', review_date: '', note: '' });
    setSavingReview(false);
  };

  const toggleReviewDone = async (id: string, done: boolean) => {
    await supabase.from('trackino_kb_reviews').update({ is_done: done }).eq('id', id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_done: done } : r));
  };

  const deleteReview = async (id: string) => {
    await supabase.from('trackino_kb_reviews').delete().eq('id', id);
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  // ── Access (per-page rights) ───────────────────────────────────────────────

  const toggleUserAccess = async (userId: string, canEdit: boolean) => {
    if (!selectedPage || !currentWorkspace) return;
    const existing = access.find(a => a.user_id === userId);
    if (existing) {
      if (canEdit) {
        await supabase.from('trackino_kb_access').update({ can_edit: true }).eq('id', existing.id);
        setAccess(prev => prev.map(a => a.id === existing.id ? { ...a, can_edit: true } : a));
      } else {
        await supabase.from('trackino_kb_access').delete().eq('id', existing.id);
        setAccess(prev => prev.filter(a => a.id !== existing.id));
      }
    } else if (canEdit) {
      const { data: na } = await supabase.from('trackino_kb_access').insert({
        workspace_id: currentWorkspace.id, page_id: selectedPage.id, user_id: userId, can_edit: true,
      }).select().single();
      if (na) setAccess(prev => [...prev, na as KbAccess]);
    }
  };

  // ── Folders ───────────────────────────────────────────────────────────────

  const saveFolder = async () => {
    if (!folderModal || !folderModal.name.trim() || !user || !currentWorkspace) return;
    if (folderModal.mode === 'add') {
      const { data: f } = await supabase.from('trackino_kb_folders').insert({
        workspace_id: currentWorkspace.id, parent_id: folderModal.parentId,
        name: folderModal.name.trim(), owner_id: user.id,
      }).select().single();
      if (f) {
        setFolders(prev => [...prev, f as KbFolder].sort((a, b) => a.name.localeCompare(b.name)));
        setExpanded(prev => new Set([...prev, (f as KbFolder).id]));
      }
    } else if (folderModal.target) {
      await supabase.from('trackino_kb_folders').update({ name: folderModal.name.trim(), updated_at: new Date().toISOString() }).eq('id', folderModal.target.id);
      setFolders(prev => prev.map(f => f.id === folderModal.target!.id ? { ...f, name: folderModal.name.trim() } : f));
    }
    setFolderModal(null);
  };

  const deleteFolder = async (folder: KbFolder) => {
    if (!confirm(`Smazat složku "${folder.name}" a přesunout stránky do kořenové úrovně?`)) return;
    await supabase.from('trackino_kb_folders').delete().eq('id', folder.id);
    await fetchAll();
    if (selectedFolderId === folder.id) setSelectedFolderId(null);
  };

  // ── Tags ──────────────────────────────────────────────────────────────────

  const addTag = (val: string) => {
    const t = val.trim().replace(/,/g, '');
    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t]);
    setTagInput('');
  };

  // ── Filtered pages (search + folder) ─────────────────────────────────────

  const filteredPages = (() => {
    let p = pages;
    if (search.trim()) {
      const q = search.toLowerCase();
      p = p.filter(pg => pg.title.toLowerCase().includes(q) || pg.content.toLowerCase().includes(q) || pg.tags.some(t => t.toLowerCase().includes(q)));
    } else if (selectedFolderId) {
      p = p.filter(pg => pg.folder_id === selectedFolderId);
    } else {
      // All pages
    }
    return p;
  })();

  const memberName = (userId: string) => members.find(m => m.user_id === userId)?.display_name ?? userId.slice(0, 8);

  // ── Render ────────────────────────────────────────────────────────────────

  if (wsLoading) return <DashboardLayout><div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex h-full gap-0 -m-4 lg:-m-6" style={{ minHeight: 'calc(100vh - var(--topbar-height))' }}>

        {/* Mobile overlay */}
        {leftOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setLeftOpen(false)} />}

        {/* LEFT PANEL */}
        <aside className={`fixed lg:relative top-0 left-0 bottom-0 z-40 lg:z-auto flex flex-col border-r flex-shrink-0 transition-transform duration-200 ${leftOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          style={{ width: 260, background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Header */}
          <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>Znalostní báze</h2>
            <button type="button" onClick={() => setLeftOpen(false)} className="lg:hidden w-7 h-7 flex items-center justify-center rounded" style={{ color: 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat..." className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-base sm:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 p-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={() => openNewPage(selectedFolderId)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nová stránka
            </button>
            <button type="button" onClick={() => setFolderModal({ mode: 'add', parentId: null, depth: 0, target: null, name: '' })}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}
              title="Nová složka">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            </button>
          </div>

          {/* Folder + page tree */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* Favorites shortcut */}
            {favorites.size > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>⭐ Oblíbené</p>
                {pages.filter(p => favorites.has(p.id)).map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 py-1 rounded-lg cursor-pointer transition-colors"
                    style={{ paddingLeft: 8, background: selectedPage?.id === p.id ? 'var(--bg-active)' : 'transparent' }}
                    onClick={() => selectPage(p.id)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f59e0b', flexShrink: 0 }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span className="flex-1 text-xs truncate" style={{ color: selectedPage?.id === p.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.title}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Bez složky */}
            {!search && (
              <div
                className="flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition-colors mb-1"
                style={{ background: selectedFolderId === null && !search ? 'var(--bg-hover)' : 'transparent' }}
                onClick={() => setSelectedFolderId(null)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Všechny stránky</span>
              </div>
            )}

            {/* Folder tree */}
            {!search && (
              <KbFolderTree folders={folders} pages={pages} selectedFolderId={selectedFolderId} selectedPageId={selectedPage?.id ?? null}
                expanded={expanded}
                onSelectFolder={id => setSelectedFolderId(prev => prev === id ? null : id)}
                onSelectPage={selectPage}
                onToggle={id => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                onAddSub={(pid, d) => setFolderModal({ mode: 'add', parentId: pid, depth: d, target: null, name: '' })}
                onEditFolder={f => setFolderModal({ mode: 'edit', parentId: f.parent_id, depth: getDepth(f, folders), target: f, name: f.name })}
                onDeleteFolder={deleteFolder}
                userId={user?.id ?? ''} />
            )}

            {/* Search results / All pages list */}
            {(search || !selectedFolderId) && (
              <div className="mt-1">
                {search && <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Výsledky ({filteredPages.length})</p>}
                {filteredPages.map(p => (
                  <div key={p.id}
                    className="flex items-center gap-1.5 py-1 rounded-lg cursor-pointer transition-colors"
                    style={{ paddingLeft: 8, background: selectedPage?.id === p.id ? 'var(--bg-active)' : 'transparent' }}
                    onClick={() => selectPage(p.id)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="flex-1 text-xs truncate" style={{ color: selectedPage?.id === p.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.title}</span>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1" style={{ background: STATUS_CONFIG[p.status].color, opacity: p.status === 'active' ? 0 : 1 }} />
                  </div>
                ))}
                {filteredPages.length === 0 && search && (
                  <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Žádné výsledky</p>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center gap-2 p-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <button type="button" onClick={() => setLeftOpen(true)} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              Znalostní báze
            </button>
          </div>

          {/* No page selected – welcome */}
          {!selectedPage && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--bg-hover)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Znalostní báze</h2>
              <p className="text-sm text-center max-w-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                Vyberte stránku z levého panelu nebo vytvořte novou
              </p>
              <button type="button" onClick={() => openNewPage(null)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nová stránka
              </button>

              {/* Recent pages */}
              {pages.length > 0 && (
                <div className="mt-8 w-full max-w-lg">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Naposledy upravené</p>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {pages.slice(0, 6).map((p, i) => (
                      <div key={p.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ background: 'var(--bg-card)', borderBottom: i < Math.min(pages.length, 6) - 1 ? '1px solid var(--border)' : 'none' }}
                        onClick={() => selectPage(p.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[p.status].color }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.updated_at).toLocaleDateString('cs-CZ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page selected */}
          {selectedPage && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="flex-1 p-4 lg:p-8 max-w-4xl w-full mx-auto">

                {/* Page header */}
                <div className="flex items-start gap-3 mb-6">
                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 focus:outline-none pb-1 text-base sm:text-sm"
                        style={{ borderColor: 'var(--primary)', color: 'var(--text-primary)', fontSize: '1.6rem' }}
                        placeholder="Název stránky" />
                    ) : (
                      <h1 className="text-2xl font-bold break-words" style={{ color: 'var(--text-primary)' }}>{selectedPage.title}</h1>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Star */}
                    {!selectedPage.id.startsWith('__new__') && (
                      <button type="button" onClick={() => toggleFavorite(selectedPage.id)} title="Oblíbené" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={favorites.has(selectedPage.id) ? '#f59e0b' : 'none'} stroke={favorites.has(selectedPage.id) ? '#f59e0b' : 'currentColor'} strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    )}
                    {/* Edit / Save / Cancel */}
                    {!editing ? (
                      canEditPage(selectedPage) && !selectedPage.id.startsWith('__new__') && (
                        <button type="button" onClick={() => startEdit(selectedPage)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Upravit
                        </button>
                      )
                    ) : (
                      <>
                        <button type="button" onClick={savePage} disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                          {saving ? '...' : 'Uložit'}
                        </button>
                        <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>Zrušit</button>
                      </>
                    )}
                    {/* Delete */}
                    {canAdmin && !selectedPage.id.startsWith('__new__') && (
                      <button type="button" onClick={() => deletePage(selectedPage.id)} title="Smazat stránku"
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors" style={{ color: '#ef4444' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {/* Status */}
                  {editing ? (
                    <div className="relative">
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value as KbPageStatus)}
                        className="appearance-none pl-3 pr-8 py-1 rounded-full border text-xs font-medium text-base sm:text-sm"
                        style={{ borderColor: STATUS_CONFIG[editStatus].color, color: STATUS_CONFIG[editStatus].color, background: 'transparent' }}>
                        {(Object.keys(STATUS_CONFIG) as KbPageStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                      </select>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: STATUS_CONFIG[editStatus].color }}><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: STATUS_CONFIG[selectedPage.status].color, color: STATUS_CONFIG[selectedPage.status].color }}>
                      {STATUS_CONFIG[selectedPage.status].label}
                    </span>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(editing ? editTags : selectedPage.tags).map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                        #{tag}
                        {editing && (
                          <button type="button" onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} className="hover:opacity-70">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </span>
                    ))}
                    {editing && (
                      <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
                        onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                        placeholder="+ štítek" className="text-xs px-2 py-0.5 rounded-full border text-base sm:text-sm"
                        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: 90 }} />
                    )}
                  </div>

                  {/* Last modified */}
                  {!selectedPage.id.startsWith('__new__') && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Upraveno {fmtDate(selectedPage.updated_at)}{selectedPage.updated_by ? ` · ${memberName(selectedPage.updated_by)}` : ''}
                    </span>
                  )}
                </div>

                {/* Restricted access toggle (admin only, edit mode) */}
                {editing && canAdmin && (
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <button type="button" onClick={() => setEditRestricted(v => !v)}
                      className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                      style={{ background: editRestricted ? 'var(--primary)' : 'var(--border)' }}>
                      <span className="absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-transform" style={{ transform: editRestricted ? 'translateX(18px)' : 'translateX(2px)' }} />
                    </button>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Omezený přístup</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {editRestricted ? 'Stránku mohou upravovat jen správci a přidaní uživatelé' : 'Stránku může upravovat kdokoliv'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="mb-8">
                  {editing ? (
                    <RichEditor value={editContent} onChange={setEditContent} members={members} pages={pages} />
                  ) : (
                    selectedPage.content
                      ? <PageViewer page={selectedPage} onChecklistToggle={handleChecklistToggle} onPageLinkClick={selectPage} />
                      : <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Stránka je prázdná. Klikněte Upravit a začněte psát.</p>
                  )}
                </div>

                {/* Tabs (only for saved pages) */}
                {!editing && !selectedPage.id.startsWith('__new__') && (
                  <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                      {([
                        { id: 'comments', label: `Komentáře (${comments.length})` },
                        { id: 'history', label: `Historie (${versions.length})` },
                        { id: 'reviews', label: `Recenze (${reviews.filter(r => !r.is_done).length})` },
                        canAdmin ? { id: 'access', label: 'Přístupy' } : null,
                      ].filter(Boolean) as { id: string; label: string }[]).map(tab => (
                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as PageTab)}
                          className="px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
                          style={{ borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent', color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)', background: 'transparent' }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Comments */}
                    {activeTab === 'comments' && (
                      <div>
                        {comments.map(c => (
                          <div key={c.id} className="flex gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: members.find(m => m.user_id === c.user_id)?.avatar_color ?? '#6366f1' }}>
                              {getInitials(memberName(c.user_id))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{memberName(c.user_id)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(c.created_at)}</span>
                              </div>
                              {editingComment?.id === c.id ? (
                                <div className="flex gap-2">
                                  <input value={editingComment.content} onChange={e => setEditingComment(prev => prev ? { ...prev, content: e.target.value } : null)}
                                    className="flex-1 px-3 py-1.5 rounded-lg border text-sm text-base sm:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                                  <button type="button" onClick={updateComment} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Uložit</button>
                                  <button type="button" onClick={() => setEditingComment(null)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
                                </div>
                              ) : (
                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.content}</p>
                              )}
                            </div>
                            {c.user_id === user?.id && !editingComment && (
                              <div className="flex items-start gap-1 flex-shrink-0">
                                <button type="button" onClick={() => setEditingComment({ id: c.id, content: c.content })} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button type="button" onClick={() => deleteComment(c.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" style={{ color: '#ef4444' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* New comment */}
                        <div className="flex gap-3 mt-3">
                          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: members.find(m => m.user_id === user?.id)?.avatar_color ?? '#6366f1' }}>
                            {getInitials(profile?.display_name ?? '?')}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <input value={newComment} onChange={e => setNewComment(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                              placeholder="Přidat komentář…" className="flex-1 px-3 py-2 rounded-xl border text-sm text-base sm:text-sm"
                              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                            <button type="button" onClick={addComment} disabled={!newComment.trim() || savingComment}
                              className="px-4 py-2 rounded-xl text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: (!newComment.trim() || savingComment) ? 0.5 : 1 }}>
                              Odeslat
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* History */}
                    {activeTab === 'history' && (
                      <div>
                        {versions.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné verze v historii</p>}
                        {versions.map((v, i) => (
                          <div key={v.id} className="flex items-center gap-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {fmtDateTime(v.created_at)} · {memberName(v.edited_by)}
                              </p>
                            </div>
                            {i === 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>Aktuální</span>}
                            {i > 0 && canEditPage(selectedPage) && (
                              <button type="button" onClick={() => revertToVersion(v)}
                                className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                                Obnovit
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reviews */}
                    {activeTab === 'reviews' && (
                      <div>
                        {canAdmin && (
                          <button type="button" onClick={() => { setReviewModal(true); setReviewForm({ assigned_to: user?.id ?? '', review_date: '', note: '' }); }}
                            className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl border text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Přidat připomínku revize
                          </button>
                        )}
                        {reviews.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné revizní připomínky</p>}
                        {reviews.map(r => (
                          <div key={r.id} className="flex items-start gap-3 py-3 border-b" style={{ borderColor: 'var(--border)', opacity: r.is_done ? 0.55 : 1 }}>
                            <button type="button" onClick={() => toggleReviewDone(r.id, !r.is_done)}
                              className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors"
                              style={{ borderColor: r.is_done ? 'var(--primary)' : 'var(--border)', background: r.is_done ? 'var(--primary)' : 'transparent' }}>
                              {r.is_done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                Revidovat do {fmtDate(r.review_date)} · {memberName(r.assigned_to)}
                              </p>
                              {r.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.note}</p>}
                            </div>
                            {canAdmin && (
                              <button type="button" onClick={() => deleteReview(r.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 flex-shrink-0" style={{ color: '#ef4444' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Access */}
                    {activeTab === 'access' && canAdmin && (
                      <div>
                        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                          <button type="button" onClick={async () => {
                            const newVal = !selectedPage.is_restricted;
                            await supabase.from('trackino_kb_pages').update({ is_restricted: newVal }).eq('id', selectedPage.id);
                            setSelectedPage(prev => prev ? { ...prev, is_restricted: newVal } : prev);
                            setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, is_restricted: newVal } : p));
                          }}
                            className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                            style={{ background: selectedPage.is_restricted ? 'var(--primary)' : 'var(--border)' }}>
                            <span className="absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-transform" style={{ transform: selectedPage.is_restricted ? 'translateX(18px)' : 'translateX(2px)' }} />
                          </button>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Omezený přístup k úpravám</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedPage.is_restricted ? 'Jen správci a níže přidaní uživatelé mohou upravovat' : 'Může upravovat kdokoliv'}</p>
                          </div>
                        </div>
                        {selectedPage.is_restricted && (
                          <div>
                            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>EDITAČNÍ PŘÍSTUP PRO UŽIVATELE</p>
                            {members.map(m => {
                              const hasAccess = access.some(a => a.user_id === m.user_id && a.can_edit);
                              return (
                                <div key={m.user_id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: m.avatar_color }}>{getInitials(m.display_name)}</div>
                                  <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{m.display_name}</span>
                                  <button type="button" onClick={() => toggleUserAccess(m.user_id, !hasAccess)}
                                    className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                                    style={{ background: hasAccess ? 'var(--primary)' : 'var(--border)' }}>
                                    <span className="absolute w-3.5 h-3.5 bg-white rounded-full top-0.5 transition-transform" style={{ transform: hasAccess ? 'translateX(18px)' : 'translateX(2px)' }} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOLDER MODAL */}
      {folderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl border p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {folderModal.mode === 'add' ? 'Nová složka' : 'Přejmenovat složku'}
            </h3>
            <input value={folderModal.name} onChange={e => setFolderModal(prev => prev ? { ...prev, name: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter') saveFolder(); if (e.key === 'Escape') setFolderModal(null); }}
              placeholder="Název složky" autoFocus className="w-full px-3 py-2 rounded-xl border mb-4 text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button type="button" onClick={saveFolder} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Uložit</button>
              <button type="button" onClick={() => setFolderModal(null)} className="flex-1 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl border p-6 w-full max-w-lg shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Vyberte šablonu</h3>
              <button type="button" onClick={() => setTemplateModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => createPageFromTemplate(t, templateModal.folderId)}
                  className="text-left p-4 rounded-xl border hover:border-[var(--primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl border p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat revizní připomínku</h3>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Přiřadit uživateli</label>
            <div className="relative mb-3">
              <select value={reviewForm.assigned_to} onChange={e => setReviewForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                className="w-full appearance-none px-3 py-2 rounded-xl border text-base sm:text-sm pr-8"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Vyberte uživatele…</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Termín revize</label>
            <input type="date" value={reviewForm.review_date} onChange={e => setReviewForm(prev => ({ ...prev, review_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border mb-3 text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)', transform: 'translateZ(0)' }} />
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka (volitelné)</label>
            <input value={reviewForm.note} onChange={e => setReviewForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Co revidovat…" className="w-full px-3 py-2 rounded-xl border mb-4 text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button type="button" onClick={addReview} disabled={!reviewForm.assigned_to || !reviewForm.review_date || savingReview}
                className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: (!reviewForm.assigned_to || !reviewForm.review_date) ? 0.5 : 1 }}>
                {savingReview ? '...' : 'Uložit'}
              </button>
              <button type="button" onClick={() => setReviewModal(false)} className="flex-1 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ── Outer page component ──────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <KnowledgeBaseContent />
    </WorkspaceProvider>
  );
}
