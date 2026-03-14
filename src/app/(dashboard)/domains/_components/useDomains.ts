'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import type { Domain, DomainStatus, DomainRegistrar, Subscription, DomainMonitoring, DomainCheckHistory, DomainCheckResult, GeoEntry, Project } from '@/types/database';
import type {
  DisplayStatus, SortField, SortDir, TabType,
  DomainFormState, RegFormState, DomainStats,
} from './types';
import { getDisplayStatus } from './utils';

const EMPTY_DOMAIN_FORM: DomainFormState = {
  name: '', registrar: '', subscription_id: null, registration_date: '',
  expiration_date: '', status: 'active', notes: '', target_url: '',
  project_name: '', company_name: '',
  is_blocked: false, blocked_geo_codes: [],
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
  const [geos, setGeos] = useState<GeoEntry[]>([]);
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [billingCompanies, setBillingCompanies] = useState<string[]>([]);
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
  const [regForm, setRegForm] = useState<RegFormState>({ name: '', website_url: '', login_url: '', notes: '' });

  /* ── Detail modal ── */
  const [detailDomain, setDetailDomain] = useState<Domain | null>(null);

  /* ── Monitoring state ── */
  const [monitoringList, setMonitoringList] = useState<DomainMonitoring[]>([]);
  const [checkHistory, setCheckHistory] = useState<DomainCheckHistory[]>([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);

  /* ── Checker state (přetrvává v session) ── */
  const [checkerResults, setCheckerResults] = useState<DomainCheckResult[]>([]);

  /* ── Openprovider status ── */
  const [openproviderConfigured, setOpenproviderConfigured] = useState<boolean | null>(null);

  /* ── Subreg status ── */
  const [subregConfigured, setSubregConfigured] = useState<boolean | null>(null);

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
    const [dRes, sRes, rRes, gRes, pRes, bRes] = await Promise.all([
      supabase.from('trackino_domains').select('*').eq('workspace_id', wsId).order('name'),
      hasModule('subscriptions')
        ? supabase.from('trackino_subscriptions').select('id,name,website_url').eq('workspace_id', wsId).eq('status', 'active').order('name')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('trackino_domain_registrars').select('*').eq('workspace_id', wsId).order('name'),
      supabase.from('trackino_geos').select('*').eq('workspace_id', wsId).order('name_en'),
      supabase.from('trackino_projects').select('id,name').eq('workspace_id', wsId).order('name'),
      supabase.from('trackino_workspace_billing').select('company_name').eq('workspace_id', wsId).order('is_default', { ascending: false }),
    ]);
    if (dRes.data) setDomains(dRes.data);
    if (sRes.data) setSubscriptions(sRes.data as Subscription[]);
    if (rRes.data) setRegistrars(rRes.data as DomainRegistrar[]);
    if (gRes.data) setGeos(gRes.data as GeoEntry[]);
    if (pRes.data) setProjects(pRes.data as Pick<Project, 'id' | 'name'>[]);
    if (bRes.data) {
      const names = bRes.data
        .map((r: { company_name: string }) => r.company_name)
        .filter((n: string) => n && n.trim());
      setBillingCompanies(names);
    }
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
      is_blocked: d.is_blocked ?? false,
      blocked_geo_codes: d.blocked_geo_codes ?? [],
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
      is_blocked: form.is_blocked,
      blocked_geo_codes: form.is_blocked ? form.blocked_geo_codes : [],
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
    setRegForm({ name: '', website_url: '', login_url: '', notes: '' });
    setRegModal(true);
  };

  const openEditReg = (r: DomainRegistrar) => {
    setEditingReg(r);
    setRegForm({ name: r.name, website_url: r.website_url, login_url: r.login_url ?? '', notes: r.notes });
    setRegModal(true);
  };

  const saveRegistrar = async () => {
    if (!wsId || !userId || !regForm.name.trim()) return;
    setSavingReg(true);
    const payload = {
      workspace_id: wsId,
      name: regForm.name.trim(),
      website_url: regForm.website_url.trim(),
      login_url: regForm.login_url.trim(),
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

  /* ── Openprovider status fetch ── */
  const fetchOpenproviderStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/openprovider/status');
      const data = await res.json();
      setOpenproviderConfigured(data.configured ?? false);
    } catch {
      setOpenproviderConfigured(false);
    }
  }, []);

  /* ── Subreg status fetch ── */
  const fetchSubregStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/subreg/status');
      const data = await res.json();
      setSubregConfigured(data.configured ?? false);
    } catch {
      setSubregConfigured(false);
    }
  }, []);

  /* ── Monitoring CRUD ── */
  const fetchMonitoring = useCallback(async () => {
    if (!wsId) return;
    setLoadingMonitoring(true);
    const [mRes, hRes] = await Promise.all([
      supabase.from('trackino_domain_monitoring').select('*').eq('workspace_id', wsId).order('domain_name'),
      supabase.from('trackino_domain_check_history').select('*').eq('workspace_id', wsId).order('checked_at', { ascending: false }).limit(50),
    ]);
    if (mRes.data) setMonitoringList(mRes.data as DomainMonitoring[]);
    if (hRes.data) setCheckHistory(hRes.data as DomainCheckHistory[]);
    setLoadingMonitoring(false);
  }, [wsId]);

  const addToMonitoring = useCallback(async (domainName: string, frequency: 'daily' | 'weekly' = 'daily') => {
    if (!wsId || !userId) return;
    const { error } = await supabase.from('trackino_domain_monitoring').insert({
      workspace_id: wsId,
      domain_name: domainName.toLowerCase().trim(),
      frequency,
      notify_on_change: true,
      notes: '',
      created_by: userId,
    });
    if (error) {
      setMessage({ text: 'Chyba při přidávání do monitoringu', type: 'error' });
    } else {
      setMessage({ text: `${domainName} přidána do monitoringu`, type: 'success' });
      fetchMonitoring();
    }
  }, [wsId, userId, fetchMonitoring]);

  const deleteMonitoring = useCallback(async (id: string) => {
    if (!confirm('Odebrat doménu z monitoringu?')) return;
    await supabase.from('trackino_domain_monitoring').delete().eq('id', id);
    setMessage({ text: 'Záznam odebrán', type: 'success' });
    fetchMonitoring();
  }, [fetchMonitoring]);

  const checkMonitoringNow = useCallback(async (item: DomainMonitoring) => {
    if (!wsId) return;
    // Parsuje "example.cz" → name="example", extension="cz"
    const lastDot = item.domain_name.lastIndexOf('.');
    if (lastDot < 1) {
      setMessage({ text: 'Neplatný formát domény', type: 'error' });
      return;
    }
    const name = item.domain_name.slice(0, lastDot);
    const extension = item.domain_name.slice(lastDot + 1);

    try {
      const res = await fetch('/api/openprovider/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [{ name, extension }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? 'Chyba kontroly', type: 'error' });
        return;
      }
      const status = data.results?.[0]?.status ?? 'error';
      // Uložit do history
      await supabase.from('trackino_domain_check_history').insert({
        workspace_id: wsId,
        domain_name: item.domain_name,
        status,
        source: 'monitoring',
        monitoring_id: item.id,
      });
      // Update záznamu
      await supabase.from('trackino_domain_monitoring').update({
        last_checked_at: new Date().toISOString(),
        last_status: status,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      setMessage({ text: `${item.domain_name}: ${status}`, type: 'success' });
      fetchMonitoring();
    } catch {
      setMessage({ text: 'Chyba při kontrole', type: 'error' });
    }
  }, [wsId, fetchMonitoring]);

  /* ── Check domains (pro Checker záložku) ── */
  const checkDomains = useCallback(async (
    domains: { name: string; extension: string }[],
    source: 'manual' | 'bulk' = 'manual',
  ): Promise<DomainCheckResult[]> => {
    if (!wsId) return [];
    const res = await fetch('/api/openprovider/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ text: data.error ?? 'Chyba kontroly', type: 'error' });
      return [];
    }
    const results: DomainCheckResult[] = data.results ?? [];
    setCheckerResults(results);

    // Uložit do history
    if (results.length > 0) {
      const historyRows = results.map(r => ({
        workspace_id: wsId,
        domain_name: r.domain,
        status: r.status,
        source,
        monitoring_id: null,
      }));
      await supabase.from('trackino_domain_check_history').insert(historyRows);
    }
    return results;
  }, [wsId]);

  /* ── Mazání historie kontrol ── */
  const deleteHistoryEntry = useCallback(async (id: string) => {
    if (!wsId) return;
    await supabase.from('trackino_domain_check_history').delete().eq('id', id).eq('workspace_id', wsId);
    setCheckHistory(prev => prev.filter(h => h.id !== id));
  }, [wsId]);

  const deleteHistoryEntries = useCallback(async (ids: string[]) => {
    if (!wsId || ids.length === 0) return;
    await supabase.from('trackino_domain_check_history').delete().in('id', ids).eq('workspace_id', wsId);
    setCheckHistory(prev => prev.filter(h => !ids.includes(h.id)));
  }, [wsId]);

  const clearHistory = useCallback(async (domainName?: string) => {
    if (!wsId) return;
    let query = supabase.from('trackino_domain_check_history').delete().eq('workspace_id', wsId);
    if (domainName) query = query.eq('domain_name', domainName);
    await query;
    setCheckHistory(prev => domainName ? prev.filter(h => h.domain_name !== domainName) : []);
  }, [wsId]);

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
    domains, subscriptions, registrars, geos, projects, billingCompanies, loading, wsLoading,
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
    /* monitoring */
    monitoringList, checkHistory, loadingMonitoring,
    fetchMonitoring, addToMonitoring, deleteMonitoring, checkMonitoringNow,
    deleteHistoryEntry, deleteHistoryEntries, clearHistory,
    /* checker */
    checkerResults, setCheckerResults, checkDomains,
    /* openprovider */
    openproviderConfigured, fetchOpenproviderStatus,
    /* subreg */
    subregConfigured, fetchSubregStatus,
    /* misc */
    canManage, message,
    hasSubscriptionsModule: hasModule('subscriptions'),
    wsId,
  };
}
