'use client';

import React from 'react';
import type { Subscription, SubscriptionAccessUser } from '@/types/database';
import { ICONS, inputCls, inputStyle, btnPrimary } from './constants';
import type { AccessForm, Member } from './types';

interface AccessModalProps {
  accessForm: AccessForm;
  setAccessForm: React.Dispatch<React.SetStateAction<AccessForm>>;
  subs: Subscription[];
  members: Member[];
  externalUsers: SubscriptionAccessUser[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  openNewExtUser: () => void;
}

export function AccessModal({
  accessForm, setAccessForm, subs, members, externalUsers,
  saving, onClose, onSave, openNewExtUser,
}: AccessModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl shadow-xl border w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat přístup</h2>
          <div className="space-y-3">
            {/* Předplatné */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Předplatné *</label>
              <div className="relative">
                <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={accessForm.subscription_id} onChange={e => setAccessForm(f => ({ ...f, subscription_id: e.target.value }))}>
                  <option value="">Vyberte...</option>
                  {subs.filter(s => !s.is_tip).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
              </div>
            </div>

            {/* Typ uživatele */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Typ uživatele</label>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: accessForm.type === 'internal' ? 'var(--primary)' : 'var(--bg-hover)',
                    color: accessForm.type === 'internal' ? '#fff' : 'var(--text-muted)',
                  }}
                  onClick={() => setAccessForm(f => ({ ...f, type: 'internal', external_user_id: '' }))}
                >Interní</button>
                <button
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: accessForm.type === 'external' ? 'var(--primary)' : 'var(--bg-hover)',
                    color: accessForm.type === 'external' ? '#fff' : 'var(--text-muted)',
                  }}
                  onClick={() => setAccessForm(f => ({ ...f, type: 'external', user_id: '' }))}
                >Externí</button>
              </div>
            </div>

            {/* Výběr uživatele */}
            {accessForm.type === 'internal' ? (
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Uživatel *</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={accessForm.user_id} onChange={e => setAccessForm(f => ({ ...f, user_id: e.target.value }))}>
                    <option value="">Vyberte...</option>
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Externí uživatel *</label>
                <div className="relative">
                  <select className={`${inputCls} appearance-none pr-8`} style={inputStyle} value={accessForm.external_user_id} onChange={e => setAccessForm(f => ({ ...f, external_user_id: e.target.value }))}>
                    <option value="">Vyberte...</option>
                    {externalUsers.map(eu => <option key={eu.id} value={eu.id}>{eu.name}{eu.email ? ` (${eu.email})` : ''}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
                </div>
                {externalUsers.length === 0 && (
                  <button className="text-xs mt-1" style={{ color: 'var(--primary)' }} onClick={() => { onClose(); openNewExtUser(); }}>
                    + Nejdřív přidejte externího uživatele
                  </button>
                )}
              </div>
            )}

            {/* Role */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Role</label>
              <input className={inputCls} style={inputStyle} value={accessForm.role} onChange={e => setAccessForm(f => ({ ...f, role: e.target.value }))} placeholder="např. Admin, Uživatel..." />
            </div>

            {/* Datum přiřazení */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum přiřazení</label>
              <input type="date" className={inputCls} style={inputStyle} value={accessForm.granted_at} onChange={e => setAccessForm(f => ({ ...f, granted_at: e.target.value }))} />
            </div>

            {/* Poznámka */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
              <textarea className={`${inputCls} min-h-[50px]`} style={inputStyle} value={accessForm.note} onChange={e => setAccessForm(f => ({ ...f, note: e.target.value }))} placeholder="Volitelná poznámka..." rows={2} />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={onClose}>Zrušit</button>
            <button
              className={btnPrimary}
              style={{ background: 'var(--primary)', opacity: saving ? 0.7 : 1 }}
              disabled={saving || !accessForm.subscription_id || (accessForm.type === 'internal' ? !accessForm.user_id : !accessForm.external_user_id)}
              onClick={onSave}
            >{saving ? 'Ukládám...' : 'Přidat'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
