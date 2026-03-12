'use client';

import { StatsDashboard } from './StatsDashboard';
import { ICONS, EXPIRING_THRESHOLD_DAYS, STATUS_CONFIG, inputCls, inputStyle } from './constants';
import { daysUntilExpiration, getDisplayStatus, fmtDate } from './utils';
import type { Domain, DisplayStatus, SortField, SortDir, DomainStats } from './types';

interface Props {
  filteredDomains: Domain[];
  domains: Domain[];
  stats: DomainStats;
  searchQ: string;
  setSearchQ: (v: string) => void;
  filterStatus: DisplayStatus | '';
  setFilterStatus: (v: DisplayStatus | '') => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterRegistrar: string;
  setFilterRegistrar: (v: string) => void;
  companies: string[];
  registrarNames: string[];
  sortField: SortField;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
  canManage: boolean;
  onOpenEdit: (domain: Domain) => void;
  onDelete: (id: string) => void;
  onDetail: (domain: Domain) => void;
}

function SortArrow({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return null;
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-1 inline">
      {sortDir === 'asc'
        ? <polyline points="18 15 12 9 6 15"/>
        : <polyline points="6 9 12 15 18 9"/>}
    </svg>
  );
}

export function DomainsTabContent({
  filteredDomains, domains, stats,
  searchQ, setSearchQ,
  filterStatus, setFilterStatus,
  filterCompany, setFilterCompany,
  filterRegistrar, setFilterRegistrar,
  companies, registrarNames,
  sortField, sortDir, toggleSort,
  canManage, onOpenEdit, onDelete, onDetail,
}: Props) {
  return (
    <>
      {/* Dashboard karty */}
      <StatsDashboard stats={stats} />

      {/* Filtry a hledání */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            {ICONS.search}
          </span>
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Hledat doménu..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: 'var(--text-muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="relative self-start">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as DisplayStatus | '')}
            className={`${inputCls} appearance-none pr-8 cursor-pointer`}
            style={{ ...inputStyle, minWidth: 160 }}
          >
            <option value="">Všechny stavy</option>
            <option value="active">Aktivní</option>
            <option value="expiring">Expirující</option>
            <option value="winding_down">Dobíhá</option>
            <option value="expired">Expirovaná</option>
            <option value="transferred">Převedená</option>
            <option value="cancelled">Zrušená</option>
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
        </div>

        {/* Registrar filter */}
        {registrarNames.length > 0 && (
          <div className="relative self-start">
            <select
              value={filterRegistrar}
              onChange={e => setFilterRegistrar(e.target.value)}
              className={`${inputCls} appearance-none pr-8 cursor-pointer`}
              style={{ ...inputStyle, minWidth: 160 }}
            >
              <option value="">Všichni registrátoři</option>
              {registrarNames.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
          </div>
        )}

        {/* Company filter */}
        {companies.length > 0 && (
          <div className="relative self-start">
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className={`${inputCls} appearance-none pr-8 cursor-pointer`}
              style={{ ...inputStyle, minWidth: 160 }}
            >
              <option value="">Všechny firmy</option>
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
          </div>
        )}
      </div>

      {/* Tabulka */}
      {filteredDomains.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {domains.length === 0 ? 'Zatím žádné domény.' : 'Žádné domény neodpovídají filtru.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Desktop tabulka */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('name')}>
                    Název <SortArrow field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('registrar')}>
                    Registrátor <SortArrow field="registrar" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('expiration_date')}>
                    Expirace <SortArrow field="expiration_date" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => toggleSort('status')}>
                    Stav <SortArrow field="status" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Firma</th>
                  {canManage && <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Akce</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDomains.map(d => {
                  const ds = getDisplayStatus(d);
                  const sc = STATUS_CONFIG[ds];
                  const days = daysUntilExpiration(d.expiration_date);
                  const isExpiring = ds === 'expiring';
                  const isWindingDown = ds === 'winding_down';
                  return (
                    <tr
                      key={d.id}
                      className="transition-colors cursor-pointer"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isExpiring ? '#fef3c720' : isWindingDown ? '#ede9fe20' : undefined,
                      }}
                      onMouseEnter={e => { if (!isExpiring && !isWindingDown) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isExpiring ? '#fef3c720' : isWindingDown ? '#ede9fe20' : ''; }}
                      onClick={() => onDetail(d)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{d.registrar || '–'}</td>
                      <td className="px-4 py-3">
                        <span style={{ color: isExpiring ? sc.color : ds === 'expired' ? '#ef4444' : 'var(--text-secondary)' }}>
                          {fmtDate(d.expiration_date)}
                        </span>
                        {days !== null && d.expiration_date && (
                          <span className="text-xs ml-1.5" style={{ color: days <= EXPIRING_THRESHOLD_DAYS ? sc.color : 'var(--text-muted)' }}>
                            ({days >= 0 ? `za ${days} dní` : `${Math.abs(days)} dní po`})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: sc.bg, color: sc.text }}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{d.company_name || '–'}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Upravit"
                              onClick={() => onOpenEdit(d)}
                            >{ICONS.edit}</button>
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Smazat"
                              onClick={() => onDelete(d.id)}
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

          {/* Mobilní karty */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {filteredDomains.map(d => {
              const ds = getDisplayStatus(d);
              const sc = STATUS_CONFIG[ds];
              const days = daysUntilExpiration(d.expiration_date);
              const isExpiring = ds === 'expiring';
              const isWindingDown = ds === 'winding_down';
              return (
                <div
                  key={d.id}
                  className="px-4 py-3 transition-colors cursor-pointer"
                  style={{ background: isExpiring ? '#fef3c720' : isWindingDown ? '#ede9fe20' : undefined, borderColor: 'var(--border)' }}
                  onClick={() => onDetail(d)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                      style={{ background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {d.registrar && <span>{d.registrar}</span>}
                    {d.expiration_date && (
                      <span style={{ color: isExpiring ? sc.color : ds === 'expired' ? '#ef4444' : undefined }}>
                        Exp: {fmtDate(d.expiration_date)}
                        {days !== null && (
                          <span className="ml-1">({days >= 0 ? `za ${days} d` : `${Math.abs(days)} d po`})</span>
                        )}
                      </span>
                    )}
                    {d.company_name && <span>{d.company_name}</span>}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 mt-2" onClick={e => e.stopPropagation()}>
                      <button
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Upravit"
                        onClick={() => onOpenEdit(d)}
                      >{ICONS.edit}</button>
                      <button
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Smazat"
                        onClick={() => onDelete(d.id)}
                      >{ICONS.trash}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
