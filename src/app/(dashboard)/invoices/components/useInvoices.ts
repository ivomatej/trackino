'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { Invoice, InvoiceStatus, Profile, WorkspaceBilling } from '@/types/database';
import type { ViewTab, InvoiceWithUser } from '../types';
import { getPreviousMonthPeriod, toSlug, fmtMonth } from '../utils';

export function useInvoices() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership } = useWorkspace();
  const { isWorkspaceAdmin, isManager } = usePermissions();

  const canInvoice = currentMembership?.can_invoice ?? false;
  const canManageBilling = currentMembership?.can_manage_billing ?? false;
  const canApprove = isWorkspaceAdmin || isManager;

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

  // Zkontrolovat zda uživatel již podal fakturu za předchozí měsíc
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

  // Aktuálně podaná faktura (pro banner alreadySubmitted)
  const currentPeriodInvoice = alreadySubmitted ? invoices.find(
    i => i.user_id === user?.id &&
      i.billing_period_year === prevYear &&
      i.billing_period_month === prevMonth &&
      i.status !== 'cancelled' &&
      i.status !== 'returned'
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
      const periodStart = `${invoice.billing_period_year}-${String(invoice.billing_period_month).padStart(2, '0')}-01`;
      const nextMonth = invoice.billing_period_month === 12 ? 1 : invoice.billing_period_month + 1;
      const nextYear = invoice.billing_period_month === 12 ? invoice.billing_period_year + 1 : invoice.billing_period_year;
      const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

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

  // Filtrování
  const myInvoices = invoices.filter(i => i.user_id === user?.id);
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

  return {
    // Permissions
    canInvoice, canManageBilling, canApprove, isWorkspaceAdmin,
    // State
    loading, invoices, activeTab, setActiveTab,
    // Submit form
    showSubmitForm, setShowSubmitForm,
    submitIssueDate, setSubmitIssueDate,
    submitDueDate, setSubmitDueDate,
    submitVarSymbol, setSubmitVarSymbol,
    submitIsVat, setSubmitIsVat,
    submitPdf, setSubmitPdf,
    submitNote, setSubmitNote,
    submitting, submitError,
    userBillingProfile,
    // Approve
    approvingId, approveHours, setApproveHours,
    approveAmount, setApproveAmount,
    approveNote, setApproveNote,
    approveModalInvoice, setApproveModalInvoice,
    approveLoading,
    // Pay
    payingId,
    // Return
    returnModalInvoice, setReturnModalInvoice,
    returnNote, setReturnNote,
    returningId,
    // Download
    downloadingId,
    // Detail
    detailInvoice, setDetailInvoice,
    pdfUrl, pdfLoading,
    editingDetailId, setEditingDetailId,
    editDetailIssueDate, setEditDetailIssueDate,
    editDetailDueDate, setEditDetailDueDate,
    editDetailHours, setEditDetailHours,
    editDetailAmount, setEditDetailAmount,
    editDetailApprovedAt, setEditDetailApprovedAt,
    editDetailPaidAt, setEditDetailPaidAt,
    savingDetail, changingStatusId,
    // Filters
    invoiceSearch, setInvoiceSearch,
    filterMonth, setFilterMonth,
    filterYear, setFilterYear,
    // Computed
    prevYear, prevMonth,
    alreadySubmitted, returnedForCurrentPeriod, currentPeriodInvoice,
    currencySymbol, myInvoices, availableYears,
    pendingInvoices, billingInvoices,
    pendingInvoicesFiltered, billingInvoicesFiltered,
    visibleTabs,
    // Actions
    fetchInvoices,
    submitInvoice,
    openApproveModal, approveInvoice,
    returnInvoice, markAsPaid,
    downloadPdf, openDetail,
    startDetailEdit, saveDetailEdit,
    changeDetailStatus,
  };
}
