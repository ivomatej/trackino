'use client';

import { useRef, useState, useEffect } from 'react';
import type { KbPage } from '@/types/database';
import type { KbMember } from './types';
import { getInitials } from './utils';

// ── Rich Editor ───────────────────────────────────────────────────────────────

export default function RichEditor({ value, onChange, members, pages }: {
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

  // Obnoví kurzor do editoru – buď ze savedRange, nebo zachová stávající pozici
  const restoreCursor = () => {
    if (savedRange.current) {
      try {
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
      } catch { /* ignore */ }
      savedRange.current = null;
    } else {
      // Pokud kurzor už je v editoru, neměnit pozici – jen fokus pokud není
      const sel = window.getSelection();
      const inside = sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode);
      if (!inside) ref.current?.focus();
    }
  };

  const ins = (html: string) => {
    setSelectionPopup(null);
    restoreCursor();
    document.execCommand('insertHTML', false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // insBlock: jako ins(), ale po vložení přesune kurzor do elementu s data-kbm atributem
  const insBlock = (html: string) => {
    setSelectionPopup(null);
    restoreCursor();
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
          // Task box delete – kliknutí na × v pravém horním rohu
          const taskBox = (e.target as Element).closest('.kb-task-box') as HTMLElement | null;
          if (taskBox) {
            const rect = taskBox.getBoundingClientRect();
            if (e.clientX > rect.right - 36 && e.clientY < rect.top + 36) {
              e.preventDefault();
              taskBox.remove();
              if (ref.current) onChange(ref.current.innerHTML);
              return;
            }
          }
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
        .prose-kb .kb-task-box{position:relative;border:1px solid var(--border);border-radius:10px;padding:12px 36px 12px 16px;margin:16px 0;background:var(--bg-hover)}
        .prose-kb .kb-task-box .kb-task-box-title{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px}
        .prose-kb .kb-task-box .kb-checklist{margin:0;padding-left:2px}
        .prose-kb .kb-task-box::after{content:"";position:absolute;top:10px;right:10px;width:18px;height:18px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'/%3E%3Cline x1='6' y1='6' x2='18' y2='18'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0;transition:opacity 0.15s;border-radius:4px}
        .prose-kb .kb-task-box:hover::after{opacity:0.5}
        .prose-kb .kb-task-box::after:hover{opacity:1}
        .prose-kb details.kb-toggle{border:none;border-radius:10px;background:var(--bg-hover);padding:0;margin:16px 0;overflow:hidden}
        .prose-kb details.kb-toggle>summary{padding:10px 14px;cursor:pointer;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px}
        .prose-kb details.kb-toggle>summary::-webkit-details-marker{display:none}
        .prose-kb details.kb-toggle>summary::before{content:"▶";font-size:0.65em;opacity:0.5;transition:transform 0.2s;display:inline-block}
        .prose-kb details.kb-toggle[open]>summary::before{transform:rotate(90deg)}
        .prose-kb details.kb-toggle>:not(summary){padding:4px 14px 12px;border-top:1px solid var(--border)}
      `}</style>
    </div>
    {/* Callout color picker – fixed positioning escapes overflow:hidden */}
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
