'use client';

import React from 'react';
import type { FolderModalState } from './types';
import { inputCls, inputStyle } from './utils';

interface FolderModalProps {
  folderModal: FolderModalState;
  setFolderModal: React.Dispatch<React.SetStateAction<FolderModalState>>;
  savingFolder: boolean;
  saveFolder: () => Promise<void>;
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

export function FolderModal({ folderModal, setFolderModal, savingFolder, saveFolder }: FolderModalProps) {
  if (!folderModal.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={() => setFolderModal(f => ({ ...f, open: false }))}>
      <div className="rounded-xl shadow-xl border p-6 w-full max-w-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {folderModal.editing ? 'Upravit složku' : folderModal.parentId ? 'Nová podsložka' : 'Nová složka'}
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
            <input
              type="text"
              value={folderModal.name}
              onChange={e => setFolderModal(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveFolder()}
              className={inputCls}
              style={inputStyle}
              placeholder="Název složky"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Barva</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setFolderModal(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full border-2 transition-transform"
                  style={{ background: c, borderColor: folderModal.color === c ? 'var(--text-primary)' : 'transparent', transform: folderModal.color === c ? 'scale(1.15)' : 'none' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={() => setFolderModal(f => ({ ...f, open: false }))}
            className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Zrušit
          </button>
          <button onClick={saveFolder} disabled={savingFolder || !folderModal.name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {savingFolder ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  );
}
