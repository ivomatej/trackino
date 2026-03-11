'use client';

import React from 'react';
import type { SubscriptionCategory } from '@/types/database';
import type { Subscription } from '@/types/database';
import { ICONS, STATUS_CONFIG, TYPE_LABELS, FREQUENCY_LABELS, inputCls, inputStyle } from './constants';
import { getFaviconUrl, fmtPrice, fmtDate, daysUntil, toMonthly } from './utils';
import { StarRating } from './StarRating';
import type { SortField, SortDir } from './types';
import type { SubscriptionStatus, SubscriptionType } from '@/types/database';

interface SubsTabContentProps {
  displaySubs: Subscription[];
  categories: SubscriptionCategory[];
  rootCategories: SubscriptionCategory[];
  getSubcategories: (parentId: string) => SubscriptionCategory[];
  avgRatings: Record<string, number>;
  myRatings: Record<string, number>;
  searchQ: string;
  setSearchQ: (v: string) => void;
  filterStatus: SubscriptionStatus | '';
  setFilterStatus: (v: SubscriptionStatus | '') => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterType: SubscriptionType | '';
  setFilterType: (v: SubscriptionType | '') => void;
  sortField: SortField;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
  setDetailSub: (s: Subscription) => void;
  setMyRating: (subId: string, value: number) => void;
  openEdit: (s: Subscription) => void;
  deleteSub: (id: string, name: string) => void;
  canManage: boolean;
  activeTab: 'subscriptions' | 'tips';
  toCzk: (price: number | null, currency: string) => number | null;
}

export function SubsTabContent({
  displaySubs, categories, rootCategories, getSubcategories,
  avgRatings, myRatings, searchQ, setSearchQ,
  filterStatus, setFilterStatus, filterCategory, setFilterCategory,
  filterType, setFilterType, sortField, sortDir, toggleSort,
  setDetailSub, setMyRating, openEdit, deleteSub, canManage, activeTab, toCzk,
}: SubsTabContentProps) {
  return (
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
              {rootCategories.map(c => {
                const subs2 = getSubcategories(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <option value={c.id}>{c.name}</option>
                    {subs2.map(sc => (
                      <option key={sc.id} value={sc.id}>{'\u00A0\u00A0\u00A0\u00A0' + sc.name}</option>
                    ))}
                  </React.Fragment>
                );
              })}
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
              {([
                { field: 'name' as SortField, label: 'Název' },
                { field: 'status' as SortField, label: 'Stav' },
                { field: 'price' as SortField, label: 'Cena' },
                { field: 'next_payment' as SortField, label: 'Další platba' },
                { field: 'rating' as SortField, label: 'Hodnocení' },
              ]).map(col => (
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
              const cat = categories.find(c => c.id === s.category_id);
              const czkPrice = toCzk(s.price, s.currency);
              const monthCzk = czkPrice != null ? toMonthly(czkPrice, s.frequency) : null;
              const days = daysUntil(s.next_payment_date);
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
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: STATUS_CONFIG[s.status].color + '20', color: STATUS_CONFIG[s.status].color }}>
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
  );
}
