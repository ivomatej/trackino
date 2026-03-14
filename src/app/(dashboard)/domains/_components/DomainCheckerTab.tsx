'use client';

import { useState, useRef } from 'react';
import type { DomainCheckResult, DomainMonitoring } from '@/types/database';
import { inputCls, inputStyle, ICONS } from './constants';

// ─── Ikona koše ────────────────────────────────────────────────────────────────
const TrashIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

// ─── Ikony pro checker ────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, validated }: { status: string; validated?: boolean }) {
  let label: string;
  let bg: string;
  let color: string;

  if (status === 'free') {
    label = 'Volná'; bg = '#dcfce7'; color = '#166534';
  } else if (status === 'active') {
    label = 'Obsazená'; bg = '#fee2e2'; color = '#991b1b';
  } else if (status === 'unverified') {
    label = 'Neověřeno'; bg = '#fef9c3'; color = '#854d0e';
  } else {
    label = 'Chyba'; bg = 'var(--bg-hover)'; color = 'var(--text-muted)';
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color }}>
      {label}
      {validated && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round">
          <title>Ověřeno dvěma zdroji</title>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

// ─── Subreg status badge ───────────────────────────────────────────────────────
function SubregBadge({ status }: { status: string | null | undefined }) {
  if (status === null || status === undefined) return null;
  let label: string;
  let bg: string;
  let color: string;

  if (status === 'free') {
    label = 'Volná'; bg = '#dcfce7'; color = '#166534';
  } else if (status === 'active') {
    label = 'Obsazená'; bg = '#fee2e2'; color = '#991b1b';
  } else if (status === 'unknown') {
    label = '?'; bg = '#fef9c3'; color = '#854d0e';
  } else if (status === 'error') {
    label = 'Chyba'; bg = 'var(--bg-hover)'; color = 'var(--text-muted)';
  } else {
    label = '—'; bg = 'var(--bg-hover)'; color = 'var(--text-muted)';
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color }}>
      {label}
    </span>
  );
}

// ─── TLD výběr ────────────────────────────────────────────────────────────────
const DEFAULT_TLDS = ['cz', 'com', 'net', 'org', 'eu', 'de', 'pl', 'sk', 'at', 'co.uk'];
const DEFAULT_CHECKED_TLDS = new Set(['cz', 'com', 'net']);

// ─── Parsování domény ─────────────────────────────────────────────────────────
function parseDomain(raw: string): { name: string; extension: string } | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot < 1) return null; // žádná tečka nebo začíná tečkou
  return {
    name: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot + 1),
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  openproviderConfigured: boolean | null;
  subregConfigured?: boolean | null;
  checkerResults: DomainCheckResult[];
  setCheckerResults: (r: DomainCheckResult[]) => void;
  checkDomains: (
    domains: { name: string; extension: string }[],
    source: 'manual' | 'bulk',
  ) => Promise<DomainCheckResult[]>;
  onAddToMonitoring: (domainName: string) => void;
  monitoringList: DomainMonitoring[];
  canManage?: boolean;
}

export function DomainCheckerTab({
  openproviderConfigured,
  subregConfigured = null,
  checkerResults,
  setCheckerResults,
  checkDomains,
  onAddToMonitoring,
  monitoringList,
  canManage = false,
}: Props) {
  // Režim
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Jednotlivě
  const [singleInput, setSingleInput] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [selectedTlds, setSelectedTlds] = useState<Set<string>>(new Set(DEFAULT_CHECKED_TLDS));
  const [showTldPicker, setShowTldPicker] = useState(false);

  // Hromadně
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Výběr řádků pro mazání
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const abortRef = useRef(false);

  /* ── Helpers pro výběr ── */
  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelectedDomains(new Set());
  };
  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };
  const selectAll = () => setSelectedDomains(new Set(checkerResults.map(r => r.domain)));
  const deselectAll = () => setSelectedDomains(new Set());
  const allSelected = checkerResults.length > 0 && selectedDomains.size === checkerResults.length;

  const deleteSelected = () => {
    setCheckerResults(checkerResults.filter(r => !selectedDomains.has(r.domain)));
    setSelectedDomains(new Set());
  };
  const deleteSingle = (domain: string) => {
    setCheckerResults(checkerResults.filter(r => r.domain !== domain));
    setSelectedDomains(prev => { const n = new Set(prev); n.delete(domain); return n; });
  };

  // Zda je zadaný vstup bez TLD (žádná tečka)
  const hasTld = singleInput.trim().includes('.');

  /* ── Kontrola – jednotlivě ── */
  const handleSingleCheck = async () => {
    const raw = singleInput.trim();
    if (!raw) return;
    setSingleLoading(true);
    setCheckerResults([]);

    let domainsToCheck: { name: string; extension: string }[];

    if (hasTld) {
      const parsed = parseDomain(raw);
      if (!parsed) { setSingleLoading(false); return; }
      domainsToCheck = [parsed];
    } else {
      // Bez TLD → kontrola vybraných TLD
      domainsToCheck = Array.from(selectedTlds).map(tld => {
        // co.uk apod.
        const ext = tld;
        return { name: raw.toLowerCase(), extension: ext };
      });
    }

    await checkDomains(domainsToCheck, 'manual');
    setSingleLoading(false);
    setShowTldPicker(false);
  };

  /* ── Kontrola – hromadně ── */
  const handleBulkCheck = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    // Parsuje domény – přeskočí řádky bez tečky
    const parsed = lines
      .map(l => parseDomain(l))
      .filter((d): d is { name: string; extension: string } => d !== null);

    if (parsed.length === 0) return;

    setBulkLoading(true);
    setCheckerResults([]);
    abortRef.current = false;

    // Dávkování po 50
    const BATCH = 50;
    const allResults: DomainCheckResult[] = [];
    setBulkProgress({ done: 0, total: parsed.length });

    for (let i = 0; i < parsed.length; i += BATCH) {
      if (abortRef.current) break;
      const batch = parsed.slice(i, i + BATCH);
      const results = await checkDomains(batch, 'bulk');
      allResults.push(...results);
      setBulkProgress({ done: Math.min(i + BATCH, parsed.length), total: parsed.length });
    }

    setCheckerResults(allResults);
    setBulkProgress(null);
    setBulkLoading(false);
  };

  /* ── Export CSV ── */
  const exportCsv = () => {
    if (checkerResults.length === 0) return;
    const now = new Date().toISOString().slice(0, 10);
    const rows = [
      ['Doména', 'Status', 'Datum kontroly'],
      ...checkerResults.map(r => [r.domain, r.status, now]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domeny-kontrola-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monitoringNames = new Set(monitoringList.map(m => m.domain_name));

  // Zda výsledky obsahují Subreg data
  const hasSubregData = checkerResults.some(r => r.subreg_status !== undefined && r.subreg_status !== null);

  // Pokud openprovider není nakonfigurován
  if (openproviderConfigured === false) {
    return (
      <div className="rounded-xl border p-6 flex items-start gap-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <span style={{ color: '#f59e0b', flexShrink: 0 }}><InfoIcon /></span>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Openprovider není nakonfigurován
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Pro kontrolu dostupnosti domén nakonfigurujte Openprovider přihlašovací údaje přes prostředí serveru (env vars: OPENPROVIDER_USERNAME, OPENPROVIDER_PASSWORD).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Přepínač režimu ── */}
      <div className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-hover)' }}>
        {([
          { id: 'single', label: 'Jednotlivě' },
          { id: 'bulk', label: 'Hromadně' },
        ] as const).map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: mode === m.id ? 'var(--bg-card)' : 'transparent',
              color: mode === m.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === m.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Režim: Jednotlivě ── */}
      {mode === 'single' && (
        <div className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={singleInput}
              onChange={e => { setSingleInput(e.target.value); setShowTldPicker(!e.target.value.trim().includes('.')); }}
              onKeyDown={e => e.key === 'Enter' && handleSingleCheck()}
              placeholder="example.cz nebo example (bez TLD)"
              className={inputCls + ' flex-1'}
              style={inputStyle}
            />
            <button
              onClick={handleSingleCheck}
              disabled={singleLoading || !singleInput.trim()}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => { if (!singleLoading) e.currentTarget.style.background = 'var(--primary-hover)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            >
              {singleLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{ICONS.search}</span>
              )}
              Zkontrolovat
            </button>
          </div>

          {/* TLD výběr – zobrazí se pokud není tečka ve vstupu */}
          {!hasTld && singleInput.trim() && (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Vyberte TLD pro kontrolu:
              </p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_TLDS.map(tld => (
                  <label
                    key={tld}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors"
                    style={{
                      borderColor: selectedTlds.has(tld) ? 'var(--primary)' : 'var(--border)',
                      background: selectedTlds.has(tld) ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg-hover)',
                      color: selectedTlds.has(tld) ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTlds.has(tld)}
                      onChange={e => {
                        const next = new Set(selectedTlds);
                        if (e.target.checked) next.add(tld);
                        else next.delete(tld);
                        setSelectedTlds(next);
                      }}
                      className="sr-only"
                    />
                    {selectedTlds.has(tld) && <span style={{ color: 'var(--primary)' }}><CheckIcon /></span>}
                    .{tld}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Režim: Hromadně ── */}
      {mode === 'bulk' && (
        <div className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div>
            <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Seznam domén
            </label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={'recenzer.cz\nexample.com\ntrackino.eu'}
              rows={8}
              className={inputCls}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 160 }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Jeden řádek = jedna doména. Domény bez TLD jsou přeskočeny.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkCheck}
              disabled={bulkLoading || !bulkText.trim()}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => { if (!bulkLoading) e.currentTarget.style.background = 'var(--primary-hover)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            >
              {bulkLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{ICONS.search}</span>
              )}
              Zkontrolovat
            </button>
            {checkerResults.length > 0 && !bulkLoading && (
              <button
                onClick={exportCsv}
                className="px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
              >
                <DownloadIcon /> Exportovat CSV
              </button>
            )}
          </div>

          {/* Progress bar */}
          {bulkProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Kontroluji...</span>
                <span>{bulkProgress.done} / {bulkProgress.total}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Výsledky ── */}
      {checkerResults.length > 0 && (
        <div className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--border)' }}>

          {/* Hlavička */}
          <div className="flex items-center justify-between px-4 py-3 border-b gap-3 flex-wrap"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Výsledky ({checkerResults.length})
            </h3>
            <div className="flex items-center gap-2">
              {/* Admin akce */}
              {canManage && (
                <>
                  {selectMode ? (
                    <>
                      {/* Označit vše / zrušit */}
                      <button
                        onClick={allSelected ? deselectAll : selectAll}
                        className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      >
                        {allSelected ? 'Zrušit výběr' : 'Označit vše'}
                      </button>
                      {/* Smazat označené */}
                      {selectedDomains.size > 0 && (
                        <button
                          onClick={deleteSelected}
                          className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fecaca')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fee2e2')}
                        >
                          <TrashIcon /> Smazat ({selectedDomains.size})
                        </button>
                      )}
                      {/* Zrušit výběr */}
                      <button
                        onClick={toggleSelectMode}
                        className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      >
                        Zrušit
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={toggleSelectMode}
                      className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                    >
                      Vybrat
                    </button>
                  )}
                  {/* Smazat vše */}
                  {!selectMode && (
                    <button
                      onClick={() => { setCheckerResults([]); setSelectedDomains(new Set()); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border transition-colors"
                      style={{ borderColor: '#fecaca', color: '#991b1b', background: '#fff5f5' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff5f5')}
                    >
                      <TrashIcon /> Smazat vše
                    </button>
                  )}
                </>
              )}
              {/* Vymazat pro non-admin */}
              {!canManage && (
                <button
                  onClick={() => setCheckerResults([])}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  Vymazat
                </button>
              )}
            </div>
          </div>

          {/* Desktop tabulka */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  {selectMode && <th className="px-4 py-2.5 w-10" />}
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Doména</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  {hasSubregData && (
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                      Subreg
                    </th>
                  )}
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {checkerResults.map((r, i) => (
                  <tr
                    key={r.domain}
                    onClick={selectMode ? () => toggleDomain(r.domain) : undefined}
                    style={{
                      borderBottom: i < checkerResults.length - 1 ? '1px solid var(--border)' : undefined,
                      background: selectMode && selectedDomains.has(r.domain)
                        ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                        : r.status === 'free' ? '#f0fdf4'
                        : r.status === 'active' ? '#fff8f8'
                        : undefined,
                      cursor: selectMode ? 'pointer' : undefined,
                    }}
                  >
                    {selectMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedDomains.has(r.domain)}
                          onChange={() => toggleDomain(r.domain)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: 'var(--primary)' }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.domain}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} validated={r.validated} />
                      {r.premium && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: '#fef3c7', color: '#92400e' }}>
                          Premium
                        </span>
                      )}
                    </td>
                    {hasSubregData && (
                      <td className="px-4 py-3">
                        <SubregBadge status={r.subreg_status} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'free' && !monitoringNames.has(r.domain) && !selectMode && (
                          <button
                            onClick={() => onAddToMonitoring(r.domain)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          >
                            <PlusIcon /> Monitoring
                          </button>
                        )}
                        {monitoringNames.has(r.domain) && !selectMode && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>V monitoringu</span>
                        )}
                        {canManage && !selectMode && (
                          <button
                            onClick={() => deleteSingle(r.domain)}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: '#dc2626' }}
                            title="Smazat z výsledků"
                            onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
            {checkerResults.map(r => (
              <div
                key={r.domain}
                onClick={selectMode ? () => toggleDomain(r.domain) : undefined}
                className="px-4 py-3 flex items-center gap-3"
                style={{
                  background: selectMode && selectedDomains.has(r.domain)
                    ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                    : r.status === 'free' ? '#f0fdf4'
                    : r.status === 'active' ? '#fff8f8'
                    : 'var(--bg-card)',
                  cursor: selectMode ? 'pointer' : undefined,
                }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedDomains.has(r.domain)}
                    onChange={() => toggleDomain(r.domain)}
                    onClick={e => e.stopPropagation()}
                    className="w-5 h-5 flex-shrink-0 rounded"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.domain}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={r.status} validated={r.validated} />
                    {r.subreg_status !== undefined && r.subreg_status !== null && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Subreg:</span>
                    )}
                    <SubregBadge status={r.subreg_status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.status === 'free' && !monitoringNames.has(r.domain) && !selectMode && (
                    <button
                      onClick={() => onAddToMonitoring(r.domain)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)', minHeight: 44 }}
                    >
                      <PlusIcon /> Monitoring
                    </button>
                  )}
                  {canManage && !selectMode && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteSingle(r.domain); }}
                      className="p-2.5 rounded-lg"
                      style={{ color: '#dc2626', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Smazat z výsledků"
                      onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Prázdný stav ── */}
      {checkerResults.length === 0 && !singleLoading && !bulkLoading && (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
          <div className="mx-auto mb-3 w-10 h-10 flex items-center justify-center rounded-full" style={{ background: 'var(--bg-hover)' }}>
            {ICONS.search}
          </div>
          <p className="text-sm">Zadejte doménu a klikněte na Zkontrolovat</p>
        </div>
      )}
    </div>
  );
}
