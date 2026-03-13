'use client';

import type { Tariff } from '@/types/database';
import { WS_COLORS } from './types';
import { inputStyle } from './utils';

interface Props {
  newWsName: string;
  setNewWsName: (v: string) => void;
  newWsTariff: Tariff;
  setNewWsTariff: (v: Tariff) => void;
  newWsColor: string;
  setNewWsColor: (v: string) => void;
  creatingWs: boolean;
  onCreate: () => void;
  onCancel: () => void;
}

export function NewWorkspaceForm({
  newWsName, setNewWsName, newWsTariff, setNewWsTariff,
  newWsColor, setNewWsColor, creatingWs, onCreate, onCancel,
}: Props) {
  return (
    <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Nový workspace</div>
      <div className="flex gap-2 flex-wrap mb-3">
        <input
          type="text"
          value={newWsName}
          onChange={(e) => setNewWsName(e.target.value)}
          placeholder="Název workspace"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          style={inputStyle}
        />
        <div className="relative flex-shrink-0">
          <select
            value={newWsTariff}
            onChange={(e) => setNewWsTariff(e.target.value as Tariff)}
            className="pl-3 pr-8 py-2 rounded-lg border text-base sm:text-sm appearance-none cursor-pointer"
            style={inputStyle}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="max">Max</option>
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>
      <div className="mb-3">
        <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Barva workspace</div>
        <div className="flex flex-wrap gap-1.5">
          {WS_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewWsColor(c)}
              className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
              style={{
                background: c,
                outline: newWsColor === c ? '2px solid #000' : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCreate}
          disabled={creatingWs || !newWsName.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {creatingWs ? 'Vytvářím...' : 'Vytvořit'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}
