'use client';

import React from 'react';
import type { AvailabilityStatus } from '@/types/database';
import type { CellKey } from './types';

interface CellHalfProps {
  label: string;
  status: AvailabilityStatus | null;
  note: string;
  canEdit: boolean;
  onClick: (e: React.MouseEvent) => void;
  cellKey: CellKey;
  hoveredCell: CellKey | null;
  setHoveredCell: (k: CellKey | null) => void;
  setTooltipPos: (p: { top: number; left: number } | null) => void;
}

export function CellHalf({
  label,
  status,
  note,
  canEdit,
  onClick,
  cellKey,
  hoveredCell,
  setHoveredCell,
  setTooltipPos,
}: CellHalfProps) {
  const hasStatus = status !== null;
  const hasNote = !!note;
  void hoveredCell;

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all select-none ${canEdit ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
      style={{
        background: hasStatus ? status!.color + '2a' : 'var(--bg-hover)',
        color: hasStatus ? status!.color : 'var(--text-muted)',
        border: `1px solid ${hasStatus ? status!.color + '60' : 'transparent'}`,
        minHeight: 24,
      }}
      onClick={canEdit ? onClick : undefined}
      onMouseEnter={e => {
        if (hasNote) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setHoveredCell(cellKey);
          setTooltipPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX });
        }
      }}
      onMouseLeave={() => { setHoveredCell(null); setTooltipPos(null); }}
    >
      <span className="opacity-55 text-[9px] w-6 flex-shrink-0">{label}</span>
      {hasStatus && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: status!.color }} />}
      {hasNote && (
        <span className="ml-auto opacity-80">
          <svg width="10" height="10" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M4 6h16M4 12h8M4 18h12" />
          </svg>
        </span>
      )}
    </div>
  );
}
