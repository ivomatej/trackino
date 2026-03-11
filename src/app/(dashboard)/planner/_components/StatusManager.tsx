'use client';

import type { AvailabilityStatus } from '@/types/database';

interface StatusManagerProps {
  statuses: AvailabilityStatus[];
  newStatusName: string;
  setNewStatusName: (v: string) => void;
  newStatusColor: string;
  setNewStatusColor: (v: string) => void;
  editingStatus: AvailabilityStatus | null;
  setEditingStatus: (s: AvailabilityStatus | null) => void;
  savingStatus: boolean;
  saveStatus: () => void;
  deleteStatus: (id: string) => void;
}

export function StatusManager({
  statuses,
  newStatusName,
  setNewStatusName,
  newStatusColor,
  setNewStatusColor,
  editingStatus,
  setEditingStatus,
  savingStatus,
  saveStatus,
  deleteStatus,
}: StatusManagerProps) {
  return (
    <div className="rounded-2xl border p-4 mb-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Správa stavů dostupnosti</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {statuses.map(s => (
          <div
            key={s.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: s.color + '22', color: s.color, border: `1px solid ${s.color}55` }}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            {s.name}
            <button
              className="ml-1 opacity-60 hover:opacity-100"
              onClick={() => { setEditingStatus(s); setNewStatusName(s.name); setNewStatusColor(s.color); }}
              title="Upravit"
            >✎</button>
            <button
              className="opacity-60 hover:opacity-100 text-red-500"
              onClick={() => deleteStatus(s.id)}
              title="Smazat"
            >×</button>
          </div>
        ))}
        {statuses.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Zatím žádné stavy. Přidejte první níže.</p>
        )}
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="text"
          placeholder="Název stavu (např. Home office)"
          value={newStatusName}
          onChange={e => setNewStatusName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveStatus(); }}
          className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg text-base sm:text-sm border outline-none"
          style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
        <input
          type="color"
          value={newStatusColor}
          onChange={e => setNewStatusColor(e.target.value)}
          className="w-9 h-9 rounded cursor-pointer border p-0.5"
          style={{ borderColor: 'var(--border)' }}
          title="Barva stavu"
        />
        <button
          onClick={saveStatus}
          disabled={savingStatus || !newStatusName.trim()}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
          style={{ background: 'var(--primary)' }}
        >
          {editingStatus ? 'Uložit' : 'Přidat'}
        </button>
        {editingStatus && (
          <button
            onClick={() => { setEditingStatus(null); setNewStatusName(''); setNewStatusColor('#6366f1'); }}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >Zrušit</button>
        )}
      </div>
    </div>
  );
}
