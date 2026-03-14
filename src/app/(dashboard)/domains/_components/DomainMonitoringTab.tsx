'use client';

import { useState, useEffect } from 'react';
import type { DomainMonitoring, DomainCheckHistory } from '@/types/database';
import { inputCls, inputStyle } from './constants';

// ─── Ikony ────────────────────────────────────────────────────────────────────
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ─── Status badge dostupnosti ─────────────────────────────────────────────────
function AvailabilityBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
  }
  if (status === 'free') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#dcfce7', color: '#166534' }}>
        Volná
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#fee2e2', color: '#991b1b' }}>
        Obsazená
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
      Neznámý
    </span>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const MAP: Record<string, string> = {
    manual: 'Manuální',
    monitoring: 'Monitoring',
    bulk: 'Hromadně',
  };
  return (
    <span className="text-xs px-1.5 py-0.5 rounded"
      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
      {MAP[source] ?? source}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  monitoringList: DomainMonitoring[];
  checkHistory: DomainCheckHistory[];
  loadingMonitoring: boolean;
  canManage: boolean;
  openproviderConfigured: boolean | null;
  onFetchMonitoring: () => void;
  onAddToMonitoring: (domainName: string, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly', monthlyDay?: number | null) => void;
  onDeleteMonitoring: (id: string) => void;
  onCheckNow: (item: DomainMonitoring) => void;
  onDeleteHistoryEntry: (id: string) => void;
  onDeleteHistoryEntries: (ids: string[]) => void;
  onClearHistory: (domainName?: string) => void;
}

export function DomainMonitoringTab({
  monitoringList,
  checkHistory,
  loadingMonitoring,
  canManage,
  openproviderConfigured,
  onFetchMonitoring,
  onAddToMonitoring,
  onDeleteMonitoring,
  onCheckNow,
  onDeleteHistoryEntry,
  onDeleteHistoryEntries,
  onClearHistory,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Výběr záznamů v historii
  const [historySelectMode, setHistorySelectMode] = useState(false);
  const [historySelectedIds, setHistorySelectedIds] = useState<Set<string>>(new Set());

  // Modal přidání
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    domain_name: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    monthly_day: 1,
    notes: '',
  });
  const [addError, setAddError] = useState('');

  // Načtení monitoringu při prvním zobrazení záložky
  useEffect(() => {
    onFetchMonitoring();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckNow = async (item: DomainMonitoring) => {
    setCheckingId(item.id);
    await onCheckNow(item);
    setCheckingId(null);
  };

  const handleAdd = async () => {
    const trimmed = addForm.domain_name.trim().toLowerCase();
    if (!trimmed) { setAddError('Zadejte doménové jméno'); return; }
    if (!trimmed.includes('.')) { setAddError('Doména musí obsahovat alespoň jednu tečku (např. example.cz)'); return; }
    setAddError('');
    const monthlyDay = addForm.frequency === 'monthly' ? addForm.monthly_day : null;
    await onAddToMonitoring(trimmed, addForm.frequency, monthlyDay);
    setAddModal(false);
    setAddForm({ domain_name: '', frequency: 'daily', monthly_day: 1, notes: '' });
  };

  const filteredHistory = historyFilter
    ? checkHistory.filter(h => h.domain_name === historyFilter)
    : checkHistory;

  const historyDomains = Array.from(new Set(checkHistory.map(h => h.domain_name))).sort();

  const freqLabel = (item: DomainMonitoring) => {
    if (item.frequency === 'daily') return 'Denně';
    if (item.frequency === 'weekly') return 'Týdně';
    if (item.frequency === 'monthly') return `Měsíčně (${item.monthly_day ?? 1}. v měs.)`;
    if (item.frequency === 'yearly') return 'Ročně';
    return item.frequency;
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── Výběr v historii ──────────────────────────────────────────────────────
  const toggleHistoryItem = (id: string) => {
    setHistorySelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllHistory = () => {
    setHistorySelectedIds(new Set(filteredHistory.map(h => h.id)));
  };

  const deselectAllHistory = () => {
    setHistorySelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setHistorySelectMode(false);
    setHistorySelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (historySelectedIds.size === 0) return;
    await onDeleteHistoryEntries(Array.from(historySelectedIds));
    exitSelectMode();
  };

  const handleDeleteSingle = async (id: string) => {
    await onDeleteHistoryEntry(id);
  };

  const handleClearHistory = async () => {
    await onClearHistory(historyFilter || undefined);
    exitSelectMode();
  };

  const allFilteredSelected = filteredHistory.length > 0 && filteredHistory.every(h => historySelectedIds.has(h.id));

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Monitoring dostupnosti
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Sleduje dostupnost domén a upozorní na změnu statusu
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setAddModal(true)}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 self-start"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            <PlusIcon /> Přidat doménu
          </button>
        )}
      </div>

      {/* Openprovider info banner */}
      {openproviderConfigured === false && (
        <div className="rounded-xl border p-4 flex items-start gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }}><InfoIcon /></span>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Openprovider není nakonfigurován – kontrola dostupnosti nebude fungovat. Nakonfigurujte env vars OPENPROVIDER_USERNAME a OPENPROVIDER_PASSWORD.
          </p>
        </div>
      )}

      {/* ── Seznam monitorovaných domén ── */}
      {loadingMonitoring ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : monitoringList.length === 0 ? (
        <div className="rounded-xl border p-8 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="mx-auto mb-3 w-10 h-10 flex items-center justify-center rounded-full"
            style={{ background: 'var(--bg-hover)' }}>
            <RefreshIcon />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Žádné domény v monitoringu
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Přidejte domény přes záložku Kontrola dostupnosti nebo tlačítkem výše.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border)' }}>
          {/* Desktop tabulka */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Doména</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Frekvence</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Poslední kontrola</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {monitoringList.map((item, i) => (
                  <tr key={item.id}
                    style={{ borderBottom: i < monitoringList.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {item.domain_name}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {freqLabel(item)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(item.last_checked_at)}
                    </td>
                    <td className="px-4 py-3">
                      <AvailabilityBadge status={item.last_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCheckNow(item)}
                          disabled={checkingId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          title="Zkontrolovat teď"
                        >
                          {checkingId === item.id ? (
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <RefreshIcon />
                          )}
                          Zkontrolovat
                        </button>
                        {canManage && (
                          <button
                            onClick={() => onDeleteMonitoring(item.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#ef4444' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Odebrat"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobilní karty */}
          <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {monitoringList.map(item => (
              <div key={item.id} className="p-4" style={{ background: 'var(--bg-card)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{item.domain_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {freqLabel(item)} · {fmtDate(item.last_checked_at)}
                    </p>
                    <div className="mt-2"><AvailabilityBadge status={item.last_status} /></div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleCheckNow(item)}
                      disabled={checkingId === item.id}
                      className="p-2.5 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', minWidth: 44, minHeight: 44 }}
                    >
                      {checkingId === item.id ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                      ) : (
                        <RefreshIcon />
                      )}
                    </button>
                    {canManage && (
                      <button
                        onClick={() => onDeleteMonitoring(item.id)}
                        className="p-2.5 rounded-lg"
                        style={{ color: '#ef4444', minWidth: 44, minHeight: 44 }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historie kontrol (collapsible) ── */}
      <div className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
          style={{ background: 'var(--bg-card)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Historie kontrol
            {checkHistory.length > 0 && (
              <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                {checkHistory.length}
              </span>
            )}
          </span>
          <span style={{ color: 'var(--text-muted)' }}><ChevronIcon open={historyOpen} /></span>
        </button>

        {historyOpen && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {/* Toolbar filtru + akcí */}
            <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center gap-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>

              {/* Filtr domény */}
              {historyDomains.length > 1 && (
                <div className="relative max-w-xs flex-shrink-0">
                  <select
                    value={historyFilter}
                    onChange={e => { setHistoryFilter(e.target.value); deselectAllHistory(); }}
                    className={inputCls + ' appearance-none pr-8'}
                    style={inputStyle}
                  >
                    <option value="">Všechny domény</option>
                    {historyDomains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              )}

              {/* Akce pro admina */}
              {canManage && filteredHistory.length > 0 && (
                <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                  {historySelectMode ? (
                    <>
                      {/* Označit vše / Zrušit označení */}
                      <button
                        onClick={allFilteredSelected ? deselectAllHistory : selectAllHistory}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      >
                        {allFilteredSelected ? 'Zrušit označení' : 'Označit vše'}
                      </button>

                      {/* Smazat vybrané */}
                      {historySelectedIds.size > 0 && (
                        <button
                          onClick={handleDeleteSelected}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                        >
                          <TrashIcon /> Smazat ({historySelectedIds.size})
                        </button>
                      )}

                      {/* Zrušit výběr */}
                      <button
                        onClick={exitSelectMode}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      >
                        Zrušit
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Vybrat */}
                      <button
                        onClick={() => setHistorySelectMode(true)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      >
                        Vybrat
                      </button>

                      {/* Smazat vše (filtrované) */}
                      <button
                        onClick={handleClearHistory}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        style={{ background: '#fee2e2', color: '#991b1b' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fecaca'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                      >
                        <TrashIcon />
                        {historyFilter ? `Smazat vše (${filteredHistory.length})` : 'Smazat celou historii'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}>
                Žádné záznamy v historii
              </div>
            ) : (
              <>
                {/* Desktop tabulka */}
                <div className="hidden sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                        {historySelectMode && (
                          <th className="px-4 py-2 w-10">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={allFilteredSelected ? deselectAllHistory : selectAllHistory}
                              className="rounded"
                              style={{ accentColor: 'var(--primary)', width: 15, height: 15 }}
                            />
                          </th>
                        )}
                        <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Doména</th>
                        <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                        <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Datum</th>
                        <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Zdroj</th>
                        {canManage && !historySelectMode && (
                          <th className="px-4 py-2 w-10" />
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((h, i) => (
                        <tr key={h.id}
                          style={{
                            borderBottom: i < filteredHistory.length - 1 ? '1px solid var(--border)' : undefined,
                            background: historySelectMode && historySelectedIds.has(h.id) ? 'var(--bg-hover)' : 'var(--bg-card)',
                            cursor: historySelectMode ? 'pointer' : undefined,
                          }}
                          onClick={historySelectMode ? () => toggleHistoryItem(h.id) : undefined}
                        >
                          {historySelectMode && (
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={historySelectedIds.has(h.id)}
                                onChange={() => toggleHistoryItem(h.id)}
                                onClick={e => e.stopPropagation()}
                                className="rounded"
                                style={{ accentColor: 'var(--primary)', width: 15, height: 15 }}
                              />
                            </td>
                          )}
                          <td className="px-4 py-2.5 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{h.domain_name}</td>
                          <td className="px-4 py-2.5"><AvailabilityBadge status={h.status} /></td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(h.checked_at)}</td>
                          <td className="px-4 py-2.5"><SourceBadge source={h.source} /></td>
                          {canManage && !historySelectMode && (
                            <td className="px-4 py-2.5">
                              <button
                                onClick={() => handleDeleteSingle(h.id)}
                                className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                style={{ color: '#ef4444' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = ''; }}
                                title="Smazat záznam"
                              >
                                <TrashIcon />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobilní karty */}
                <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredHistory.map(h => (
                    <div
                      key={h.id}
                      className="px-4 py-3 flex items-center gap-3"
                      style={{
                        background: historySelectMode && historySelectedIds.has(h.id) ? 'var(--bg-hover)' : 'var(--bg-card)',
                        cursor: historySelectMode ? 'pointer' : undefined,
                      }}
                      onClick={historySelectMode ? () => toggleHistoryItem(h.id) : undefined}
                    >
                      {historySelectMode && (
                        <input
                          type="checkbox"
                          checked={historySelectedIds.has(h.id)}
                          onChange={() => toggleHistoryItem(h.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ accentColor: 'var(--primary)', width: 18, height: 18, flexShrink: 0 }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{h.domain_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fmtDate(h.checked_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <AvailabilityBadge status={h.status} />
                        <SourceBadge source={h.source} />
                        {canManage && !historySelectMode && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSingle(h.id); }}
                            className="p-2 rounded-lg"
                            style={{ color: '#ef4444', minWidth: 36, minHeight: 36 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Smazat záznam"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: přidání do monitoringu ── */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl border shadow-xl w-full max-w-md p-6 space-y-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Přidat do monitoringu
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>
                  Doménové jméno *
                </label>
                <input
                  type="text"
                  value={addForm.domain_name}
                  onChange={e => setAddForm(f => ({ ...f, domain_name: e.target.value }))}
                  placeholder="example.cz"
                  className={inputCls}
                  style={inputStyle}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                {addError && <p className="text-xs mt-1 text-red-600">{addError}</p>}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>
                  Frekvence kontroly
                </label>
                <div className="relative">
                  <select
                    value={addForm.frequency}
                    onChange={e => setAddForm(f => ({ ...f, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' }))}
                    className={inputCls + ' appearance-none pr-8'}
                    style={inputStyle}
                  >
                    <option value="daily">Denně</option>
                    <option value="weekly">Týdně</option>
                    <option value="monthly">Měsíčně</option>
                    <option value="yearly">Ročně</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Den v měsíci – zobrazí se jen pro monthly */}
              {addForm.frequency === 'monthly' && (
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>
                    Den v měsíci
                  </label>
                  <div className="relative">
                    <select
                      value={addForm.monthly_day}
                      onChange={e => setAddForm(f => ({ ...f, monthly_day: Number(e.target.value) }))}
                      className={inputCls + ' appearance-none pr-8'}
                      style={inputStyle}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}. v měsíci</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Rozsah 1–28 zajišťuje kompatibilitu s únorem a kratšími měsíci.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
              >
                Přidat
              </button>
              <button
                onClick={() => { setAddModal(false); setAddError(''); }}
                className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
