'use client';

import type { Profile } from '@/types/database';
import { inputCls, inputStyle } from './utils';

interface Props {
  isWorkspaceAdmin: boolean;
  allProfiles: Profile[];
  userId: string;
  formUserId: string;
  setFormUserId: (v: string) => void;
  formStartDate: string;
  setFormStartDate: (v: string) => void;
  formEndDate: string;
  setFormEndDate: (v: string) => void;
  computedDays: number;
  willNeedApproval: boolean;
  formNote: string;
  setFormNote: (v: string) => void;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function VacationForm({
  isWorkspaceAdmin,
  allProfiles,
  userId,
  formUserId,
  setFormUserId,
  formStartDate,
  setFormStartDate,
  formEndDate,
  setFormEndDate,
  computedDays,
  willNeedApproval,
  formNote,
  setFormNote,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <div className="rounded-xl border p-5 mb-4 overflow-x-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', transform: 'translateZ(0)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat dovolenou</h3>

      {isWorkspaceAdmin && allProfiles.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Uživatel</label>
          <div className="relative">
            <select
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              className={inputCls + ' pr-8 appearance-none cursor-pointer'}
              style={inputStyle}
            >
              <option value={userId}>Já ({allProfiles.find(p => p.id === userId)?.display_name ?? 'Já'})</option>
              {allProfiles.filter(p => p.id !== userId).map(p => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="min-w-0">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum od</label>
          <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className={inputCls} style={{ ...inputStyle, maxWidth: '100%' }} />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum do</label>
          <input type="date" value={formEndDate} min={formStartDate} onChange={(e) => setFormEndDate(e.target.value)} className={inputCls} style={{ ...inputStyle, maxWidth: '100%' }} />
        </div>
      </div>

      {computedDays > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
          <span>Pracovních dní: <strong style={{ color: 'var(--text-primary)' }}>{computedDays}</strong></span>
          {willNeedApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
              ⏳ Vyžaduje schválení nadřízeného
            </span>
          )}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Poznámka (volitelně)</label>
        <input
          type="text"
          value={formNote}
          onChange={(e) => setFormNote(e.target.value)}
          placeholder="např. Dovolená v Chorvatsku"
          className={inputCls}
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Zrušit
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || !formStartDate || !formEndDate || computedDays === 0}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? 'Ukládám...' : willNeedApproval ? 'Odeslat žádost' : 'Přidat'}
        </button>
      </div>
    </div>
  );
}
