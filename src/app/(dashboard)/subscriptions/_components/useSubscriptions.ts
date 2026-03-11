'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import type {
  Subscription,
  SubscriptionCategory,
  SubscriptionRating,
  SubscriptionType,
  SubscriptionStatus,
  SubscriptionFrequency,
  SubscriptionPriority,
  SubscriptionAccess,
  SubscriptionAccessUser,
} from '@/types/database';
import { toMonthly, toYearly, daysUntil } from './utils';
import { CATEGORY_COLORS } from './constants';
import type {
  Tab, SortField, SortDir, AccessView, AccessSortField,
  Member, Rates, Stats, SubForm, CatForm, AccessForm, ExtUserForm,
} from './types';

export function useSubscriptions() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const canManage = useMemo(
    () => isMasterAdmin || isWorkspaceAdmin || (currentMembership?.can_manage_subscriptions ?? false),
    [isMasterAdmin, isWorkspaceAdmin, currentMembership]
  );

  const wsId = currentWorkspace?.id;
  const userId = user?.id;

  /* ── State ── */
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<SubscriptionCategory[]>([]);
  const [ratings, setRatings] = useState<SubscriptionRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Rates>({ CZK: 1, EUR: null, USD: null });

  // UI
  const [activeTab, setActiveTab] = useState<Tab>('subscriptions');
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | ''>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState<SubscriptionType | ''>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Subscription modal
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SubForm>({
    name: '', type: 'saas', website_url: '', login_url: '',
    registration_email: '', company_name: '', registered_by: null,
    description: '', notes: '', priority: 'medium',
    status: 'active', renewal_type: 'auto',
    price: '', currency: 'CZK', frequency: 'monthly',
    next_payment_date: '', registration_date: '', category_id: null, is_tip: false,
  });

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<SubscriptionCategory | null>(null);
  const [catForm, setCatForm] = useState<CatForm>({ name: '', color: CATEGORY_COLORS[0], parent_id: null });

  // Detail modal
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);

  // Access tab
  const [accesses, setAccesses] = useState<SubscriptionAccess[]>([]);
  const [externalUsers, setExternalUsers] = useState<SubscriptionAccessUser[]>([]);
  const [accessView, setAccessView] = useState<AccessView>('by_service');
  const [accessSortField, setAccessSortField] = useState<AccessSortField>('name');
  const [accessSortDir, setAccessSortDir] = useState<SortDir>('asc');
  const [accessSearch, setAccessSearch] = useState('');

  // Access modal
  const [accessModal, setAccessModal] = useState(false);
  const [accessForm, setAccessForm] = useState<AccessForm>({
    subscription_id: '', type: 'internal', user_id: '',
    external_user_id: '', role: '', granted_at: '', note: '',
  });

  // External user modal
  const [extUserModal, setExtUserModal] = useState(false);
  const [editingExtUser, setEditingExtUser] = useState<SubscriptionAccessUser | null>(null);
  const [extUserForm, setExtUserForm] = useState<ExtUserForm>({ name: '', email: '', note: '' });

  /* ── Members ── */
  const [members, setMembers] = useState<Member[]>([]);

  /* ── Module guard ── */
  useEffect(() => {
    if (!wsLoading && !hasModule('subscriptions')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  /* ── Fetch data ── */
  const fetchAll = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    const [sRes, cRes, rRes, mRes, aRes, euRes] = await Promise.all([
      supabase.from('trackino_subscriptions').select('*').eq('workspace_id', wsId).order('name'),
      supabase.from('trackino_subscription_categories').select('*').eq('workspace_id', wsId).order('sort_order').order('name'),
      supabase.from('trackino_subscription_ratings').select('*').eq('workspace_id', wsId),
      supabase.from('trackino_workspace_members').select('user_id').eq('workspace_id', wsId),
      supabase.from('trackino_subscription_accesses').select('*').eq('workspace_id', wsId),
      supabase.from('trackino_subscription_access_users').select('*').eq('workspace_id', wsId).order('name'),
    ]);
    setSubs((sRes.data ?? []) as Subscription[]);
    setCategories((cRes.data ?? []) as SubscriptionCategory[]);
    setRatings((rRes.data ?? []) as SubscriptionRating[]);
    setAccesses((aRes.data ?? []) as SubscriptionAccess[]);
    setExternalUsers((euRes.data ?? []) as SubscriptionAccessUser[]);

    const uids = (mRes.data ?? []).map((m: { user_id: string }) => m.user_id);
    if (uids.length > 0) {
      const { data: pData } = await supabase.from('trackino_profiles').select('id, display_name, avatar_color').in('id', uids);
      setMembers((pData ?? []).map((p: { id: string; display_name: string | null; avatar_color: string | null }) => ({
        user_id: p.id,
        display_name: p.display_name ?? '',
        avatar_color: p.avatar_color ?? '#2563eb',
      })));
    }
    setLoading(false);
  }, [wsId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Fetch ČNB rates ── */
  useEffect(() => {
    fetch('/api/cnb-rates')
      .then(r => r.json())
      .then(d => { if (d.rates) setRates(d.rates); })
      .catch(() => {});
  }, []);

  /* ── Computed: avg ratings ── */
  const avgRatings = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    for (const r of ratings) {
      if (!map[r.subscription_id]) map[r.subscription_id] = { sum: 0, count: 0 };
      map[r.subscription_id].sum += r.rating;
      map[r.subscription_id].count += 1;
    }
    const result: Record<string, number> = {};
    for (const [id, v] of Object.entries(map)) result[id] = v.sum / v.count;
    return result;
  }, [ratings]);

  /* ── Computed: my ratings ── */
  const myRatings = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of ratings) {
      if (r.user_id === userId) map[r.subscription_id] = r.rating;
    }
    return map;
  }, [ratings, userId]);

  /* ── Computed: category helpers ── */
  const rootCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const getSubcategories = useCallback((parentId: string) => categories.filter(c => c.parent_id === parentId), [categories]);
  const getCatCountWithSubs = useCallback((catId: string): number => {
    const direct = subs.filter(s => s.category_id === catId).length;
    const subCats = categories.filter(c => c.parent_id === catId);
    return direct + subCats.reduce((sum, sc) => sum + subs.filter(s => s.category_id === sc.id).length, 0);
  }, [subs, categories]);

  /* ── Computed: filter + sort ── */
  const displaySubs = useMemo(() => {
    let list = subs.filter(s => activeTab === 'tips' ? s.is_tip : !s.is_tip);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.company_name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.registration_email.toLowerCase().includes(q)
      );
    }
    if (filterStatus) list = list.filter(s => s.status === filterStatus);
    if (filterCategory) {
      const subCatIds = categories.filter(c => c.parent_id === filterCategory).map(c => c.id);
      const matchIds = new Set([filterCategory, ...subCatIds]);
      list = list.filter(s => s.category_id && matchIds.has(s.category_id));
    }
    if (filterType) list = list.filter(s => s.type === filterType);

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, 'cs'); break;
        case 'price': cmp = (a.price ?? 0) - (b.price ?? 0); break;
        case 'next_payment': cmp = (a.next_payment_date ?? '').localeCompare(b.next_payment_date ?? ''); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'rating': cmp = (avgRatings[a.id] ?? 0) - (avgRatings[b.id] ?? 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [subs, activeTab, searchQ, filterStatus, filterCategory, filterType, sortField, sortDir, avgRatings, categories]);

  /* ── Dashboard stats ── */
  const stats: Stats = useMemo(() => {
    const activeSubs = subs.filter(s => s.status === 'active' && !s.is_tip);
    let totalMonthly = 0;
    let totalYearly = 0;
    for (const s of activeSubs) {
      if (s.price == null) continue;
      let priceCZK = s.price;
      if (s.currency !== 'CZK') {
        const r = rates[s.currency as keyof Rates];
        if (r) priceCZK = s.price * r;
      }
      totalMonthly += toMonthly(priceCZK, s.frequency);
      totalYearly += toYearly(priceCZK, s.frequency);
    }
    const upcoming = subs.filter(s => {
      const d = daysUntil(s.next_payment_date);
      return d !== null && d >= 0 && d <= 30 && s.status === 'active';
    });
    return { totalMonthly, totalYearly, activeCount: activeSubs.length, upcomingCount: upcoming.length, totalCount: subs.filter(s => !s.is_tip).length };
  }, [subs, rates]);

  /* ── Helpers ── */
  const getCatName = useCallback((id: string | null): string => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return '';
    if (cat.parent_id) {
      const parent = categories.find(c => c.id === cat.parent_id);
      return parent ? `${parent.name} / ${cat.name}` : cat.name;
    }
    return cat.name;
  }, [categories]);

  const getCatColor = useCallback((id: string | null) => categories.find(c => c.id === id)?.color ?? 'var(--text-muted)', [categories]);
  const getMemberName = useCallback((id: string | null) => members.find(m => m.user_id === id)?.display_name ?? '', [members]);

  const toCzk = useCallback((price: number | null, currency: string): number | null => {
    if (price == null) return null;
    if (currency === 'CZK') return price;
    const r = rates[currency as keyof Rates];
    return r ? price * r : null;
  }, [rates]);

  /* ── Access helpers ── */
  const getAccessCount = useCallback((subId: string) => accesses.filter(a => a.subscription_id === subId).length, [accesses]);

  const getCostPerUser = useCallback((sub: Subscription): number => {
    if (!sub.price) return 0;
    const count = accesses.filter(a => a.subscription_id === sub.id).length;
    if (count === 0) return 0;
    const monthlyCzk = toMonthly(toCzk(sub.price, sub.currency) ?? 0, sub.frequency);
    return monthlyCzk / count;
  }, [accesses, toCzk]);

  const getUserTotalCost = useCallback((uid: string, isExternal: boolean): number => {
    const userAccesses = accesses.filter(a => isExternal ? a.external_user_id === uid : a.user_id === uid);
    let total = 0;
    for (const acc of userAccesses) {
      const sub = subs.find(s => s.id === acc.subscription_id);
      if (sub) total += getCostPerUser(sub);
    }
    return total;
  }, [accesses, subs, getCostPerUser]);

  const getAccessUserName = useCallback((a: SubscriptionAccess): string => {
    if (a.user_id) return members.find(m => m.user_id === a.user_id)?.display_name ?? '?';
    if (a.external_user_id) return externalUsers.find(eu => eu.id === a.external_user_id)?.name ?? '?';
    return '?';
  }, [members, externalUsers]);

  /* ── Sort helpers ── */
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleAccessSort = (field: AccessSortField) => {
    if (accessSortField === field) setAccessSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setAccessSortField(field); setAccessSortDir('asc'); }
  };

  /* ── CRUD: Subscriptions ── */
  const openNew = (isTip = false) => {
    setEditing(null);
    setForm({
      name: '', type: 'saas', website_url: '', login_url: '',
      registration_email: '', company_name: '', registered_by: userId ?? null,
      description: '', notes: '', priority: 'medium',
      status: 'active', renewal_type: 'auto',
      price: '', currency: 'CZK', frequency: 'monthly',
      next_payment_date: '', registration_date: '', category_id: null, is_tip: isTip,
    });
    setModal(true);
  };

  const openEdit = (s: Subscription) => {
    setEditing(s);
    setForm({
      name: s.name, type: s.type, website_url: s.website_url, login_url: s.login_url,
      registration_email: s.registration_email, company_name: s.company_name,
      registered_by: s.registered_by, description: s.description, notes: s.notes,
      priority: s.priority, status: s.status, renewal_type: s.renewal_type,
      price: s.price != null ? String(s.price) : '', currency: s.currency,
      frequency: s.frequency, next_payment_date: s.next_payment_date ?? '',
      registration_date: s.registration_date ?? '', category_id: s.category_id, is_tip: s.is_tip,
    });
    setModal(true);
  };

  const saveSub = async () => {
    if (!form.name.trim() || !wsId || !userId) return;
    setSaving(true);
    const payload = {
      workspace_id: wsId, name: form.name.trim(), type: form.type,
      website_url: form.website_url.trim(), login_url: form.login_url.trim(),
      registration_email: form.registration_email.trim(), company_name: form.company_name.trim(),
      registered_by: form.registered_by || null, description: form.description.trim(),
      notes: form.notes.trim(), priority: form.priority, status: form.status,
      renewal_type: form.renewal_type, price: form.price ? parseFloat(form.price) : null,
      currency: form.currency, frequency: form.frequency,
      next_payment_date: form.next_payment_date || null,
      registration_date: form.registration_date || null,
      category_id: form.category_id || null, is_tip: form.is_tip,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('trackino_subscriptions').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('trackino_subscriptions').insert({ ...payload, created_by: userId });
    }
    setSaving(false);
    setModal(false);
    fetchAll();
  };

  const deleteSub = async (id: string, name: string) => {
    if (!confirm(`Smazat předplatné „${name}"?`)) return;
    await supabase.from('trackino_subscription_ratings').delete().eq('subscription_id', id);
    await supabase.from('trackino_subscriptions').delete().eq('id', id);
    if (detailSub?.id === id) setDetailSub(null);
    fetchAll();
  };

  /* ── CRUD: Ratings ── */
  const setMyRating = async (subId: string, value: number) => {
    if (!wsId || !userId) return;
    const existing = ratings.find(r => r.subscription_id === subId && r.user_id === userId);
    if (existing) {
      await supabase.from('trackino_subscription_ratings').update({ rating: value, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('trackino_subscription_ratings').insert({ subscription_id: subId, workspace_id: wsId, user_id: userId, rating: value });
    }
    fetchAll();
  };

  /* ── CRUD: Categories ── */
  const openNewCat = (parentId?: string) => {
    setEditingCat(null);
    setCatForm({ name: '', color: CATEGORY_COLORS[0], parent_id: parentId ?? null });
    setCatModal(true);
  };

  const openEditCat = (c: SubscriptionCategory) => {
    setEditingCat(c);
    setCatForm({ name: c.name, color: c.color, parent_id: c.parent_id ?? null });
    setCatModal(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim() || !wsId) return;
    if (editingCat) {
      await supabase.from('trackino_subscription_categories').update({ name: catForm.name.trim(), color: catForm.color, parent_id: catForm.parent_id || null }).eq('id', editingCat.id);
    } else {
      await supabase.from('trackino_subscription_categories').insert({ workspace_id: wsId, name: catForm.name.trim(), color: catForm.color, sort_order: categories.length, parent_id: catForm.parent_id || null });
    }
    setCatModal(false);
    fetchAll();
  };

  const deleteCat = async (c: SubscriptionCategory) => {
    const subCats = categories.filter(sc => sc.parent_id === c.id);
    const msg = subCats.length > 0
      ? `Smazat kategorii „${c.name}" a ${subCats.length} podkategori${subCats.length === 1 ? 'i' : subCats.length <= 4 ? 'e' : 'í'}? Předplatná budou ponechána bez kategorie.`
      : `Smazat kategorii „${c.name}"?`;
    if (!confirm(msg)) return;
    await supabase.from('trackino_subscriptions').update({ category_id: null }).eq('category_id', c.id);
    for (const sc of subCats) {
      await supabase.from('trackino_subscriptions').update({ category_id: null }).eq('category_id', sc.id);
      await supabase.from('trackino_subscription_categories').delete().eq('id', sc.id);
    }
    await supabase.from('trackino_subscription_categories').delete().eq('id', c.id);
    fetchAll();
  };

  /* ── CRUD: Accesses ── */
  const openAccessModal = (presetSubId?: string) => {
    setAccessForm({ subscription_id: presetSubId ?? '', type: 'internal', user_id: '', external_user_id: '', role: '', granted_at: '', note: '' });
    setAccessModal(true);
  };

  const saveAccess = async () => {
    if (!accessForm.subscription_id || !wsId || !userId) return;
    const isInt = accessForm.type === 'internal';
    if (isInt && !accessForm.user_id) return;
    if (!isInt && !accessForm.external_user_id) return;
    setSaving(true);
    await supabase.from('trackino_subscription_accesses').insert({
      workspace_id: wsId, subscription_id: accessForm.subscription_id,
      user_id: isInt ? accessForm.user_id : null,
      external_user_id: !isInt ? accessForm.external_user_id : null,
      role: accessForm.role.trim(), granted_at: accessForm.granted_at || null,
      note: accessForm.note.trim(), created_by: userId,
    });
    setSaving(false);
    setAccessModal(false);
    fetchAll();
  };

  const removeAccess = async (id: string) => {
    if (!confirm('Odebrat přístup?')) return;
    await supabase.from('trackino_subscription_accesses').delete().eq('id', id);
    fetchAll();
  };

  /* ── CRUD: External users ── */
  const openNewExtUser = () => {
    setEditingExtUser(null);
    setExtUserForm({ name: '', email: '', note: '' });
    setExtUserModal(true);
  };

  const openEditExtUser = (eu: SubscriptionAccessUser) => {
    setEditingExtUser(eu);
    setExtUserForm({ name: eu.name, email: eu.email, note: eu.note });
    setExtUserModal(true);
  };

  const saveExtUser = async () => {
    if (!extUserForm.name.trim() || !wsId || !userId) return;
    setSaving(true);
    if (editingExtUser) {
      await supabase.from('trackino_subscription_access_users').update({
        name: extUserForm.name.trim(), email: extUserForm.email.trim(),
        note: extUserForm.note.trim(), updated_at: new Date().toISOString(),
      }).eq('id', editingExtUser.id);
    } else {
      await supabase.from('trackino_subscription_access_users').insert({
        workspace_id: wsId, name: extUserForm.name.trim(),
        email: extUserForm.email.trim(), note: extUserForm.note.trim(),
        created_by: userId,
      });
    }
    setSaving(false);
    setExtUserModal(false);
    fetchAll();
  };

  const deleteExtUser = async (eu: SubscriptionAccessUser) => {
    if (!confirm(`Smazat externího uživatele „${eu.name}"? Budou odebrány i všechny jeho přístupy.`)) return;
    await supabase.from('trackino_subscription_accesses').delete().eq('external_user_id', eu.id);
    await supabase.from('trackino_subscription_access_users').delete().eq('id', eu.id);
    fetchAll();
  };

  return {
    // Data
    subs, categories, ratings, loading, rates, accesses, externalUsers, members,
    wsLoading, canManage,
    // UI state
    activeTab, setActiveTab,
    searchQ, setSearchQ,
    filterStatus, setFilterStatus,
    filterCategory, setFilterCategory,
    filterType, setFilterType,
    sortField, sortDir, toggleSort,
    // Subscription modal
    modal, setModal, editing, saving, form, setForm,
    // Category modal
    catModal, setCatModal, editingCat, catForm, setCatForm,
    // Detail modal
    detailSub, setDetailSub,
    // Access tab
    accessView, setAccessView,
    accessSortField, accessSortDir, toggleAccessSort,
    accessSearch, setAccessSearch,
    // Access modal
    accessModal, setAccessModal, accessForm, setAccessForm,
    // Ext user modal
    extUserModal, setExtUserModal, editingExtUser, extUserForm, setExtUserForm,
    // Computed
    avgRatings, myRatings, displaySubs, stats,
    rootCategories, getSubcategories, getCatCountWithSubs,
    // Helpers
    getCatName, getCatColor, getMemberName, toCzk,
    getAccessCount, getCostPerUser, getUserTotalCost, getAccessUserName,
    // CRUD
    openNew, openEdit, saveSub, deleteSub, setMyRating,
    openNewCat, openEditCat, saveCat, deleteCat,
    openAccessModal, saveAccess, removeAccess,
    openNewExtUser, openEditExtUser, saveExtUser, deleteExtUser,
  };
}
