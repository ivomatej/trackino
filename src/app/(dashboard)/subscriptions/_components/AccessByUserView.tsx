'use client';

import type { Subscription, SubscriptionAccess, SubscriptionAccessUser } from '@/types/database';
import { ICONS, inputCls, inputStyle } from './constants';
import { getFaviconUrl, fmtPrice } from './utils';
import type { Member } from './types';

interface AccessByUserViewProps {
  subs: Subscription[];
  accesses: SubscriptionAccess[];
  externalUsers: SubscriptionAccessUser[];
  members: Member[];
  accessSearch: string;
  setAccessSearch: (v: string) => void;
  canManage: boolean;
  getCatColor: (id: string) => string;
  getUserTotalCost: (userId: string, isExternal: boolean) => number;
  removeAccess: (id: string) => void;
  openEditExtUser: (u: SubscriptionAccessUser) => void;
  deleteExtUser: (u: SubscriptionAccessUser) => void;
}

export function AccessByUserView({
  subs, accesses, externalUsers, members, accessSearch, setAccessSearch,
  canManage, getCatColor, getUserTotalCost, removeAccess, openEditExtUser, deleteExtUser,
}: AccessByUserViewProps) {
  const aq = accessSearch.toLowerCase();

  const internalIds = [...new Set(accesses.filter(a => a.user_id).map(a => a.user_id!))];
  const internalList = internalIds.map(uid => {
    const m = members.find(mm => mm.user_id === uid);
    const userAcc = accesses.filter(a => a.user_id === uid);
    return { id: uid, name: m?.display_name ?? '?', avatar_color: m?.avatar_color ?? '#2563eb', accesses: userAcc, cost: getUserTotalCost(uid, false) };
  }).filter(u => !aq || u.name.toLowerCase().includes(aq))
    .sort((a, b) => b.accesses.length - a.accesses.length || a.name.localeCompare(b.name, 'cs'));

  const externalList = externalUsers.map(eu => {
    const userAcc = accesses.filter(a => a.external_user_id === eu.id);
    return { id: eu.id, name: eu.name, email: eu.email, note: eu.note, accesses: userAcc, cost: getUserTotalCost(eu.id, true) };
  }).filter(u => !aq || u.name.toLowerCase().includes(aq) || (u.email && u.email.toLowerCase().includes(aq)))
    .sort((a, b) => b.accesses.length - a.accesses.length || a.name.localeCompare(b.name, 'cs'));

  return (
    <>
      {/* Hledání */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>{ICONS.search}</span>
        <input type="text" placeholder="Hledat uživatele..." value={accessSearch} onChange={e => setAccessSearch(e.target.value)} className={`${inputCls} pl-9`} style={inputStyle} />
      </div>

      {/* Interní uživatelé */}
      {internalList.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Interní uživatelé ({internalList.length})</h3>
          <div className="space-y-3 mb-6">
            {internalList.map(u => (
              <div key={u.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: u.avatar_color }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.accesses.length} služeb · {fmtPrice(Math.round(u.cost), 'CZK')}/měs
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  {u.accesses.map(a => {
                    const sub = subs.find(ss => ss.id === a.subscription_id);
                    return sub ? (
                      <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm group" style={{ background: 'var(--bg-hover)' }}>
                        {(() => {
                          const fv = sub.website_url ? getFaviconUrl(sub.website_url.startsWith('http') ? sub.website_url : `https://${sub.website_url}`) : '';
                          return fv ? (
                            <img src={fv} alt="" width={16} height={16} className="flex-shrink-0 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : sub.category_id ? (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getCatColor(sub.category_id) }} />
                          ) : null;
                        })()}
                        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{sub.name}</span>
                        {a.role && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{a.role}</span>}
                        {canManage && (
                          <button className="p-0.5 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            style={{ color: 'var(--text-muted)' }} onClick={() => removeAccess(a.id)}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Externí uživatelé */}
      <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
        Externí uživatelé ({externalList.length})
      </h3>
      {externalList.length === 0 ? (
        <div className="rounded-xl border px-6 py-8 text-center mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádní externí uživatelé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {externalList.map(u => (
            <div key={u.id} className="rounded-xl border p-4 group" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--border)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {u.email && <>{u.email} · </>}
                    {u.accesses.length} služeb · {fmtPrice(Math.round(u.cost), 'CZK')}/měs
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                      onClick={() => openEditExtUser(externalUsers.find(eu => eu.id === u.id)!)}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >{ICONS.edit}</button>
                    <button className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                      onClick={() => deleteExtUser(externalUsers.find(eu => eu.id === u.id)!)}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >{ICONS.trash}</button>
                  </div>
                )}
              </div>
              {u.accesses.length > 0 && (
                <div className="space-y-1">
                  {u.accesses.map(a => {
                    const sub = subs.find(ss => ss.id === a.subscription_id);
                    return sub ? (
                      <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm group/item" style={{ background: 'var(--bg-hover)' }}>
                        {(() => {
                          const fv = sub.website_url ? getFaviconUrl(sub.website_url.startsWith('http') ? sub.website_url : `https://${sub.website_url}`) : '';
                          return fv ? (
                            <img src={fv} alt="" width={16} height={16} className="flex-shrink-0 rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : sub.category_id ? (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getCatColor(sub.category_id) }} />
                          ) : null;
                        })()}
                        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{sub.name}</span>
                        {a.role && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{a.role}</span>}
                        {canManage && (
                          <button className="p-0.5 rounded transition-colors opacity-100 md:opacity-0 md:group-hover/item:opacity-100"
                            style={{ color: 'var(--text-muted)' }} onClick={() => removeAccess(a.id)}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              {u.note && <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>{u.note}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
