'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type {
  Subscription,
  SubscriptionCategory,
  SubscriptionRating,
  SubscriptionType,
  SubscriptionStatus,
  SubscriptionFrequency,
  SubscriptionPriority,
  SubscriptionCurrency,
  SubscriptionAccess,
  SubscriptionAccessUser,
} from '@/types/database';

/* ── Konstanty ── */

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string }> = {
  active: { label: 'Aktivní', color: '#22c55e' },
  paused: { label: 'Pozastaveno', color: '#f59e0b' },
  cancelled: { label: 'Zrušeno', color: '#ef4444' },
  trial: { label: 'Zkušební', color: '#3b82f6' },
  pending_approval: { label: 'Ke schválení', color: '#8b5cf6' },
};

const TYPE_LABELS: Record<SubscriptionType, string> = {
  saas: 'SaaS',
  hosting: 'Hosting',
  license: 'Licence',
  domain: 'Doména',
  other: 'Jiné',
};

const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  monthly: 'Měsíčně',
  quarterly: 'Čtvrtletně',
  yearly: 'Ročně',
  biennial: 'Dvouletně',
  one_time: 'Jednorázově',
};

const PRIORITY_CONFIG: Record<SubscriptionPriority, { label: string; color: string }> = {
  high: { label: 'Vysoká', color: '#ef4444' },
  medium: { label: 'Střední', color: '#f59e0b' },
  low: { label: 'Nízká', color: '#22c55e' },
};

const CATEGORY_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e',
  '#84cc16', '#eab308', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#64748b',
];

const CURRENCIES: SubscriptionCurrency[] = ['CZK', 'EUR', 'USD'];

/* ── Pomocné funkce ── */

function toMonthly(price: number, freq: SubscriptionFrequency): number {
  switch (freq) {
    case 'monthly': return price;
    case 'quarterly': return price / 3;
    case 'yearly': return price / 12;
    case 'biennial': return price / 24;
    case 'one_time': return 0;
  }
}

function toYearly(price: number, freq: SubscriptionFrequency): number {
  switch (freq) {
    case 'monthly': return price * 12;
    case 'quarterly': return price * 4;
    case 'yearly': return price;
    case 'biennial': return price / 2;
    case 'one_time': return 0;
  }
}

function getFaviconUrl(url: string) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; }
}

function fmtPrice(n: number, currency: string): string {
  const display = currency === 'CZK' ? 'Kč' : currency;
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + display;
}

function fmtDate(d: string | null): string {
  if (!d) return '–';
  const dt = new Date(d);
  return dt.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── Ikony (SVG) ── */

const ICONS = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  star: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starEmpty: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
};

/* ── Hvězdičky ── */

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          className="p-0 border-0 bg-transparent"
          style={{ color: i <= (hover || value) ? '#f59e0b' : 'var(--text-muted)', cursor: readonly ? 'default' : 'pointer', opacity: readonly ? 0.8 : 1 }}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          {i <= (hover || value) ? ICONS.star : ICONS.starEmpty}
        </button>
      ))}
    </span>
  );
}

/* ── Hlavní komponenta ── */

type Tab = 'subscriptions' | 'tips' | 'categories' | 'access';
type SortField = 'name' | 'price' | 'next_payment' | 'status' | 'rating';
type SortDir = 'asc' | 'desc';
type AccessView = 'by_service' | 'by_user' | 'summary';
type AccessSortField = 'name' | 'users' | 'cost_per_user';

function SubscriptionsContent() {
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
  const [rates, setRates] = useState<{ CZK: number; EUR: number | null; USD: number | null }>({ CZK: 1, EUR: null, USD: null });

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
  const [form, setForm] = useState({
    name: '', type: 'saas' as SubscriptionType, website_url: '', login_url: '',
    registration_email: '', company_name: '', registered_by: '' as string | null,
    description: '', notes: '', priority: 'medium' as SubscriptionPriority,
    status: 'active' as SubscriptionStatus, renewal_type: 'auto' as 'auto' | 'manual',
    price: '', currency: 'CZK' as SubscriptionCurrency, frequency: 'monthly' as SubscriptionFrequency,
    next_payment_date: '', registration_date: '', category_id: '' as string | null, is_tip: false,
  });

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<SubscriptionCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', color: CATEGORY_COLORS[0] });

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
  const [accessForm, setAccessForm] = useState({
    subscription_id: '',
    type: 'internal' as 'internal' | 'external',
    user_id: '' as string,
    external_user_id: '' as string,
    role: '',
    granted_at: '',
    note: '',
  });

  // External user modal
  const [extUserModal, setExtUserModal] = useState(false);
  const [editingExtUser, setEditingExtUser] = useState<SubscriptionAccessUser | null>(null);
  const [extUserForm, setExtUserForm] = useState({ name: '', email: '', note: '' });

  /* ── Members ── */
  const [members, setMembers] = useState<{ user_id: string; display_name: string; avatar_color: string }[]>([]);

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

    // Members
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
    for (const [id, v] of Object.entries(map)) {
      result[id] = v.sum / v.count;
    }
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
    if (filterCategory) list = list.filter(s => s.category_id === filterCategory);
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
  }, [subs, activeTab, searchQ, filterStatus, filterCategory, filterType, sortField, sortDir, avgRatings]);

  /* ── Dashboard stats ── */
  const stats = useMemo(() => {
    const activeSubs = subs.filter(s => s.status === 'active' && !s.is_tip);
    let totalMonthly = 0;
    let totalYearly = 0;
    for (const s of activeSubs) {
      if (s.price == null) continue;
      let priceCZK = s.price;
      if (s.currency !== 'CZK') {
        const r = rates[s.currency as keyof typeof rates];
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

  /* ── CRUD ── */
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
      workspace_id: wsId,
      name: form.name.trim(),
      type: form.type,
      website_url: form.website_url.trim(),
      login_url: form.login_url.trim(),
      registration_email: form.registration_email.trim(),
      company_name: form.company_name.trim(),
      registered_by: form.registered_by || null,
      description: form.description.trim(),
      notes: form.notes.trim(),
      priority: form.priority,
      status: form.status,
      renewal_type: form.renewal_type,
      price: form.price ? parseFloat(form.price) : null,
      currency: form.currency,
      frequency: form.frequency,
      next_payment_date: form.next_payment_date || null,
      registration_date: form.registration_date || null,
      category_id: form.category_id || null,
      is_tip: form.is_tip,
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

  /* ── Rating ── */
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

  /* ── Categories CRUD ── */
  const openNewCat = () => { setEditingCat(null); setCatForm({ name: '', color: CATEGORY_COLORS[0] }); setCatModal(true); };
  const openEditCat = (c: SubscriptionCategory) => { setEditingCat(c); setCatForm({ name: c.name, color: c.color }); setCatModal(true); };

  const saveCat = async () => {
    if (!catForm.name.trim() || !wsId) return;
    if (editingCat) {
      await supabase.from('trackino_subscription_categories').update({ name: catForm.name.trim(), color: catForm.color }).eq('id', editingCat.id);
    } else {
      await supabase.from('trackino_subscription_categories').insert({ workspace_id: wsId, name: catForm.name.trim(), color: catForm.color, sort_order: categories.length });
    }
    setCatModal(false);
    fetchAll();
  };

  const deleteCat = async (c: SubscriptionCategory) => {
    if (!confirm(`Smazat kategorii „${c.name}"?`)) return;
    await supabase.from('trackino_subscriptions').update({ category_id: null }).eq('category_id', c.id);
    await supabase.from('trackino_subscription_categories').delete().eq('id', c.id);
    fetchAll();
  };

  /* ── Helpers ── */
  const getCatName = (id: string | null) => categories.find(c => c.id === id)?.name ?? '';
  const getCatColor = (id: string | null) => categories.find(c => c.id === id)?.color ?? 'var(--text-muted)';
  const getMemberName = (id: string | null) => members.find(m => m.user_id === id)?.display_name ?? '';

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toCzk = (price: number | null, currency: SubscriptionCurrency): number | null => {
    if (price == null) return null;
    if (currency === 'CZK') return price;
    const r = rates[currency as keyof typeof rates];
    return r ? price * r : null;
  };

  /* ── Access helpers ── */
  const getAccessCount = useCallback((subId: string) => accesses.filter(a => a.subscription_id === subId).length, [accesses]);

  const getCostPerUser = useCallback((sub: Subscription): number => {
    if (!sub.price) return 0;
    const count = accesses.filter(a => a.subscription_id === sub.id).length;
    if (count === 0) return 0;
    const monthlyCzk = toMonthly(toCzk(sub.price, sub.currency) ?? 0, sub.frequency);
    return monthlyCzk / count;
  }, [accesses, rates]);

  const getUserTotalCost = useCallback((uid: string, isExternal: boolean): number => {
    const userAccesses = accesses.filter(a => isExternal ? a.external_user_id === uid : a.user_id === uid);
    let total = 0;
    for (const acc of userAccesses) {
      const sub = subs.find(s => s.id === acc.subscription_id);
      if (sub) total += getCostPerUser(sub);
    }
    return total;
  }, [accesses, subs, getCostPerUser]);

  const getAccessUserName = (a: SubscriptionAccess): string => {
    if (a.user_id) return members.find(m => m.user_id === a.user_id)?.display_name ?? '?';
    if (a.external_user_id) return externalUsers.find(eu => eu.id === a.external_user_id)?.name ?? '?';
    return '?';
  };

  /* ── Access CRUD ── */
  const openAccessModal = (presetSubId?: string) => {
    setAccessForm({
      subscription_id: presetSubId ?? '',
      type: 'internal',
      user_id: '',
      external_user_id: '',
      role: '',
      granted_at: '',
      note: '',
    });
    setAccessModal(true);
  };

  const saveAccess = async () => {
    if (!accessForm.subscription_id || !wsId || !userId) return;
    const isInt = accessForm.type === 'internal';
    if (isInt && !accessForm.user_id) return;
    if (!isInt && !accessForm.external_user_id) return;
    setSaving(true);
    await supabase.from('trackino_subscription_accesses').insert({
      workspace_id: wsId,
      subscription_id: accessForm.subscription_id,
      user_id: isInt ? accessForm.user_id : null,
      external_user_id: !isInt ? accessForm.external_user_id : null,
      role: accessForm.role.trim(),
      granted_at: accessForm.granted_at || null,
      note: accessForm.note.trim(),
      created_by: userId,
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

  /* ── External users CRUD ── */
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

  const toggleAccessSort = (field: AccessSortField) => {
    if (accessSortField === field) setAccessSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setAccessSortField(field); setAccessSortDir('asc'); }
  };

  /* ── Styles ── */
  const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const inputStyle: React.CSSProperties = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };
  const btnPrimary = 'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors';

  /* ── Loading / guard ── */
  if (wsLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      </DashboardLayout>
    );
  }

  /* ── Render ── */
  return (
    <DashboardLayout>
      <h1 className="text-xl font-bold mb-4 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>Předplatná</h1>

      {/* ── Dashboard statistiky ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Aktivních', value: stats.activeCount, sub: `z ${stats.totalCount} celkem`, color: '#22c55e' },
          { label: 'Měsíčně', value: fmtPrice(Math.round(stats.totalMonthly), 'CZK'), sub: 'aktivní předplatná', color: 'var(--primary)' },
          { label: 'Ročně', value: fmtPrice(Math.round(stats.totalYearly), 'CZK'), sub: 'aktivní předplatná', color: '#3b82f6' },
          { label: 'Blížící se platby', value: stats.upcomingCount, sub: 'do 30 dní', color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Záložky ── */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { id: 'subscriptions' as Tab, label: 'Předplatná' },
          { id: 'tips' as Tab, label: 'Tipy' },
          { id: 'categories' as Tab, label: 'Kategorie' },
          { id: 'access' as Tab, label: 'Přístupy' },
        ]).map(t => (
          <button
            key={t.id}
            className="px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={{
              borderColor: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
            }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.id === 'tips' && subs.filter(s => s.is_tip).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                {subs.filter(s => s.is_tip).length}
              </span>
            )}
            {t.id === 'access' && accesses.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                {accesses.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {canManage ? (
        <div className="flex justify-end mt-3 mb-4 gap-2">
          {activeTab === 'access' && (
            <button
              className={`${btnPrimary} flex items-center gap-1.5`}
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              onClick={openNewExtUser}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              <span className="hidden sm:inline">Přidat externího uživatele</span>
              <span className="sm:hidden">Ext. uživatel</span>
            </button>
          )}
          <button
            className={`${btnPrimary} flex items-center gap-1.5`}
            style={{ background: 'var(--primary)' }}
            onClick={() => {
              if (activeTab === 'categories') openNewCat();
              else if (activeTab === 'access') openAccessModal();
              else openNew(activeTab === 'tips');
            }}
          >
            {ICONS.plus}
            <span className="hidden sm:inline">
              {activeTab === 'categories' ? 'Přidat kategorii' : activeTab === 'access' ? 'Přidat přístup' : activeTab === 'tips' ? 'Přidat tip' : 'Přidat předplatné'}
            </span>
            <span className="sm:hidden">Přidat</span>
          </button>
        </div>
      ) : (<div className="mb-4" />)}

      {/* ── TAB: Předplatná / Tipy ── */}
      {(activeTab === 'subscriptions' || activeTab === 'tips') && (
        <>
          {/* Filtry */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-0 sm:min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>{ICONS.search}</span>
              <input
                type="text"
                placeholder="Hledat..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className={`${inputCls} pl-9`}
                style={inputStyle}
              />
            </div>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as SubscriptionStatus | '')}
                className={`${inputCls} appearance-none pr-8`}
                style={inputStyle}
              >
                <option value="">Všechny stavy</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
            </div>
            <div className="relative">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as SubscriptionType | '')}
                className={`${inputCls} appearance-none pr-8`}
                style={inputStyle}
              >
                <option value="">Všechny typy</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
            </div>
            {categories.length > 0 && (
              <div className="relative">
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className={`${inputCls} appearance-none pr-8`}
                  style={inputStyle}
                >
                  <option value="">Všechny kategorie</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
              </div>
            )}
          </div>

          {/* Tabulka */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)' }}>
                  {[
                    { field: 'name' as SortField, label: 'Název' },
                    { field: 'status' as SortField, label: 'Stav' },
                    { field: 'price' as SortField, label: 'Cena' },
                    { field: 'next_payment' as SortField, label: 'Další platba' },
                    { field: 'rating' as SortField, label: 'Hodnocení' },
                  ].map(col => (
                    <th
                      key={col.field}
                      className="px-3 py-2.5 text-left text-xs font-medium cursor-pointer select-none whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => toggleSort(col.field)}
                    >
                      {col.label}
                      {sortField === col.field && (
                        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                  {canManage && <th className="px-3 py-2.5 w-20" />}
                </tr>
              </thead>
              <tbody>
                {displaySubs.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      {searchQ || filterStatus || filterCategory || filterType
                        ? 'Žádné výsledky pro zadané filtry'
                        : activeTab === 'tips' ? 'Zatím žádné tipy na předplatná' : 'Zatím žádná předplatná'}
                    </td>
                  </tr>
                )}
                {displaySubs.map(s => {
                  const days = daysUntil(s.next_payment_date);
                  const cat = categories.find(c => c.id === s.category_id);
                  const czkPrice = toCzk(s.price, s.currency);
                  const monthCzk = czkPrice != null ? toMonthly(czkPrice, s.frequency) : null;
                  return (
                    <tr
                      key={s.id}
                      className="border-t cursor-pointer transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => setDetailSub(s)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const favicon = s.website_url ? getFaviconUrl(s.website_url.startsWith('http') ? s.website_url : `https://${s.website_url}`) : '';
                            return (
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                                {favicon ? (
                                  <img src={favicon} alt="" width={18} height={18} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : cat ? (
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                )}
                              </div>
                            );
                          })()}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{s.name}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {TYPE_LABELS[s.type]}
                              {s.company_name && ` · ${s.company_name}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: STATUS_CONFIG[s.status].color + '20', color: STATUS_CONFIG[s.status].color }}
                        >
                          {STATUS_CONFIG[s.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {s.price != null ? (
                          <div>
                            <p className="font-medium">{fmtPrice(s.price, s.currency)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {FREQUENCY_LABELS[s.frequency]}
                              {s.currency !== 'CZK' && monthCzk != null && ` · ~${fmtPrice(Math.round(monthCzk), 'CZK')}/měs`}
                              {s.currency === 'CZK' && s.frequency !== 'monthly' && s.frequency !== 'one_time' && ` · ${fmtPrice(Math.round(toMonthly(s.price, s.frequency)), 'CZK')}/měs`}
                            </p>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {s.next_payment_date ? (
                          <div>
                            <p>{fmtDate(s.next_payment_date)}</p>
                            {days !== null && days >= 0 && days <= 14 && (
                              <p className="text-xs font-medium" style={{ color: days <= 3 ? '#ef4444' : '#f59e0b' }}>
                                {days === 0 ? 'Dnes' : days === 1 ? 'Zítra' : `za ${days} dní`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <StarRating
                          value={myRatings[s.id] ?? 0}
                          onChange={v => setMyRating(s.id, v)}
                        />
                        {avgRatings[s.id] != null && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {avgRatings[s.id].toFixed(1)} avg
                          </p>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onClick={() => openEdit(s)}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >{ICONS.edit}</button>
                            <button
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onClick={() => deleteSub(s.id, s.name)}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
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
        </>
      )}

      {/* ── TAB: Kategorie ── */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.length === 0 && (
            <p className="text-sm col-span-full py-10 text-center" style={{ color: 'var(--text-muted)' }}>
              Zatím žádné kategorie
            </p>
          )}
          {categories.map(c => {
            const count = subs.filter(s => s.category_id === c.id).length;
            return (
              <div
                key={c.id}
                className="rounded-xl border p-4 flex items-center gap-3 group"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{count} předplatn{count === 1 ? 'é' : count >= 2 && count <= 4 ? 'á' : 'ých'}</p>
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1.5 rounded-lg"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => openEditCat(c)}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >{ICONS.edit}</button>
                    <button
                      className="p-1.5 rounded-lg"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => deleteCat(c)}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >{ICONS.trash}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Přístupy ── */}
      {activeTab === 'access' && (() => {
        const activeSubs = subs.filter(s => !s.is_tip);
        const aq = accessSearch.toLowerCase();

        /* Pohled: Podle služby */
        if (accessView === 'by_service') {
          const subsWithAccess = activeSubs.filter(s => {
            const hasAccess = accesses.some(a => a.subscription_id === s.id);
            if (!hasAccess && !canManage) return false;
            if (aq) return s.name.toLowerCase().includes(aq) || s.company_name.toLowerCase().includes(aq);
            return true;
          }).sort((a, b) => {
            const ca = getAccessCount(a.id);
            const cb = getAccessCount(b.id);
            return cb - ca || a.name.localeCompare(b.name, 'cs');
          });

          return (
            <>
              {/* Sub-přepínač pohledů */}
              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--bg-hover)' }}>
                {([
                  { id: 'by_service' as AccessView, label: 'Podle služby' },
                  { id: 'by_user' as AccessView, label: 'Podle uživatele' },
                  { id: 'summary' as AccessView, label: 'Souhrnný přehled' },
                ] as const).map(v => (
                  <button
                    key={v.id}
                    className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all text-center"
                    style={{
                      background: accessView === v.id ? 'var(--bg-card)' : 'transparent',
                      color: accessView === v.id ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: accessView === v.id ? 'var(--shadow-sm)' : 'none',
                    }}
                    onClick={() => setAccessView(v.id)}
                  >{v.label}</button>
                ))}
              </div>

              {/* Hledání */}
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>{ICONS.search}</span>
                <input
                  type="text"
                  placeholder="Hledat službu..."
                  value={accessSearch}
                  onChange={e => setAccessSearch(e.target.value)}
                  className={`${inputCls} pl-9`}
                  style={inputStyle}
                />
              </div>

              {subsWithAccess.length === 0 ? (
                <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné přístupy k zobrazení</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subsWithAccess.map(s => {
                    const subAccesses = accesses.filter(a => a.subscription_id === s.id);
                    const count = subAccesses.length;
                    const costPer = getCostPerUser(s);
                    const czkPrice = toCzk(s.price, s.currency);
                    const monthCzk = czkPrice != null ? toMonthly(czkPrice, s.frequency) : null;
                    return (
                      <div key={s.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {(() => {
                              const fav = s.website_url ? getFaviconUrl(s.website_url.startsWith('http') ? s.website_url : `https://${s.website_url}`) : '';
                              return (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                                  {fav ? (
                                    <img src={fav} alt="" width={18} height={18} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : s.category_id ? (
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCatColor(s.category_id) }} />
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                  )}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {count} uživatel{count === 1 ? '' : count >= 2 && count <= 4 ? 'é' : 'ů'}
                                {monthCzk != null && <> · {fmtPrice(Math.round(monthCzk), 'CZK')}/měs</>}
                                {count > 0 && costPer > 0 && <> · {fmtPrice(Math.round(costPer), 'CZK')}/uživatel</>}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0" style={{ background: STATUS_CONFIG[s.status].color + '20', color: STATUS_CONFIG[s.status].color }}>
                            {STATUS_CONFIG[s.status].label}
                          </span>
                        </div>
                        {/* Seznam uživatelů */}
                        {subAccesses.length > 0 && (
                          <div className="space-y-1.5 mb-2">
                            {subAccesses.map(a => {
                              const isInt = !!a.user_id;
                              const name = getAccessUserName(a);
                              const member = isInt ? members.find(m => m.user_id === a.user_id) : null;
                              return (
                                <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg group" style={{ background: 'var(--bg-hover)' }}>
                                  {isInt && member ? (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: member.avatar_color }}>
                                      {name.charAt(0).toUpperCase()}
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--border)' }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm truncate block" style={{ color: 'var(--text-primary)' }}>{name}</span>
                                    {(a.role || !isInt) && (
                                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {!isInt && 'Externí'}
                                        {!isInt && a.role && ' · '}
                                        {a.role}
                                      </span>
                                    )}
                                  </div>
                                  {canManage && (
                                    <button
                                      className="p-1 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                      style={{ color: 'var(--text-muted)' }}
                                      onClick={() => removeAccess(a.id)}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                      title="Odebrat přístup"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {canManage && (
                          <button
                            className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                            style={{ color: 'var(--primary)' }}
                            onClick={() => openAccessModal(s.id)}
                          >+ Přidat přístup</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        }

        /* Pohled: Podle uživatele */
        if (accessView === 'by_user') {
          // Interní uživatelé s přístupy
          const internalIds = [...new Set(accesses.filter(a => a.user_id).map(a => a.user_id!))];
          const internalList = internalIds.map(uid => {
            const m = members.find(mm => mm.user_id === uid);
            const userAcc = accesses.filter(a => a.user_id === uid);
            return { id: uid, name: m?.display_name ?? '?', avatar_color: m?.avatar_color ?? '#2563eb', accesses: userAcc, isExternal: false, cost: getUserTotalCost(uid, false) };
          }).filter(u => !aq || u.name.toLowerCase().includes(aq))
            .sort((a, b) => b.accesses.length - a.accesses.length || a.name.localeCompare(b.name, 'cs'));

          // Externí uživatelé
          const externalList = externalUsers.map(eu => {
            const userAcc = accesses.filter(a => a.external_user_id === eu.id);
            return { id: eu.id, name: eu.name, email: eu.email, note: eu.note, accesses: userAcc, isExternal: true, cost: getUserTotalCost(eu.id, true) };
          }).filter(u => !aq || u.name.toLowerCase().includes(aq) || (u.email && u.email.toLowerCase().includes(aq)))
            .sort((a, b) => b.accesses.length - a.accesses.length || a.name.localeCompare(b.name, 'cs'));

          return (
            <>
              {/* Sub-přepínač pohledů */}
              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--bg-hover)' }}>
                {([
                  { id: 'by_service' as AccessView, label: 'Podle služby' },
                  { id: 'by_user' as AccessView, label: 'Podle uživatele' },
                  { id: 'summary' as AccessView, label: 'Souhrnný přehled' },
                ] as const).map(v => (
                  <button key={v.id} className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all text-center"
                    style={{ background: accessView === v.id ? 'var(--bg-card)' : 'transparent', color: accessView === v.id ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: accessView === v.id ? 'var(--shadow-sm)' : 'none' }}
                    onClick={() => setAccessView(v.id)}
                  >{v.label}</button>
                ))}
              </div>

              {/* Hledání */}
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>{ICONS.search}</span>
                <input type="text" placeholder="Hledat uživatele..." value={accessSearch} onChange={e => setAccessSearch(e.target.value)} className={`${inputCls} pl-9`} style={inputStyle} />
              </div>

              {/* Interní uživatelé */}
              {internalList.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Interní uživatelé ({internalList.length})</h3>
                  <div className="space-y-3 mb-6">
                    {internalList.map(u => (
                      <div key={u.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: u.avatar_color }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {u.accesses.length} služeb · {fmtPrice(Math.round(u.cost), 'CZK')}/měs
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {u.accesses.map(a => {
                            const sub = subs.find(ss => ss.id === a.subscription_id);
                            return sub ? (
                              <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm group" style={{ background: 'var(--bg-hover)' }}>
                                {(() => {
                                  const fv = sub.website_url ? getFaviconUrl(sub.website_url.startsWith('http') ? sub.website_url : `https://${sub.website_url}`) : '';
                                  return fv ? (
                                    <img src={fv} alt="" width={16} height={16} className="flex-shrink-0 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : sub.category_id ? (
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getCatColor(sub.category_id) }} />
                                  ) : null;
                                })()}
                                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{sub.name}</span>
                                {a.role && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{a.role}</span>}
                                {canManage && (
                                  <button className="p-0.5 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                    style={{ color: 'var(--text-muted)' }} onClick={() => removeAccess(a.id)}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                )}
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Externí uživatelé */}
              <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                Externí uživatelé ({externalList.length})
              </h3>
              {externalList.length === 0 ? (
                <div className="rounded-xl border px-6 py-8 text-center mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádní externí uživatelé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {externalList.map(u => (
                    <div key={u.id} className="rounded-xl border p-4 group" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--border)' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {u.email && <>{u.email} · </>}
                            {u.accesses.length} služeb · {fmtPrice(Math.round(u.cost), 'CZK')}/měs
                          </p>
                        </div>
                        {canManage && (
                          <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                              onClick={() => openEditExtUser(externalUsers.find(eu => eu.id === u.id)!)}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >{ICONS.edit}</button>
                            <button className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                              onClick={() => deleteExtUser(externalUsers.find(eu => eu.id === u.id)!)}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >{ICONS.trash}</button>
                          </div>
                        )}
                      </div>
                      {u.accesses.length > 0 && (
                        <div className="space-y-1">
                          {u.accesses.map(a => {
                            const sub = subs.find(ss => ss.id === a.subscription_id);
                            return sub ? (
                              <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm group/item" style={{ background: 'var(--bg-hover)' }}>
                                {(() => {
                                  const fv = sub.website_url ? getFaviconUrl(sub.website_url.startsWith('http') ? sub.website_url : `https://${sub.website_url}`) : '';
                                  return fv ? (
                                    <img src={fv} alt="" width={16} height={16} className="flex-shrink-0 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  ) : sub.category_id ? (
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getCatColor(sub.category_id) }} />
                                  ) : null;
                                })()}
                                <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{sub.name}</span>
                                {a.role && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{a.role}</span>}
                                {canManage && (
                                  <button className="p-0.5 rounded transition-colors opacity-100 md:opacity-0 md:group-hover/item:opacity-100"
                                    style={{ color: 'var(--text-muted)' }} onClick={() => removeAccess(a.id)}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                )}
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                      {u.note && <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>{u.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        }

        /* Pohled: Souhrnný přehled */
        const summaryData = activeSubs.map(s => {
          const count = getAccessCount(s.id);
          const czkPrice = toCzk(s.price, s.currency);
          const monthlyCzk = czkPrice != null ? toMonthly(czkPrice, s.frequency) : 0;
          const costPerUser = count > 0 ? monthlyCzk / count : 0;
          return { sub: s, count, monthlyCzk, costPerUser };
        }).filter(d => {
          if (aq) return d.sub.name.toLowerCase().includes(aq) || d.sub.company_name.toLowerCase().includes(aq);
          return true;
        }).sort((a, b) => {
          let cmp = 0;
          switch (accessSortField) {
            case 'name': cmp = a.sub.name.localeCompare(b.sub.name, 'cs'); break;
            case 'users': cmp = a.count - b.count; break;
            case 'cost_per_user': cmp = a.costPerUser - b.costPerUser; break;
          }
          return accessSortDir === 'asc' ? cmp : -cmp;
        });

        const totalUsers = [...new Set(accesses.map(a => a.user_id || a.external_user_id))].length;
        const totalMonthlyCost = summaryData.reduce((s, d) => s + d.monthlyCzk, 0);
        const avgCost = totalUsers > 0 ? totalMonthlyCost / totalUsers : 0;

        return (
          <>
            {/* Sub-přepínač pohledů */}
            <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--bg-hover)' }}>
              {([
                { id: 'by_service' as AccessView, label: 'Podle služby' },
                { id: 'by_user' as AccessView, label: 'Podle uživatele' },
                { id: 'summary' as AccessView, label: 'Souhrnný přehled' },
              ] as const).map(v => (
                <button key={v.id} className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all text-center"
                  style={{ background: accessView === v.id ? 'var(--bg-card)' : 'transparent', color: accessView === v.id ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: accessView === v.id ? 'var(--shadow-sm)' : 'none' }}
                  onClick={() => setAccessView(v.id)}
                >{v.label}</button>
              ))}
            </div>

            {/* Souhrn */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Uživatelů celkem</p>
                <p className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{totalUsers}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Měsíční náklady</p>
                <p className="text-lg font-bold" style={{ color: '#22c55e' }}>{fmtPrice(Math.round(totalMonthlyCost), 'CZK')}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Průměr na uživatele</p>
                <p className="text-lg font-bold" style={{ color: '#3b82f6' }}>{fmtPrice(Math.round(avgCost), 'CZK')}/měs</p>
              </div>
            </div>

            {/* Hledání */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>{ICONS.search}</span>
              <input type="text" placeholder="Hledat službu..." value={accessSearch} onChange={e => setAccessSearch(e.target.value)} className={`${inputCls} pl-9`} style={inputStyle} />
            </div>

            {/* Tabulka */}
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)' }}>
                    {([
                      { field: 'name' as AccessSortField, label: 'Služba' },
                      { field: 'users' as AccessSortField, label: 'Uživatelů' },
                      { field: 'cost_per_user' as AccessSortField, label: 'Náklad/uživatel' },
                    ]).map(col => (
                      <th key={col.field}
                        className="px-3 py-2.5 text-left text-xs font-medium cursor-pointer select-none whitespace-nowrap"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => toggleAccessSort(col.field)}
                      >
                        {col.label}
                        {accessSortField === col.field && <span className="ml-1">{accessSortDir === 'asc' ? '↑' : '↓'}</span>}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Stav</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Cena/měs</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Kategorie</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Žádná data</td></tr>
                  ) : summaryData.map(d => (
                    <tr key={d.sub.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-3 py-2.5 font-medium">{d.sub.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-medium ${d.count === 0 ? '' : ''}`} style={{ color: d.count === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {d.count}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {d.count > 0 ? fmtPrice(Math.round(d.costPerUser), 'CZK') : <span style={{ color: 'var(--text-muted)' }}>–</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: STATUS_CONFIG[d.sub.status].color + '20', color: STATUS_CONFIG[d.sub.status].color }}>
                          {STATUS_CONFIG[d.sub.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{d.monthlyCzk > 0 ? fmtPrice(Math.round(d.monthlyCzk), 'CZK') : <span style={{ color: 'var(--text-muted)' }}>–</span>}</td>
                      <td className="px-3 py-2.5">
                        {d.sub.category_id ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ background: getCatColor(d.sub.category_id) }} />
                            {getCatName(d.sub.category_id)}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {/* ── Detail modal ── */}
      {detailSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDetailSub(null)}>
          <div className="rounded-xl shadow-xl border w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {(() => {
                    const fav = detailSub.website_url ? getFaviconUrl(detailSub.website_url.startsWith('http') ? detailSub.website_url : `https://${detailSub.website_url}`) : '';
                    return (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border overflow-hidden mt-0.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                        {fav ? (
                          <img src={fav} alt="" width={22} height={22} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        )}
                      </div>
                    );
                  })()}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{detailSub.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: STATUS_CONFIG[detailSub.status].color + '20', color: STATUS_CONFIG[detailSub.status].color }}>
                      {STATUS_CONFIG[detailSub.status].label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{TYPE_LABELS[detailSub.type]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PRIORITY_CONFIG[detailSub.priority].color + '20', color: PRIORITY_CONFIG[detailSub.priority].color }}>
                      {PRIORITY_CONFIG[detailSub.priority].label}
                    </span>
                  </div>
                </div>
                </div>
                <button onClick={() => setDetailSub(null)} className="p-1 rounded-lg ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                {detailSub.price != null && (
                  <>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Cena</p>
                      <p className="font-medium">{fmtPrice(detailSub.price, detailSub.currency)} / {FREQUENCY_LABELS[detailSub.frequency].toLowerCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Měsíčně (Kč)</p>
                      <p className="font-medium">{fmtPrice(Math.round(toMonthly(toCzk(detailSub.price, detailSub.currency) ?? 0, detailSub.frequency)), 'CZK')}</p>
                    </div>
                  </>
                )}
                {detailSub.next_payment_date && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Další platba</p>
                    <p>{fmtDate(detailSub.next_payment_date)}</p>
                  </div>
                )}
                {detailSub.registration_date && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Registrováno</p>
                    <p>{fmtDate(detailSub.registration_date)}</p>
                  </div>
                )}
                {detailSub.company_name && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Společnost</p>
                    <p>{detailSub.company_name}</p>
                  </div>
                )}
                {detailSub.registration_email && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Email</p>
                    <p className="truncate">{detailSub.registration_email}</p>
                  </div>
                )}
                {detailSub.registered_by && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Registroval</p>
                    <p>{getMemberName(detailSub.registered_by)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Obnova</p>
                  <p>{detailSub.renewal_type === 'auto' ? 'Automatická' : 'Manuální'}</p>
                </div>
                {detailSub.category_id && (
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Kategorie</p>
                    <p className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCatColor(detailSub.category_id) }} />
                      {getCatName(detailSub.category_id)}
                    </p>
                  </div>
                )}
              </div>

              {/* URLs */}
              {(detailSub.website_url || detailSub.login_url) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {detailSub.website_url && (
                    <a href={detailSub.website_url.startsWith('http') ? detailSub.website_url : `https://${detailSub.website_url}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={{ background: 'var(--bg-hover)', color: 'var(--primary)' }}
                    >
                      {ICONS.link} Web
                    </a>
                  )}
                  {detailSub.login_url && (
                    <a href={detailSub.login_url.startsWith('http') ? detailSub.login_url : `https://${detailSub.login_url}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={{ background: 'var(--bg-hover)', color: 'var(--primary)' }}
                    >
                      {ICONS.link} Přihlášení
                    </a>
                  )}
                </div>
              )}

              {/* Description */}
              {detailSub.description && (
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Popis</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{detailSub.description}</p>
                </div>
              )}

              {/* Notes */}
              {detailSub.notes && (
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Poznámky</p>
                  <div className="text-sm rounded-lg p-3 border" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: detailSub.notes }}
                  />
                </div>
              )}

              {/* Rating */}
              <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Moje hodnocení</p>
                <StarRating value={myRatings[detailSub.id] ?? 0} onChange={v => setMyRating(detailSub.id, v)} />
                {avgRatings[detailSub.id] != null && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Průměr: {avgRatings[detailSub.id].toFixed(1)} ({ratings.filter(r => r.subscription_id === detailSub.id).length} hodnocení)
                  </p>
                )}
              </div>

              {/* Přístupy */}
              {(() => {
                const detailAccesses = accesses.filter(a => a.subscription_id === detailSub.id);
                return (
                  <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Přístupy ({detailAccesses.length})
                      </p>
                      {canManage && (
                        <button className="text-xs font-medium" style={{ color: 'var(--primary)' }}
                          onClick={() => { setDetailSub(null); openAccessModal(detailSub.id); }}
                        >+ Přidat</button>
                      )}
                    </div>
                    {detailAccesses.length > 0 ? (
                      <div className="space-y-1">
                        {detailAccesses.map(a => {
                          const isInt = !!a.user_id;
                          const name = getAccessUserName(a);
                          const member = isInt ? members.find(m => m.user_id === a.user_id) : null;
                          return (
                            <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg group" style={{ background: 'var(--bg-hover)' }}>
                              {isInt && member ? (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: member.avatar_color }}>
                                  {name.charAt(0).toUpperCase()}
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--border)' }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                                </div>
                              )}
                              <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                                {name}
                                {!isInt && <span style={{ color: 'var(--text-muted)' }}> (ext.)</span>}
                              </span>
                              {a.role && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{a.role}</span>}
                              {canManage && (
                                <button className="p-0.5 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                  style={{ color: 'var(--text-muted)' }} onClick={() => removeAccess(a.id)}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Zatím žádné přístupy</p>
                    )}
                  </div>
                );
              })()}

              {/* Actions */}
              {canManage && (
                <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    onClick={() => { setDetailSub(null); openEdit(detailSub); }}
                  >{ICONS.edit} Upravit</button>
                  <button
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                    style={{ background: '#ef444415', color: '#ef4444' }}
                    onClick={() => { deleteSub(detailSub.id, detailSub.name); }}
                  >{ICONS.trash} Smazat</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Subscription modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setModal(false)}>
          <div className="rounded-xl shadow-xl border w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {editing ? 'Upravit předplatné' : form.is_tip ? 'Nový tip' : 'Nové předplatné'}
              </h2>

              <div className="space-y-3">
                {/* Název */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název *</label>
                  <input className={inputCls} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Název služby" />
                </div>

                {/* Typ + Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Typ</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as SubscriptionType }))}>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Stav</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SubscriptionStatus }))}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                </div>

                {/* Cena + Měna + Frekvence */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Cena</label>
                    <input type="number" className={inputCls} style={inputStyle} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Měna</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as SubscriptionCurrency }))}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Frekvence</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as SubscriptionFrequency }))}>
                        {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                </div>

                {/* CZK přepočet */}
                {form.price && form.currency !== 'CZK' && rates[form.currency as keyof typeof rates] && (
                  <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                    ≈ {fmtPrice(Math.round(parseFloat(form.price) * (rates[form.currency as keyof typeof rates] ?? 1)), 'CZK')} (kurz ČNB)
                  </p>
                )}

                {/* Priorita + Obnova */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Priorita</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as SubscriptionPriority }))}>
                        {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Obnova</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.renewal_type} onChange={e => setForm(f => ({ ...f, renewal_type: e.target.value as 'auto' | 'manual' }))}>
                        <option value="auto">Automatická</option>
                        <option value="manual">Manuální</option>
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                </div>

                {/* Datumy */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Další platba</label>
                    <input type="date" className={inputCls} style={inputStyle} value={form.next_payment_date} onChange={e => setForm(f => ({ ...f, next_payment_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum registrace</label>
                    <input type="date" className={inputCls} style={inputStyle} value={form.registration_date} onChange={e => setForm(f => ({ ...f, registration_date: e.target.value }))} />
                  </div>
                </div>

                {/* Kategorie */}
                {categories.length > 0 && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Kategorie</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}>
                        <option value="">Bez kategorie</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                )}

                {/* URLs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Web URL</label>
                    <input className={inputCls} style={inputStyle} value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Login URL</label>
                    <input className={inputCls} style={inputStyle} value={form.login_url} onChange={e => setForm(f => ({ ...f, login_url: e.target.value }))} placeholder="https://..." />
                  </div>
                </div>

                {/* Společnost + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Společnost</label>
                    <input className={inputCls} style={inputStyle} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Název poskytovatele" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Registrační email</label>
                    <input type="email" className={inputCls} style={inputStyle} value={form.registration_email} onChange={e => setForm(f => ({ ...f, registration_email: e.target.value }))} placeholder="email@..." />
                  </div>
                </div>

                {/* Registroval */}
                {members.length > 0 && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Registroval</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.registered_by ?? ''} onChange={e => setForm(f => ({ ...f, registered_by: e.target.value || null }))}>
                        <option value="">Nevybráno</option>
                        {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                )}

                {/* Popis */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Popis</label>
                  <textarea className={`${inputCls} min-h-[60px]`} style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Stručný popis služby..." rows={2} />
                </div>

                {/* Poznámky */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámky</label>
                  <textarea className={`${inputCls} min-h-[60px]`} style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Interní poznámky..." rows={2} />
                </div>

                {/* Tip checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_tip} onChange={e => setForm(f => ({ ...f, is_tip: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Označit jako tip (doporučení)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setModal(false)}>Zrušit</button>
                <button className={`${btnPrimary}`} style={{ background: 'var(--primary)', opacity: saving ? 0.7 : 1 }} disabled={saving || !form.name.trim()} onClick={saveSub}>
                  {saving ? 'Ukládám...' : editing ? 'Uložit' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Access modal ── */}
      {accessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setAccessModal(false)}>
          <div className="rounded-xl shadow-xl border w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat přístup</h2>
              <div className="space-y-3">
                {/* Předplatné */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Předplatné *</label>
                  <div className="relative">
                    <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={accessForm.subscription_id} onChange={e => setAccessForm(f => ({ ...f, subscription_id: e.target.value }))}>
                      <option value="">Vyberte...</option>
                      {subs.filter(s => !s.is_tip).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                  </div>
                </div>

                {/* Typ uživatele */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Typ uživatele</label>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: accessForm.type === 'internal' ? 'var(--primary)' : 'var(--bg-hover)',
                        color: accessForm.type === 'internal' ? '#fff' : 'var(--text-muted)',
                      }}
                      onClick={() => setAccessForm(f => ({ ...f, type: 'internal', external_user_id: '' }))}
                    >Interní</button>
                    <button
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: accessForm.type === 'external' ? 'var(--primary)' : 'var(--bg-hover)',
                        color: accessForm.type === 'external' ? '#fff' : 'var(--text-muted)',
                      }}
                      onClick={() => setAccessForm(f => ({ ...f, type: 'external', user_id: '' }))}
                    >Externí</button>
                  </div>
                </div>

                {/* Výběr uživatele */}
                {accessForm.type === 'internal' ? (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Uživatel *</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={accessForm.user_id} onChange={e => setAccessForm(f => ({ ...f, user_id: e.target.value }))}>
                        <option value="">Vyberte...</option>
                        {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Externí uživatel *</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={accessForm.external_user_id} onChange={e => setAccessForm(f => ({ ...f, external_user_id: e.target.value }))}>
                        <option value="">Vyberte...</option>
                        {externalUsers.map(eu => <option key={eu.id} value={eu.id}>{eu.name}{eu.email ? ` (${eu.email})` : ''}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                    </div>
                    {externalUsers.length === 0 && (
                      <button className="text-xs mt-1" style={{ color: 'var(--primary)' }} onClick={() => { setAccessModal(false); openNewExtUser(); }}>
                        + Nejdřív přidejte externího uživatele
                      </button>
                    )}
                  </div>
                )}

                {/* Role */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Role</label>
                  <input className={inputCls} style={inputStyle} value={accessForm.role} onChange={e => setAccessForm(f => ({ ...f, role: e.target.value }))} placeholder="např. Admin, Uživatel..." />
                </div>

                {/* Datum přiřazení */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum přiřazení</label>
                  <input type="date" className={inputCls} style={inputStyle} value={accessForm.granted_at} onChange={e => setAccessForm(f => ({ ...f, granted_at: e.target.value }))} />
                </div>

                {/* Poznámka */}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
                  <textarea className={`${inputCls} min-h-[50px]`} style={inputStyle} value={accessForm.note} onChange={e => setAccessForm(f => ({ ...f, note: e.target.value }))} placeholder="Volitelná poznámka..." rows={2} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setAccessModal(false)}>Zrušit</button>
                <button
                  className={btnPrimary}
                  style={{ background: 'var(--primary)', opacity: saving ? 0.7 : 1 }}
                  disabled={saving || !accessForm.subscription_id || (accessForm.type === 'internal' ? !accessForm.user_id : !accessForm.external_user_id)}
                  onClick={saveAccess}
                >{saving ? 'Ukládám...' : 'Přidat'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── External user modal ── */}
      {extUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setExtUserModal(false)}>
          <div className="rounded-xl shadow-xl border w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {editingExtUser ? 'Upravit externího uživatele' : 'Nový externí uživatel'}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Jméno *</label>
                  <input className={inputCls} style={inputStyle} value={extUserForm.name} onChange={e => setExtUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Jméno a příjmení" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                  <input type="email" className={inputCls} style={inputStyle} value={extUserForm.email} onChange={e => setExtUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..." />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
                  <textarea className={`${inputCls} min-h-[50px]`} style={inputStyle} value={extUserForm.note} onChange={e => setExtUserForm(f => ({ ...f, note: e.target.value }))} placeholder="Volitelná poznámka..." rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setExtUserModal(false)}>Zrušit</button>
                <button className={btnPrimary} style={{ background: 'var(--primary)', opacity: saving ? 0.7 : 1 }} disabled={saving || !extUserForm.name.trim()} onClick={saveExtUser}>
                  {saving ? 'Ukládám...' : editingExtUser ? 'Uložit' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category modal ── */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setCatModal(false)}>
          <div className="rounded-xl shadow-xl border w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                {editingCat ? 'Upravit kategorii' : 'Nová kategorie'}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název</label>
                  <input className={inputCls} style={inputStyle} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Název kategorie" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Barva</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className="w-7 h-7 rounded-full transition-all"
                        style={{
                          background: c,
                          outline: catForm.color === c ? `2px solid ${c}` : 'none',
                          outlineOffset: catForm.color === c ? '2px' : '0',
                        }}
                        onClick={() => setCatForm(f => ({ ...f, color: c }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setCatModal(false)}>Zrušit</button>
                <button className={`${btnPrimary}`} style={{ background: 'var(--primary)' }} disabled={!catForm.name.trim()} onClick={saveCat}>
                  {editingCat ? 'Uložit' : 'Vytvořit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ── Export ── */

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <SubscriptionsContent />
    </WorkspaceProvider>
  );
}
