'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import type { Invoice, InvoiceStatus, Profile, WorkspaceBilling } from '@/types/database';

import type { ViewTab, InvoiceWithUser } from './types';
import { getPreviousMonthPeriod, canSubmitInvoice, toSlug, fmtDate, fmtMonth } from './utils';
import { InvoiceRow, StatusBadge } from './components/InvoiceRow';
import { SubmitInvoiceForm } from './components/SubmitInvoiceForm';
import { InvoiceFilters } from './components/InvoiceFilters';
import { ApproveModal } from './components/ApproveModal';
import { ReturnModal } from './components/ReturnModal';
import { DetailModal } from './components/DetailModal';

// ─── Main Component ──────────────────────────────────────────────────────────

function InvoicesContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership } = useWorkspace();
  const { isWorkspaceAdmin, isManager } = usePermissions();

  const canInvoice = currentMembership?.can_invoice ?? false;
  const canManageBilling = currentMembership?.can_manage_billing ?? false;
  const canApprove = isWorkspaceAdmin || isManager;

  // Výchozí tab dle oprávnění
  const defaultTab: ViewTab = canInvoice ? 'my' : canApprove ? 'approve' : 'billing';
  const [activeTab, setActiveTab] = useState<ViewTab>(defaultTab);

  const [invoices, setInvoices] = useState<InvoiceWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Stav podání nové faktury
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitIssueDate, setSubmitIssueDate] = useState('');
  const [submitDueDate, setSubmitDueDate] = useState('');
  const [submitVarSymbol, setSubmitVarSymbol] = useState('');
  const [submitIsVat, setSubmitIsVat] = useState(false);
  const [submitPdf, setSubmitPdf] = useState<File | null>(null);
  const [submitNote, setSubmitNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Schvalování
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveHours, setApproveHours] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveModalInvoice, setApproveModalInvoice] = useState<InvoiceWithUser | null>(null);

  // Proplacení
  const [payingId, setPayingId] = useState<string | null>(null);

  // Vrácení k opravě
  const [returnModalInvoice, setReturnModalInvoice] = useState<InvoiceWithUser | null>(null);
  const [returnNote, setReturnNote] = useState('');
  const [returningId, setReturningId] = useState<string | null>(null);

  // Stahování PDF
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Načítání dat z reportů při schvalování
  const [approveLoading, setApproveLoading] = useState(false);

  // Fakturační profil uživatele (zobrazuje se při podání faktury)
  const [userBillingProfile, setUserBillingProfile] = useState<WorkspaceBilling | null>(null);

  // Detail faktury
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithUser | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Editace detailu faktury (jen admin)
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [editDetailIssueDate, setEditDetailIssueDate] = useState('');
  const [editDetailDueDate, setEditDetailDueDate] = useState('');
  const [editDetailHours, setEditDetailHours] = useState('');
  const [editDetailAmount, setEditDetailAmount] = useState('');
  const [editDetailApprovedAt, setEditDetailApprovedAt] = useState('');
  const [editDetailPaidAt, setEditDetailPaidAt] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  // Filtry + vyhledávání
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');

  const { year: prevYear, month: prevMonth } = getPreviousMonthPeriod();

  const fetchInvoices = useCallback(async () => {
    if (!currentWorkspace || !user) return;
    setLoading(true);

    let query = supabase
      .from('trackino_invoices')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    // Běžný uživatel vidí jen své faktury
    if (!canApprove && !canManageBilling) {
      query = query.eq('user_id', user.id);
    }

    const { data } = await query;
    const invData = (data ?? []) as Invoice[];

    // Načteme profily
    if (invData.length > 0) {
      const userIds = [...new Set(invData.map(i => i.user_id))];
      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', userIds);
      const profileMap: Record<string, Profile> = {};
      (profiles ?? []).forEach((p: unknown) => { const prof = p as Profile; profileMap[prof.id] = prof; });
      setInvoices(invData.map(i => ({ ...i, profile: profileMap[i.user_id] })));
    } else {
      setInvoices([]);
    }
    setLoading(false);
  }, [currentWorkspace, user, canApprove, canManageBilling]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Automaticky nastavit defaultní hodnoty pro formulář + načíst billing profil
  useEffect(() => {
    if (showSubmitForm && currentWorkspace && currentMembership) {
      const today = new Date().toISOString().split('T')[0];
      const due = new Date();
      due.setDate(due.getDate() + 14);
      setSubmitIssueDate(today);
      setSubmitDueDate(due.toISOString().split('T')[0]);

      // Načíst přiřazený nebo výchozí billing profil
      (async () => {
        const billingProfileId = currentMembership.billing_profile_id;
        if (billingProfileId) {
          const { data } = await supabase
            .from('trackino_workspace_billing')
            .select('*')
            .eq('id', billingProfileId)
            .single();
          setUserBillingProfile(data as WorkspaceBilling | null);
        } else {
          // Fallback na výchozí profil workspace
          const { data } = await supabase
            .from('trackino_workspace_billing')
            .select('*')
            .eq('workspace_id', currentWorkspace.id)
            .eq('is_default', true)
            .single();
          setUserBillingProfile(data as WorkspaceBilling | null);
        }
      })();
    }
  }, [showSubmitForm, currentWorkspace, currentMembership]);

  // Zkontrolovat zda uživatel již podal fakturu za předchozí měsíc (vrácené k opravě se nepočítají)
  const alreadySubmitted = invoices.some(
    i => i.user_id === user?.id &&
      i.billing_period_year === prevYear &&
      i.billing_period_month === prevMonth &&
      i.status !== 'cancelled' &&
      i.status !== 'returned'
  );

  // Vrácená faktura za aktuální fakturační měsíc (zobrazí se varování)
  const returnedForCurrentPeriod = !alreadySubmitted ? invoices.find(
    i => i.user_id === user?.id &&
      i.billing_period_year === prevYear &&
      i.billing_period_month === prevMonth &&
      i.status === 'returned'
  ) : undefined;

  const submitInvoice = async () => {
    if (!currentWorkspace || !user || !submitPdf) return;
    if (!submitIssueDate || !submitDueDate || !submitVarSymbol.trim()) {
      setSubmitError('Vyplňte prosím všechna povinná pole.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');

    // Pokud existuje vrácená faktura za stejné období, smaž ji (re-submission)
    const returnedOld = invoices.find(
      i => i.user_id === user.id &&
        i.billing_period_year === prevYear &&
        i.billing_period_month === prevMonth &&
        i.status === 'returned'
    );
    if (returnedOld) {
      if (returnedOld.pdf_url) {
        await supabase.storage.from('trackino-invoices').remove([returnedOld.pdf_url]);
      }
      await supabase.from('trackino_invoices').delete().eq('id', returnedOld.id);
    }

    // Upload PDF
    const fileName = `${currentWorkspace.id}/${user.id}/${prevYear}-${String(prevMonth).padStart(2, '0')}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('trackino-invoices')
      .upload(fileName, submitPdf, { contentType: 'application/pdf' });

    if (uploadError) {
      setSubmitError('Chyba při nahrávání PDF: ' + uploadError.message);
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('trackino_invoices').insert({
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      billing_period_year: prevYear,
      billing_period_month: prevMonth,
      issue_date: submitIssueDate,
      due_date: submitDueDate,
      variable_symbol: submitVarSymbol.trim(),
      is_vat_payer: submitIsVat,
      pdf_url: fileName,
      status: 'pending',
      note: submitNote.trim(),
      submitted_at: new Date().toISOString(),
    });

    if (insertError) {
      setSubmitError('Chyba při ukládání faktury: ' + insertError.message);
      // Pokus o smazání PDF při chybě
      await supabase.storage.from('trackino-invoices').remove([fileName]);
    } else {
      setShowSubmitForm(false);
      setSubmitPdf(null);
      setSubmitNote('');
      setSubmitVarSymbol('');
      setSubmitIsVat(false);
      fetchInvoices();
    }
    setSubmitting(false);
  };

  const openApproveModal = async (invoice: InvoiceWithUser) => {
    setApproveModalInvoice(invoice);
    setApproveHours('');
    setApproveAmount('');
    setApproveNote('');
    setApproveLoading(true);

    try {
      // Rozsah fakturačního měsíce
      const periodStart = `${invoice.billing_period_year}-${String(invoice.billing_period_month).padStart(2, '0')}-01`;
      const nextMonth = invoice.billing_period_month === 12 ? 1 : invoice.billing_period_month + 1;
      const nextYear = invoice.billing_period_month === 12 ? invoice.billing_period_year + 1 : invoice.billing_period_year;
      const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      // Hodiny z time entries
      const { data: entries } = await supabase
        .from('trackino_time_entries')
        .select('duration')
        .eq('workspace_id', currentWorkspace!.id)
        .eq('user_id', invoice.user_id)
        .gte('start_time', periodStart)
        .lt('start_time', periodEnd)
        .not('duration', 'is', null);

      const totalSeconds = (entries ?? []).reduce((sum: number, e: { duration: number | null }) => sum + (e.duration ?? 0), 0);
      const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;

      // Hodinová sazba z trackino_member_rates
      const { data: memberData } = await supabase
        .from('trackino_workspace_members')
        .select('id')
        .eq('workspace_id', currentWorkspace!.id)
        .eq('user_id', invoice.user_id)
        .single();

      let rate = 0;
      if (memberData) {
        const { data: rateData } = await supabase
          .from('trackino_member_rates')
          .select('hourly_rate')
          .eq('workspace_member_id', (memberData as { id: string }).id)
          .lte('valid_from', `${invoice.billing_period_year}-${String(invoice.billing_period_month).padStart(2, '0')}-28`)
          .or(`valid_to.is.null,valid_to.gte.${periodStart}`)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rateData) rate = (rateData as { hourly_rate: number }).hourly_rate;
      }

      if (totalHours > 0) setApproveHours(String(totalHours));
      if (totalHours > 0 && rate > 0) setApproveAmount(String(Math.round(totalHours * rate)));
    } catch (_e) {
      // Chyba při načítání – pole zůstanou prázdná k ručnímu vyplnění
    } finally {
      setApproveLoading(false);
    }
  };

  const approveInvoice = async () => {
    if (!approveModalInvoice || !user) return;
    setApprovingId(approveModalInvoice.id);
    await supabase.from('trackino_invoices').update({
      status: 'approved',
      total_hours: approveHours ? parseFloat(approveHours) : null,
      amount: approveAmount ? parseFloat(approveAmount) : null,
      note: approveNote.trim() || approveModalInvoice.note,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }).eq('id', approveModalInvoice.id);
    setApprovingId(null);
    setApproveModalInvoice(null);
    fetchInvoices();
  };

  const returnInvoice = async () => {
    if (!returnModalInvoice || !returnNote.trim()) return;
    setReturningId(returnModalInvoice.id);
    await supabase.from('trackino_invoices').update({
      status: 'returned',
      note: returnNote.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', returnModalInvoice.id);
    setReturningId(null);
    setReturnModalInvoice(null);
    setReturnNote('');
    fetchInvoices();
  };

  const markAsPaid = async (invoiceId: string) => {
    if (!user) return;
    setPayingId(invoiceId);
    await supabase.from('trackino_invoices').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: user.id,
    }).eq('id', invoiceId);
    setPayingId(null);
    fetchInvoices();
  };

  const downloadPdf = async (invoice: InvoiceWithUser) => {
    if (!invoice.pdf_url) return;
    setDownloadingId(invoice.id);
    try {
      const yyyymm = `${invoice.billing_period_year}${String(invoice.billing_period_month).padStart(2, '0')}`;
      const nameSlug = toSlug(invoice.profile?.display_name ?? 'neznamy');
      const filename = `${yyyymm}-faktura-${nameSlug}.pdf`;
      const { data } = await supabase.storage
        .from('trackino-invoices')
        .createSignedUrl(invoice.pdf_url, 3600, { download: filename });
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.click();
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const openDetail = async (invoice: InvoiceWithUser) => {
    setDetailInvoice(invoice);
    setEditingDetailId(null);
    setPdfUrl(null);
    if (invoice.pdf_url) {
      setPdfLoading(true);
      const { data } = await supabase.storage
        .from('trackino-invoices')
        .createSignedUrl(invoice.pdf_url, 3600);
      setPdfUrl(data?.signedUrl ?? null);
      setPdfLoading(false);
    }
  };

  const startDetailEdit = (invoice: InvoiceWithUser) => {
    setEditingDetailId(invoice.id);
    setEditDetailIssueDate(invoice.issue_date);
    setEditDetailDueDate(invoice.due_date);
    setEditDetailHours(invoice.total_hours !== null ? String(invoice.total_hours) : '');
    setEditDetailAmount(invoice.amount !== null ? String(invoice.amount) : '');
    setEditDetailApprovedAt(invoice.approved_at ? invoice.approved_at.split('T')[0] : '');
    setEditDetailPaidAt(invoice.paid_at ? invoice.paid_at.split('T')[0] : '');
  };

  const saveDetailEdit = async () => {
    if (!editingDetailId || !detailInvoice) return;
    setSavingDetail(true);
    const updates: Partial<Invoice> = {
      issue_date: editDetailIssueDate,
      due_date: editDetailDueDate,
      total_hours: editDetailHours ? parseFloat(editDetailHours) : null,
      amount: editDetailAmount ? parseFloat(editDetailAmount) : null,
      approved_at: editDetailApprovedAt ? editDetailApprovedAt + 'T00:00:00' : null,
      paid_at: editDetailPaidAt ? editDetailPaidAt + 'T00:00:00' : null,
    };
    await supabase.from('trackino_invoices').update(updates).eq('id', editingDetailId);
    const updated = { ...detailInvoice, ...updates };
    setDetailInvoice(updated as InvoiceWithUser);
    setSavingDetail(false);
    setEditingDetailId(null);
    fetchInvoices();
  };

  const changeDetailStatus = async (invoiceId: string, newStatus: InvoiceStatus) => {
    setChangingStatusId(invoiceId);
    const updates: Partial<Invoice> = { status: newStatus };
    if (newStatus !== 'paid') { updates.paid_at = null; updates.paid_by = null; }
    if (newStatus !== 'approved' && newStatus !== 'paid') { updates.approved_at = null; updates.approved_by = null; }
    await supabase.from('trackino_invoices').update(updates).eq('id', invoiceId);
    if (detailInvoice) setDetailInvoice({ ...detailInvoice, ...updates } as InvoiceWithUser);
    setChangingStatusId(null);
    fetchInvoices();
  };

  const currencySymbol = currentWorkspace?.currency === 'EUR' ? '€' : currentWorkspace?.currency === 'USD' ? '$' : 'Kč';

  // Filtrování faktur dle tabu
  const myInvoices = invoices.filter(i => i.user_id === user?.id);

  // Unikátní roky z faktur (pro dropdown)
  const availableYears = [...new Set(invoices.map(i => i.billing_period_year))].sort((a, b) => b - a);

  const matchesSearch = (inv: InvoiceWithUser) => {
    if (filterYear && inv.billing_period_year !== parseInt(filterYear)) return false;
    if (filterMonth && inv.billing_period_month !== parseInt(filterMonth)) return false;
    if (!invoiceSearch.trim()) return true;
    const q = invoiceSearch.toLowerCase();
    const name = (inv.profile?.display_name ?? inv.profile?.email ?? '').toLowerCase();
    const vs = (inv.variable_symbol ?? '').toLowerCase();
    const month = fmtMonth(inv.billing_period_year, inv.billing_period_month).toLowerCase();
    return name.includes(q) || vs.includes(q) || month.includes(q);
  };

  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const billingInvoices = invoices.filter(i => i.status === 'approved' || i.status === 'paid');

  const pendingInvoicesFiltered = pendingInvoices.filter(matchesSearch);
  const billingInvoicesFiltered = billingInvoices.filter(matchesSearch);

  const tabs: { key: ViewTab; label: string; count?: number; visible: boolean }[] = [
    { key: 'my', label: 'Moje faktury', count: myInvoices.length, visible: canInvoice },
    { key: 'approve', label: 'Ke schválení', count: pendingInvoices.length, visible: canApprove },
    { key: 'billing', label: 'Přehled faktur', count: billingInvoices.length, visible: canManageBilling || isWorkspaceAdmin },
  ];
  const visibleTabs = tabs.filter(t => t.visible);

  if (!currentWorkspace) return null;

  // Sdílené props pro InvoiceRow
  const rowProps = {
    activeTab,
    currencySymbol,
    downloadingId,
    payingId,
    canManageBilling,
    isWorkspaceAdmin,
    onOpenDetail: openDetail,
    onDownloadPdf: downloadPdf,
    onOpenApproveModal: openApproveModal,
    onSetReturnModal: setReturnModalInvoice,
    onMarkAsPaid: markAsPaid,
  };

  return (
    <DashboardLayout moduleName="Fakturace">
      <div className="max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Fakturace</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Správa faktur a žádostí o proplacení
            </p>
          </div>
          {canInvoice && !showSubmitForm && !alreadySubmitted && canSubmitInvoice() && (
            <button
              onClick={() => setShowSubmitForm(true)}
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
        {canInvoice && returnedForCurrentPeriod && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl border" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: '#92400e' }}>
                Faktura za <strong>{fmtMonth(prevYear, prevMonth)}</strong> byla vrácena k opravě
              </p>
              {returnedForCurrentPeriod.note && (
                <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>{returnedForCurrentPeriod.note}</p>
              )}
              <p className="text-xs mt-1" style={{ color: '#b45309' }}>Opravte fakturu a podejte ji znovu pomocí tlačítka výše.</p>
            </div>
          </div>
        )}

        {/* Faktura aktuálního období – zobrazí se namísto banneru */}
        {canInvoice && alreadySubmitted && (() => {
          const inv = invoices.find(
            i => i.user_id === user?.id &&
              i.billing_period_year === prevYear &&
              i.billing_period_month === prevMonth &&
              i.status !== 'cancelled' &&
              i.status !== 'returned'
          );
          if (!inv) return null;
          return (
            <div
              className="mb-5 rounded-xl border overflow-hidden"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                onClick={() => openDetail(inv)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {fmtMonth(inv.billing_period_year, inv.billing_period_month)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>VS: {inv.variable_symbol}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Vystaveno: {fmtDate(inv.issue_date)}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Splatnost: {fmtDate(inv.due_date)}</span>
                  </div>
                  {(inv.amount !== null || inv.total_hours !== null) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {inv.amount !== null && (
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {inv.amount.toLocaleString('cs-CZ')} {currencySymbol}
                        </span>
                      )}
                      {inv.total_hours !== null && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          ({inv.total_hours} h)
                        </span>
                      )}
                    </div>
                  )}
                  {(inv.approved_at || inv.paid_at) && (
                    <div className="flex items-center gap-3 mt.0.5">
                      {inv.approved_at && (
                        <span className="text-xs" style={{ color: '#1e40af' }}>
                          Schváleno: {fmtDate(inv.approved_at.split('T')[0])}
                        </span>
                      )}
                      {inv.paid_at && (
                        <span className="text-xs font-medium" style={{ color: '#15803d' }}>
                          Proplaceno: {fmtDate(inv.paid_at.split('T')[0])}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusBadge status={inv.status} />
                  <button
                    onClick={(e) => { e.stopPropagation(); openDetail(inv); }}
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
                  {inv.pdf_url && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadPdf(inv); }}
                      title="Stáhnout PDF"
                      disabled={downloadingId === inv.id}
                      className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      {downloadingId === inv.id ? (
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
        })()}

        {/* Formulář pro podání faktury */}
        {showSubmitForm && canInvoice && (
          <SubmitInvoiceForm
            prevYear={prevYear}
            prevMonth={prevMonth}
            submitIssueDate={submitIssueDate}
            setSubmitIssueDate={setSubmitIssueDate}
            submitDueDate={submitDueDate}
            setSubmitDueDate={setSubmitDueDate}
            submitVarSymbol={submitVarSymbol}
            setSubmitVarSymbol={setSubmitVarSymbol}
            submitIsVat={submitIsVat}
            setSubmitIsVat={setSubmitIsVat}
            submitPdf={submitPdf}
            setSubmitPdf={setSubmitPdf}
            submitNote={submitNote}
            setSubmitNote={setSubmitNote}
            submitting={submitting}
            submitError={submitError}
            userBillingProfile={userBillingProfile}
            onClose={() => setShowSubmitForm(false)}
            onSubmit={submitInvoice}
          />
        )}

        {/* Taby + vyhledávání */}
        <InvoiceFilters
          visibleTabs={visibleTabs}
          activeTab={activeTab}
          onChangeTab={(tab) => { setActiveTab(tab); setInvoiceSearch(''); setFilterMonth(''); setFilterYear(''); }}
          canApprove={canApprove}
          canManageBilling={canManageBilling}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          filterYear={filterYear}
          setFilterYear={setFilterYear}
          invoiceSearch={invoiceSearch}
          setInvoiceSearch={setInvoiceSearch}
          availableYears={availableYears}
        />

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Moje faktury */}
            {activeTab === 'my' && (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {myInvoices.length === 0 ? (
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
                  myInvoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} showUser={false} {...rowProps} />)
                )}
              </div>
            )}

            {/* Ke schválení */}
            {activeTab === 'approve' && canApprove && (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {pendingInvoicesFiltered.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      {invoiceSearch ? 'Žádné výsledky' : 'Vše schváleno'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {invoiceSearch ? `Žádná faktura neodpovídá „${invoiceSearch}"` : 'Žádné faktury nečekají na schválení.'}
                    </p>
                  </div>
                ) : (
                  pendingInvoicesFiltered.map(inv => <InvoiceRow key={inv.id} invoice={inv} showUser={true} {...rowProps} />)
                )}
              </div>
            )}

            {/* Přehled faktur */}
            {activeTab === 'billing' && (canManageBilling || isWorkspaceAdmin) && (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {billingInvoicesFiltered.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {invoiceSearch ? `Žádná faktura neodpovídá „${invoiceSearch}"` : 'Žádné schválené ani proplacené faktury.'}
                    </p>
                  </div>
                ) : (
                  billingInvoicesFiltered.map(inv => <InvoiceRow key={inv.id} invoice={inv} showUser={true} {...rowProps} />)
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ MODAL: Schválení faktury ═══ */}
      {approveModalInvoice && (
        <ApproveModal
          approveModalInvoice={approveModalInvoice}
          approveHours={approveHours}
          setApproveHours={setApproveHours}
          approveAmount={approveAmount}
          setApproveAmount={setApproveAmount}
          approveNote={approveNote}
          setApproveNote={setApproveNote}
          approveLoading={approveLoading}
          approvingId={approvingId}
          currencySymbol={currencySymbol}
          onClose={() => setApproveModalInvoice(null)}
          onApprove={approveInvoice}
        />
      )}

      {/* ═══ MODAL: Vrátit k opravě ═══ */}
      {returnModalInvoice && (
        <ReturnModal
          returnModalInvoice={returnModalInvoice}
          returnNote={returnNote}
          setReturnNote={setReturnNote}
          returningId={returningId}
          onClose={() => { setReturnModalInvoice(null); setReturnNote(''); }}
          onReturn={returnInvoice}
        />
      )}

      {/* ═══ MODAL: Detail faktury ═══ */}
      {detailInvoice && (
        <DetailModal
          detailInvoice={detailInvoice}
          pdfUrl={pdfUrl}
          pdfLoading={pdfLoading}
          editingDetailId={editingDetailId}
          setEditingDetailId={setEditingDetailId}
          editDetailIssueDate={editDetailIssueDate}
          setEditDetailIssueDate={setEditDetailIssueDate}
          editDetailDueDate={editDetailDueDate}
          setEditDetailDueDate={setEditDetailDueDate}
          editDetailHours={editDetailHours}
          setEditDetailHours={setEditDetailHours}
          editDetailAmount={editDetailAmount}
          setEditDetailAmount={setEditDetailAmount}
          editDetailApprovedAt={editDetailApprovedAt}
          setEditDetailApprovedAt={setEditDetailApprovedAt}
          editDetailPaidAt={editDetailPaidAt}
          setEditDetailPaidAt={setEditDetailPaidAt}
          savingDetail={savingDetail}
          changingStatusId={changingStatusId}
          canApprove={canApprove}
          canManageBilling={canManageBilling}
          currencySymbol={currencySymbol}
          onClose={() => { setDetailInvoice(null); setEditingDetailId(null); }}
          onStartEdit={startDetailEdit}
          onSaveEdit={saveDetailEdit}
          onChangeStatus={changeDetailStatus}
        />
      )}
    </DashboardLayout>
  );
}

export default function InvoicesPage() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <WorkspaceProvider>
      <InvoicesContent />
    </WorkspaceProvider>
  );
}
