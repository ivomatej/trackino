'use client';

import type { KbFolder, KbPage } from '@/types/database';
import { STATUS_CONFIG } from './types';
import { getFolderPath } from './utils';

// ── KB Welcome Screen ─────────────────────────────────────────────────────────

export default function KbWelcomeScreen({ pages, folders, onSelectPage, onNewPage }: {
  pages: KbPage[];
  folders: KbFolder[];
  onSelectPage: (id: string) => void;
  onNewPage: () => void;
}) {
  return (
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
      <button type="button" onClick={() => onNewPage()}
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
                    onClick={() => onSelectPage(p.id)}>
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
                    onClick={() => onSelectPage(p.id)}>
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
  );
}
