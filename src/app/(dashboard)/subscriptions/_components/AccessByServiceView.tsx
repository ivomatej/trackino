'use client';

import type { Subscription, SubscriptionAccess } from '@/types/database';
import { STATUS_CONFIG, ICONS, inputCls, inputStyle } from './constants';
import { getFaviconUrl, fmtPrice, toMonthly } from './utils';
import type { Member } from './types';

interface AccessByServiceViewProps {
  activeSubs: Subscription[];
  accesses: SubscriptionAccess[];
  accessSearch: string;
  setAccessSearch: (v: string) => void;
  canManage: boolean;
  getCostPerUser: (s: Subscription) => number;
  toCzk: (price: number | null, currency: string) => number | null;
  getCatColor: (id: string) => string;
  getAccessUserName: (a: SubscriptionAccess) => string;
  members: Member[];
  openAccessModal: (subId: string) => void;
  removeAccess: (id: string) => void;
}

export function AccessByServiceView({
  activeSubs, accesses, accessSearch, setAccessSearch, canManage,
  getCostPerUser, toCzk, getCatColor, getAccessUserName,
  members, openAccessModal, removeAccess,
}: AccessByServiceViewProps) {
  const aq = accessSearch.toLowerCase();

  const subsWithAccess = activeSubs.filter(s => {
    const hasAccess = accesses.some(a => a.subscription_id === s.id);
    if (!hasAccess && !canManage) return false;
    if (aq) return s.name.toLowerCase().includes(aq) || s.company_name.toLowerCase().includes(aq);
    return true;
  }).sort((a, b) => {
    const ca = accesses.filter(x => x.subscription_id === a.id).length;
    const cb = accesses.filter(x => x.subscription_id === b.id).length;
    return cb - ca || a.name.localeCompare(b.name, 'cs');
  });

  return (
    <>
      {/* Hledání */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>{ICONS.search}</span>
        <input
          type="text"
          placeholder="Hledat službu..."
          value={accessSearch}
          onChange={e => setAccessSearch(e.target.value)}
          className={`${inputCls} pl-9`}
          style={inputStyle}
        />
      </div>

      {subsWithAccess.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné přístupy k zobrazení</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subsWithAccess.map(s => {
            const subAccesses = accesses.filter(a => a.subscription_id === s.id);
            const count = subAccesses.length;
            const costPer = getCostPerUser(s);
            const czkPrice = toCzk(s.price, s.currency);
            const monthCzk = czkPrice != null ? toMonthly(czkPrice, s.frequency) : null;
            return (
              <div key={s.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(() => {
                      const fav = s.website_url ? getFaviconUrl(s.website_url.startsWith('http') ? s.website_url : `https://${s.website_url}`) : '';
                      return (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                          {fav ? (
                            <img src={fav} alt="" width={18} height={18} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : s.category_id ? (
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCatColor(s.category_id) }} />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          )}
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {count} uživatel{count === 1 ? '' : count >= 2 && count <= 4 ? 'é' : 'ů'}
                        {monthCzk != null && <> · {fmtPrice(Math.round(monthCzk), 'CZK')}/měs</>}
                        {count > 0 && costPer > 0 && <> · {fmtPrice(Math.round(costPer), 'CZK')}/uživatel</>}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0" style={{ background: STATUS_CONFIG[s.status].color + '20', color: STATUS_CONFIG[s.status].color }}>
                    {STATUS_CONFIG[s.status].label}
                  </span>
                </div>

                {/* Seznam uživatelů */}
                {subAccesses.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {subAccesses.map(a => {
                      const isInt = !!a.user_id;
                      const name = getAccessUserName(a);
                      const member = isInt ? members.find(m => m.user_id === a.user_id) : null;
                      return (
                        <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg group" style={{ background: 'var(--bg-hover)' }}>
                          {isInt && member ? (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: member.avatar_color }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--border)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm truncate block" style={{ color: 'var(--text-primary)' }}>{name}</span>
                            {(a.role || !isInt) && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {!isInt && 'Externí'}
                                {!isInt && a.role && ' · '}
                                {a.role}
                              </span>
                            )}
                          </div>
                          {canManage && (
                            <button
                              className="p-1 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              style={{ color: 'var(--text-muted)' }}
                              onClick={() => removeAccess(a.id)}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                              title="Odebrat přístup"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {canManage && (
                  <button
                    className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--primary)' }}
                    onClick={() => openAccessModal(s.id)}
                  >+ Přidat přístup</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
