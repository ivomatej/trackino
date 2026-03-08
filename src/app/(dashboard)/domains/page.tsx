'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { Domain, DomainStatus, DomainRegistrar, Subscription } from '@/types/database';

/* ── Konstanty ── */

type DisplayStatus = DomainStatus | 'expiring';

const STATUS_CONFIG: Record<DisplayStatus, { label: string; color: string; bg: string; text: string }> = {
  active:       { label: 'Aktivní',     color: '#22c55e', bg: '#dcfce7', text: '#166534' },
  expiring:     { label: 'Expirující',  color: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  winding_down: { label: 'Dobíhá',     color: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6' },
  expired:      { label: 'Expirovaná',  color: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
  transferred:  { label: 'Převedená',   color: '#3b82f6', bg: '#dbeafe', text: '#1e40af' },
  cancelled:    { label: 'Zrušená',     color: '#64748b', bg: '#f1f5f9', text: '#475569' },
};

const DB_STATUSES: DomainStatus[] = ['active', 'winding_down', 'expired', 'transferred', 'cancelled'];

const EXPIRING_THRESHOLD_DAYS = 30;

/* ── Pomocné funkce ── */

function daysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(expirationDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDisplayStatus(domain: Domain): DisplayStatus {
  if (domain.status === 'active' && domain.expiration_date) {
    const days = daysUntilExpiration(domain.expiration_date);
    if (days !== null && days <= EXPIRING_THRESHOLD_DAYS && days >= 0) return 'expiring';
  }
  return domain.status;
}

function fmtDate(d: string | null): string {
  if (!d) return '–';
  const dt = new Date(d);
  return dt.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/* ── Ikony (SVG) ── */

const ICONS = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  globe: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  chevronDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9"/></svg>,
  server: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
};

/* ── Typy řazení ── */

type SortField = 'name' | 'expiration_date' | 'registrar' | 'status';
type SortDir = 'asc' | 'desc';
type TabType = 'domains' | 'registrars';

/* ── Hlavní komponenta ── */

function DomainsContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const canManage = useMemo(
    () => isMasterAdmin || isWorkspaceAdmin || (currentMembership?.can_manage_domains ?? false),
    [isMasterAdmin, isWorkspaceAdmin, currentMembership]
  );

  const wsId = currentWorkspace?.id;
  const userId = user?.id;

  /* ── State ── */
  const [domains, setDomains] = useState<Domain[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('domains');

  // UI
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<DisplayStatus | ''>('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRegistrar, setFilterRegistrar] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Domain form modal
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    registrar: '',
    subscription_id: '' as string | null,
    registration_date: '',
    expiration_date: '',
    status: 'active' as DomainStatus,
    notes: '',
    target_url: '',
    project_name: '',
    company_name: '',
  });

  // Registrar form modal
  const [regModal, setRegModal] = useState(false);
  const [editingReg, setEditingReg] = useState<DomainRegistrar | null>(null);
  const [savingReg, setSavingReg] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', website_url: '', notes: '' });

  // Detail modal
  const [detailDomain, setDetailDomain] = useState<Domain | null>(null);

  // Message
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };

  /* ── Module guard ── */
  useEffect(() => {
    if (!wsLoading && !hasModule('domains')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  /* ── Fetch data ── */
  const fetchAll = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    const [dRes, sRes, rRes] = await Promise.all([
      supabase.from('trackino_domains').select('*').eq('workspace_id', wsId).order('name'),
      hasModule('subscriptions')
        ? supabase.from('trackino_subscriptions').select('id,name,website_url').eq('workspace_id', wsId).eq('status', 'active').order('name')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('trackino_domain_registrars').select('*').eq('workspace_id', wsId).order('name'),
    ]);
    if (dRes.data) setDomains(dRes.data);
    if (sRes.data) setSubscriptions(sRes.data as Subscription[]);
    if (rRes.data) setRegistrars(rRes.data as DomainRegistrar[]);
    setLoading(false);
  }, [wsId, hasModule]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Computed ── */
  const companies = useMemo(() => {
    const set = new Set(domains.map(d => d.company_name).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [domains]);

  const registrarNames = useMemo(() => {
    const set = new Set(domains.map(d => d.registrar).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [domains]);

  const filteredDomains = useMemo(() => {
    let list = domains;

    // fulltext
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.registrar.toLowerCase().includes(q) ||
        d.company_name.toLowerCase().includes(q) ||
        d.project_name.toLowerCase().includes(q) ||
        d.notes.toLowerCase().includes(q)
      );
    }

    // status filter
    if (filterStatus) {
      if (filterStatus === 'expiring') {
        list = list.filter(d => getDisplayStatus(d) === 'expiring');
      } else if (filterStatus === 'active') {
        list = list.filter(d => getDisplayStatus(d) === 'active');
      } else {
        list = list.filter(d => d.status === filterStatus);
      }
    }

    // company filter
    if (filterCompany) {
      list = list.filter(d => d.company_name === filterCompany);
    }

    // registrar filter
    if (filterRegistrar) {
      list = list.filter(d => d.registrar === filterRegistrar);
    }

    // sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'cs');
          break;
        case 'expiration_date': {
          const dA = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
          const dB = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
          cmp = dA - dB;
          break;
        }
        case 'registrar':
          cmp = a.registrar.localeCompare(b.registrar, 'cs');
          break;
        case 'status': {
          const order: Record<DisplayStatus, number> = { expiring: 0, winding_down: 1, expired: 2, active: 3, transferred: 4, cancelled: 5 };
          cmp = order[getDisplayStatus(a)] - order[getDisplayStatus(b)];
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [domains, searchQ, filterStatus, filterCompany, filterRegistrar, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = domains.length;
    const active = domains.filter(d => d.status === 'active').length;
    const expiring = domains.filter(d => getDisplayStatus(d) === 'expiring').length;
    const windingDown = domains.filter(d => d.status === 'winding_down').length;
    const expired = domains.filter(d => d.status === 'expired').length;
    return { total, active, expiring, windingDown, expired };
  }, [domains]);

  /* ── Domain CRUD ── */
  const openNew = () => {
    setEditing(null);
    setForm({
      name: '', registrar: '', subscription_id: null, registration_date: '',
      expiration_date: '', status: 'active', notes: '', target_url: '',
      project_name: '', company_name: '',
    });
    setModal(true);
  };

  const openEdit = (d: Domain) => {
    setEditing(d);
    setForm({
      name: d.name,
      registrar: d.registrar,
      subscription_id: d.subscription_id || null,
      registration_date: d.registration_date || '',
      expiration_date: d.expiration_date || '',
      status: d.status,
      notes: d.notes,
      target_url: d.target_url,
      project_name: d.project_name,
      company_name: d.company_name,
    });
    setModal(true);
  };

  const saveDomain = async () => {
    if (!wsId || !userId || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      workspace_id: wsId,
      name: form.name.trim(),
      registrar: form.registrar.trim(),
      subscription_id: form.subscription_id || null,
      registration_date: form.registration_date || null,
      expiration_date: form.expiration_date || null,
      status: form.status,
      notes: form.notes.trim(),
      target_url: form.target_url.trim(),
      project_name: form.project_name.trim(),
      company_name: form.company_name.trim(),
    };
    if (editing) {
      const { error } = await supabase.from('trackino_domains').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { setMessage({ text: 'Chyba při ukládání', type: 'error' }); }
      else { setMessage({ text: 'Doména aktualizována', type: 'success' }); }
    } else {
      const { error } = await supabase.from('trackino_domains').insert({ ...payload, created_by: userId });
      if (error) { setMessage({ text: 'Chyba při vytváření', type: 'error' }); }
      else { setMessage({ text: 'Doména přidána', type: 'success' }); }
    }
    setSaving(false);
    setModal(false);
    fetchAll();
  };

  const deleteDomain = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tuto doménu?')) return;
    await supabase.from('trackino_domains').delete().eq('id', id);
    setMessage({ text: 'Doména smazána', type: 'success' });
    fetchAll();
  };

  const getSubName = useCallback((subId: string | null) => {
    if (!subId) return null;
    return subscriptions.find(s => s.id === subId)?.name ?? null;
  }, [subscriptions]);

  /* ── Registrar CRUD ── */
  const openNewReg = () => {
    setEditingReg(null);
    setRegForm({ name: '', website_url: '', notes: '' });
    setRegModal(true);
  };

  const openEditReg = (r: DomainRegistrar) => {
    setEditingReg(r);
    setRegForm({ name: r.name, website_url: r.website_url, notes: r.notes });
    setRegModal(true);
  };

  const saveRegistrar = async () => {
    if (!wsId || !userId || !regForm.name.trim()) return;
    setSavingReg(true);
    const payload = {
      workspace_id: wsId,
      name: regForm.name.trim(),
      website_url: regForm.website_url.trim(),
      notes: regForm.notes.trim(),
    };
    if (editingReg) {
      const { error } = await supabase.from('trackino_domain_registrars').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingReg.id);
      if (error) { setMessage({ text: 'Chyba při ukládání registrátora', type: 'error' }); }
      else { setMessage({ text: 'Registrátor aktualizován', type: 'success' }); }
    } else {
      const { error } = await supabase.from('trackino_domain_registrars').insert({ ...payload, created_by: userId });
      if (error) { setMessage({ text: 'Chyba při vytváření registrátora', type: 'error' }); }
      else { setMessage({ text: 'Registrátor přidán', type: 'success' }); }
    }
    setSavingReg(false);
    setRegModal(false);
    fetchAll();
  };

  const deleteRegistrar = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tohoto registrátora?')) return;
    await supabase.from('trackino_domain_registrars').delete().eq('id', id);
    setMessage({ text: 'Registrátor smazán', type: 'success' });
    fetchAll();
  };

  /* ── Sort toggle ── */
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortArrow = ({ field }: { field: SortField }) => (
    sortField === field ? (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-1 inline">
        {sortDir === 'asc'
          ? <polyline points="18 15 12 9 6 15"/>
          : <polyline points="6 9 12 15 18 9"/>}
      </svg>
    ) : null
  );

  /* ── Auto-hide message ── */
  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }
  }, [message]);

  /* ── Loading guard ── */
  if (wsLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Message banner ── */}
        {message && (
          <div className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: message.type === 'success' ? '#16a34a' : '#ef4444',
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
            }}>
            {message.text}
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Evidence domén</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Správa a evidence firemních domén</p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2 self-start">
              <button
                onClick={openNew}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
              >
                {ICONS.plus} Přidat doménu
              </button>
            </div>
          )}
        </div>

        {/* ── Záložky ── */}
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
          {([
            { id: 'domains' as TabType, label: 'Domény' },
            { id: 'registrars' as TabType, label: 'Registrátoři' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 text-sm font-medium transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {tab.id === 'registrars' && registrars.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{registrars.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ TAB: DOMÉNY ═══════════════════════════════════════════════════ */}
        {activeTab === 'domains' && (
          <>
            {/* Dashboard karty */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Celkem', value: stats.total, color: 'var(--primary)' },
                { label: 'Aktivní', value: stats.active, color: '#22c55e' },
                { label: 'Expirující', value: stats.expiring, color: '#f59e0b' },
                { label: 'Dobíhá', value: stats.windingDown, color: '#8b5cf6' },
                { label: 'Expirované', value: stats.expired, color: '#ef4444' },
              ].map(card => (
                <div key={card.label} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                  <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Filtry a hledání */}
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                  {ICONS.search}
                </span>
                <input
                  type="text"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Hledat doménu..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                {searchQ && (
                  <button onClick={() => setSearchQ('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                    style={{ color: 'var(--text-muted)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="relative self-start">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as DisplayStatus | '')}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                  style={{ ...inputStyle, minWidth: 160 }}
                >
                  <option value="">Všechny stavy</option>
                  <option value="active">Aktivní</option>
                  <option value="expiring">Expirující</option>
                  <option value="winding_down">Dobíhá</option>
                  <option value="expired">Expirovaná</option>
                  <option value="transferred">Převedená</option>
                  <option value="cancelled">Zrušená</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
              </div>

              {/* Registrar filter */}
              {registrarNames.length > 0 && (
                <div className="relative self-start">
                  <select
                    value={filterRegistrar}
                    onChange={e => setFilterRegistrar(e.target.value)}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                    style={{ ...inputStyle, minWidth: 160 }}
                  >
                    <option value="">Všichni registrátoři</option>
                    {registrarNames.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
                </div>
              )}

              {/* Company filter */}
              {companies.length > 0 && (
                <div className="relative self-start">
                  <select
                    value={filterCompany}
                    onChange={e => setFilterCompany(e.target.value)}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                    style={{ ...inputStyle, minWidth: 160 }}
                  >
                    <option value="">Všechny firmy</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
                </div>
              )}
            </div>

            {/* Tabulka */}
            {filteredDomains.length === 0 ? (
              <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {domains.length === 0 ? 'Zatím žádné domény.' : 'Žádné domény neodpovídají filtru.'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {/* Desktop tabulka */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('name')}>
                          Název <SortArrow field="name" />
                        </th>
                        <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('registrar')}>
                          Registrátor <SortArrow field="registrar" />
                        </th>
                        <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('expiration_date')}>
                          Expirace <SortArrow field="expiration_date" />
                        </th>
                        <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('status')}>
                          Stav <SortArrow field="status" />
                        </th>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Firma</th>
                        {canManage && <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Akce</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDomains.map(d => {
                        const ds = getDisplayStatus(d);
                        const sc = STATUS_CONFIG[ds];
                        const days = daysUntilExpiration(d.expiration_date);
                        const isExpiring = ds === 'expiring';
                        const isWindingDown = ds === 'winding_down';
                        return (
                          <tr
                            key={d.id}
                            className="transition-colors cursor-pointer"
                            style={{
                              borderBottom: '1px solid var(--border)',
                              background: isExpiring ? '#fef3c720' : isWindingDown ? '#ede9fe20' : undefined,
                            }}
                            onMouseEnter={e => { if (!isExpiring && !isWindingDown) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = isExpiring ? '#fef3c720' : isWindingDown ? '#ede9fe20' : ''; }}
                            onClick={() => setDetailDomain(d)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                            </td>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{d.registrar || '–'}</td>
                            <td className="px-4 py-3">
                              <span style={{ color: isExpiring ? sc.color : ds === 'expired' ? '#ef4444' : 'var(--text-secondary)' }}>
                                {fmtDate(d.expiration_date)}
                              </span>
                              {days !== null && d.expiration_date && (
                                <span className="text-xs ml-1.5" style={{ color: days <= EXPIRING_THRESHOLD_DAYS ? sc.color : 'var(--text-muted)' }}>
                                  ({days >= 0 ? `za ${days} dní` : `${Math.abs(days)} dní po`})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                style={{ background: sc.bg, color: sc.text }}>
                                {sc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{d.company_name || '–'}</td>
                            {canManage && (
                              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    className="p-1.5 rounded transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Upravit"
                                    onClick={() => openEdit(d)}
                                  >{ICONS.edit}</button>
                                  <button
                                    className="p-1.5 rounded transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Smazat"
                                    onClick={() => deleteDomain(d.id)}
                                  >{ICONS.trash}</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobilní karty */}
                <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredDomains.map(d => {
                    const ds = getDisplayStatus(d);
                    const sc = STATUS_CONFIG[ds];
                    const days = daysUntilExpiration(d.expiration_date);
                    const isExpiring = ds === 'expiring';
                    const isWindingDown = ds === 'winding_down';
                    return (
                      <div
                        key={d.id}
                        className="px-4 py-3 transition-colors cursor-pointer"
                        style={{ background: isExpiring ? '#fef3c720' : isWindingDown ? '#ede9fe20' : undefined, borderColor: 'var(--border)' }}
                        onClick={() => setDetailDomain(d)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                            style={{ background: sc.bg, color: sc.text }}>
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {d.registrar && <span>{d.registrar}</span>}
                          {d.expiration_date && (
                            <span style={{ color: isExpiring ? sc.color : ds === 'expired' ? '#ef4444' : undefined }}>
                              Exp: {fmtDate(d.expiration_date)}
                              {days !== null && (
                                <span className="ml-1">({days >= 0 ? `za ${days} d` : `${Math.abs(days)} d po`})</span>
                              )}
                            </span>
                          )}
                          {d.company_name && <span>{d.company_name}</span>}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Upravit"
                              onClick={() => openEdit(d)}
                            >{ICONS.edit}</button>
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Smazat"
                              onClick={() => deleteDomain(d.id)}
                            >{ICONS.trash}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ TAB: REGISTRÁTOŘI ═══════════════════════════════════════════ */}
        {activeTab === 'registrars' && (
          <>
            {canManage && (
              <div className="flex justify-end">
                <button
                  onClick={openNewReg}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                  style={{ background: 'var(--primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                >
                  {ICONS.plus} Přidat registrátora
                </button>
              </div>
            )}

            {registrars.length === 0 ? (
              <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádní registrátoři. Přidejte prvního registrátora.</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                {/* Desktop tabulka */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Název</th>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Web</th>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Počet domén</th>
                        <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Poznámky</th>
                        {canManage && <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Akce</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {registrars.map(r => {
                        const domainCount = domains.filter(d => d.registrar === r.name).length;
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span style={{ color: 'var(--text-muted)' }}>{ICONS.server}</span>
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {r.website_url ? (
                                <a href={r.website_url.startsWith('http') ? r.website_url : `https://${r.website_url}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm"
                                  style={{ color: 'var(--primary)' }}>
                                  {r.website_url.replace(/^https?:\/\//, '')} {ICONS.link}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>–</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                                {domainCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              <span className="truncate block text-sm" style={{ color: 'var(--text-muted)' }}>{r.notes || '–'}</span>
                            </td>
                            {canManage && (
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    className="p-1.5 rounded transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Upravit"
                                    onClick={() => openEditReg(r)}
                                  >{ICONS.edit}</button>
                                  <button
                                    className="p-1.5 rounded transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                    title="Smazat"
                                    onClick={() => deleteRegistrar(r.id)}
                                  >{ICONS.trash}</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobilní karty */}
                <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
                  {registrars.map(r => {
                    const domainCount = domains.filter(d => d.registrar === r.name).length;
                    return (
                      <div key={r.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span style={{ color: 'var(--text-muted)' }}>{ICONS.server}</span>
                            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                            {domainCount} domén
                          </span>
                        </div>
                        {r.website_url && (
                          <a href={r.website_url.startsWith('http') ? r.website_url : `https://${r.website_url}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs flex items-center gap-1 mb-1"
                            style={{ color: 'var(--primary)' }}>
                            {r.website_url.replace(/^https?:\/\//, '')} {ICONS.link}
                          </a>
                        )}
                        {r.notes && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes}</p>}
                        {canManage && (
                          <div className="flex items-center gap-1 mt-2">
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Upravit"
                              onClick={() => openEditReg(r)}
                            >{ICONS.edit}</button>
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Smazat"
                              onClick={() => deleteRegistrar(r.id)}
                            >{ICONS.trash}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Domain form modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-card)' }}>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editing ? 'Upravit doménu' : 'Nová doména'}
              </h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Název domény */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název domény *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="example.com" className={inputCls} style={inputStyle} />
              </div>

              {/* Registrátor – select z entity */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Registrátor</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={form.registrar}
                      onChange={e => setForm(f => ({ ...f, registrar: e.target.value }))}
                      className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                      style={inputStyle}
                    >
                      <option value="">– vyberte registrátora –</option>
                      {registrars.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => { openNewReg(); }}
                      className="px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      title="Přidat registrátora"
                    >
                      {ICONS.plus}
                    </button>
                  )}
                </div>
              </div>

              {/* Spárování s předplatným */}
              {hasModule('subscriptions') && subscriptions.length > 0 && (
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Spárováno s předplatným</label>
                  <div className="relative">
                    <select
                      value={form.subscription_id || ''}
                      onChange={e => setForm(f => ({ ...f, subscription_id: e.target.value || null }))}
                      className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                      style={inputStyle}
                    >
                      <option value="">– bez spárování –</option>
                      {subscriptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
                  </div>
                </div>
              )}

              {/* Datumy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum registrace</label>
                  <input type="date" value={form.registration_date} onChange={e => setForm(f => ({ ...f, registration_date: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum expirace</label>
                  <input type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Status</label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as DomainStatus }))}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                    style={inputStyle}
                  >
                    {DB_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
                </div>
              </div>

              {/* Cíl / URL */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Cíl / Web URL</label>
                <input type="text" value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                  placeholder="https://..." className={inputCls} style={inputStyle} />
              </div>

              {/* Projekt + Firma */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Projekt</label>
                  <input type="text" value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Firma</label>
                  <input type="text" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Poznámky */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámky</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Další informace..." className={inputCls} style={inputStyle} />
              </div>
            </div>

            {/* Akční tlačítka */}
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onClick={() => setModal(false)}>
                Zrušit
              </button>
              <button className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                disabled={saving || !form.name.trim()}
                onClick={saveDomain}>
                {saving ? 'Ukládám...' : editing ? 'Uložit' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Registrar form modal ── */}
      {regModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && setRegModal(false)}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--bg-card)' }}>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingReg ? 'Upravit registrátora' : 'Nový registrátor'}
              </h2>
              <button onClick={() => setRegModal(false)} className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název *</label>
                <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="WEDOS, Forpsi, Cloudflare..." className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Webové stránky</label>
                <input type="text" value={regForm.website_url} onChange={e => setRegForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="https://www.wedos.cz" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámky</label>
                <textarea rows={2} value={regForm.notes} onChange={e => setRegForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Další informace..." className={inputCls} style={inputStyle} />
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onClick={() => setRegModal(false)}>
                Zrušit
              </button>
              <button className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                disabled={savingReg || !regForm.name.trim()}
                onClick={saveRegistrar}>
                {savingReg ? 'Ukládám...' : editingReg ? 'Uložit' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail modal ── */}
      {detailDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && setDetailDomain(null)}>
          <div className="w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-card)' }}>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {detailDomain.name}
              </h2>
              <div className="flex items-center gap-1">
                {canManage && (
                  <button onClick={() => { setDetailDomain(null); openEdit(detailDomain); }}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Upravit">
                    {ICONS.edit}
                  </button>
                )}
                <button onClick={() => setDetailDomain(null)} className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {(() => {
              const ds = getDisplayStatus(detailDomain);
              const sc = STATUS_CONFIG[ds];
              const days = daysUntilExpiration(detailDomain.expiration_date);
              const subName = getSubName(detailDomain.subscription_id);
              return (
                <div className="space-y-3 text-sm">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    {days !== null && detailDomain.expiration_date && (
                      <span className="text-xs" style={{ color: ds === 'expiring' || ds === 'expired' ? sc.color : 'var(--text-muted)' }}>
                        {days >= 0 ? `Expiruje za ${days} dní` : `Expirovala před ${Math.abs(days)} dny`}
                      </span>
                    )}
                  </div>

                  {/* Detail rows */}
                  {[
                    { label: 'Registrátor', value: detailDomain.registrar },
                    { label: 'Datum registrace', value: fmtDate(detailDomain.registration_date) },
                    { label: 'Datum expirace', value: fmtDate(detailDomain.expiration_date) },
                    { label: 'Firma', value: detailDomain.company_name },
                    { label: 'Projekt', value: detailDomain.project_name },
                    ...(subName ? [{ label: 'Předplatné', value: subName }] : []),
                  ].filter(r => r.value && r.value !== '–').map(r => (
                    <div key={r.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      <span className="font-medium text-right" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
                    </div>
                  ))}

                  {/* Target URL */}
                  {detailDomain.target_url && (
                    <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Cíl / URL</span>
                      <a href={detailDomain.target_url.startsWith('http') ? detailDomain.target_url : `https://${detailDomain.target_url}`}
                        target="_blank" rel="noopener noreferrer"
                        className="font-medium flex items-center gap-1 text-right"
                        style={{ color: 'var(--primary)' }}>
                        {detailDomain.target_url} {ICONS.link}
                      </a>
                    </div>
                  )}

                  {/* Notes */}
                  {detailDomain.notes && (
                    <div className="pt-2">
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámky</p>
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{detailDomain.notes}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ── Export ── */

export default function DomainsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <DomainsContent />
    </WorkspaceProvider>
  );
}
