'use client';

import { useRef, useEffect } from 'react';

export function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, []);

  const cmd = (command: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertCode = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    const selected = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).toString() : '';
    document.execCommand('insertHTML', false,
      `<pre class="code-block" style="position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border)"><code>${selected || ''}</code></pre><p><br></p>`
    );
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const btn = (label: string, action: () => void, title?: string) => (
    <button type="button" title={title || label} onClick={action}
      className="px-2 py-1 rounded text-xs font-medium hover:bg-[var(--bg-active)] transition-colors"
      style={{ color: 'var(--text-secondary)' }}
    >{label}</button>
  );

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
        {btn('H2', () => cmd('formatBlock', 'h2'))}
        {btn('H3', () => cmd('formatBlock', 'h3'))}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
        {btn('B', () => cmd('bold'), 'Tučné')}
        {btn('I', () => cmd('italic'), 'Kurzíva')}
        {btn('U', () => cmd('underline'), 'Podtržení')}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
        {btn('• Seznam', () => cmd('insertUnorderedList'))}
        {btn('1. Seznam', () => cmd('insertOrderedList'))}
        <span className="w-px mx-1 self-stretch" style={{ background: 'var(--border)' }} />
        {btn('</> Kód', insertCode, 'Vložit blok kódu')}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        onClick={(e) => {
          const target = e.target as Element;
          const codeEl = target.closest('code');
          const preEl = target.closest('pre');

          // Kliknutí na copy ikonu (pravý horní roh pre bloku)
          if (preEl) {
            const rect = preEl.getBoundingClientRect();
            if (e.clientX > rect.right - 36 && e.clientY < rect.top + 32) {
              const code = preEl.querySelector('code')?.textContent ?? '';
              navigator.clipboard.writeText(code).catch(() => {});
              return;
            }
          }

        }}
        className="min-h-[200px] p-4 text-base sm:text-sm focus:outline-none prose-editor"
        style={{ color: 'var(--text-primary)', background: 'var(--bg-card)' }}
      />
      <style>{`
        .prose-editor h2{font-size:1.2em;font-weight:700;margin:12px 0 6px}
        .prose-editor h3{font-size:1.05em;font-weight:600;margin:10px 0 4px}
        .prose-editor ul{list-style:disc;padding-left:20px;margin:4px 0}
        .prose-editor ol{list-style:decimal;padding-left:20px;margin:4px 0}
        .prose-editor pre{position:relative;background:var(--bg-hover);padding:12px 40px 12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:8px 0;border:1px solid var(--border)}
        .prose-editor pre::after{content:"";position:absolute;top:8px;right:8px;width:20px;height:20px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center;cursor:pointer;opacity:0.5;transition:opacity 0.15s}
        .prose-editor pre:hover::after{opacity:1}
      `}</style>
    </div>
  );
}
