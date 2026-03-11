'use client';

import type { Subscription, SubscriptionAccess } from '@/types/database';
import { STATUS_CONFIG, ICONS, inputCls, inputStyle } from './constants';
import { fmtPrice, toMonthly } from './utils';
import type { AccessSortField } from './types';

interface AccessSummaryViewProps {
  activeSubs: Subscription[];
  accesses: SubscriptionAccess[];
  accessSearch: string;
  setAccessSearch: (v: string) => void;
  accessSortField: AccessSortField;
  accessSortDir: 'asc' | 'desc';
  toggleAccessSort: (field: AccessSortField) => void;
  toCzk: (price: number | null, currency: string) => number | null;
  getCatColor: (id: string) => string;
  getCatName: (id: string) => string;
}

export function AccessSummaryView({
  activeSubs, accesses, accessSearch, setAccessSearch,
  accessSortField, accessSortDir, toggleAccessSort,
  toCzk, getCatColor, getCatName,
}: AccessSummaryViewProps) {
  const aq = accessSearch.toLowerCase();

  const summaryData = activeSubs.map(s => {
    const count = accesses.filter(a => a.subscription_id === s.id).length;
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
                  <span className="font-medium" style={{ color: d.count === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
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
}
