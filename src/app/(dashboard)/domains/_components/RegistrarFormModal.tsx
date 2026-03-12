'use client';

import { inputCls, inputStyle } from './constants';
import type { DomainRegistrar, RegFormState } from './types';

interface Props {
  regModal: boolean;
  editingReg: DomainRegistrar | null;
  savingReg: boolean;
  regForm: RegFormState;
  setRegForm: React.Dispatch<React.SetStateAction<RegFormState>>;
  onClose: () => void;
  onSave: () => void;
}

export function RegistrarFormModal({
  regModal, editingReg, savingReg, regForm, setRegForm,
  onClose, onSave,
}: Props) {
  if (!regModal) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-xl"
        style={{ background: 'var(--bg-card)' }}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editingReg ? 'Upravit registrátora' : 'Nový registrátor'}
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
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název *</label>
            <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
              placeholder="WEDOS, Forpsi, Cloudflare..." className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Webové stránky</label>
            <input type="text" value={regForm.website_url} onChange={e => setRegForm(f => ({ ...f, website_url: e.target.value }))}
              placeholder="https://www.wedos.cz" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámky</label>
            <textarea rows={2} value={regForm.notes} onChange={e => setRegForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Další informace..." className={inputCls} style={inputStyle} />
          </div>
        </div>

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
            disabled={savingReg || !regForm.name.trim()}
            onClick={onSave}>
            {savingReg ? 'Ukládám...' : editingReg ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}
