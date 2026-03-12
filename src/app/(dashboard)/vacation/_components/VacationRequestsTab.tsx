'use client';

import { VacationEntryWithProfile } from './types';
import { formatDate } from './utils';

interface Props {
  loading: boolean;
  pendingRequestEntries: VacationEntryWithProfile[];
  approving: string | null;
  isWorkspaceAdmin: boolean;
  onApprove: (id: string) => void;
  onOpenRejectModal: (id: string) => void;
}

export function VacationRequestsTab({
  loading,
  pendingRequestEntries,
  approving,
  isWorkspaceAdmin,
  onApprove,
  onOpenRejectModal,
}: Props) {
  return (
    <>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {isWorkspaceAdmin
          ? 'Čekající žádosti o dovolenou od všech členů workspace.'
          : 'Čekající žádosti o dovolenou od vašich podřízených.'}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pendingRequestEntries.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné čekající žádosti k vyřízení. 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRequestEntries.map(entry => (
            <div key={entry.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-4">
                {/* Info o uživateli a záznamu */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}
                  >
                    {entry.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {entry.profile?.display_name ?? 'Neznámý uživatel'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(entry.start_date)} – {formatDate(entry.end_date)}
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                        {entry.days} pracovních dnů
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Poznámka: {entry.note}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Podáno {new Date(entry.created_at).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>
                </div>
                {/* Akce */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onOpenRejectModal(entry.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-light)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    Zamítnout
                  </button>
                  <button
                    onClick={() => onApprove(entry.id)}
                    disabled={approving === entry.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--success)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {approving === entry.id ? '...' : 'Schválit'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
