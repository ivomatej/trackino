'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import type { KbFolder, KbFolderShare, KbPage, KbVersion, KbComment, KbReview, KbAccess, KbPageStatus } from '@/types/database';

// ── Local types ──────────────────────────────────────────────────────────────

type PageTab = 'comments' | 'history' | 'access' | 'backlinks' | 'reviews';
interface KbMember { user_id: string; display_name: string; avatar_color: string; email?: string; }

type ListFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'recent' }
  | { type: 'unfiled' }
  | { type: 'status'; value: KbPageStatus }
  | { type: 'mention'; userId: string }
  | { type: 'folder'; folderId: string };

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
    content: '<h2>Popis procesu</h2><p><strong>Zodpovědná osoba:</strong> </p><p><strong>Frekvence:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Popis</h3><p>Stručný popis procesu...</p><h3>Kroky</h3><ol><li>Krok 1</li><li>Krok 2</li><li>Krok 3</li></ol><h3>Poznámky</h3><div class="kb-callout">ℹ Důležité informace k procesu</div>',
  },
  {
    id: 'onboarding', title: 'Onboarding průvodce', description: 'Checklist pro nové zaměstnance',
    content: '<h2>Onboarding průvodce</h2><p>Vítejte v týmu! Tento průvodce vám pomůže v prvních dnech.</p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>První den</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Nastavit pracovní e-mail</li><li class="kb-check-unchecked">Představit se týmu</li><li class="kb-check-unchecked">Projít firemní pravidla</li></ul><h3>První týden</h3><ul class="kb-checklist"><li class="kb-check-unchecked">Absolvovat úvodní školení</li><li class="kb-check-unchecked">Nastavit přístupy do systémů</li></ul>',
  },
  {
    id: 'project', title: 'Dokumentace projektu', description: 'Cíle a architektura projektu',
    content: '<h2>Dokumentace projektu</h2><p><strong>Vlastník projektu:</strong> </p><p><strong>Termín:</strong> </p><hr style="border:none;border-top:1px solid var(--border);margin:16px 0"><h3>Cíl projektu</h3><p>Popis cíle...</p><h3>Rozsah</h3><ul><li>V rozsahu: </li><li>Mimo rozsah: </li></ul><h3>Technické detaily</h3><pre style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;margin:8px 0;border:1px solid var(--border)"><code>...</code></pre><h3>Rizika</h3><div class="kb-callout">⚠ Identifikovaná rizika</div>',
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
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFolderPath(folderId: string | null, folders: KbFolder[]): string {
  if (!folderId) return '';
  const parts: string[] = [];
  let current: KbFolder | undefined = folders.find(f => f.id === folderId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
  }
  return parts.join(' / ');
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Rich Editor ───────────────────────────────────────────────────────────────

function RichEditor({ value, onChange, members, pages }: {
  value: string; onChange: (v: string) => void; members: KbMember[]; pages: KbPage[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number } | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [calloutPicker, setCalloutPicker] = useState<{ el: HTMLElement; right: number; top: number } | null>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cmd = (command: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const ins = (html: string) => {
    setSelectionPopup(null);
    if (savedRange.current) {
      try {
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
      } catch { /* ignore */ }
      savedRange.current = null;
    } else {
      ref.current?.focus();
    }
    document.execCommand('insertHTML', false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // insBlock: jako ins(), ale po vložení přesune kurzor do elementu s data-kbm atributem
  const insBlock = (html: string) => {
    setSelectionPopup(null);
    if (savedRange.current) {
      try {
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
      } catch { /* ignore */ }
      savedRange.current = null;
    } else {
      ref.current?.focus();
    }
    document.execCommand('insertHTML', false, html);
    if (ref.current) {
      const target = ref.current.querySelector('[data-kbm]') as HTMLElement | null;
      if (target) {
        target.removeAttribute('data-kbm');
        try {
          const range = document.createRange();
          range.setStart(target, 0);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        } catch { /* ignore */ }
      }
      onChange(ref.current.innerHTML);
    }
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
    ins(`<a class="kb-page-link" data-page-id="${p.id}" href="#" style="color:var(--primary);text-decoration:underline">${p.title}</a>`);
    setShowPagePicker(false); setPickerSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element;
        const pre = el?.closest('pre');
        if (pre) {
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
          if (ref.current) onChange(ref.current.innerHTML);
          return;
        }
        const callout = el?.closest('.kb-callout');
        if (callout) {
          e.preventDefault();
          document.execCommand('insertHTML', false, '<br>');
          if (ref.current) onChange(ref.current.innerHTML);
          return;
        }
      }
    }
  };

  const filteredMembers = members.filter(m => m.display_name.toLowerCase().includes(pickerSearch.toLowerCase()));
  const filteredPages = pages.filter(p => p.title.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 15);

  const TBtn = ({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) => (
    <button type="button" title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-active)]"
      style={{ color: active ? 'var(--primary)' : 'var(--text-secondary)', background: active ? 'color-mix(in srgb,var(--primary) 10%,transparent)' : 'transparent' }}>
      {children}
    </button>
  );

  const Sep = () => <span className="w-px mx-0.5 self-stretch" style={{ background: 'var(--border)' }} />;

  return (
    <>
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Toolbar */}
      <div className="flex flex-col border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
        {/* Řádek 1: formátování textu */}
        <div className="flex flex-wrap gap-0.5 px-2 py-1.5">
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
        </div>
        {/* Oddělovač mezi řádky */}
        <div className="border-t" style={{ borderColor: 'var(--border)' }} />
        {/* Řádek 2: bloky a vložení */}
        <div className="flex flex-wrap gap-0.5 px-2 py-1.5">
          {/* Kód */}
          <TBtn onClick={() => {
            const sel = window.getSelection();
            const selected = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).toString() : '';
            if (selected) {
              ins(`<pre style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:16px 0;border:1px solid var(--border);white-space:pre-wrap"><code style="display:block;min-height:3em;outline:none">${selected}</code></pre><p><br></p>`);
            } else {
              insBlock(`<pre style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:16px 0;border:1px solid var(--border);white-space:pre-wrap"><code data-kbm style="display:block;min-height:3em;outline:none"></code></pre><p><br></p>`);
            }
          }} title="Blok kódu">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Kód
          </TBtn>
          {/* Odkaz */}
          <div className="relative">
            <TBtn onClick={() => { saveRange(); setShowLinkModal(v => !v); setShowMentionPicker(false); setShowPagePicker(false); }} title="Vložit odkaz" active={showLinkModal}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Odkaz
            </TBtn>
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
          {/* Zmínky */}
          <div className="relative">
            <TBtn onClick={() => { saveRange(); setShowMentionPicker(v => !v); setShowPagePicker(false); setShowLinkModal(false); setPickerSearch(''); }} title="Zmínit uživatele" active={showMentionPicker}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
              Zmínky
            </TBtn>
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
          {/* Stránka */}
          <div className="relative">
            <TBtn onClick={() => { saveRange(); setShowPagePicker(v => !v); setShowMentionPicker(false); setShowLinkModal(false); setPickerSearch(''); }} title="Odkaz na stránku" active={showPagePicker}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Stránka
            </TBtn>
            {showPagePicker && (
              <div className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg min-w-[220px] max-h-[220px] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                  <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Hledat stránku..." autoFocus
                    className="w-full px-2 py-1 rounded text-sm text-base sm:text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                </div>
                {filteredPages.map(p => (
                  <button key={p.id} type="button" onClick={() => insertPageLink(p)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-primary)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
                {filteredPages.length === 0 && <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Žádné stránky</p>}
              </div>
            )}
          </div>
          <Sep />
          {/* Úkol */}
          <TBtn onClick={() => insBlock('<div class="kb-task-box"><div class="kb-task-box-title">Úkoly</div><ul class="kb-checklist"><li class="kb-check-unchecked" data-kbm></li></ul></div><p><br></p>')} title="Přidat blok úkolů">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
            Úkol
          </TBtn>
          {/* Infobox */}
          <TBtn onClick={() => insBlock('<div data-kbm class="kb-callout"><br></div><p><br></p>')} title="Infobox / callout">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            Infobox
          </TBtn>
          {/* Toggle */}
          <TBtn onClick={() => ins('<details class="kb-toggle"><summary>Klikněte pro zobrazení</summary><p>Obsah...</p></details><p><br></p>')} title="Toggle blok">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            Toggle
          </TBtn>
        </div>
      </div>
      {/* Editable area */}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onKeyDown={handleKeyDown}
        onMouseUp={() => {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            savedRange.current = range.cloneRange();
            setSelectionPopup({ x: rect.left + rect.width / 2, y: rect.top });
          } else {
            setSelectionPopup(null);
          }
        }}
        onClick={e => {
          const preEl = (e.target as Element).closest('pre');
          if (preEl) {
            const rect = preEl.getBoundingClientRect();
            if (e.clientX > rect.right - 36 && e.clientY < rect.top + 32) {
              navigator.clipboard.writeText(preEl.querySelector('code')?.textContent ?? '').catch(() => {});
              preEl.classList.add('kb-code-copied');
              setTimeout(() => preEl.classList.remove('kb-code-copied'), 1500);
            }
            setCalloutPicker(null);
            return;
          }
          const callout = (e.target as Element).closest('.kb-callout') as HTMLElement | null;
          if (callout) {
            const rect = callout.getBoundingClientRect();
            if (e.clientX > rect.right - 32 && e.clientY < rect.top + 32) {
              e.preventDefault();
              setCalloutPicker(prev => prev?.el === callout ? null : { el: callout, right: window.innerWidth - rect.right + 4, top: rect.top + 4 });
            } else {
              setCalloutPicker(null);
            }
          } else {
            setCalloutPicker(null);
          }
        }}
        onBlur={() => setTimeout(() => setCalloutPicker(null), 150)}
        className="min-h-[280px] p-4 focus:outline-none prose-kb"
        style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}
      />
      <style>{`
        .prose-kb h1{font-size:1.6em;font-weight:800;margin:28px 0 10px;line-height:1.2}
        .prose-kb h2{font-size:1.25em;font-weight:700;margin:24px 0 8px}
        .prose-kb h3{font-size:1.05em;font-weight:600;margin:20px 0 6px}
        .prose-kb ul{list-style:disc;padding-left:32px;margin:4px 0}
        .prose-kb ol{list-style:decimal;padding-left:32px;margin:4px 0}
        .prose-kb p{margin:4px 0;line-height:1.6}
        .prose-kb pre{position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:16px 0;border:1px solid var(--border);white-space:pre-wrap}
        .prose-kb pre code{display:block;min-height:3em;white-space:pre-wrap;word-break:break-all;outline:none}
        .prose-kb pre::after{content:"";position:absolute;top:8px;right:8px;width:20px;height:20px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0.5;transition:opacity 0.15s,background-image 0.1s}
        .prose-kb pre:hover::after{opacity:1}
        .prose-kb pre.kb-code-copied::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");opacity:1!important}
        .prose-kb .kb-checklist{list-style:none;padding-left:2px}
        .prose-kb .kb-check-unchecked{line-height:1.8}
        .prose-kb .kb-check-unchecked::before{content:"";display:inline-block;width:14px;height:14px;border:1.5px solid var(--border);border-radius:3px;margin-right:7px;vertical-align:middle;background:transparent;position:relative;top:-1px}
        .prose-kb .kb-check-checked{opacity:0.6;text-decoration:line-through;line-height:1.8}
        .prose-kb .kb-check-checked::before{content:"✓";display:inline-block;width:14px;height:14px;border:1.5px solid var(--primary);border-radius:3px;margin-right:7px;vertical-align:middle;background:var(--primary);color:white;font-size:9px;font-weight:700;line-height:14px;text-align:center;position:relative;top:-1px}
        .prose-kb .kb-callout{position:relative;border-radius:10px;padding:12px 36px 12px 16px;margin:16px 0;border:1.5px solid color-mix(in srgb,var(--primary) 35%,transparent);background:color-mix(in srgb,var(--primary) 8%,var(--bg-card));line-height:1.6;min-height:1.6em}
        .prose-kb .kb-callout[data-color="green"]{border-color:color-mix(in srgb,#22c55e 35%,transparent);background:color-mix(in srgb,#22c55e 8%,var(--bg-card))}
        .prose-kb .kb-callout[data-color="yellow"]{border-color:color-mix(in srgb,#f59e0b 35%,transparent);background:color-mix(in srgb,#f59e0b 8%,var(--bg-card))}
        .prose-kb .kb-callout[data-color="red"]{border-color:color-mix(in srgb,#ef4444 35%,transparent);background:color-mix(in srgb,#ef4444 8%,var(--bg-card))}
        .prose-kb .kb-callout[data-color="purple"]{border-color:color-mix(in srgb,#8b5cf6 35%,transparent);background:color-mix(in srgb,#8b5cf6 8%,var(--bg-card))}
        .prose-kb .kb-callout[data-color="gray"]{border-color:color-mix(in srgb,#6b7280 35%,transparent);background:color-mix(in srgb,#6b7280 8%,var(--bg-card))}
        .prose-kb .kb-callout::after{content:"";position:absolute;top:8px;right:8px;width:18px;height:18px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ccircle cx='9' cy='9' r='1.5' fill='%23888' stroke='none'/%3E%3Ccircle cx='15' cy='9' r='1.5' fill='%23888' stroke='none'/%3E%3Ccircle cx='9' cy='15' r='1.5' fill='%23888' stroke='none'/%3E%3Ccircle cx='15' cy='15' r='1.5' fill='%23888' stroke='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0;transition:opacity 0.15s}
        .prose-kb .kb-callout:hover::after{opacity:0.5}
        .prose-kb .kb-task-box{border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin:16px 0;background:var(--bg-hover)}
        .prose-kb .kb-task-box .kb-task-box-title{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px}
        .prose-kb .kb-task-box .kb-checklist{margin:0;padding-left:2px}
        .prose-kb details.kb-toggle{border:none;border-radius:10px;background:var(--bg-hover);padding:0;margin:16px 0;overflow:hidden}
        .prose-kb details.kb-toggle>summary{padding:10px 14px;cursor:pointer;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px}
        .prose-kb details.kb-toggle>summary::-webkit-details-marker{display:none}
        .prose-kb details.kb-toggle>summary::before{content:"▶";font-size:0.65em;opacity:0.5;transition:transform 0.2s;display:inline-block}
        .prose-kb details.kb-toggle[open]>summary::before{transform:rotate(90deg)}
        .prose-kb details.kb-toggle>:not(summary){padding:4px 14px 12px;border-top:1px solid var(--border)}
      `}</style>
    </div>
    {/* Selection popup – fixed positioning escapes overflow:hidden */}
    {calloutPicker && (
      <div className="fixed z-[9999] flex items-center gap-1 p-1.5 rounded-lg border shadow-lg"
        style={{ right: calloutPicker.right, top: calloutPicker.top, background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onMouseDown={e => e.preventDefault()}>
        {([
          { id: '', color: 'var(--primary)', label: 'Výchozí' },
          { id: 'green', color: '#22c55e', label: 'Zelená' },
          { id: 'yellow', color: '#f59e0b', label: 'Žlutá' },
          { id: 'red', color: '#ef4444', label: 'Červená' },
          { id: 'purple', color: '#8b5cf6', label: 'Fialová' },
          { id: 'gray', color: '#6b7280', label: 'Šedá' },
        ] as { id: string; color: string; label: string }[]).map(c => (
          <button key={c.id} type="button" title={c.label}
            onMouseDown={e => {
              e.preventDefault();
              calloutPicker.el.setAttribute('data-color', c.id);
              if (ref.current) onChange(ref.current.innerHTML);
              setCalloutPicker(null);
            }}
            className="w-4 h-4 rounded-full transition-all"
            style={{ background: c.color, border: (calloutPicker.el.dataset.color ?? '') === c.id ? '2px solid var(--text-primary)' : '2px solid transparent', outline: '1px solid rgba(0,0,0,0.1)' }} />
        ))}
      </div>
    )}
    {selectionPopup && (
      <div className="fixed z-[9999] flex items-center gap-0.5 px-1.5 py-1 rounded-lg border shadow-lg"
        style={{ left: selectionPopup.x, top: selectionPopup.y - 46, transform: 'translateX(-50%)', background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onMouseDown={e => e.preventDefault()}>
        <button type="button" title="Odkaz"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setShowLinkModal(true); setShowMentionPicker(false); setShowPagePicker(false); setSelectionPopup(null); }}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-secondary)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>
        <button type="button" title="Zmínka (@uživatel)"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setShowMentionPicker(true); setShowPagePicker(false); setShowLinkModal(false); setPickerSearch(''); setSelectionPopup(null); }}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
          @
        </button>
        <button type="button" title="Odkaz na stránku"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setShowPagePicker(true); setShowMentionPicker(false); setShowLinkModal(false); setPickerSearch(''); setSelectionPopup(null); }}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-secondary)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </button>
      </div>
    )}
    </>
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
        pre.classList.add('kb-code-copied');
        setTimeout(() => pre.classList.remove('kb-code-copied'), 1500);
      }
    }
  };

  return (
    <>
      <div className="prose-kb prose-view" dangerouslySetInnerHTML={{ __html: page.content }} onClick={handleClick} style={{ color: 'var(--text-primary)' }} />
      <style>{`
        .prose-view h1{font-size:1.6em;font-weight:800;margin:28px 0 10px;line-height:1.2}
        .prose-view h2{font-size:1.25em;font-weight:700;margin:24px 0 8px}
        .prose-view h3{font-size:1.05em;font-weight:600;margin:20px 0 6px}
        .prose-view ul{list-style:disc;padding-left:32px;margin:4px 0}
        .prose-view ol{list-style:decimal;padding-left:32px;margin:4px 0}
        .prose-view p{margin:4px 0;line-height:1.6}
        .prose-view pre{position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:16px 0;border:1px solid var(--border);cursor:default;white-space:pre-wrap;word-break:break-all}
        .prose-view pre code{white-space:pre-wrap;word-break:break-all;display:block}
        .prose-view pre::after{content:"";position:absolute;top:8px;right:8px;width:20px;height:20px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0.5;transition:opacity 0.15s,background-image 0.1s}
        .prose-view pre:hover::after{opacity:1}
        .prose-view pre.kb-code-copied::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");opacity:1!important}
        .prose-view .kb-checklist{list-style:none;padding-left:2px}
        .prose-view .kb-check-unchecked,.prose-view .kb-check-checked{cursor:pointer;line-height:1.8}
        .prose-view .kb-check-unchecked::before{content:"";display:inline-block;width:14px;height:14px;border:1.5px solid var(--border);border-radius:3px;margin-right:7px;vertical-align:middle;background:transparent;position:relative;top:-1px}
        .prose-view .kb-check-checked::before{content:"✓";display:inline-block;width:14px;height:14px;border:1.5px solid var(--primary);border-radius:3px;margin-right:7px;vertical-align:middle;background:var(--primary);color:white;font-size:9px;font-weight:700;line-height:14px;text-align:center;position:relative;top:-1px}
        .prose-view .kb-check-checked{opacity:0.6;text-decoration:line-through}
        .prose-view .kb-callout{border-radius:10px;padding:12px 16px;margin:16px 0;border:1.5px solid color-mix(in srgb,var(--primary) 35%,transparent);background:color-mix(in srgb,var(--primary) 8%,var(--bg-card));line-height:1.6}
        .prose-view .kb-callout[data-color="green"]{border-color:color-mix(in srgb,#22c55e 35%,transparent);background:color-mix(in srgb,#22c55e 8%,var(--bg-card))}
        .prose-view .kb-callout[data-color="yellow"]{border-color:color-mix(in srgb,#f59e0b 35%,transparent);background:color-mix(in srgb,#f59e0b 8%,var(--bg-card))}
        .prose-view .kb-callout[data-color="red"]{border-color:color-mix(in srgb,#ef4444 35%,transparent);background:color-mix(in srgb,#ef4444 8%,var(--bg-card))}
        .prose-view .kb-callout[data-color="purple"]{border-color:color-mix(in srgb,#8b5cf6 35%,transparent);background:color-mix(in srgb,#8b5cf6 8%,var(--bg-card))}
        .prose-view .kb-callout[data-color="gray"]{border-color:color-mix(in srgb,#6b7280 35%,transparent);background:color-mix(in srgb,#6b7280 8%,var(--bg-card))}
        .prose-view .kb-task-box{border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin:16px 0;background:var(--bg-hover)}
        .prose-view .kb-task-box .kb-task-box-title{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px}
        .prose-view .kb-task-box .kb-checklist{margin:0;padding-left:2px}
        .prose-view details.kb-toggle{border:none;border-radius:10px;background:var(--bg-hover);padding:0;margin:16px 0;overflow:hidden}
        .prose-view details.kb-toggle>summary{padding:10px 14px;cursor:pointer;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px;user-select:none}
        .prose-view details.kb-toggle>summary::-webkit-details-marker{display:none}
        .prose-view details.kb-toggle>summary::before{content:"▶";font-size:0.65em;opacity:0.5;transition:transform 0.2s;display:inline-block}
        .prose-view details.kb-toggle[open]>summary::before{transform:rotate(90deg)}
        .prose-view details.kb-toggle>:not(summary){padding:4px 14px 12px;border-top:1px solid var(--border)}
        .prose-view hr{border:none;border-top:1px solid var(--border);margin:16px 0}
      `}</style>
    </>
  );
}

// ── Folder Tree ───────────────────────────────────────────────────────────────

function KbFolderTree({ folders, pages, selectedFolderId, expanded, onSelectFolder, onToggle, onAddSub, onEditFolder, onDeleteFolder, onShareFolder, userId, depth = 0, parentId = null }: {
  folders: KbFolder[]; pages: KbPage[]; selectedFolderId: string | null;
  expanded: Set<string>; onSelectFolder: (id: string) => void;
  onToggle: (id: string) => void; onAddSub: (parentId: string, depth: number) => void;
  onEditFolder: (f: KbFolder) => void; onDeleteFolder: (f: KbFolder) => void;
  onShareFolder: (f: KbFolder) => void;
  userId: string; depth?: number; parentId?: string | null;
}) {
  const children = folders.filter(f => f.parent_id === parentId);
  if (children.length === 0) return null;
  return (
    <div>
      {children.map(folder => {
        const isExp = expanded.has(folder.id);
        const isSel = selectedFolderId === folder.id;
        const pageCount = pages.filter(p => p.folder_id === folder.id).length;
        return (
          <div key={folder.id}>
            <div className="group/folder flex items-center gap-1 py-1 rounded-lg cursor-pointer transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px`, background: isSel ? 'var(--bg-active)' : 'transparent' }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { onSelectFolder(folder.id); onToggle(folder.id); }}>
              <button type="button" onClick={e => { e.stopPropagation(); onToggle(folder.id); }}
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transition: 'transform 0.15s', transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <path d="M3 2l4 3-4 3V2z"/>
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: folder.is_shared ? 'var(--primary)' : (isSel ? 'var(--primary)' : 'var(--text-muted)'), flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="flex-1 text-xs truncate" style={{ color: isSel ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isSel ? 600 : 400 }}>{folder.name}</span>
              {pageCount > 0 && <span className="text-[10px] px-1 mr-1 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>{pageCount}</span>}
              <div className="opacity-100 md:opacity-0 md:group-hover/folder:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
                {depth < MAX_FOLDER_DEPTH - 1 && (
                  <button type="button" onClick={e => { e.stopPropagation(); onAddSub(folder.id, depth + 1); }} title="Přidat podsložku"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]" style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
                {folder.owner_id === userId && (
                  <>
                    <button type="button" onClick={e => { e.stopPropagation(); onShareFolder(folder); }} title="Sdílet složku"
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]"
                      style={{ color: folder.is_shared ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); onEditFolder(folder); }} title="Přejmenovat"
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)]" style={{ color: 'var(--text-muted)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); onDeleteFolder(folder); }} title="Smazat složku"
                      className="w-5 h-5 flex items-center justify-center rounded" style={{ color: '#ef4444' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Subfolders only */}
            {isExp && (
              <KbFolderTree folders={folders} pages={pages} selectedFolderId={selectedFolderId}
                expanded={expanded} onSelectFolder={onSelectFolder} onToggle={onToggle}
                onAddSub={onAddSub} onEditFolder={onEditFolder} onDeleteFolder={onDeleteFolder}
                onShareFolder={onShareFolder}
                userId={userId} depth={depth + 1} parentId={folder.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page List View ────────────────────────────────────────────────────────────

function PageListView({ pages, folders, members, favorites, allReviews, filterLabel, filterIcon, onSelectPage, onNewPage, STATUS_CONFIG: sc }: {
  pages: KbPage[]; folders: KbFolder[]; members: KbMember[];
  favorites: Set<string>; allReviews: Pick<KbReview, 'page_id' | 'review_date' | 'is_done'>[]; filterLabel: string; filterIcon: React.ReactNode;
  onSelectPage: (id: string) => void; onNewPage: () => void;
  STATUS_CONFIG: Record<KbPageStatus, { label: string; color: string }>;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-4 lg:p-6 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-hover)' }}>
              {filterIcon}
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{filterLabel}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pages.length} {pages.length === 1 ? 'stránka' : pages.length < 5 ? 'stránky' : 'stránek'}</p>
            </div>
          </div>
          <button type="button" onClick={onNewPage}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="hidden sm:inline">Nová stránka</span>
            <span className="sm:hidden">Nová</span>
          </button>
        </div>

        {/* Page list */}
        {pages.length === 0 ? (
          <div className="rounded-xl border px-6 py-14 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <svg className="mx-auto mb-3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné stránky</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            {pages.map((p, i) => {
              const path = getFolderPath(p.folder_id, folders);
              const author = members.find(m => m.user_id === (p.updated_by ?? p.created_by));
              const pageReviews = allReviews.filter(r => r.page_id === p.id && r.is_done && r.review_date);
              const lastReview = pageReviews.sort((a, b) => b.review_date!.localeCompare(a.review_date!))[0];
              return (
                <div key={p.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{ borderBottom: i < pages.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => onSelectPage(p.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
                      {favorites.has(p.id) && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" style={{ flexShrink: 0 }}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {path && (
                        <span className="text-[11px] truncate flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          {path}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc[p.status].color }} />
                      <span className="text-[11px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>{sc[p.status].label}</span>
                    </div>
                    {author && (
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white hidden md:flex" style={{ background: author.avatar_color }}>
                        {getInitials(author.display_name)}
                      </div>
                    )}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                        {new Date(p.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {lastReview && (
                        <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)', opacity: 0.7 }} title="Datum poslední revize">
                          revize {new Date(lastReview.review_date!).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
  const [editTasks, setEditTasks] = useState<{ id: string; text: string; checked: boolean }[]>([]);
  const kbTaskRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [editStatus, setEditStatus] = useState<KbPageStatus>('active');
  const [editRestricted, setEditRestricted] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [copiedPage, setCopiedPage] = useState(false);

  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<KbMember[]>([]);

  const [comments, setComments] = useState<KbComment[]>([]);
  const [versions, setVersions] = useState<KbVersion[]>([]);
  const [reviews, setReviews] = useState<KbReview[]>([]);
  const [allReviews, setAllReviews] = useState<Pick<KbReview, 'page_id' | 'review_date' | 'is_done'>[]>([]);
  const [access, setAccess] = useState<KbAccess[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<PageTab>('comments');
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);

  const [leftOpen, setLeftOpen] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter | null>(null);
  const [statusSectionExpanded, setStatusSectionExpanded] = useState(false);
  const [mentionSectionExpanded, setMentionSectionExpanded] = useState(false);

  // Folder modal
  const [folderModal, setFolderModal] = useState<{ mode: 'add' | 'edit'; parentId: string | null; depth: number; target: KbFolder | null; name: string } | null>(null);

  // Share modal
  const [folderShares, setFolderShares] = useState<KbFolderShare[]>([]);
  const [shareModal, setShareModal] = useState<{ open: boolean; folder: KbFolder | null }>({ open: false, folder: null });
  const [shareType, setShareType] = useState<'none' | 'workspace' | 'users'>('none');
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);

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

    const [{ data: fData }, { data: pData }, { data: memData }, { data: favData }, { data: revData }, { data: sharesData }] = await Promise.all([
      supabase.from('trackino_kb_folders').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('trackino_kb_pages').select('*').eq('workspace_id', wid).order('updated_at', { ascending: false }),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wid).eq('approved', true),
      supabase.from('trackino_kb_favorites').select('page_id').eq('user_id', user.id),
      supabase.from('trackino_kb_reviews').select('page_id,review_date,is_done').eq('workspace_id', wid),
      supabase.from('trackino_kb_folder_shares').select('*').eq('workspace_id', wid),
    ]);

    setFolderShares((sharesData ?? []) as KbFolderShare[]);
    setFolders((fData ?? []) as KbFolder[]);
    setPages((pData ?? []) as KbPage[]);
    setFavorites(new Set((favData ?? []).map((f: { page_id: string }) => f.page_id)));
    setAllReviews((revData ?? []) as Pick<KbReview, 'page_id' | 'review_date' | 'is_done'>[]);

    // Fetch member profiles
    const uids = ((memData ?? []) as { user_id: string }[]).map(m => m.user_id);
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from('trackino_profiles').select('id,display_name,avatar_color,email').in('id', uids).order('display_name');
      setMembers(((profiles ?? []) as { id: string; display_name: string; avatar_color: string; email?: string }[]).map(p => ({ user_id: p.id, display_name: p.display_name, avatar_color: p.avatar_color, email: p.email })));
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

  const backToList = () => {
    setSelectedPage(null);
    setEditing(false);
    setComments([]); setVersions([]); setReviews([]); setAccess([]);
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
    setEditTasks(Array.isArray(page.tasks) ? page.tasks : []);
    setEditStatus(page.status);
    setEditRestricted(page.is_restricted);
    setEditFolderId(page.folder_id);
    setEditing(true);
  };

  const savePage = async () => {
    if (!user || !currentWorkspace || !selectedPage) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = { title: editTitle.trim() || 'Bez názvu', content: editContent, tasks: [] as { id: string; text: string; checked: boolean }[], status: editStatus, is_restricted: editRestricted, folder_id: editFolderId, updated_by: user.id, updated_at: now };

    if (selectedPage.id.startsWith('__new__')) {
      const { data: np } = await supabase.from('trackino_kb_pages').insert({
        workspace_id: currentWorkspace.id,
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

  const openNewPage = (folderId?: string | null) => {
    const fid = folderId !== undefined ? folderId : (listFilter?.type === 'folder' ? listFilter.folderId : null);
    setTemplateModal({ folderId: fid });
  };

  const createPageFromTemplate = (template: typeof TEMPLATES[0], folderId: string | null) => {
    setTemplateModal(null);
    const fake: KbPage = {
      id: '__new__', workspace_id: currentWorkspace?.id ?? '', folder_id: folderId,
      title: template.title === 'Prázdná stránka' ? 'Nová stránka' : template.title,
      content: template.content, tasks: [], status: 'draft', tags: [], is_restricted: false,
      created_by: user?.id ?? '', updated_by: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setSelectedPage(fake);
    setEditing(true);
    setEditTitle(fake.title);
    setEditContent(fake.content);
    setEditTasks([]);
    setEditStatus('draft');
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

  // ── KB edit tasks helpers ─────────────────────────────────────────────────

  const addKbTask = () => {
    const t = { id: nanoid(), text: '', checked: false };
    setEditTasks(prev => [...prev, t]);
    setTimeout(() => kbTaskRefs.current.get(t.id)?.focus(), 50);
  };
  const removeKbTask = (id: string) => setEditTasks(prev => prev.filter(t => t.id !== id));
  const toggleKbTask = (id: string) => setEditTasks(prev => prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t));
  const updateKbTaskText = (id: string, text: string) => setEditTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));

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
        // Optimistický update
        setAccess(prev => prev.map(a => a.id === existing.id ? { ...a, can_edit: true } : a));
        await supabase.from('trackino_kb_access').update({ can_edit: true }).eq('id', existing.id);
      } else {
        // Optimistický update
        setAccess(prev => prev.filter(a => a.id !== existing.id));
        await supabase.from('trackino_kb_access').delete().eq('id', existing.id);
      }
    } else if (canEdit) {
      // Optimistický update s dočasným id
      const tempId = `temp-${userId}`;
      const tempAccess: KbAccess = { id: tempId, workspace_id: currentWorkspace.id, page_id: selectedPage.id, user_id: userId, can_edit: true, created_at: new Date().toISOString() };
      setAccess(prev => [...prev, tempAccess]);
      const { data: na } = await supabase.from('trackino_kb_access').insert({
        workspace_id: currentWorkspace.id, page_id: selectedPage.id, user_id: userId, can_edit: true,
      }).select().single();
      if (na) setAccess(prev => prev.map(a => a.id === tempId ? na as KbAccess : a));
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

  const openShare = (folder: KbFolder) => {
    const existing = folderShares.filter(s => s.folder_id === folder.id);
    const wsShare = existing.find(s => s.user_id === null);
    if (wsShare) { setShareType('workspace'); setShareUserIds([]); }
    else if (existing.length > 0) { setShareType('users'); setShareUserIds(existing.map(s => s.user_id!)); }
    else { setShareType('none'); setShareUserIds([]); }
    setShareModal({ open: true, folder });
  };

  const saveShare = async () => {
    if (!currentWorkspace || !shareModal.folder || !user) return;
    const fid = shareModal.folder.id;
    await supabase.from('trackino_kb_folder_shares').delete().eq('folder_id', fid);
    if (shareType === 'workspace') {
      await supabase.from('trackino_kb_folder_shares').insert({ folder_id: fid, workspace_id: currentWorkspace.id, user_id: null, shared_by: user.id });
    } else if (shareType === 'users' && shareUserIds.length > 0) {
      await supabase.from('trackino_kb_folder_shares').insert(shareUserIds.map(uid => ({ folder_id: fid, workspace_id: currentWorkspace.id, user_id: uid, shared_by: user.id })));
    }
    const isNowShared = shareType !== 'none';
    await supabase.from('trackino_kb_folders').update({ is_shared: isNowShared }).eq('id', fid);
    setFolders(prev => prev.map(f => f.id === fid ? { ...f, is_shared: isNowShared } : f));
    await fetchAll();
    setShareModal({ open: false, folder: null });
  };

  // ── Move page to folder ───────────────────────────────────────────────────

  const movePageToFolder = async (pageId: string, folderId: string | null) => {
    await supabase.from('trackino_kb_pages').update({ folder_id: folderId }).eq('id', pageId);
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, folder_id: folderId } : p));
    if (selectedPage?.id === pageId) setSelectedPage(prev => prev ? { ...prev, folder_id: folderId } : prev);
    setMovingPageId(null);
  };

  // ── Copy page content ─────────────────────────────────────────────────────

  const copyPageContent = () => {
    if (!selectedPage?.content) return;
    const div = document.createElement('div');
    div.innerHTML = selectedPage.content;
    const text = div.textContent ?? div.innerText ?? '';
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };


  // ── Filtered pages (search + listFilter) ──────────────────────────────────

  const filteredPages = (() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return pages.filter(pg =>
        pg.title.toLowerCase().includes(q) ||
        pg.content.toLowerCase().includes(q)
      );
    }
    if (!listFilter) return pages;
    switch (listFilter.type) {
      case 'all': return pages;
      case 'favorites': return pages.filter(p => favorites.has(p.id));
      case 'recent': return [...pages].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 30);
      case 'unfiled': return pages.filter(p => !p.folder_id);
      case 'status': return pages.filter(p => p.status === listFilter.value);
      case 'mention': return pages.filter(p => p.content.includes(`data-user-id="${listFilter.userId}"`));
      case 'folder': return pages.filter(p => p.folder_id === listFilter.folderId);
      default: return pages;
    }
  })();

  const filterLabel = (() => {
    const q = search.trim();
    if (q) return `Hledání: „${q}"`;
    if (!listFilter) return '';
    switch (listFilter.type) {
      case 'all': return 'Všechny stránky';
      case 'favorites': return 'Oblíbené stránky';
      case 'recent': return 'Naposledy upravené';
      case 'unfiled': return 'Nezařazené stránky';
      case 'status': return STATUS_CONFIG[listFilter.value].label;
      case 'mention': return `Zmínky: ${members.find(m => m.user_id === listFilter.userId)?.display_name ?? ''}`;
      case 'folder': return folders.find(f => f.id === listFilter.folderId)?.name ?? 'Složka';
    }
  })();

  const filterIcon = (() => {
    const q = search.trim();
    if (q) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    if (!listFilter) return null;
    switch (listFilter.type) {
      case 'all': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>;
      case 'favorites': return <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
      case 'recent': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
      case 'unfiled': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
      case 'status': return <div className="w-3 h-3 rounded-full" style={{ background: STATUS_CONFIG[listFilter.value].color }} />;
      case 'mention': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>;
      case 'folder': return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
      default: return null;
    }
  })();

  const showList = (search.trim() || listFilter !== null) && !selectedPage;
  const showWelcome = !search.trim() && listFilter === null && !selectedPage;

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
              <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value.trim()) { setListFilter(null); setSelectedPage(null); } }} placeholder="Hledat stránky…" className="w-full pl-8 pr-7 py-1.5 rounded-lg border text-base sm:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded" style={{ color: 'var(--text-muted)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* Nav shortcuts */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              {/* Všechny stránky */}
              {(() => {
                const isActive = listFilter?.type === 'all' && !search;
                return (
                  <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setListFilter({ type: 'all' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                    <span className="flex-1 text-left">Všechny stránky</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{pages.length}</span>
                  </button>
                );
              })()}
              {/* Oblíbené */}
              {favorites.size > 0 && (() => {
                const isActive = listFilter?.type === 'favorites' && !search;
                return (
                  <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setListFilter({ type: 'favorites' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isActive ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span className="flex-1 text-left">Oblíbené</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{favorites.size}</span>
                  </button>
                );
              })()}
              {/* Naposledy upravené */}
              {(() => {
                const isActive = listFilter?.type === 'recent' && !search;
                return (
                  <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setListFilter({ type: 'recent' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span className="flex-1 text-left">Naposledy upravené</span>
                  </button>
                );
              })()}
              {/* Nezařazené */}
              {(() => {
                const count = pages.filter(p => !p.folder_id).length;
                const isActive = listFilter?.type === 'unfiled' && !search;
                if (count === 0) return null;
                return (
                  <button type="button" className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setListFilter({ type: 'unfiled' }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span className="flex-1 text-left">Nezařazené</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{count}</span>
                  </button>
                );
              })()}
            </div>

            {/* Filtry */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              {/* Podle stavu */}
              <button type="button" className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors mb-0.5"
                onClick={() => setStatusSectionExpanded(v => !v)}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: statusSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}><path d="M3 2l4 3-4 3V2z"/></svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Podle stavu</span>
              </button>
              {statusSectionExpanded && (Object.keys(STATUS_CONFIG) as KbPageStatus[]).map(s => {
                const count = pages.filter(p => p.status === s).length;
                const isActive = listFilter?.type === 'status' && listFilter.value === s && !search;
                return (
                  <button key={s} type="button" className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ paddingLeft: 20, background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 400 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => { setListFilter({ type: 'status', value: s }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_CONFIG[s].color }} />
                    <span className="flex-1 text-left">{STATUS_CONFIG[s].label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{count}</span>
                  </button>
                );
              })}

              {/* Podle zmínky */}
              {members.some(m => pages.some(p => p.content.includes(`data-user-id="${m.user_id}"`))) && (
                <>
                  <button type="button" className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-[var(--bg-hover)] transition-colors mt-1 mb-0.5"
                    onClick={() => setMentionSectionExpanded(v => !v)}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: mentionSectionExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}><path d="M3 2l4 3-4 3V2z"/></svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Podle zmínky</span>
                  </button>
                  {mentionSectionExpanded && members.map(m => {
                    const count = pages.filter(p => p.content.includes(`data-user-id="${m.user_id}"`)).length;
                    if (count === 0) return null;
                    const isActive = listFilter?.type === 'mention' && listFilter.userId === m.user_id && !search;
                    return (
                      <button key={m.user_id} type="button" className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors"
                        style={{ paddingLeft: 20, background: isActive ? 'var(--bg-active)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => { setListFilter({ type: 'mention', userId: m.user_id }); setSearch(''); setSelectedPage(null); setLeftOpen(false); }}>
                        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white" style={{ background: m.avatar_color }}>{getInitials(m.display_name)}</div>
                        <span className="flex-1 text-left truncate">{m.display_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{count}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Folder tree */}
            <div className="p-2">
              <div className="flex items-center gap-1 px-2 py-1 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--text-muted)' }}>Složky</span>
                <button type="button" onClick={() => setFolderModal({ mode: 'add', parentId: null, depth: 0, target: null, name: '' })} title="Nová složka"
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              {folders.filter(f => !f.parent_id).length === 0 ? (
                <p className="px-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Zatím žádné složky</p>
              ) : (
                <KbFolderTree folders={folders} pages={pages} selectedFolderId={listFilter?.type === 'folder' ? listFilter.folderId : null}
                  expanded={expanded}
                  onSelectFolder={id => {
                    const newFilter: ListFilter = { type: 'folder', folderId: id };
                    setListFilter(prev => prev?.type === 'folder' && prev.folderId === id ? null : newFilter);
                    setSearch(''); setSelectedPage(null); setLeftOpen(false);
                  }}
                  onToggle={id => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  onAddSub={(pid, d) => setFolderModal({ mode: 'add', parentId: pid, depth: d, target: null, name: '' })}
                  onEditFolder={f => setFolderModal({ mode: 'edit', parentId: f.parent_id, depth: getDepth(f, folders), target: f, name: f.name })}
                  onDeleteFolder={deleteFolder}
                  onShareFolder={openShare}
                  userId={user?.id ?? ''} />
              )}
            </div>
          </div>

          {/* Bottom action */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button type="button" onClick={() => { openNewPage(); setLeftOpen(false); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nová stránka
            </button>
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

          {/* Welcome screen – no filter active */}
          {showWelcome && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--bg-hover)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Znalostní báze</h2>
              <p className="text-sm text-center max-w-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                Vyberte filtr nebo složku vlevo, nebo vytvořte novou stránku
              </p>
              <button type="button" onClick={() => openNewPage(null)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nová stránka
              </button>

              {/* Two-column: recently edited + newly created */}
              {pages.length > 0 && (
                <div className="mt-8 w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Naposledy upravené */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Naposledy upravené</p>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      {[...pages].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10).map((p, i, arr) => {
                        const path = getFolderPath(p.folder_id, folders);
                        return (
                          <div key={p.id}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                            style={{ background: 'var(--bg-card)', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                            onClick={() => selectPage(p.id)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                              {path && <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{path}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[p.status].color }} />
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(p.updated_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Nově vytvořené */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Nově vytvořené</p>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      {[...pages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).map((p, i, arr) => {
                        const path = getFolderPath(p.folder_id, folders);
                        return (
                          <div key={p.id}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                            style={{ background: 'var(--bg-card)', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                            onClick={() => selectPage(p.id)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                              {path && <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{path}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[p.status].color }} />
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List view – filter/search active, no page selected */}
          {showList && (
            <PageListView
              pages={filteredPages}
              folders={folders}
              members={members}
              favorites={favorites}
              allReviews={allReviews}
              filterLabel={filterLabel ?? ''}
              filterIcon={filterIcon}
              onSelectPage={selectPage}
              onNewPage={openNewPage}
              STATUS_CONFIG={STATUS_CONFIG}
            />
          )}

          {/* Page selected */}
          {selectedPage && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="flex-1 px-5 py-4 md:px-4 lg:px-8 lg:py-8 max-w-4xl w-full mx-auto">

                {/* Page header – actions row */}
                <div className="flex flex-col-reverse md:flex-row md:items-start gap-2 md:gap-3 mb-4 md:mb-6">
                  {/* Title – full width on mobile (below actions) */}
                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        onFocus={() => { if (selectedPage?.id.startsWith('__new__') && editTitle === 'Nová stránka') setEditTitle(''); }}
                        className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 focus:outline-none pb-1 text-base sm:text-2xl"
                        style={{ borderColor: 'var(--primary)', color: 'var(--text-primary)' }}
                        placeholder="Název stránky" />
                    ) : (
                      <h1 className="text-xl md:text-2xl font-bold break-words" style={{ color: 'var(--text-primary)' }}>{selectedPage.title}</h1>
                    )}
                  </div>
                  {/* Actions – top row on mobile, right-aligned on mobile */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 self-end md:self-auto">
                    {/* Back to list */}
                    {(listFilter !== null || search.trim()) && !selectedPage.id.startsWith('__new__') && (
                      <button type="button" onClick={backToList} title="Zpět na seznam"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        <span className="hidden sm:inline">Zpět</span>
                      </button>
                    )}
                    {/* Copy content */}
                    {!selectedPage.id.startsWith('__new__') && !editing && (
                      <button type="button" onClick={copyPageContent} title="Kopírovat obsah stránky"
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: copiedPage ? '#22c55e' : 'var(--text-muted)' }}>
                        {copiedPage ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                      </button>
                    )}
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                {editing ? (
                  <div className="flex flex-col gap-2 mb-6">
                    {/* Row 1 edit: Status + Složka */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Status select */}
                      <div className="relative">
                        <select value={editStatus} onChange={e => setEditStatus(e.target.value as KbPageStatus)}
                          className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-xs font-medium text-base sm:text-sm"
                          style={{ borderColor: STATUS_CONFIG[editStatus].color, color: STATUS_CONFIG[editStatus].color, background: 'var(--bg-hover)' }}>
                          {(Object.keys(STATUS_CONFIG) as KbPageStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: STATUS_CONFIG[editStatus].color }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                      {/* Složka select */}
                      <div className="relative">
                        <select value={editFolderId ?? ''} onChange={e => setEditFolderId(e.target.value || null)}
                          className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-xs text-base sm:text-sm"
                          style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                          <option value="">Bez složky</option>
                          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    {/* Status badge */}
                    <span className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: STATUS_CONFIG[selectedPage.status].color, color: STATUS_CONFIG[selectedPage.status].color }}>
                      {STATUS_CONFIG[selectedPage.status].label}
                    </span>
                    {/* Current folder */}
                    {selectedPage.folder_id && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        {getFolderPath(selectedPage.folder_id, folders)}
                      </span>
                    )}
                    {/* Last modified */}
                    {!selectedPage.id.startsWith('__new__') && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Upraveno {fmtDate(selectedPage.updated_at)}{selectedPage.updated_by ? ` · ${memberName(selectedPage.updated_by)}` : ''}
                      </span>
                    )}
                  </div>
                )}


                {/* Restricted access toggle (admin only, edit mode) */}
                {editing && canAdmin && (
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <button type="button" onClick={() => setEditRestricted(v => !v)}
                      className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                      style={{ background: editRestricted ? 'var(--primary)' : 'var(--border)' }}>
                      <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: editRestricted ? 'translateX(16px)' : 'translateX(0)' }} />
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
                    <>
                    {selectedPage.content
                      ? <PageViewer page={selectedPage} onChecklistToggle={handleChecklistToggle} onPageLinkClick={selectPage} />
                      : <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Stránka je prázdná. Klikněte Upravit a začněte psát.</p>
                    }
                    </>
                  )}
                </div>

                {/* Tabs (only for saved pages) */}
                {!editing && !selectedPage.id.startsWith('__new__') && (
                  <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex gap-1 mb-4 border-b overflow-x-auto" style={{ borderColor: 'var(--border)', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehavior: 'contain' }}>
                      {((() => {
                        const backlinksCount = pages.filter(p => p.id !== selectedPage.id && p.content.includes(`data-page-id="${selectedPage.id}"`)).length;
                        const pendingReviews = reviews.filter(r => !r.is_done).length;
                        return [
                          { id: 'comments', label: `Komentáře (${comments.length})` },
                          { id: 'history', label: `Historie (${versions.length})` },
                          canAdmin ? { id: 'access', label: 'Přístupy' } : null,
                          { id: 'backlinks', label: `Odkazující (${backlinksCount})` },
                          { id: 'reviews', label: `Revize${pendingReviews > 0 ? ` (${pendingReviews})` : ''}` },
                        ].filter(Boolean) as { id: string; label: string }[];
                      })()).map(tab => (
                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as PageTab)}
                          className="px-3 md:px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0"
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
                                    className="flex-1 px-3 py-1.5 rounded-lg border text-base md:text-sm" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
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
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* New comment */}
                        <div className="flex gap-3 mt-3 pb-8 md:pb-0">
                          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: members.find(m => m.user_id === user?.id)?.avatar_color ?? '#6366f1' }}>
                            {getInitials(profile?.display_name ?? '?')}
                          </div>
                          <div className="flex-1 flex gap-2">
                            <input value={newComment} onChange={e => setNewComment(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                              placeholder="Přidat komentář…" className="flex-1 px-3 py-2 rounded-xl border text-base md:text-sm"
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

                    {/* Access */}
                    {activeTab === 'access' && canAdmin && (
                      <div>
                        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                          <button type="button" onClick={() => {
                            const newVal = !selectedPage.is_restricted;
                            // Optimistický update
                            setSelectedPage(prev => prev ? { ...prev, is_restricted: newVal } : prev);
                            setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, is_restricted: newVal } : p));
                            supabase.from('trackino_kb_pages').update({ is_restricted: newVal }).eq('id', selectedPage.id).then(() => {});
                          }}
                            className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                            style={{ background: selectedPage.is_restricted ? 'var(--primary)' : 'var(--border)' }}>
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: selectedPage.is_restricted ? 'translateX(16px)' : 'translateX(0)' }} />
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
                                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: hasAccess ? 'translateX(16px)' : 'translateX(0)' }} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Backlinks */}
                    {activeTab === 'backlinks' && (
                      <div>
                        {(() => {
                          const linking = pages.filter(p => p.id !== selectedPage.id && p.content.includes(`data-page-id="${selectedPage.id}"`));
                          if (linking.length === 0) {
                            return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádná stránka na tuto stránku neodkazuje.</p>;
                          }
                          return linking.map(p => {
                            const path = getFolderPath(p.folder_id, folders);
                            return (
                              <div key={p.id} className="flex items-center gap-3 py-3 border-b cursor-pointer hover:bg-[var(--bg-hover)] rounded-lg px-2 transition-colors" style={{ borderColor: 'var(--border)' }}
                                onClick={() => selectPage(p.id)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                                  {path && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{path}</p>}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[p.status].color }} />
                                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{STATUS_CONFIG[p.status].label}</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}

                    {/* Reviews tab */}
                    {activeTab === 'reviews' && (
                      <div>
                        {reviews.length === 0 && !canAdmin && (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné revize</p>
                        )}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {reviews.map(r => {
                            const overdue = !r.is_done && new Date(r.review_date + 'T23:59:59') < new Date();
                            return (
                              <div key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs" style={{
                                borderColor: overdue && !r.is_done ? '#ef4444' : 'var(--border)',
                                color: r.is_done ? 'var(--text-muted)' : overdue ? '#ef4444' : 'var(--text-secondary)',
                                opacity: r.is_done ? 0.55 : 1,
                                background: 'var(--bg-hover)',
                              }}>
                                <button type="button" onClick={() => toggleReviewDone(r.id, !r.is_done)}
                                  className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                                  style={{ borderColor: r.is_done ? 'var(--primary)' : 'currentColor', background: r.is_done ? 'var(--primary)' : 'transparent' }}>
                                  {r.is_done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                </button>
                                <span>{memberName(r.assigned_to)} · {new Date(r.review_date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</span>
                                {r.note && (
                                  <span title={r.note} className="opacity-70 flex items-center">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                                  </span>
                                )}
                                {canAdmin && (
                                  <button type="button" onClick={() => deleteReview(r.id)} className="hover:opacity-70 flex items-center" style={{ color: 'inherit' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {canAdmin && (
                          <button type="button" onClick={() => { setReviewModal(true); setReviewForm({ assigned_to: user?.id ?? '', review_date: '', note: '' }); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium hover:bg-[var(--bg-hover)] transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Přidat revizi
                          </button>
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

      {/* SHARE FOLDER MODAL */}
      {shareModal.open && shareModal.folder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareModal({ open: false, folder: null })}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Sdílet složku „{shareModal.folder.name}"</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její stránky vidět</p>
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
                {members.filter(m => m.user_id !== user?.id).map(m => (
                  <label key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{ background: shareUserIds.includes(m.user_id) ? 'var(--bg-active)' : 'transparent' }}
                    onMouseEnter={e => { if (!shareUserIds.includes(m.user_id)) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!shareUserIds.includes(m.user_id)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <input type="checkbox" checked={shareUserIds.includes(m.user_id)}
                      onChange={() => setShareUserIds(prev => prev.includes(m.user_id) ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id])}
                      className="accent-[var(--primary)]" />
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                      {m.display_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
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
              <button type="button" onClick={() => setShareModal({ open: false, folder: null })} className="px-3 py-1.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button type="button" onClick={saveShare} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
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
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat revizi</h3>
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
