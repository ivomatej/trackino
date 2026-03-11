'use client';

import type { Subscription, SubscriptionAccess } from '@/types/database';
import { STATUS_CONFIG, TYPE_LABELS, FREQUENCY_LABELS, PRIORITY_CONFIG, ICONS } from './constants';
import { getFaviconUrl, fmtPrice, fmtDate, toMonthly } from './utils';
import { StarRating } from './StarRating';
import type { Member } from './types';

interface DetailModalProps {
  detailSub: Subscription;
  onClose: () => void;
  accesses: SubscriptionAccess[];
  members: Member[];
  myRatings: Record<string, number>;
  avgRatings: Record<string, number>;
  ratings: { subscription_id: string }[];
  canManage: boolean;
  toCzk: (price: number | null, currency: string) => number | null;
  getCatColor: (id: string) => string;
  getCatName: (id: string) => string;
  getMemberName: (id: string) => string;
  getAccessUserName: (a: SubscriptionAccess) => string;
  setMyRating: (subId: string, value: number) => void;
  openEdit: (s: Subscription) => void;
  deleteSub: (id: string, name: string) => void;
  openAccessModal: (subId: string) => void;
  removeAccess: (id: string) => void;
}

export function DetailModal({
  detailSub, onClose, accesses, members, myRatings, avgRatings, ratings,
  canManage, toCzk, getCatColor, getCatName, getMemberName, getAccessUserName,
  setMyRating, openEdit, deleteSub, openAccessModal, removeAccess,
}: DetailModalProps) {
  const detailAccesses = accesses.filter(a => a.subscription_id === detailSub.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl shadow-xl border w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {(() => {
                const fav = detailSub.website_url ? getFaviconUrl(detailSub.website_url.startsWith('http') ? detailSub.website_url : `https://${detailSub.website_url}`) : '';
                return (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border overflow-hidden mt-0.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    {fav ? (
                      <img src={fav} alt="" width={22} height={22} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    )}
                  </div>
                );
              })()}
              <div className="min-w-0">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{detailSub.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: STATUS_CONFIG[detailSub.status].color + '20', color: STATUS_CONFIG[detailSub.status].color }}>
                    {STATUS_CONFIG[detailSub.status].label}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{TYPE_LABELS[detailSub.type]}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PRIORITY_CONFIG[detailSub.priority].color + '20', color: PRIORITY_CONFIG[detailSub.priority].color }}>
                    {PRIORITY_CONFIG[detailSub.priority].label}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            {detailSub.price != null && (
              <>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Cena</p>
                  <p className="font-medium">{fmtPrice(detailSub.price, detailSub.currency)} / {FREQUENCY_LABELS[detailSub.frequency].toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Měsíčně (Kč)</p>
                  <p className="font-medium">{fmtPrice(Math.round(toMonthly(toCzk(detailSub.price, detailSub.currency) ?? 0, detailSub.frequency)), 'CZK')}</p>
                </div>
              </>
            )}
            {detailSub.next_payment_date && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Další platba</p>
                <p>{fmtDate(detailSub.next_payment_date)}</p>
              </div>
            )}
            {detailSub.registration_date && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Registrováno</p>
                <p>{fmtDate(detailSub.registration_date)}</p>
              </div>
            )}
            {detailSub.company_name && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Společnost</p>
                <p>{detailSub.company_name}</p>
              </div>
            )}
            {detailSub.registration_email && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Email</p>
                <p className="truncate">{detailSub.registration_email}</p>
              </div>
            )}
            {detailSub.registered_by && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Registroval</p>
                <p>{getMemberName(detailSub.registered_by)}</p>
              </div>
            )}
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Obnova</p>
              <p>{detailSub.renewal_type === 'auto' ? 'Automatická' : 'Manuální'}</p>
            </div>
            {detailSub.category_id && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Kategorie</p>
                <p className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCatColor(detailSub.category_id) }} />
                  {getCatName(detailSub.category_id)}
                </p>
              </div>
            )}
          </div>

          {/* URLs */}
          {(detailSub.website_url || detailSub.login_url) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {detailSub.website_url && (
                <a href={detailSub.website_url.startsWith('http') ? detailSub.website_url : `https://${detailSub.website_url}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--primary)' }}
                >
                  {ICONS.link} Web
                </a>
              )}
              {detailSub.login_url && (
                <a href={detailSub.login_url.startsWith('http') ? detailSub.login_url : `https://${detailSub.login_url}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--primary)' }}
                >
                  {ICONS.link} Přihlášení
                </a>
              )}
            </div>
          )}

          {/* Description */}
          {detailSub.description && (
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Popis</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{detailSub.description}</p>
            </div>
          )}

          {/* Notes */}
          {detailSub.notes && (
            <div className="mb-3">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Poznámky</p>
              <div className="text-sm rounded-lg p-3 border" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: detailSub.notes }}
              />
            </div>
          )}

          {/* Rating */}
          <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Moje hodnocení</p>
            <StarRating value={myRatings[detailSub.id] ?? 0} onChange={v => setMyRating(detailSub.id, v)} />
            {avgRatings[detailSub.id] != null && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Průměr: {avgRatings[detailSub.id].toFixed(1)} ({ratings.filter(r => r.subscription_id === detailSub.id).length} hodnocení)
              </p>
            )}
          </div>

          {/* Přístupy */}
          <div className="border-t pt-3 mt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Přístupy ({detailAccesses.length})
              </p>
              {canManage && (
                <button className="text-xs font-medium" style={{ color: 'var(--primary)' }}
                  onClick={() => { onClose(); openAccessModal(detailSub.id); }}
                >+ Přidat</button>
              )}
            </div>
            {detailAccesses.length > 0 ? (
              <div className="space-y-1">
                {detailAccesses.map(a => {
                  const isInt = !!a.user_id;
                  const name = getAccessUserName(a);
                  const member = isInt ? members.find(m => m.user_id === a.user_id) : null;
                  return (
                    <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg group" style={{ background: 'var(--bg-hover)' }}>
                      {isInt && member ? (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: member.avatar_color }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--border)' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        </div>
                      )}
                      <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                        {name}
                        {!isInt && <span style={{ color: 'var(--text-muted)' }}> (ext.)</span>}
                      </span>
                      {a.role && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-main)', color: 'var(--text-muted)' }}>{a.role}</span>}
                      {canManage && (
                        <button className="p-0.5 rounded transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          style={{ color: 'var(--text-muted)' }} onClick={() => removeAccess(a.id)}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Zatím žádné přístupy</p>
            )}
          </div>

          {/* Actions */}
          {canManage && (
            <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                onClick={() => { onClose(); openEdit(detailSub); }}
              >{ICONS.edit} Upravit</button>
              <button
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                style={{ background: '#ef444415', color: '#ef4444' }}
                onClick={() => deleteSub(detailSub.id, detailSub.name)}
              >{ICONS.trash} Smazat</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
