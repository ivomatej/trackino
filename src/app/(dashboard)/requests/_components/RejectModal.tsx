'use client';

interface Props {
  note: string;
  setNote: (note: string) => void;
  rejecting: boolean;
  onReject: () => void;
  onClose: () => void;
}

export function RejectModal({ note, setNote, rejecting, onReject, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Zamítnout žádost</h2>
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Důvod zamítnutí (volitelné)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Proč se žádost zamítá..."
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', resize: 'none' }}
            autoFocus
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Zrušit
          </button>
          <button
            onClick={onReject}
            disabled={rejecting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--danger)' }}
          >
            {rejecting ? 'Zamítám...' : 'Zamítnout'}
          </button>
        </div>
      </div>
    </div>
  );
}
