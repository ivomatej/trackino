'use client';

import type { InvoiceWithUser } from '../types';
import { fmtMonth, inputCls, inputStyle } from '../utils';

interface ReturnModalProps {
  returnModalInvoice: InvoiceWithUser;
  returnNote: string;
  setReturnNote: (v: string) => void;
  returningId: string | null;
  onClose: () => void;
  onReturn: () => void;
}

export function ReturnModal({
  returnModalInvoice,
  returnNote,
  setReturnNote,
  returningId,
  onClose,
  onReturn,
}: ReturnModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl shadow-xl z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Vrátit fakturu k opravě</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            {returnModalInvoice.profile?.display_name} · {fmtMonth(returnModalInvoice.billing_period_year, returnModalInvoice.billing_period_month)}
          </p>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Poznámka pro uživatele *
          </label>
          <textarea
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            rows={3}
            placeholder="např. Uprav fakturační údaje, chybí DIČ…"
            className={inputCls}
            style={inputStyle}
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zrušit
            </button>
            <button
              onClick={onReturn}
              disabled={!returnNote.trim() || !!returningId}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
              style={{ background: '#d97706' }}
            >
              {returningId ? 'Odesílám...' : 'Vrátit k opravě'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
