'use client';

import type { KbPage } from '@/types/database';

// ── Page Viewer (view mode HTML renderer) ─────────────────────────────────────

export default function PageViewer({ page, onChecklistToggle, onPageLinkClick }: {
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
        .prose-view .kb-task-box{position:relative;border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin:16px 0;background:var(--bg-hover)}
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
