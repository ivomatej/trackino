'use client';

import type { InvoiceStatus } from '@/types/database';
import type { InvoiceWithUser } from '../types';
import { fmtDate, fmtMonth, inputCls, inputStyle } from '../utils';
import { StatusBadge } from './InvoiceRow';

interface DetailModalProps {
  detailInvoice: InvoiceWithUser;
  pdfUrl: string | null;
  pdfLoading: boolean;
  editingDetailId: string | null;
  setEditingDetailId: (v: string | null) => void;
  editDetailIssueDate: string;
  setEditDetailIssueDate: (v: string) => void;
  editDetailDueDate: string;
  setEditDetailDueDate: (v: string) => void;
  editDetailHours: string;
  setEditDetailHours: (v: string) => void;
  editDetailAmount: string;
  setEditDetailAmount: (v: string) => void;
  editDetailApprovedAt: string;
  setEditDetailApprovedAt: (v: string) => void;
  editDetailPaidAt: string;
  setEditDetailPaidAt: (v: string) => void;
  savingDetail: boolean;
  changingStatusId: string | null;
  canApprove: boolean;
  canManageBilling: boolean;
  currencySymbol: string;
  onClose: () => void;
  onStartEdit: (invoice: InvoiceWithUser) => void;
  onSaveEdit: () => void;
  onChangeStatus: (invoiceId: string, newStatus: InvoiceStatus) => void;
}

export function DetailModal({
  detailInvoice,
  pdfUrl,
  pdfLoading,
  editingDetailId,
  setEditingDetailId,
  editDetailIssueDate,
  setEditDetailIssueDate,
  editDetailDueDate,
  setEditDetailDueDate,
  editDetailHours,
  setEditDetailHours,
  editDetailAmount,
  setEditDetailAmount,
  editDetailApprovedAt,
  setEditDetailApprovedAt,
  editDetailPaidAt,
  setEditDetailPaidAt,
  savingDetail,
  changingStatusId,
  canApprove,
  canManageBilling,
  currencySymbol,
  onClose,
  onStartEdit,
  onSaveEdit,
  onChangeStatus,
}: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl shadow-xl z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Hlavička */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Faktura – {fmtMonth(detailInvoice.billing_period_year, detailInvoice.billing_period_month)}
              </h3>
              <StatusBadge status={detailInvoice.status} />
            </div>
            {detailInvoice.profile && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {detailInvoice.profile.display_name ?? detailInvoice.profile.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Tlačítko Upravit – pouze pro adminy, pokud není storno */}
            {(canApprove || canManageBilling) && detailInvoice.status !== 'cancelled' && editingDetailId !== detailInvoice.id && (
              <button
                onClick={() => onStartEdit(detailInvoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Upravit
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5">

          {/* ── EDIT MODE ── */}
          {editingDetailId === detailInvoice.id ? (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Datum vystavení</label>
                  <input
                    type="date"
                    value={editDetailIssueDate}
                    onChange={(e) => setEditDetailIssueDate(e.target.value)}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Datum splatnosti</label>
                  <input
                    type="date"
                    value={editDetailDueDate}
                    onChange={(e) => setEditDetailDueDate(e.target.value)}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Hodiny</label>
                  <input
                    type="number"
                    value={editDetailHours}
                    onChange={(e) => setEditDetailHours(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.5"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Částka ({currencySymbol})</label>
                  <input
                    type="number"
                    value={editDetailAmount}
                    onChange={(e) => setEditDetailAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="1"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
              {/* Datum schválení / proplacení – editovatelné pokud existuje */}
              {(detailInvoice.status === 'approved' || detailInvoice.status === 'paid') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Datum schválení</label>
                    <input
                      type="date"
                      value={editDetailApprovedAt}
                      onChange={(e) => setEditDetailApprovedAt(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  {detailInvoice.status === 'paid' && (
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Datum proplacení</label>
                      <input
                        type="date"
                        value={editDetailPaidAt}
                        onChange={(e) => setEditDetailPaidAt(e.target.value)}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>
              )}
              {/* Statické pole jen pro čtení */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Variabilní symbol</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{detailInvoice.variable_symbol}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Plátce DPH</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{detailInvoice.is_vat_payer ? 'Ano' : 'Ne'}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditingDetailId(null)}
                  className="flex-1 py-2 rounded-xl border text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={onSaveEdit}
                  disabled={savingDetail}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingDetail ? 'Ukládám...' : 'Uložit změny'}
                </button>
              </div>
            </div>
          ) : (
            /* ── VIEW MODE ── */
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Datum vystavení', value: fmtDate(detailInvoice.issue_date) },
                { label: 'Datum splatnosti', value: fmtDate(detailInvoice.due_date) },
                { label: 'Variabilní symbol', value: detailInvoice.variable_symbol },
                { label: 'Plátce DPH', value: detailInvoice.is_vat_payer ? 'Ano' : 'Ne' },
                ...(detailInvoice.total_hours !== null ? [{ label: 'Hodiny', value: `${detailInvoice.total_hours} h` }] : []),
                ...(detailInvoice.amount !== null ? [{ label: 'Částka', value: `${detailInvoice.amount.toLocaleString('cs-CZ')} ${currencySymbol}` }] : []),
                ...(detailInvoice.approved_at ? [{ label: 'Schváleno', value: fmtDate(detailInvoice.approved_at.split('T')[0]) }] : []),
                ...(detailInvoice.paid_at ? [{ label: 'Proplaceno', value: fmtDate(detailInvoice.paid_at.split('T')[0]) }] : []),
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Poznámka */}
          {detailInvoice.note && (
            <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka</div>
              {detailInvoice.note}
            </div>
          )}

          {/* PDF */}
          {detailInvoice.pdf_url && (
            <div className="mb-4">
              {pdfLoading ? (
                <div className="py-4 text-center"><div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
              ) : pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'var(--bg-hover)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  Stáhnout PDF faktury
                </a>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nepodařilo se načíst PDF.</p>
              )}
            </div>
          )}

          {/* ── Změna stavu (jen admin, jen ve view mode) ── */}
          {(canApprove || canManageBilling) && editingDetailId !== detailInvoice.id && (
            (() => {
              const s = detailInvoice.status;
              const btns: { label: string; status: InvoiceStatus; color: string }[] = [];
              if (s === 'paid') {
                btns.push({ label: 'Vrátit na Schváleno', status: 'approved', color: '#6366f1' });
                btns.push({ label: 'Stornovat', status: 'cancelled', color: '#ef4444' });
              } else if (s === 'approved') {
                btns.push({ label: 'Vrátit na Čekající', status: 'pending', color: '#d97706' });
                btns.push({ label: 'Stornovat', status: 'cancelled', color: '#ef4444' });
              } else if (s === 'pending') {
                btns.push({ label: 'Stornovat', status: 'cancelled', color: '#ef4444' });
              }
              if (btns.length === 0) return null;
              return (
                <div className="border-t pt-4 mt-2" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Změna stavu faktury</p>
                  <div className="flex gap-2 flex-wrap">
                    {btns.map(btn => (
                      <button
                        key={btn.status}
                        onClick={() => onChangeStatus(detailInvoice.id, btn.status)}
                        disabled={!!changingStatusId}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: btn.color }}
                      >
                        {changingStatusId === detailInvoice.id ? '...' : btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

        </div>
      </div>
    </div>
  );
}
