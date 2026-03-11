'use client';

import React from 'react';
import type { SubscriptionCategory } from '@/types/database';
import { CATEGORY_COLORS, ICONS, inputCls, inputStyle, btnPrimary } from './constants';
import type { CatForm } from './types';

interface CatFormModalProps {
  catForm: CatForm;
  setCatForm: React.Dispatch<React.SetStateAction<CatForm>>;
  editingCat: SubscriptionCategory | null;
  rootCategories: SubscriptionCategory[];
  onClose: () => void;
  onSave: () => void;
}

export function CatFormModal({
  catForm, setCatForm, editingCat, rootCategories, onClose, onSave,
}: CatFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl shadow-xl border w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingCat ? 'Upravit kategorii' : 'Nová kategorie'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Název</label>
              <input className={inputCls} style={inputStyle} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Název kategorie" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Nadřazená kategorie</label>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-8`}
                  style={inputStyle}
                  value={catForm.parent_id ?? ''}
                  onChange={e => setCatForm(f => ({ ...f, parent_id: e.target.value || null }))}
                >
                  <option value="">Žádná (hlavní kategorie)</option>
                  {rootCategories.filter(c => c.id !== editingCat?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{ICONS.chevronDown}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Barva</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      background: c,
                      outline: catForm.color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: catForm.color === c ? '2px' : '0',
                    }}
                    onClick={() => setCatForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={onClose}>Zrušit</button>
            <button className={`${btnPrimary}`} style={{ background: 'var(--primary)' }} disabled={!catForm.name.trim()} onClick={onSave}>
              {editingCat ? 'Uložit' : 'Vytvořit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
