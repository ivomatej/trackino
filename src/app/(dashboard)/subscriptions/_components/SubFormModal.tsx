'use client';

import React from 'react';
import type { SubscriptionCategory, SubscriptionType, SubscriptionStatus, SubscriptionFrequency, SubscriptionPriority, SubscriptionCurrency } from '@/types/database';
import { STATUS_CONFIG, TYPE_LABELS, FREQUENCY_LABELS, PRIORITY_CONFIG, CURRENCIES, ICONS, inputCls, inputStyle, btnPrimary } from './constants';
import { fmtPrice } from './utils';
import type { SubForm, Member, Rates } from './types';

interface SubFormModalProps {
  form: SubForm;
  setForm: React.Dispatch<React.SetStateAction<SubForm>>;
  editing: boolean;
  saving: boolean;
  categories: SubscriptionCategory[];
  rootCategories: SubscriptionCategory[];
  getSubcategories: (parentId: string) => SubscriptionCategory[];
  members: Member[];
  rates: Rates;
  onClose: () => void;
  onSave: () => void;
}

export function SubFormModal({
  form, setForm, editing, saving, categories, rootCategories, getSubcategories,
  members, rates, onClose, onSave,
}: SubFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl shadow-xl border w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editing ? 'Upravit předplatné' : form.is_tip ? 'Nový tip' : 'Nové předplatné'}
          </h2>

          <div className="space-y-3">
            {/* Název */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název *</label>
              <input className={inputCls} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Název služby" />
            </div>

            {/* Typ + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Typ</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as SubscriptionType }))}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Stav</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SubscriptionStatus }))}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
            </div>

            {/* Cena + Měna + Frekvence */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Cena</label>
                <input type="number" className={inputCls} style={inputStyle} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Měna</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as SubscriptionCurrency }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Frekvence</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as SubscriptionFrequency }))}>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
            </div>

            {/* CZK přepočet */}
            {form.price && form.currency !== 'CZK' && rates[form.currency as keyof typeof rates] && (
              <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                ≈ {fmtPrice(Math.round(parseFloat(form.price) * (rates[form.currency as keyof typeof rates] ?? 1)), 'CZK')} (kurz ČNB)
              </p>
            )}

            {/* Priorita + Obnova */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Priorita</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as SubscriptionPriority }))}>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Obnova</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.renewal_type} onChange={e => setForm(f => ({ ...f, renewal_type: e.target.value as 'auto' | 'manual' }))}>
                    <option value="auto">Automatická</option>
                    <option value="manual">Manuální</option>
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
            </div>

            {/* Datumy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Další platba</label>
                <input type="date" className={inputCls} style={inputStyle} value={form.next_payment_date} onChange={e => setForm(f => ({ ...f, next_payment_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum registrace</label>
                <input type="date" className={inputCls} style={inputStyle} value={form.registration_date} onChange={e => setForm(f => ({ ...f, registration_date: e.target.value }))} />
              </div>
            </div>

            {/* Kategorie */}
            {categories.length > 0 && (
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Kategorie</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}>
                    <option value="">Bez kategorie</option>
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
              </div>
            )}

            {/* URLs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Web URL</label>
                <input className={inputCls} style={inputStyle} value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Login URL</label>
                <input className={inputCls} style={inputStyle} value={form.login_url} onChange={e => setForm(f => ({ ...f, login_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>

            {/* Společnost + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Společnost</label>
                <input className={inputCls} style={inputStyle} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Název poskytovatele" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Registrační email</label>
                <input type="email" className={inputCls} style={inputStyle} value={form.registration_email} onChange={e => setForm(f => ({ ...f, registration_email: e.target.value }))} placeholder="email@..." />
              </div>
            </div>

            {/* Registroval */}
            {members.length > 0 && (
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Registroval</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={form.registered_by ?? ''} onChange={e => setForm(f => ({ ...f, registered_by: e.target.value || null }))}>
                    <option value="">Nevybráno</option>
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
            )}

            {/* Popis */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Popis</label>
              <textarea className={`${inputCls} min-h-[60px]`} style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Stručný popis služby..." rows={2} />
            </div>

            {/* Poznámky */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámky</label>
              <textarea className={`${inputCls} min-h-[60px]`} style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Interní poznámky..." rows={2} />
            </div>

            {/* Tip checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_tip} onChange={e => setForm(f => ({ ...f, is_tip: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Označit jako tip (doporučení)</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={onClose}>Zrušit</button>
            <button className={`${btnPrimary}`} style={{ background: 'var(--primary)', opacity: saving ? 0.7 : 1 }} disabled={saving || !form.name.trim()} onClick={onSave}>
              {saving ? 'Ukládám...' : editing ? 'Uložit' : 'Vytvořit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
