'use client';

import { type RefObject } from 'react';
import type { AppChange, AppChangeType, AppChangePriority, AppChangeStatus } from '@/types/database';
import { type FormState, TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './types';
import { inputCls, inputStyle, labelCls, selectCls } from './utils';

interface AppChangeFormModalProps {
  showForm: boolean;
  editingItem: AppChange | null;
  form: FormState;
  setForm: (fn: (f: FormState) => FormState) => void;
  formError: string;
  saving: boolean;
  descTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onSave: () => void;
}

// SVG chevron pro selecty
function SelectChevron() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

export function AppChangeFormModal({
  showForm,
  editingItem,
  form,
  setForm,
  formError,
  saving,
  descTextareaRef,
  onClose,
  onSave,
}: AppChangeFormModalProps) {
  if (!showForm) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }}
      >
        {/* Modal hlavička */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editingItem ? 'Upravit položku' : 'Přidat položku'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal tělo – scrollovatelné */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Název */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Název *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              className={inputCls}
              style={inputStyle}
              placeholder="Krátký popis úkolu nebo nápadu"
              autoFocus
            />
          </div>

          {/* Popis – auto-expanding */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Popis (volitelné)</label>
            <textarea
              ref={descTextareaRef}
              value={form.content}
              onChange={(e) => {
                setForm(f => ({ ...f, content: e.target.value }));
                const ta = e.target;
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 600) + 'px';
              }}
              rows={10}
              className={inputCls + ' resize-none overflow-hidden'}
              style={{ ...inputStyle, minHeight: '260px' }}
              placeholder="Podrobnější popis, kroky k reprodukci, návrh řešení..."
            />
          </div>

          {/* Typ + Priorita + Stav */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Typ</label>
              <div className="relative">
                <select
                  value={form.type}
                  onChange={(e) => setForm(f => ({ ...f, type: e.target.value as AppChangeType }))}
                  className={selectCls}
                  style={inputStyle}
                >
                  {(Object.entries(TYPE_LABELS) as [AppChangeType, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Priorita</label>
              <div className="relative">
                <select
                  value={form.priority}
                  onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as AppChangePriority }))}
                  className={selectCls}
                  style={inputStyle}
                >
                  {(Object.entries(PRIORITY_LABELS) as [AppChangePriority, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Stav</label>
              <div className="relative">
                <select
                  value={form.status}
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value as AppChangeStatus }))}
                  className={selectCls}
                  style={inputStyle}
                >
                  <option value="open">{STATUS_LABELS.open}</option>
                  <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                  <option value="solved">{STATUS_LABELS.solved}</option>
                </select>
                <SelectChevron />
              </div>
            </div>
          </div>

          {formError && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Zrušit
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          >
            {saving ? 'Ukládám…' : editingItem ? 'Uložit změny' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}
