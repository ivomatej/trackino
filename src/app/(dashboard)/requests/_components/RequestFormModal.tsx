'use client';

import type { RequestType } from '@/types/database';
import { REQUEST_TYPE_OPTIONS } from './types';
import { inputCls, inputStyle } from './utils';

interface Props {
  formType: RequestType;
  setFormType: (t: RequestType) => void;
  formTitle: string;
  setFormTitle: (v: string) => void;
  formNote: string;
  setFormNote: (v: string) => void;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function RequestFormModal({
  formType, setFormType,
  formTitle, setFormTitle,
  formNote, setFormNote,
  saving, onSubmit, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nová žádost</h2>
          <button
            onClick={onClose}
            className="p-1 rounded"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Typ */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Kategorie žádosti</label>
            <div className="relative">
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as RequestType)}
                className={inputCls + ' appearance-none pr-8'}
                style={inputStyle}
              >
                {REQUEST_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Název */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="Stručný název žádosti"
              className={inputCls}
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Poznámka */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              rows={3}
              placeholder="Doplňující informace, zdůvodnění žádosti..."
              className={inputCls}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Zrušit
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !formTitle.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? 'Odesílám...' : 'Odeslat žádost'}
          </button>
        </div>
      </div>
    </div>
  );
}
