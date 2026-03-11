'use client';

import React from 'react';
import { inputCls, inputStyle, btnPrimary } from './constants';
import type { ExtUserForm } from './types';

interface ExtUserModalProps {
  extUserForm: ExtUserForm;
  setExtUserForm: React.Dispatch<React.SetStateAction<ExtUserForm>>;
  editingExtUser: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ExtUserModal({
  extUserForm, setExtUserForm, editingExtUser, saving, onClose, onSave,
}: ExtUserModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl shadow-xl border w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingExtUser ? 'Upravit externího uživatele' : 'Nový externí uživatel'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Jméno *</label>
              <input className={inputCls} style={inputStyle} value={extUserForm.name} onChange={e => setExtUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Jméno a příjmení" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input type="email" className={inputCls} style={inputStyle} value={extUserForm.email} onChange={e => setExtUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..." />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Poznámka</label>
              <textarea className={`${inputCls} min-h-[50px]`} style={inputStyle} value={extUserForm.note} onChange={e => setExtUserForm(f => ({ ...f, note: e.target.value }))} placeholder="Volitelná poznámka..." rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }} onClick={onClose}>Zrušit</button>
            <button className={btnPrimary} style={{ background: 'var(--primary)', opacity: saving ? 0.7 : 1 }} disabled={saving || !extUserForm.name.trim()} onClick={onSave}>
              {saving ? 'Ukládám...' : editingExtUser ? 'Uložit' : 'Vytvořit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
