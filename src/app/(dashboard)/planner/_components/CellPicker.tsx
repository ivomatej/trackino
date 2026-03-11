'use client';

import React from 'react';
import type { AvailabilityStatus } from '@/types/database';
import type { CellKey, EditingCell } from './types';
import { NoteInput } from './NoteInput';

interface CellPickerProps {
  editingCell: EditingCell;
  cellPickerPos: { top: number; left: number };
  cellPickerRef: React.RefObject<HTMLDivElement | null>;
  statuses: AvailabilityStatus[];
  cells: Record<CellKey, { statusId: string | null; note: string }>;
  canAdmin: boolean;
  setAvailability: (statusId: string | null, note?: string) => void;
}

export function CellPicker({
  editingCell,
  cellPickerPos,
  cellPickerRef,
  statuses,
  cells,
  canAdmin,
  setAvailability,
}: CellPickerProps) {
  const cellKey: CellKey = `${editingCell.userId}|${editingCell.date}|${editingCell.half}`;
  const currentCell = cells[cellKey];

  return (
    <div
      ref={cellPickerRef}
      className="fixed z-50 rounded-xl border shadow-xl p-3"
      style={{
        top: cellPickerPos.top,
        left: Math.min(cellPickerPos.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260),
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        width: 244,
      }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        {editingCell.half === 'full'
          ? `Celý den — ${editingCell.date}`
          : `${editingCell.half === 'am' ? 'Dopoledne' : 'Odpoledne'} — ${editingCell.date}`}
      </p>

      <div className="flex flex-col gap-1 mb-1">
        {/* Vymazat stav */}
        <button
          onClick={() => setAvailability(null)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)] text-left transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <span
            className="w-4 h-4 rounded-full border-2 border-dashed flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
          />
          Bez stavu
        </button>

        {statuses.map(s => (
          <button
            key={s.id}
            onClick={() => setAvailability(s.id)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)] text-left transition-colors"
            style={{ color: 'var(--text-primary)' }}
          >
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: s.color }} />
            {s.name}
          </button>
        ))}

        {statuses.length === 0 && (
          <p className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>
            Nejsou definovány žádné stavy.{canAdmin ? ' Přidejte je výše.' : ''}
          </p>
        )}
      </div>

      {/* Poznámka (jen pokud je buňka vyplněna) */}
      {currentCell?.statusId && (
        <NoteInput
          initialNote={currentCell.note ?? ''}
          onSave={(note) => {
            if (!currentCell) return;
            setAvailability(currentCell.statusId, note);
          }}
        />
      )}
    </div>
  );
}
