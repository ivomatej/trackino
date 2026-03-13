'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useInvoices } from './useInvoices';
import { CurrentPeriodCard } from './CurrentPeriodCard';
import { InvoiceRow } from './InvoiceRow';
import { SubmitInvoiceForm } from './SubmitInvoiceForm';
import { InvoiceFilters } from './InvoiceFilters';
import { ApproveModal } from './ApproveModal';
import { ReturnModal } from './ReturnModal';
import { DetailModal } from './DetailModal';
import { fmtMonth, canSubmitInvoice } from '../utils';

export function InvoicesContent() {
  const { currentWorkspace } = useWorkspace();
  const inv = useInvoices();

  if (!currentWorkspace) return null;

  // Sdílené props pro InvoiceRow
  const rowProps = {
    activeTab: inv.activeTab,
    currencySymbol: inv.currencySymbol,
    downloadingId: inv.downloadingId,
    payingId: inv.payingId,
    canManageBilling: inv.canManageBilling,
    isWorkspaceAdmin: inv.isWorkspaceAdmin,
    onOpenDetail: inv.openDetail,
    onDownloadPdf: inv.downloadPdf,
    onOpenApproveModal: inv.openApproveModal,
    onSetReturnModal: inv.setReturnModalInvoice,
    onMarkAsPaid: inv.markAsPaid,
  };

  return (
    <DashboardLayout moduleName="Fakturace">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Fakturace</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Správa faktur a žádostí o proplacení
            </p>
          </div>
          {inv.canInvoice && !inv.showSubmitForm && !inv.alreadySubmitted && canSubmitInvoice() && (
            <button
              onClick={() => inv.setShowSubmitForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--primary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Požádat o fakturaci
            </button>
          )}
        </div>

        {/* Banner – vráceno k opravě */}
        {inv.canInvoice && inv.returnedForCurrentPeriod && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl border" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                Faktura za <strong>{fmtMonth(inv.prevYear, inv.prevMonth)}</strong> byla vrácena k opravě
              </p>
              {inv.returnedForCurrentPeriod.note && (
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>{inv.returnedForCurrentPeriod.note}</p>
              )}
              <p className="text-xs mt-1" style={{ color: '#b45309' }}>Opravte fakturu a podejte ji znovu pomocí tlačítka výše.</p>
            </div>
          </div>
        )}

        {/* Karta aktuálního fakturačního období */}
        {inv.canInvoice && inv.alreadySubmitted && inv.currentPeriodInvoice && (
          <CurrentPeriodCard
            invoice={inv.currentPeriodInvoice}
            currencySymbol={inv.currencySymbol}
            downloadingId={inv.downloadingId}
            onOpenDetail={inv.openDetail}
            onDownloadPdf={inv.downloadPdf}
          />
        )}

        {/* Formulář pro podání faktury */}
        {inv.showSubmitForm && inv.canInvoice && (
          <SubmitInvoiceForm
            prevYear={inv.prevYear}
            prevMonth={inv.prevMonth}
            submitIssueDate={inv.submitIssueDate}
            setSubmitIssueDate={inv.setSubmitIssueDate}
            submitDueDate={inv.submitDueDate}
            setSubmitDueDate={inv.setSubmitDueDate}
            submitVarSymbol={inv.submitVarSymbol}
            setSubmitVarSymbol={inv.setSubmitVarSymbol}
            submitIsVat={inv.submitIsVat}
            setSubmitIsVat={inv.setSubmitIsVat}
            submitPdf={inv.submitPdf}
            setSubmitPdf={inv.setSubmitPdf}
            submitNote={inv.submitNote}
            setSubmitNote={inv.setSubmitNote}
            submitting={inv.submitting}
            submitError={inv.submitError}
            userBillingProfile={inv.userBillingProfile}
            onClose={() => inv.setShowSubmitForm(false)}
            onSubmit={inv.submitInvoice}
          />
        )}

        {/* Taby + vyhledávání */}
        <InvoiceFilters
          visibleTabs={inv.visibleTabs}
          activeTab={inv.activeTab}
          onChangeTab={(tab) => {
            inv.setActiveTab(tab);
            inv.setInvoiceSearch('');
            inv.setFilterMonth('');
            inv.setFilterYear('');
          }}
          canApprove={inv.canApprove}
          canManageBilling={inv.canManageBilling}
          filterMonth={inv.filterMonth}
          setFilterMonth={inv.setFilterMonth}
          filterYear={inv.filterYear}
          setFilterYear={inv.setFilterYear}
          invoiceSearch={inv.invoiceSearch}
          setInvoiceSearch={inv.setInvoiceSearch}
          availableYears={inv.availableYears}
        />

        {/* Content */}
        {inv.loading ? (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Moje faktury */}
            {inv.activeTab === 'my' && (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {inv.myInvoices.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Žádné faktury</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Klikněte na „Požádat o fakturaci" pro podání první faktury.
                    </p>
                  </div>
                ) : (
                  inv.myInvoices.map(i => <InvoiceRow key={i.id} invoice={i} showUser={false} {...rowProps} />)
                )}
              </div>
            )}

            {/* Ke schválení */}
            {inv.activeTab === 'approve' && inv.canApprove && (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {inv.pendingInvoicesFiltered.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {inv.invoiceSearch ? 'Žádné výsledky' : 'Vše schváleno'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {inv.invoiceSearch ? `Žádná faktura neodpovídá „${inv.invoiceSearch}"` : 'Žádné faktury nečekají na schválení.'}
                    </p>
                  </div>
                ) : (
                  inv.pendingInvoicesFiltered.map(i => <InvoiceRow key={i.id} invoice={i} showUser={true} {...rowProps} />)
                )}
              </div>
            )}

            {/* Přehled faktur */}
            {inv.activeTab === 'billing' && (inv.canManageBilling || inv.isWorkspaceAdmin) && (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {inv.billingInvoicesFiltered.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {inv.invoiceSearch ? `Žádná faktura neodpovídá „${inv.invoiceSearch}"` : 'Žádné schválené ani proplacené faktury.'}
                    </p>
                  </div>
                ) : (
                  inv.billingInvoicesFiltered.map(i => <InvoiceRow key={i.id} invoice={i} showUser={true} {...rowProps} />)
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ MODAL: Schválení faktury ═══ */}
      {inv.approveModalInvoice && (
        <ApproveModal
          approveModalInvoice={inv.approveModalInvoice}
          approveHours={inv.approveHours}
          setApproveHours={inv.setApproveHours}
          approveAmount={inv.approveAmount}
          setApproveAmount={inv.setApproveAmount}
          approveNote={inv.approveNote}
          setApproveNote={inv.setApproveNote}
          approveLoading={inv.approveLoading}
          approvingId={inv.approvingId}
          currencySymbol={inv.currencySymbol}
          onClose={() => inv.setApproveModalInvoice(null)}
          onApprove={inv.approveInvoice}
        />
      )}

      {/* ═══ MODAL: Vrátit k opravě ═══ */}
      {inv.returnModalInvoice && (
        <ReturnModal
          returnModalInvoice={inv.returnModalInvoice}
          returnNote={inv.returnNote}
          setReturnNote={inv.setReturnNote}
          returningId={inv.returningId}
          onClose={() => { inv.setReturnModalInvoice(null); inv.setReturnNote(''); }}
          onReturn={inv.returnInvoice}
        />
      )}

      {/* ═══ MODAL: Detail faktury ═══ */}
      {inv.detailInvoice && (
        <DetailModal
          detailInvoice={inv.detailInvoice}
          pdfUrl={inv.pdfUrl}
          pdfLoading={inv.pdfLoading}
          editingDetailId={inv.editingDetailId}
          setEditingDetailId={inv.setEditingDetailId}
          editDetailIssueDate={inv.editDetailIssueDate}
          setEditDetailIssueDate={inv.setEditDetailIssueDate}
          editDetailDueDate={inv.editDetailDueDate}
          setEditDetailDueDate={inv.setEditDetailDueDate}
          editDetailHours={inv.editDetailHours}
          setEditDetailHours={inv.setEditDetailHours}
          editDetailAmount={inv.editDetailAmount}
          setEditDetailAmount={inv.setEditDetailAmount}
          editDetailApprovedAt={inv.editDetailApprovedAt}
          setEditDetailApprovedAt={inv.setEditDetailApprovedAt}
          editDetailPaidAt={inv.editDetailPaidAt}
          setEditDetailPaidAt={inv.setEditDetailPaidAt}
          savingDetail={inv.savingDetail}
          changingStatusId={inv.changingStatusId}
          canApprove={inv.canApprove}
          canManageBilling={inv.canManageBilling}
          currencySymbol={inv.currencySymbol}
          onClose={() => { inv.setDetailInvoice(null); inv.setEditingDetailId(null); }}
          onStartEdit={inv.startDetailEdit}
          onSaveEdit={inv.saveDetailEdit}
          onChangeStatus={inv.changeDetailStatus}
        />
      )}
    </DashboardLayout>
  );
}
