'use client';

import { StatusBadge } from './InvoiceRow';
import { fmtDate, fmtMonth } from '../utils';
import type { InvoiceWithUser } from '../types';

interface CurrentPeriodCardProps {
  invoice: InvoiceWithUser;
  currencySymbol: string;
  downloadingId: string | null;
  onOpenDetail: (inv: InvoiceWithUser) => void;
  onDownloadPdf: (inv: InvoiceWithUser) => void;
}

export function CurrentPeriodCard({
  invoice,
  currencySymbol,
  downloadingId,
  onOpenDetail,
  onDownloadPdf,
}: CurrentPeriodCardProps) {
  return (
    <div
      className="mb-5 rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
        onClick={() => onOpenDetail(invoice)}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {fmtMonth(invoice.billing_period_year, invoice.billing_period_month)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>VS: {invoice.variable_symbol}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Vystaveno: {fmtDate(invoice.issue_date)}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Splatnost: {fmtDate(invoice.due_date)}</span>
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
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={invoice.status} />
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetail(invoice); }}
            title="Zobrazit detail"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
