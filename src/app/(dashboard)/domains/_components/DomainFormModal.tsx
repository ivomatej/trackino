'use client';

import { ICONS, STATUS_CONFIG, DB_STATUSES, inputCls, inputStyle } from './constants';
import type { Domain, DomainRegistrar, Subscription, DomainStatus, DomainFormState } from './types';

interface Props {
  modal: boolean;
  editing: Domain | null;
  saving: boolean;
  form: DomainFormState;
  setForm: React.Dispatch<React.SetStateAction<DomainFormState>>;
  onClose: () => void;
  onSave: () => void;
  registrars: DomainRegistrar[];
  subscriptions: Subscription[];
  hasSubscriptionsModule: boolean;
  canManage: boolean;
  onNewRegistrar: () => void;
}

export function DomainFormModal({
  modal, editing, saving, form, setForm,
  onClose, onSave,
  registrars, subscriptions, hasSubscriptionsModule, canManage,
  onNewRegistrar,
}: Props) {
  if (!modal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)' }}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editing ? 'Upravit doménu' : 'Nová doména'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Název domény */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název domény *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="example.com" className={inputCls} style={inputStyle} />
          </div>

          {/* Registrátor – select z entity */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Registrátor</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={form.registrar}
                  onChange={e => setForm(f => ({ ...f, registrar: e.target.value }))}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="">– vyberte registrátora –</option>
                  {registrars.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={onNewRegistrar}
                  className="px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Přidat registrátora"
                >
                  {ICONS.plus}
                </button>
              )}
            </div>
          </div>

          {/* Spárování s předplatným */}
          {hasSubscriptionsModule && subscriptions.length > 0 && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Spárováno s předplatným</label>
              <div className="relative">
                <select
                  value={form.subscription_id || ''}
                  onChange={e => setForm(f => ({ ...f, subscription_id: e.target.value || null }))}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="">– bez spárování –</option>
                  {subscriptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
              </div>
            </div>
          )}

          {/* Datumy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum registrace</label>
              <input type="date" value={form.registration_date} onChange={e => setForm(f => ({ ...f, registration_date: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Datum expirace</label>
              <input type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Status</label>
            <div className="relative">
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as DomainStatus }))}
                className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                style={inputStyle}
              >
                {DB_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
            </div>
          </div>

          {/* Cíl / URL */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Cíl / Web URL</label>
            <input type="text" value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
              placeholder="https://..." className={inputCls} style={inputStyle} />
          </div>

          {/* Projekt + Firma */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Projekt</label>
              <input type="text" value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Firma</label>
              <input type="text" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Poznámky */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámky</label>
            <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Další informace..." className={inputCls} style={inputStyle} />
          </div>
        </div>

        {/* Akční tlačítka */}
        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onClick={onClose}>
            Zrušit
          </button>
          <button className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
            disabled={saving || !form.name.trim()}
            onClick={onSave}>
            {saving ? 'Ukládám...' : editing ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}
