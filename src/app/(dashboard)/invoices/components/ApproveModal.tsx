'use client';

import type { InvoiceWithUser } from '../types';
import { fmtDate, fmtMonth, inputCls, inputStyle } from '../utils';

interface ApproveModalProps {
  approveModalInvoice: InvoiceWithUser;
  approveHours: string;
  setApproveHours: (v: string) => void;
  approveAmount: string;
  setApproveAmount: (v: string) => void;
  approveNote: string;
  setApproveNote: (v: string) => void;
  approveLoading: boolean;
  approvingId: string | null;
  currencySymbol: string;
  onClose: () => void;
  onApprove: () => void;
}

export function ApproveModal({
  approveModalInvoice,
  approveHours,
  setApproveHours,
  approveAmount,
  setApproveAmount,
  approveNote,
  setApproveNote,
  approveLoading,
  approvingId,
  currencySymbol,
  onClose,
  onApprove,
}: ApproveModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl shadow-xl z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Schválit fakturu</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {approveModalInvoice.profile?.display_name} · {fmtMonth(approveModalInvoice.billing_period_year, approveModalInvoice.billing_period_month)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-6 pb-4">
          {/* Info z faktury */}
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span style={{ color: 'var(--text-muted)' }}>Datum vystavení:</span><br /><strong style={{ color: 'var(--text-primary)' }}>{fmtDate(approveModalInvoice.issue_date)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Datum splatnosti:</span><br /><strong style={{ color: 'var(--text-primary)' }}>{fmtDate(approveModalInvoice.due_date)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Variabilní symbol:</span><br /><strong style={{ color: 'var(--text-primary)' }}>{approveModalInvoice.variable_symbol}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Plátce DPH:</span><br /><strong style={{ color: 'var(--text-primary)' }}>{approveModalInvoice.is_vat_payer ? 'Ano' : 'Ne'}</strong></div>
            </div>
            {approveModalInvoice.note && (
              <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <em>{approveModalInvoice.note}</em>
              </div>
            )}
          </div>
          {approveLoading && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Načítám data z reportů…
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Odpracované hodiny
                {!approveLoading && approveHours && (
                  <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>(z reportů)</span>
                )}
              </label>
              <input type="number" value={approveHours} onChange={(e) => setApproveHours(e.target.value)} placeholder="0" min="0" step="0.5" disabled={approveLoading} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Částka ({currencySymbol})
                {!approveLoading && approveAmount && (
                  <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>(z reportů)</span>
                )}
              </label>
              <input type="number" value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} placeholder="0" min="0" step="1" disabled={approveLoading} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Poznámka ke schválení</label>
            <textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} rows={2} placeholder="Volitelná poznámka..." className={inputCls} style={inputStyle} />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Zrušit
            </button>
            <button
              onClick={onApprove}
              disabled={!!approvingId}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--success)' }}
            >
              {!approvingId && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              {approvingId ? 'Ukládám...' : 'Schválit fakturu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
