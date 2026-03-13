'use client';

export function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
      Čeká na vyřízení
    </span>
  );
  if (status === 'approved') return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#d1fae5', color: '#065f46' }}>
      Schváleno
    </span>
  );
  if (status === 'rejected') return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>
      Zamítnuto
    </span>
  );
  return null;
}
