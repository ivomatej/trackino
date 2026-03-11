'use client';

import type { ViewTab } from '../types';
import { inputStyle } from '../utils';

interface TabItem {
  key: ViewTab;
  label: string;
  count?: number;
  visible: boolean;
}

interface InvoiceFiltersProps {
  visibleTabs: TabItem[];
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  canApprove: boolean;
  canManageBilling: boolean;
  filterMonth: string;
  setFilterMonth: (v: string) => void;
  filterYear: string;
  setFilterYear: (v: string) => void;
  invoiceSearch: string;
  setInvoiceSearch: (v: string) => void;
  availableYears: number[];
}

export function InvoiceFilters({
  visibleTabs,
  activeTab,
  onChangeTab,
  canApprove,
  canManageBilling,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  invoiceSearch,
  setInvoiceSearch,
  availableYears,
}: InvoiceFiltersProps) {
  return (
    <div className="mb-6">
      {visibleTabs.length > 1 && (
        <div className="flex gap-1 rounded-lg p-1 mb-3" style={{ background: 'var(--bg-hover)' }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white" style={{ background: tab.key === 'approve' ? '#ef4444' : '#9ca3af' }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {/* Filtry + vyhledávání – pouze pro adminy/managery/správce fakturace */}
      {(activeTab === 'approve' || activeTab === 'billing') && (canApprove || canManageBilling) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Filtr měsíce */}
          <div className="relative flex-shrink-0 self-start">
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={inputStyle}
            >
              <option value="">Všechny měsíce</option>
              {['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'].map((m, i) => (
                <option key={i + 1} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {/* Filtr roku */}
          {availableYears.length > 1 && (
            <div className="relative flex-shrink-0 self-start">
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={inputStyle}
              >
                <option value="">Všechny roky</option>
                {availableYears.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}
          {/* Vyhledávání */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="Hledat dle jména nebo VS…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={inputStyle}
            />
            {invoiceSearch && (
              <button
                onClick={() => setInvoiceSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
