'use client';

import { VacationEntryWithProfile } from './types';
import { formatDate } from './utils';

interface Props {
  loading: boolean;
  approvedEntries: VacationEntryWithProfile[];
  isWorkspaceAdmin: boolean;
  selectedUserId: string;
  currentYear: number;
  myPendingRejectedEntries: VacationEntryWithProfile[];
  onDelete: (id: string) => void;
}

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);

export function VacationRecordsTab({
  loading,
  approvedEntries,
  isWorkspaceAdmin,
  selectedUserId,
  currentYear,
  myPendingRejectedEntries,
  onDelete,
}: Props) {
  return (
    <>
      {/* Seznam schválených záznamů */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : approvedEntries.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Žádné schválené záznamy dovolené pro rok {currentYear}.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <div
              className="grid gap-4 px-4 py-2.5 border-b text-xs font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', minWidth: '480px', gridTemplateColumns: isWorkspaceAdmin && selectedUserId === 'all' ? '1fr 110px 110px 55px 1fr 36px' : '110px 110px 55px 1fr 36px' }}
            >
              {isWorkspaceAdmin && selectedUserId === 'all' && <span>Uživatel</span>}
              <span>Od</span><span>Do</span><span>Dní</span><span>Poznámka</span><span></span>
            </div>
            {approvedEntries.map(entry => (
              <div
                key={entry.id}
                className="grid gap-4 px-4 py-3 border-b last:border-b-0 items-center group transition-colors"
                style={{ borderColor: 'var(--border)', minWidth: '480px', gridTemplateColumns: isWorkspaceAdmin && selectedUserId === 'all' ? '1fr 110px 110px 55px 1fr 36px' : '110px 110px 55px 1fr 36px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {isWorkspaceAdmin && selectedUserId === 'all' && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}>
                      {entry.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.profile?.display_name ?? 'Neznámý'}</span>
                  </div>
                )}
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(entry.start_date)}</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{formatDate(entry.end_date)}</span>
                <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--primary)' }}>{entry.days} d</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{entry.note || '—'}</span>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  title="Smazat záznam"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sekce: Moje čekající a zamítnuté žádosti */}
      {!loading && myPendingRejectedEntries.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Moje žádosti</h3>
          <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {myPendingRejectedEntries.map(entry => (
              <div key={entry.id} className="px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {entry.status === 'pending' ? (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                        ⏳ Čeká na schválení
                      </span>
                    ) : (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        ✕ Zamítnuto
                      </span>
                    )}
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {formatDate(entry.start_date)} – {formatDate(entry.end_date)}
                    </span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--primary)' }}>{entry.days} d</span>
                    {entry.note && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {entry.note}</span>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="flex-shrink-0 p-1 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Smazat žádost"
                  >
                    <TrashIcon />
                  </button>
                </div>
                {entry.status === 'rejected' && entry.reviewer_note && (
                  <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                    <strong>Důvod zamítnutí:</strong> {entry.reviewer_note}
                  </div>
                )}
                {entry.status === 'rejected' && !entry.reviewer_note && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Zamítnuto bez uvedení důvodu.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
