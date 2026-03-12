'use client';

import { VacationEntryWithProfile } from './types';
import { formatDate } from './utils';

interface Props {
  loading: boolean;
  archiveEntries: VacationEntryWithProfile[];
  isWorkspaceAdmin: boolean;
}

export function VacationArchiveTab({ loading, archiveEntries, isWorkspaceAdmin }: Props) {
  return (
    <>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {isWorkspaceAdmin
          ? 'Všechny vyřízené žádosti o dovolenou (schválené i zamítnuté).'
          : 'Vyřízené žádosti o dovolenou od vašich podřízených.'}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : archiveEntries.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné vyřízené záznamy dovolené. 🗂️</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archiveEntries.map(entry => (
            <div key={entry.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Info o uživateli a záznamu */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: entry.profile?.avatar_color ?? 'var(--primary)' }}
                  >
                    {entry.profile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
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
                    {/* Info o vyřízení */}
                    {entry.reviewerProfile && entry.reviewed_at && (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {entry.status === 'approved' ? 'Schválil/a' : 'Zamítnul/a'}{' '}
                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {entry.reviewerProfile.display_name}
                        </span>
                        {' · '}
                        {new Date(entry.reviewed_at).toLocaleDateString('cs-CZ')}
                      </p>
                    )}
                  </div>
                </div>
                {/* Badge stavu */}
                <div className="flex-shrink-0">
                  {entry.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Schváleno
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Zamítnuto
                    </span>
                  )}
                </div>
              </div>
              {/* Důvod zamítnutí */}
              {entry.status === 'rejected' && (
                <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                  {entry.reviewer_note
                    ? <><strong>Důvod zamítnutí:</strong> {entry.reviewer_note}</>
                    : 'Zamítnuto bez uvedení důvodu.'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
