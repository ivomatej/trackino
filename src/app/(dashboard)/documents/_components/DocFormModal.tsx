'use client';

import React from 'react';
import type { DocumentFolder, WorkspaceDocument } from '@/types/database';
import type { DocForm } from './types';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from './types';
import { inputCls, inputStyle, fmtSize } from './utils';

interface DocFormModalProps {
  docForm: DocForm;
  setDocForm: React.Dispatch<React.SetStateAction<DocForm>>;
  editingDoc: WorkspaceDocument | null;
  setEditingDoc: React.Dispatch<React.SetStateAction<WorkspaceDocument | null>>;
  savingDoc: boolean;
  uploadError: string;
  setUploadError: (e: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  saveDocument: () => Promise<void>;
  folders: DocumentFolder[];
}

export function DocFormModal({
  docForm, setDocForm, editingDoc, setEditingDoc,
  savingDoc, uploadError, setUploadError,
  fileInputRef, selectedFile, setSelectedFile,
  handleFileChange, saveDocument, folders,
}: DocFormModalProps) {
  if (!docForm.open) return null;

  const handleClose = () => {
    setDocForm({ open: false, mode: 'file', name: '', url: '', description: '', folder_id: null });
    setEditingDoc(null);
    setSelectedFile(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleClose}>
      <div className="rounded-xl shadow-xl border p-6 w-full max-w-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {editingDoc ? 'Upravit dokument' : 'Přidat dokument'}
        </h2>
        {!editingDoc && (
          <div className="flex rounded-lg border overflow-hidden mb-4" style={{ borderColor: 'var(--border)' }}>
            {(['file', 'link'] as const).map(mode => (
              <button key={mode}
                onClick={() => { setDocForm(f => ({ ...f, mode })); setUploadError(''); setSelectedFile(null); }}
                className="flex-1 py-2 text-sm font-medium transition-colors"
                style={{ background: docForm.mode === mode ? 'var(--primary)' : 'var(--bg-hover)', color: docForm.mode === mode ? 'white' : 'var(--text-secondary)' }}>
                {mode === 'file' ? 'Soubor' : 'Odkaz (URL)'}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {!editingDoc && docForm.mode === 'file' ? (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Soubor <span style={{ color: 'var(--text-muted)' }}>(max {MAX_FILE_SIZE_MB} MB)</span>
              </label>
              <input ref={fileInputRef} type="file" accept={ALLOWED_MIME_TYPES.join(',')} onChange={handleFileChange}
                className="w-full text-sm" style={{ color: 'var(--text-secondary)' }} />
              {selectedFile && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{selectedFile.name} · {fmtSize(selectedFile.size)}</p>
              )}
            </div>
          ) : (!editingDoc || editingDoc.type === 'link') && docForm.mode === 'link' ? (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>URL adresa</label>
              <input type="url" value={docForm.url} onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
                className={inputCls} style={inputStyle} placeholder="https://…" autoFocus={!editingDoc} />
            </div>
          ) : null}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název</label>
            <input type="text" value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls} style={inputStyle} placeholder="Název dokumentu" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Popis (volitelný)</label>
            <input type="text" value={docForm.description} onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))}
              className={inputCls} style={inputStyle} placeholder="Krátký popis…" />
          </div>
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Složka</label>
              <div className="relative">
                <select value={docForm.folder_id ?? ''} onChange={e => setDocForm(f => ({ ...f, folder_id: e.target.value || null }))}
                  className={inputCls + ' appearance-none pr-8'} style={inputStyle}>
                  <option value="">Bez složky</option>
                  {folders.map(fl => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          )}
          {uploadError && <p className="text-xs" style={{ color: '#ef4444' }}>{uploadError}</p>}
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Zrušit
          </button>
          <button onClick={saveDocument} disabled={savingDoc}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {savingDoc ? 'Ukládám…' : editingDoc ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}
