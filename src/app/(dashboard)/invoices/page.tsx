'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import type { Invoice, InvoiceStatus, Profile, WorkspaceBilling } from '@/types/database';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}.${parseInt(m)}.${y}`;
}

function fmtMonth(year: number, month: number): string {
  const months = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  return `${months[month - 1]} ${year}`;
}

function getPreviousMonthPeriod(): { year: number; month: number } {
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() je 0-indexed
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { year, month };
}

// Fakturaci lze podat od 1. dne aktuálního měsíce (za předchozí měsíc)
function canSubmitInvoice(): boolean {
  return true; // vždy od 1. dne aktuálního měsíce - kontrolujeme jen dostupnost předchozího měsíce
}

// Převede jméno na slug pro název souboru (odstraní diakritiku, mezery → pomlčky)
function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Zpracovává se',
  approved: 'Schváleno',
  paid: 'Proplaceno',
  cancelled: 'Stornováno',
  returned: 'Vráceno k opravě',
};

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; color: string }> = {
  pending: { bg: '#fef9c3', color: '#854d0e' },
  approved: { bg: '#dbeafe', color: '#1e40af' },
  paid: { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#dc2626' },
  returned: { bg: '#ffedd5', color: '#c2410c' },
};

type ViewTab = 'my' | 'approve' | 'billing';

interface InvoiceWithUser extends Invoice {
  profile?: Profile;
}

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
  const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  // Vyhledávání (jen admin záložky)
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Filtrování faktur dle tabu
  const myInvoices = invoices.filter(i => i.user_id === user?.id);

  const matchesSearch = (inv: InvoiceWithUser) => {
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

  const renderStatusBadge = (status: InvoiceStatus) => {
    const { bg, color } = STATUS_COLORS[status];
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: bg, color }}>
        {STATUS_LABELS[status]}
      </span>
    );
  };

  const renderInvoiceRow = (invoice: InvoiceWithUser, showUser = false) => (
    <div
      key={invoice.id}
      className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onClick={() => openDetail(invoice)}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {showUser && invoice.profile && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: invoice.profile.avatar_color ?? 'var(--primary)' }}
        >
          {invoice.profile.display_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {fmtMonth(invoice.billing_period_year, invoice.billing_period_month)}
          </span>
          {showUser && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              · {invoice.profile?.display_name ?? invoice.profile?.email ?? 'Neznámý'}
            </span>
          )}
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
          {invoice.total_hours !== null && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {invoice.total_hours} h
            </span>
          )}
          {invoice.amount !== null && (
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {invoice.amount.toLocaleString('cs-CZ')} {currencySymbol}
            </span>
          )}
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
        {renderStatusBadge(invoice.status)}

        {/* Ikona: info – otevře detail */}
        <button
          onClick={(e) => { e.stopPropagation(); openDetail(invoice); }}
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
            onClick={(e) => { e.stopPropagation(); downloadPdf(invoice); }}
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
            onClick={(e) => { e.stopPropagation(); openApproveModal(invoice); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
            style={{ background: 'var(--primary)' }}
          >
            Schválit
          </button>
        )}
        {activeTab === 'approve' && invoice.status === 'pending' && (
          <button
            onClick={(e) => { e.stopPropagation(); setReturnModalInvoice(invoice); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: '#d97706', border: '1px solid #d97706' }}
          >
            Vrátit k opravě
          </button>
        )}
        {/* Proplacení – checkbox styl */}
        {activeTab === 'billing' && invoice.status === 'approved' && (canManageBilling || isWorkspaceAdmin) && (
          <button
            onClick={(e) => { e.stopPropagation(); markAsPaid(invoice.id); }}
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

  return (
    <DashboardLayout>
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
              className="mb-5 rounded-2xl border overflow-hidden"
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
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {fmtMonth(inv.billing_period_year, inv.billing_period_month)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>VS: {inv.variable_symbol}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Vystaveno: {fmtDate(inv.issue_date)}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Splatnost: {fmtDate(inv.due_date)}</span>
                    {inv.total_hours !== null && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{inv.total_hours} h</span>
                    )}
                    {inv.amount !== null && (
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {inv.amount.toLocaleString('cs-CZ')} {currencySymbol}
                      </span>
                    )}
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
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {renderStatusBadge(inv.status)}
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
          <div className="mb-6 rounded-2xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Faktura za {fmtMonth(prevYear, prevMonth)}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Nahrajte svou fakturu ve formátu PDF a vyplňte údaje.
                </p>
              </div>
              <button onClick={() => setShowSubmitForm(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex gap-6">
              {/* Levá část – formulářová pole */}
              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum vystavení *</label>
                    <input type="date" value={submitIssueDate} onChange={(e) => setSubmitIssueDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum splatnosti *</label>
                    <input type="date" value={submitDueDate} onChange={(e) => setSubmitDueDate(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Variabilní symbol *</label>
                  <input type="text" value={submitVarSymbol} onChange={(e) => setSubmitVarSymbol(e.target.value)} placeholder="např. 202401001" className={inputCls} style={inputStyle} />
                </div>

                <div className="mb-4">
                  <label
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                    style={{ background: 'var(--bg-hover)' }}
                  >
                    <input
                      type="checkbox"
                      checked={submitIsVat}
                      onChange={(e) => setSubmitIsVat(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Jsem plátce DPH</span>
                      <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Zaškrtněte pokud fakturujete s DPH</span>
                    </div>
                  </label>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Faktura PDF *</label>
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                    style={{ borderColor: submitPdf ? 'var(--primary)' : 'var(--border)' }}
                    onClick={() => document.getElementById('pdf-upload')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file?.type === 'application/pdf') setSubmitPdf(file);
                    }}
                  >
                    {submitPdf ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{submitPdf.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSubmitPdf(null); }}
                          className="ml-1 text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >✕</button>
                      </div>
                    ) : (
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Klikněte nebo přetáhněte PDF soubor
                        </p>
                      </>
                    )}
                  </div>
                  <input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSubmitPdf(file);
                  }} />
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Poznámka (volitelné)</label>
                  <textarea
                    value={submitNote}
                    onChange={(e) => setSubmitNote(e.target.value)}
                    rows={2}
                    placeholder="Volitelná poznámka pro schvalovatele..."
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>

                {submitError && (
                  <div className="mb-4 px-3 py-2.5 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
                    {submitError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSubmitForm(false)}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={submitInvoice}
                    disabled={submitting || !submitPdf || !submitIssueDate || !submitDueDate || !submitVarSymbol.trim()}
                    className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                  >
                    {submitting ? 'Odesílám...' : 'Odeslat ke schválení'}
                  </button>
                </div>
              </div>

              {/* Pravá část – fakturační údaje */}
              {userBillingProfile && (
                <div className="w-72 flex-shrink-0 rounded-xl border p-4 self-start" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {userBillingProfile.name}
                    </span>
                    {userBillingProfile.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto" style={{ background: '#dbeafe', color: '#1e40af' }}>
                        Výchozí
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {userBillingProfile.company_name && (
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Společnost</span>
                        <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.company_name}</div>
                      </div>
                    )}
                    {(userBillingProfile.address || userBillingProfile.postal_code || userBillingProfile.city || userBillingProfile.country) && (
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Adresa</span>
                        <div style={{ color: 'var(--text-primary)' }}>
                          {userBillingProfile.address && <div>{userBillingProfile.address}</div>}
                          {(userBillingProfile.postal_code || userBillingProfile.city) && (
                            <div>{[userBillingProfile.postal_code, userBillingProfile.city].filter(Boolean).join(' ')}</div>
                          )}
                          {userBillingProfile.country && <div>{userBillingProfile.country}</div>}
                        </div>
                      </div>
                    )}
                    {userBillingProfile.ico && (
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>IČO</span>
                          <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.ico}</div>
                        </div>
                        {userBillingProfile.dic && (
                          <div>
                            <span className="font-medium" style={{ color: 'var(--text-muted)' }}>DIČ</span>
                            <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.dic}</div>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-muted)' }}>DPH</span>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {userBillingProfile.is_vat_payer ? 'Jsme plátci DPH' : 'Nejsme plátci DPH'}
                      </div>
                    </div>
                    {userBillingProfile.email && (
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>E-mail</span>
                        <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.email}</div>
                      </div>
                    )}
                    {userBillingProfile.phone && (
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Telefon</span>
                        <div style={{ color: 'var(--text-primary)' }}>{formatPhone(userBillingProfile.phone)}</div>
                      </div>
                    )}
                    {userBillingProfile.billing_note && (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Poznámka k fakturaci</span>
                        <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.billing_note}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Taby + vyhledávání pro admin záložky */}
        <div className="mb-6">
          {visibleTabs.length > 1 && (
            <div className="flex gap-1 rounded-lg p-1 mb-3" style={{ background: 'var(--bg-hover)' }}>
              {visibleTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setInvoiceSearch(''); }}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white" style={{ background: '#ef4444' }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {/* Vyhledávání – pouze pro adminy/managery/správce fakturace, ne pro běžné uživatele */}
          {(activeTab === 'approve' || activeTab === 'billing') && (canApprove || canManageBilling) && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Hledat dle jména, VS nebo měsíce…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={inputStyle}
              />
              {invoiceSearch && (
                <button
                  onClick={() => setInvoiceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Moje faktury */}
            {activeTab === 'my' && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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
                  myInvoices.map(inv => renderInvoiceRow(inv, false))
                )}
              </div>
            )}

            {/* Ke schválení */}
            {activeTab === 'approve' && canApprove && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
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
                  pendingInvoicesFiltered.map(inv => renderInvoiceRow(inv, true))
                )}
              </div>
            )}

            {/* Přehled faktur */}
            {activeTab === 'billing' && (canManageBilling || isWorkspaceAdmin) && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {billingInvoicesFiltered.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {invoiceSearch ? `Žádná faktura neodpovídá „${invoiceSearch}"` : 'Žádné schválené ani proplacené faktury.'}
                    </p>
                  </div>
                ) : (
                  billingInvoicesFiltered.map(inv => renderInvoiceRow(inv, true))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ MODAL: Schválení faktury ═══ */}
      {approveModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setApproveModalInvoice(null)} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Schválit fakturu</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {approveModalInvoice.profile?.display_name} · {fmtMonth(approveModalInvoice.billing_period_year, approveModalInvoice.billing_period_month)}
                </p>
              </div>
              <button onClick={() => setApproveModalInvoice(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
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
                <button onClick={() => setApproveModalInvoice(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Zrušit
                </button>
                <button
                  onClick={approveInvoice}
                  disabled={!!approvingId}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {approvingId ? 'Ukládám...' : 'Schválit fakturu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Vrátit k opravě ═══ */}
      {returnModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => { setReturnModalInvoice(null); setReturnNote(''); }} />
          <div className="relative w-full max-w-sm rounded-2xl shadow-2xl z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="px-6 pt-6 pb-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Vrátit fakturu k opravě</h3>
                <button onClick={() => { setReturnModalInvoice(null); setReturnNote(''); }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
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
                  onClick={() => { setReturnModalInvoice(null); setReturnNote(''); }}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Zrušit
                </button>
                <button
                  onClick={returnInvoice}
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
      )}

      {/* ═══ MODAL: Detail faktury ═══ */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => { setDetailInvoice(null); setEditingDetailId(null); }} />
          <div className="relative w-full max-w-lg rounded-2xl shadow-2xl z-10" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Hlavička */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 sticky top-0" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Faktura – {fmtMonth(detailInvoice.billing_period_year, detailInvoice.billing_period_month)}
                  </h3>
                  {renderStatusBadge(detailInvoice.status)}
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
                    onClick={() => startDetailEdit(detailInvoice)}
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
                <button onClick={() => { setDetailInvoice(null); setEditingDetailId(null); }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
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
                      onClick={saveDetailEdit}
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
                            onClick={() => changeDetailStatus(detailInvoice.id, btn.status)}
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
