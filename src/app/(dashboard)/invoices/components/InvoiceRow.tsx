'use client';

import type { InvoiceStatus } from '@/types/database';
import type { InvoiceWithUser, ViewTab } from '../types';
import { fmtDate, fmtMonth, STATUS_COLORS, STATUS_LABELS } from '../utils';

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: bg, color }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── InvoiceRow ───────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  invoice: InvoiceWithUser;
  showUser: boolean;
  activeTab: ViewTab;
  currencySymbol: string;
  downloadingId: string | null;
  payingId: string | null;
  canManageBilling: boolean;
  isWorkspaceAdmin: boolean;
  onOpenDetail: (invoice: InvoiceWithUser) => void;
  onDownloadPdf: (invoice: InvoiceWithUser) => void;
  onOpenApproveModal: (invoice: InvoiceWithUser) => void;
  onSetReturnModal: (invoice: InvoiceWithUser) => void;
  onMarkAsPaid: (id: string) => void;
}

export function InvoiceRow({
  invoice,
  showUser,
  activeTab,
  currencySymbol,
  downloadingId,
  payingId,
  canManageBilling,
  isWorkspaceAdmin,
  onOpenDetail,
  onDownloadPdf,
  onOpenApproveModal,
  onSetReturnModal,
  onMarkAsPaid,
}: InvoiceRowProps) {
  return (
    <div
      key={invoice.id}
      className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onClick={() => onOpenDetail(invoice)}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {showUser && (
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {invoice.profile?.display_name ?? invoice.profile?.email ?? 'Neznámý'}
            </span>
          )}
          {showUser && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>·</span>
          )}
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {fmtMonth(invoice.billing_period_year, invoice.billing_period_month)}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            VS: {invoice.variable_symbol}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Vystaveno: {fmtDate(invoice.issue_date)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Splatnost: {fmtDate(invoice.due_date)}
          </span>
        </div>
        {(invoice.amount !== null || invoice.total_hours !== null) && (
          <div className="flex items-center gap-1 mt-0.5">
            {invoice.amount !== null && (
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {invoice.amount.toLocaleString('cs-CZ')} {currencySymbol}
              </span>
            )}
            {invoice.total_hours !== null && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({invoice.total_hours} h)
              </span>
            )}
          </div>
        )}
        {(invoice.approved_at || invoice.paid_at) && (
          <div className="flex items-center gap-3 mt-0.5">
            {invoice.approved_at && (
              <span className="text-xs" style={{ color: '#1e40af' }}>
                Schváleno: {fmtDate(invoice.approved_at.split('T')[0])}
              </span>
            )}
            {invoice.paid_at && (
              <span className="text-xs font-medium" style={{ color: '#15803d' }}>
                Proplaceno: {fmtDate(invoice.paid_at.split('T')[0])}
              </span>
            )}
          </div>
        )}
        {/* Poznámka k vrácení – viditelná v "Moje faktury" */}
        {invoice.status === 'returned' && invoice.note && (
          <div className="flex items-center gap-1 mt-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
            <span className="text-xs" style={{ color: '#c2410c' }}>{invoice.note}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <StatusBadge status={invoice.status} />

        {/* Ikona: info – otevře detail */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDetail(invoice); }}
          title="Zobrazit detail"
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>

        {/* Ikona: stáhnout PDF */}
        {invoice.pdf_url && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownloadPdf(invoice); }}
            title="Stáhnout PDF"
            disabled={downloadingId === invoice.id}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {downloadingId === invoice.id ? (
              <div className="w-[15px] h-[15px] border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
        )}

        {/* Tlačítka pro schvalování */}
        {activeTab === 'approve' && invoice.status === 'pending' && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenApproveModal(invoice); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--success)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Schválit
          </button>
        )}
        {activeTab === 'approve' && invoice.status === 'pending' && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetReturnModal(invoice); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
            style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--warning-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.63" /></svg>
            Vrátit k opravě
          </button>
        )}
        {/* Proplacení – checkbox styl */}
        {activeTab === 'billing' && invoice.status === 'approved' && (canManageBilling || isWorkspaceAdmin) && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkAsPaid(invoice.id); }}
            disabled={payingId === invoice.id}
            title="Označit jako proplaceno"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors disabled:opacity-50 flex-shrink-0"
            style={{ color: '#16a34a', borderColor: '#16a34a', background: 'transparent' }}
            onMouseEnter={(e) => { if (!payingId) e.currentTarget.style.background = '#f0fdf4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span
              className="w-3.5 h-3.5 rounded border-2 border-current flex-shrink-0 flex items-center justify-center"
            >
              {payingId === invoice.id && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            {payingId === invoice.id ? 'Ukládám...' : 'Proplatit'}
          </button>
        )}
      </div>
    </div>
  );
}
