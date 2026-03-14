'use client';

import { useState, useRef, useEffect } from 'react';
import { ICONS, STATUS_CONFIG, DB_STATUSES, inputCls, inputStyle } from './constants';
import type { Domain, DomainRegistrar, Subscription, DomainStatus, DomainFormState, GeoEntry } from './types';

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
  geos: GeoEntry[];
}

// ─── Picker zemí pro blokaci ────────────────────────────────────────────────
function GeoPicker({ selected, onChange, geos }: {
  selected: string[];
  onChange: (codes: string[]) => void;
  geos: GeoEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = geos.filter(g =>
    g.name_cs.toLowerCase().includes(search.toLowerCase()) ||
    g.name_en.toLowerCase().includes(search.toLowerCase()) ||
    g.code.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  const selectedGeos = geos.filter(g => selected.includes(g.code));

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} w-full text-left flex items-center justify-between gap-2`}
        style={inputStyle}
      >
        <span className="flex-1 min-w-0">
          {selected.length === 0
            ? <span style={{ color: 'var(--text-muted)' }}>– vyberte země –</span>
            : (
              <span className="flex flex-wrap gap-1">
                {selectedGeos.map(g => (
                  <span key={g.code} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold"
                    style={{ background: 'var(--primary)', color: '#fff' }}>
                    {g.code}
                  </span>
                ))}
              </span>
            )
          }
        </span>
        {ICONS.chevronDown}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: 240 }}>
          <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Hledat zemi..."
              className="w-full text-sm px-2 py-1 rounded border outline-none text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
            {filtered.length === 0
              ? <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>Žádné výsledky</p>
              : filtered.map(g => (
                <label key={g.code} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--bg-hover)] text-sm">
                  <input type="checkbox" checked={selected.includes(g.code)} onChange={() => toggle(g.code)}
                    className="accent-[var(--primary)]" />
                  <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{g.code}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{g.name_cs}</span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{g.name_en}</span>
                </label>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

export function DomainFormModal({
  modal, editing, saving, form, setForm,
  onClose, onSave,
  registrars, subscriptions, hasSubscriptionsModule, canManage,
  onNewRegistrar, geos,
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

          {/* Blokace */}
          {geos.length > 0 && (
            <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Blokace GEO</p>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Stav blokace</label>
                <div className="relative">
                  <select
                    value={form.is_blocked ? 'blocked' : 'none'}
                    onChange={e => setForm(f => ({
                      ...f,
                      is_blocked: e.target.value === 'blocked',
                      blocked_geo_codes: e.target.value === 'none' ? [] : f.blocked_geo_codes,
                    }))}
                    className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                    style={inputStyle}
                  >
                    <option value="none">Neblokovaná</option>
                    <option value="blocked">Blokovaná</option>
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">{ICONS.chevronDown}</span>
                </div>
              </div>
              {form.is_blocked && (
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Blokované země</label>
                  <GeoPicker
                    selected={form.blocked_geo_codes}
                    onChange={codes => setForm(f => ({ ...f, blocked_geo_codes: codes }))}
                    geos={geos}
                  />
                </div>
              )}
            </div>
          )}
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
