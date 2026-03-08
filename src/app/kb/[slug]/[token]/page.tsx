'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface PublicPage {
  title: string;
  content: string;
  updated_at: string;
  workspace_name: string;
}

export default function KbPublicPage() {
  const params = useParams();
  const token = params.token as string;
  const [page, setPage] = useState<PublicPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/kb-public?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setPage(data); }
        setLoading(false);
      })
      .catch(() => { setError('Nepodařilo se načíst stránku'); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Stránka nenalezena</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {error || 'Tento odkaz je neplatný nebo stránka již není veřejná.'}
          </p>
        </div>
      </div>
    );
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            {page.workspace_name && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                {page.workspace_name}
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Aktualizováno {fmtDate(page.updated_at)}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {page.title}
          </h1>
        </div>

        {/* Content */}
        <div className="prose-kb prose-view" dangerouslySetInnerHTML={{ __html: page.content }} style={{ color: 'var(--text-primary)' }} />

        {/* Prose-view styles (same as KB) */}
        <style>{`
          .prose-view h1{font-size:1.6em;font-weight:800;margin:28px 0 10px;line-height:1.2}
          .prose-view h2{font-size:1.25em;font-weight:700;margin:24px 0 8px}
          .prose-view h3{font-size:1.05em;font-weight:600;margin:20px 0 6px}
          .prose-view ul{list-style:disc;padding-left:32px;margin:4px 0}
          .prose-view ol{list-style:decimal;padding-left:32px;margin:4px 0}
          .prose-view p{margin:4px 0;line-height:1.6}
          .prose-view pre{position:relative;background:var(--bg-hover);padding:12px 12px;border-radius:8px;font-family:monospace;font-size:13px;overflow-x:auto;margin:16px 0;border:1px solid var(--border);white-space:pre-wrap;word-break:break-all}
          .prose-view pre code{white-space:pre-wrap;word-break:break-all;display:block}
          .prose-view .kb-checklist{list-style:none;padding-left:2px}
          .prose-view .kb-check-unchecked,.prose-view .kb-check-checked{line-height:1.8}
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
          .prose-view a{color:var(--primary);text-decoration:underline}
        `}</style>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Publikováno z{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Trackino</span>
          </p>
        </div>
      </div>
    </div>
  );
}
