'use client';

interface Props {
  usedDays: number;
  totalDays: number | null;
  remainingDays: number | null;
  currentYear: number;
  isWorkspaceAdmin: boolean;
  selectedUserId: string;
}

export function VacationStats({ usedDays, totalDays, remainingDays, currentYear, isWorkspaceAdmin, selectedUserId }: Props) {
  return (
    <>
      {selectedUserId !== 'all' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border px-4 py-4 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--primary)' }}>{usedDays}</div>
            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Čerpáno</div>
          </div>
          <div className="rounded-xl border px-4 py-4 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold tabular-nums" style={{ color: remainingDays !== null && remainingDays < 0 ? 'var(--danger)' : 'var(--success, #16a34a)' }}>
              {remainingDays !== null ? remainingDays : '—'}
            </div>
            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Zbývá</div>
          </div>
          <div className="rounded-xl border px-4 py-4 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {totalDays ?? '—'}
            </div>
            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>Celkový nárok</div>
          </div>
        </div>
      )}

      {totalDays === null && selectedUserId !== 'all' && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: '#f59e0b', background: '#fffbeb', color: '#92400e' }}>
          Pro rok {currentYear} není nastaven celkový nárok dovolené.
          {isWorkspaceAdmin && <> Nastavte ho v <a href="/settings" className="underline font-medium">Nastavení → Dovolené</a>.</>}
        </div>
      )}
    </>
  );
}
