'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import type { Domain, DomainStatus, DomainRegistrar, Subscription } from '@/types/database';
import type {
  DisplayStatus, SortField, SortDir, TabType,
  DomainFormState, RegFormState, DomainStats,
} from './types';
import { getDisplayStatus } from './utils';

const EMPTY_DOMAIN_FORM: DomainFormState = {
  name: '', registrar: '', subscription_id: null, registration_date: '',
  expiration_date: '', status: 'active', notes: '', target_url: '',
  project_name: '', company_name: '',
};

export function useDomains() {
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

  /* ── Data state ── */
  const [domains, setDomains] = useState<Domain[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [registrars, setRegistrars] = useState<DomainRegistrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('domains');

  /* ── Filter/sort state ── */
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<DisplayStatus | ''>('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRegistrar, setFilterRegistrar] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* ── Domain form modal ── */
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DomainFormState>(EMPTY_DOMAIN_FORM);

  /* ── Registrar form modal ── */
  const [regModal, setRegModal] = useState(false);
  const [editingReg, setEditingReg] = useState<DomainRegistrar | null>(null);
  const [savingReg, setSavingReg] = useState(false);
  const [regForm, setRegForm] = useState<RegFormState>({ name: '', website_url: '', notes: '' });

  /* ── Detail modal ── */
  const [detailDomain, setDetailDomain] = useState<Domain | null>(null);

  /* ── Message ── */
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

    if (filterStatus) {
      if (filterStatus === 'expiring') {
        list = list.filter(d => getDisplayStatus(d) === 'expiring');
      } else if (filterStatus === 'active') {
        list = list.filter(d => getDisplayStatus(d) === 'active');
      } else {
        list = list.filter(d => d.status === filterStatus);
      }
    }

    if (filterCompany) {
      list = list.filter(d => d.company_name === filterCompany);
    }

    if (filterRegistrar) {
      list = list.filter(d => d.registrar === filterRegistrar);
    }

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

  const stats: DomainStats = useMemo(() => {
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
    setForm(EMPTY_DOMAIN_FORM);
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

  /* ── Auto-hide message ── */
  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }
  }, [message]);

  return {
    /* data */
    domains, subscriptions, registrars, loading, wsLoading,
    filteredDomains, stats, companies, registrarNames,
    /* tabs */
    activeTab, setActiveTab,
    /* filters */
    searchQ, setSearchQ,
    filterStatus, setFilterStatus,
    filterCompany, setFilterCompany,
    filterRegistrar, setFilterRegistrar,
    sortField, sortDir, toggleSort,
    /* domain modal */
    modal, setModal, editing, saving, form, setForm,
    openNew, openEdit, saveDomain, deleteDomain, getSubName,
    /* registrar modal */
    regModal, setRegModal, editingReg, savingReg, regForm, setRegForm,
    openNewReg, openEditReg, saveRegistrar, deleteRegistrar,
    /* detail modal */
    detailDomain, setDetailDomain,
    /* misc */
    canManage, message,
    hasSubscriptionsModule: hasModule('subscriptions'),
  };
}
