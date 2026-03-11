'use client';

import React from 'react';
import type { AvailabilityStatus } from '@/types/database';
import type { CellKey } from './types';

interface CellFullProps {
  status: AvailabilityStatus | null;
  note: string;
  canEdit: boolean;
  onClick: (e: React.MouseEvent) => void;
  cellKey: CellKey;
  hoveredCell: CellKey | null;
  setHoveredCell: (k: CellKey | null) => void;
  setTooltipPos: (p: { top: number; left: number } | null) => void;
}

export function CellFull({
  status,
  note,
  canEdit,
  onClick,
  cellKey,
  hoveredCell,
  setHoveredCell,
  setTooltipPos,
}: CellFullProps) {
  const hasStatus = status !== null;
  const hasNote = !!note;
  void hoveredCell; // používá se v rodiči pro tooltip

  return (
    <div
      className={`flex items-center gap-2 px-2 rounded-lg text-xs font-medium transition-all select-none ${canEdit ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
      style={{
        background: hasStatus ? status!.color + '2a' : 'var(--bg-hover)',
        color: hasStatus ? status!.color : 'var(--text-muted)',
        border: `1px solid ${hasStatus ? status!.color + '60' : 'transparent'}`,
        minHeight: 52,
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
      {hasStatus && (
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: status!.color }} />
      )}
      <span className="truncate leading-tight text-[11px]">
        {hasStatus ? status!.name : ''}
      </span>
      {hasNote && (
        <span className="ml-auto flex-shrink-0 opacity-80">
          <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M4 6h16M4 12h8M4 18h12" />
          </svg>
        </span>
      )}
    </div>
  );
}
