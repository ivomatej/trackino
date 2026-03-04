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
};

const TYPE_COLORS: Record<AppChangeType, string> = {
  bug: '#ef4444',
  idea: '#8b5cf6',
  request: '#3b82f6',
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
};

const STATUS_COLORS: Record<AppChangeStatus, string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  solved: '#22c55e',
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

// ─── Hlavní obsah ─────────────────────────────────────────────────────────────

function AppChangesContent() {
  const { isMasterAdmin } = usePermissions();
  const router = useRouter();
  useAuth();

  const [items, setItems] = useState<AppChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | AppChangeType | 'solved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal stav
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<AppChange | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Redirect non-master-admin
  useEffect(() => {
    if (!isMasterAdmin) router.push('/');
  }, [isMasterAdmin, router]);

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
    if (error) { setFormError('Chyba: ' + error.message); return; }
    setShowForm(false);
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Smazat tuto položku?')) return;
    await supabase.from('trackino_app_changes').delete().eq('id', id);
    // Zavři rozbalenout kartu pokud se smazala
    if (expandedId === id) setExpandedId(null);
    fetchItems();
  };

  const changeStatus = async (id: string, status: AppChangeStatus) => {
    await supabase.from('trackino_app_changes').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      filterTab === 'all' ? item.status !== 'solved' :
      filterTab === 'solved' ? item.status === 'solved' :
      item.type === filterTab && item.status !== 'solved';
    return matchSearch && matchTab;
  });

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };
  const labelCls = "block text-xs font-medium mb-1";
  const selectCls = "w-full px-3 py-2 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent appearance-none cursor-pointer";

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
            {([
              { key: 'all', label: 'Vše (otevřené)', count: items.filter(i => i.status !== 'solved').length },
              { key: 'bug', label: 'Bug', count: items.filter(i => i.type === 'bug' && i.status !== 'solved').length },
              { key: 'idea', label: 'Nápad', count: items.filter(i => i.type === 'idea' && i.status !== 'solved').length },
              { key: 'request', label: 'Požadavek', count: items.filter(i => i.type === 'request' && i.status !== 'solved').length },
              { key: 'solved', label: 'Hotové', count: items.filter(i => i.status === 'solved').length },
            ] as { key: typeof filterTab; label: string; count: number }[]).map(tab => (
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
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: filterTab === tab.key ? 'var(--primary)' : 'var(--border)',
                    color: filterTab === tab.key ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Seznam položek */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <p className="text-sm">
              {search ? 'Žádné výsledky pro hledaný výraz.' : 'Žádné položky v této kategorii.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => {
              const isExpanded = expandedId === item.id;
              const isSolved = item.status === 'solved';

              return (
                <div
                  key={item.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                    borderLeft: `4px solid ${PRIORITY_BORDER[item.priority]}`,
                  }}
                >
                  {/* Klikatelný header */}
                  <div
                    className="px-4 py-3 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Badges + datum */}
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {/* Typ */}
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                          style={{ background: TYPE_COLORS[item.type] }}
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
                      {/* Chevron */}
                      <ChevronDown open={isExpanded} />
                    </div>

                    {/* Název (vždy viditelný) */}
                    <p
                      className="font-medium text-sm mt-2"
                      style={{
                        color: 'var(--text-primary)',
                        textDecoration: isSolved ? 'line-through' : 'none',
                        opacity: isSolved ? 0.6 : 1,
                      }}
                    >
                      {item.title}
                    </p>
                  </div>

                  {/* Rozbalitelný obsah */}
                  {isExpanded && (
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
                            onClick={() => deleteItem(item.id)}
                            className="px-2 py-1 rounded text-xs border transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Smazat
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
