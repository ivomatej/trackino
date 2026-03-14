'use client';

import { useState, useRef } from 'react';
import type { DomainCheckResult, DomainMonitoring } from '@/types/database';
import { inputCls, inputStyle, ICONS } from './constants';

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
function StatusBadge({ status }: { status: string }) {
  if (status === 'free') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#dcfce7', color: '#166534' }}>
        Volná
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#fee2e2', color: '#991b1b' }}>
        Obsazená
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
      Neznámý
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
  checkerResults: DomainCheckResult[];
  setCheckerResults: (r: DomainCheckResult[]) => void;
  checkDomains: (
    domains: { name: string; extension: string }[],
    source: 'manual' | 'bulk',
  ) => Promise<DomainCheckResult[]>;
  onAddToMonitoring: (domainName: string) => void;
  monitoringList: DomainMonitoring[];
}

export function DomainCheckerTab({
  openproviderConfigured,
  checkerResults,
  setCheckerResults,
  checkDomains,
  onAddToMonitoring,
  monitoringList,
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

  const abortRef = useRef(false);

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
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Výsledky ({checkerResults.length})
            </h3>
            <button
              onClick={() => setCheckerResults([])}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Vymazat
            </button>
          </div>

          {/* Desktop tabulka */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Doména</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {checkerResults.map((r, i) => (
                  <tr
                    key={r.domain}
                    style={{
                      borderBottom: i < checkerResults.length - 1 ? '1px solid var(--border)' : undefined,
                      background: r.status === 'free' ? '#f0fdf4' : r.status === 'active' ? '#fff8f8' : undefined,
                    }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.domain}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.premium && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: '#fef3c7', color: '#92400e' }}>
                          Premium
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'free' && !monitoringNames.has(r.domain) && (
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
                      {monitoringNames.has(r.domain) && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>V monitoringu</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobilní karty */}
          <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {checkerResults.map(r => (
              <div key={r.domain} className="px-4 py-3 flex items-center justify-between gap-3"
                style={{ background: r.status === 'free' ? '#f0fdf4' : r.status === 'active' ? '#fff8f8' : 'var(--bg-card)' }}>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.domain}</p>
                  <div className="mt-1"><StatusBadge status={r.status} /></div>
                </div>
                {r.status === 'free' && !monitoringNames.has(r.domain) && (
                  <button
                    onClick={() => onAddToMonitoring(r.domain)}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)', minHeight: 44 }}
                  >
                    <PlusIcon /> Monitoring
                  </button>
                )}
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
