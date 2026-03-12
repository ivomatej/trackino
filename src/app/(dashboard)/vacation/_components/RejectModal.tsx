'use client';

interface Props {
  rejectModal: { id: string; note: string } | null;
  setRejectModal: (v: { id: string; note: string } | null) => void;
  onReject: () => void;
  rejecting: boolean;
}

export function RejectModal({ rejectModal, setRejectModal, onReject, rejecting }: Props) {
  if (!rejectModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}
    >
      <div className="w-full max-w-md rounded-xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Zamítnout žádost</h2>
          <button
            onClick={() => setRejectModal(null)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Důvod zamítnutí (volitelně)
          </label>
          <textarea
            value={rejectModal.note}
            onChange={e => setRejectModal({ ...rejectModal, note: e.target.value })}
            rows={3}
            placeholder="např. V daném termínu je plánovaný důležitý projekt."
            className="w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setRejectModal(null)}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Zrušit
          </button>
          <button
            onClick={onReject}
            disabled={rejecting}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--danger)' }}
          >
            {rejecting ? 'Ukládám…' : 'Zamítnout'}
          </button>
        </div>
      </div>
    </div>
  );
}
