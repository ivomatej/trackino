'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { AppChange, AppChangeStatus } from '@/types/database';
import { type FormState, type FilterTab, EMPTY_FORM } from './types';

export function useAppChanges() {
  const { isMasterAdmin } = usePermissions();
  const { loading: authLoading, profile, user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<AppChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Výběr pro hromadné mazání v Archivu
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal stav
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<AppChange | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Redirect non-master-admin – čeká, dokud se auth a profil nenačtou
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    if (profile === null) return;
    if (!isMasterAdmin) router.push('/');
  }, [authLoading, user, profile, isMasterAdmin, router]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trackino_app_changes')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data ?? []) as AppChange[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Vymaž výběr při změně záložky
  useEffect(() => {
    setSelectedIds(new Set());
    setExpandedId(null);
  }, [filterTab]);

  // Auto-resize textarea když se modal otevře s existujícím textem
  useEffect(() => {
    if (showForm && descTextareaRef.current) {
      const ta = descTextareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 600) + 'px';
    }
  }, [showForm, form.content]);

  const openAdd = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item: AppChange) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      content: item.content,
      type: item.type,
      priority: item.priority,
      status: item.status,
    });
    setFormError('');
    setShowForm(true);
  };

  const saveItem = async () => {
    if (!form.title.trim()) { setFormError('Vyplňte název.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      priority: form.priority,
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingItem) {
      ({ error } = await supabase.from('trackino_app_changes').update(payload).eq('id', editingItem.id));
    } else {
      ({ error } = await supabase.from('trackino_app_changes').insert({ ...payload, source_bug_id: null }));
    }

    setSaving(false);
    if (error) {
      if (error.message.includes('check constraint') || error.message.includes('violates')) {
        setFormError('Chyba DB: ' + error.message);
      } else {
        setFormError('Chyba: ' + error.message);
      }
      return;
    }
    setShowForm(false);
    fetchItems();
  };

  const archiveItem = async (id: string) => {
    if (!confirm('Přesunout tuto položku do archivu?')) return;
    const { error } = await supabase.from('trackino_app_changes')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Nelze archivovat. Detail: ' + error.message);
      return;
    }
    if (expandedId === id) setExpandedId(null);
    fetchItems();
  };

  const restoreItem = async (id: string) => {
    await supabase.from('trackino_app_changes')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchItems();
  };

  const permanentDeleteOne = async (id: string) => {
    if (!confirm('Trvale smazat tuto položku? Tuto akci nelze vrátit.')) return;
    await supabase.from('trackino_app_changes').delete().eq('id', id);
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    fetchItems();
  };

  const permanentDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Trvale smazat ${selectedIds.size} ${selectedIds.size === 1 ? 'položku' : selectedIds.size < 5 ? 'položky' : 'položek'}? Tuto akci nelze vrátit.`)) return;
    await supabase.from('trackino_app_changes').delete().in('id', [...selectedIds]);
    setSelectedIds(new Set());
    fetchItems();
  };

  const changeStatus = async (id: string, status: AppChangeStatus) => {
    await supabase.from('trackino_app_changes').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  // Computed hodnoty
  const activeItems = items.filter(i => i.status !== 'solved' && i.status !== 'archived');
  const archivedItems = items.filter(i => i.status === 'archived');

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',      label: 'Vše (otevřené)', count: activeItems.length },
    { key: 'bug',      label: 'Bug',             count: activeItems.filter(i => i.type === 'bug').length },
    { key: 'idea',     label: 'Nápad',           count: activeItems.filter(i => i.type === 'idea').length },
    { key: 'request',  label: 'Požadavek',       count: activeItems.filter(i => i.type === 'request').length },
    { key: 'note',     label: 'Poznámka',        count: activeItems.filter(i => i.type === 'note').length },
    { key: 'solved',   label: 'Hotové',          count: items.filter(i => i.status === 'solved').length },
    { key: 'archived', label: 'Archiv',          count: archivedItems.length },
  ];

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      filterTab === 'all'      ? (item.status !== 'solved' && item.status !== 'archived') :
      filterTab === 'solved'   ? item.status === 'solved' :
      filterTab === 'archived' ? item.status === 'archived' :
      item.type === filterTab && item.status !== 'solved' && item.status !== 'archived';
    return matchSearch && matchTab;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return {
    // Auth state
    authLoading,
    user,
    profile,
    isMasterAdmin,
    // Data
    items,
    loading,
    filtered,
    tabs,
    // Filters
    search,
    setSearch,
    filterTab,
    setFilterTab,
    // Expand / select
    expandedId,
    setExpandedId,
    selectedIds,
    toggleSelectAll,
    toggleSelect,
    // Modal
    showForm,
    setShowForm,
    editingItem,
    form,
    setForm,
    saving,
    formError,
    descTextareaRef,
    // Actions
    openAdd,
    openEdit,
    saveItem,
    archiveItem,
    restoreItem,
    permanentDeleteOne,
    permanentDeleteSelected,
    changeStatus,
  };
}
