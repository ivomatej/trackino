'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { AppChange, AppChangeType, AppChangePriority, AppChangeStatus } from '@/types/database';

// ─── Konstanty ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AppChangeType, string> = {
  bug: 'Bug',
  idea: 'Nápad',
  request: 'Požadavek',
  note: 'Poznámka',
};

const TYPE_COLORS: Record<AppChangeType, string> = {
  bug: '#ef4444',
  idea: '#8b5cf6',
  request: '#3b82f6',
  note: '#6b7280',
};

const PRIORITY_LABELS: Record<AppChangePriority, string> = {
  low: 'Nízká',
  medium: 'Střední',
  high: 'Vysoká',
};

const PRIORITY_COLORS: Record<AppChangePriority, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
};

const STATUS_LABELS: Record<AppChangeStatus, string> = {
  open: 'Otevřeno',
  in_progress: 'Řeší se',
  solved: 'Hotovo',
  archived: 'Archiv',
};

const STATUS_COLORS: Record<AppChangeStatus, string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  solved: '#22c55e',
  archived: '#6b7280',
};

const PRIORITY_BORDER: Record<AppChangePriority, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
};

// ─── Pomocné komponenty ────────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Formulář pro přidání/editaci ─────────────────────────────────────────────

interface FormState {
  title: string;
  content: string;
  type: AppChangeType;
  priority: AppChangePriority;
  status: AppChangeStatus;
}

const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  type: 'idea',
  priority: 'medium',
  status: 'open',
};

// ─── Typ filtrovací záložky ────────────────────────────────────────────────────
type FilterTab = 'all' | AppChangeType | 'solved' | 'archived';

// ─── Hlavní obsah ─────────────────────────────────────────────────────────────

function AppChangesContent() {
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
    if (authLoading) return;           // auth se ještě načítá
    if (!user) { router.push('/'); return; } // nepřihlášen
    if (profile === null) return;      // profil se ještě načítá
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

  // Přesunout položku do archivu (soft delete)
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

  // Obnovit z archivu
  const restoreItem = async (id: string) => {
    await supabase.from('trackino_app_changes')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchItems();
  };

  // Trvale smazat jednu položku
  const permanentDeleteOne = async (id: string) => {
    if (!confirm('Trvale smazat tuto položku? Tuto akci nelze vrátit.')) return;
    await supabase.from('trackino_app_changes').delete().eq('id', id);
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    fetchItems();
  };

  // Trvale smazat vybrané
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Počty pro záložky
  const activeItems = items.filter(i => i.status !== 'solved' && i.status !== 'archived');
  const archivedItems = items.filter(i => i.status === 'archived');

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',     label: 'Vše (otevřené)', count: activeItems.length },
    { key: 'bug',     label: 'Bug',             count: activeItems.filter(i => i.type === 'bug').length },
    { key: 'idea',    label: 'Nápad',           count: activeItems.filter(i => i.type === 'idea').length },
    { key: 'request', label: 'Požadavek',       count: activeItems.filter(i => i.type === 'request').length },
    { key: 'note',    label: 'Poznámka',        count: activeItems.filter(i => i.type === 'note').length },
    { key: 'solved',  label: 'Hotové',          count: items.filter(i => i.status === 'solved').length },
    { key: 'archived',label: 'Archiv',          count: archivedItems.length },
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

  // Archiv – označit / odznačit vše
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

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };
  const labelCls = "block text-xs font-medium mb-1";
  const selectCls = "w-full px-3 py-2 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent appearance-none cursor-pointer";

  const isArchiveTab = filterTab === 'archived';

  // Zobrazit loading, dokud se auth a profil nenačtou
  if (authLoading || !user || profile === null) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isMasterAdmin) return null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl">

        {/* Hlavička */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Úpravy aplikace</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Evidence nápadů, požadavků a bugů na rozvoj aplikace
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Přidat
          </button>
        </div>

        {/* Vyhledávání + Záložky */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Hledat v úkolech..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-hover)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0"
                style={{
                  background: filterTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: filterTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: filterTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.key === 'archived' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                )}
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: filterTab === tab.key ? (tab.key === 'archived' ? '#6b7280' : 'var(--primary)') : 'var(--border)',
                    color: filterTab === tab.key ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Archiv – panel hromadných akcí */}
        {isArchiveTab && filtered.length > 0 && (
          <div
            className="mb-3 px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)]"
              />
              {selectedIds.size === 0
                ? 'Označit vše'
                : `Vybráno ${selectedIds.size} z ${filtered.length}`}
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={permanentDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                style={{ background: '#ef4444' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
                Trvale smazat ({selectedIds.size})
              </button>
            )}
          </div>
        )}

        {/* Seznam položek */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            {isArchiveTab ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                <p className="text-sm">Archiv je prázdný.</p>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <p className="text-sm">
                  {search ? 'Žádné výsledky pro hledaný výraz.' : 'Žádné položky v této kategorii.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => {
              const isExpanded = expandedId === item.id;
              const isSolved = item.status === 'solved';
              const isArchived = item.status === 'archived';
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background: isSelected ? 'color-mix(in srgb, var(--primary) 4%, var(--bg-card))' : 'var(--bg-card)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                    borderLeft: `4px solid ${isArchived ? '#9ca3af' : PRIORITY_BORDER[item.priority]}`,
                    opacity: isArchived ? 0.85 : 1,
                  }}
                >
                  {/* Klikatelný header */}
                  <div
                    className="px-4 py-3 cursor-pointer select-none"
                    onClick={() => {
                      if (isArchiveTab) {
                        // V archivu klik na kartu = toggle checkbox
                        toggleSelect(item.id);
                      } else {
                        setExpandedId(isExpanded ? null : item.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {/* Checkbox v archivu */}
                        {isArchiveTab && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)] flex-shrink-0"
                          />
                        )}
                        {/* Typ */}
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                          style={{ background: isArchived ? '#9ca3af' : TYPE_COLORS[item.type] }}
                        >
                          {TYPE_LABELS[item.type]}
                        </span>
                        {/* Priorita */}
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0"
                          style={{ borderColor: PRIORITY_COLORS[item.priority], color: PRIORITY_COLORS[item.priority] }}
                        >
                          {PRIORITY_LABELS[item.priority]}
                        </span>
                        {/* Stav */}
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                          style={{ background: STATUS_COLORS[item.status] }}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                        {/* Z Bug logu */}
                        {item.source_bug_id && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 flex-shrink-0"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 2l1.88 1.88" /><path d="M14.12 3.88L16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
                            </svg>
                            Z Bug logu
                          </span>
                        )}
                        {/* Datum */}
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      {/* Chevron (jen mimo archiv) */}
                      {!isArchiveTab && <ChevronDown open={isExpanded} />}
                    </div>

                    {/* Název (vždy viditelný) */}
                    <p
                      className="font-medium text-sm mt-2"
                      style={{
                        color: 'var(--text-primary)',
                        textDecoration: isSolved ? 'line-through' : 'none',
                        opacity: isSolved || isArchived ? 0.6 : 1,
                      }}
                    >
                      {item.title}
                    </p>
                  </div>

                  {/* Archiv – akce na položce */}
                  {isArchiveTab && (
                    <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      {item.content && (
                        <p className="text-xs py-2 whitespace-pre-wrap flex-1" style={{ color: 'var(--text-muted)' }}>
                          {item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content}
                        </p>
                      )}
                      <div className="flex gap-1.5 flex-shrink-0 ml-auto pt-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => restoreItem(item.id)}
                          className="px-2 py-1 rounded text-xs border transition-colors"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Obnovit z archivu (nastaví stav na Otevřeno)"
                        >
                          Obnovit
                        </button>
                        <button
                          onClick={() => permanentDeleteOne(item.id)}
                          className="px-2 py-1 rounded text-xs border transition-colors"
                          style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          Trvale smazat
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rozbalitelný obsah (jen mimo archiv) */}
                  {!isArchiveTab && isExpanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      {/* Popis */}
                      {item.content && (
                        <p className="text-xs mt-3 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                          {item.content}
                        </p>
                      )}

                      {/* Stav + Akce */}
                      <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Stav:</span>
                          {(['open', 'in_progress', 'solved'] as AppChangeStatus[]).map(s => (
                            <button
                              key={s}
                              onClick={() => changeStatus(item.id, s)}
                              className="px-2 py-0.5 rounded-full text-xs font-medium border transition-all"
                              style={{
                                background: item.status === s ? STATUS_COLORS[s] : 'transparent',
                                color: item.status === s ? 'white' : 'var(--text-secondary)',
                                borderColor: STATUS_COLORS[s],
                              }}
                            >
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEdit(item)}
                            className="px-2 py-1 rounded text-xs border transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Upravit
                          </button>
                          <button
                            onClick={() => archiveItem(item.id)}
                            className="px-2 py-1 rounded text-xs border transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            title="Přesunout do archivu"
                          >
                            Archivovat
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Modal: Přidat / Upravit ─── */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border shadow-xl flex flex-col"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }}
            >
              {/* Modal hlavička */}
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editingItem ? 'Upravit položku' : 'Přidat položku'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal tělo – scrollovatelné */}
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Název */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Název *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="Krátký popis úkolu nebo nápadu"
                    autoFocus
                  />
                </div>

                {/* Popis – auto-expanding */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Popis (volitelné)</label>
                  <textarea
                    ref={descTextareaRef}
                    value={form.content}
                    onChange={(e) => {
                      setForm(f => ({ ...f, content: e.target.value }));
                      // Auto-expand
                      const ta = e.target;
                      ta.style.height = 'auto';
                      ta.style.height = Math.min(ta.scrollHeight, 600) + 'px';
                    }}
                    rows={10}
                    className={inputCls + ' resize-none overflow-hidden'}
                    style={{ ...inputStyle, minHeight: '260px' }}
                    placeholder="Podrobnější popis, kroky k reprodukci, návrh řešení..."
                  />
                </div>

                {/* Typ + Priorita + Stav */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Typ</label>
                    <div className="relative">
                      <select
                        value={form.type}
                        onChange={(e) => setForm(f => ({ ...f, type: e.target.value as AppChangeType }))}
                        className={selectCls}
                        style={inputStyle}
                      >
                        <option value="idea">Nápad</option>
                        <option value="request">Požadavek</option>
                        <option value="bug">Bug</option>
                        <option value="note">Poznámka</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Priorita</label>
                    <div className="relative">
                      <select
                        value={form.priority}
                        onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as AppChangePriority }))}
                        className={selectCls}
                        style={inputStyle}
                      >
                        <option value="low">Nízká</option>
                        <option value="medium">Střední</option>
                        <option value="high">Vysoká</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Stav</label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(e) => setForm(f => ({ ...f, status: e.target.value as AppChangeStatus }))}
                        className={selectCls}
                        style={inputStyle}
                      >
                        <option value="open">Otevřeno</option>
                        <option value="in_progress">Řeší se</option>
                        <option value="solved">Hotovo</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {formError && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveItem}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
                >
                  {saving ? 'Ukládám…' : editingItem ? 'Uložit změny' : 'Přidat'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

export default function AppChangesPage() {
  return (
    <WorkspaceProvider>
      <AppChangesContent />
    </WorkspaceProvider>
  );
}
