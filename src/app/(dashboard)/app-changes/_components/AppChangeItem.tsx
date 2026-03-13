'use client';

import type { AppChange, AppChangeStatus } from '@/types/database';
import {
  TYPE_LABELS, TYPE_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_BORDER,
} from './types';
import { formatDate } from './utils';

// ─── Pomocná komponenta ───────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppChangeItemProps {
  item: AppChange;
  isArchiveTab: boolean;
  expandedId: string | null;
  selectedIds: Set<string>;
  setExpandedId: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  openEdit: (item: AppChange) => void;
  archiveItem: (id: string) => void;
  restoreItem: (id: string) => void;
  permanentDeleteOne: (id: string) => void;
  changeStatus: (id: string, status: AppChangeStatus) => void;
}

// ─── Komponenta ───────────────────────────────────────────────────────────────

export function AppChangeItem({
  item,
  isArchiveTab,
  expandedId,
  selectedIds,
  setExpandedId,
  toggleSelect,
  openEdit,
  archiveItem,
  restoreItem,
  permanentDeleteOne,
  changeStatus,
}: AppChangeItemProps) {
  const isExpanded = expandedId === item.id;
  const isSolved = item.status === 'solved';
  const isArchived = item.status === 'archived';
  const isSelected = selectedIds.has(item.id);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--primary) 4%, var(--bg-card))' : 'var(--bg-card)',
        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
        borderLeft: `4px solid ${isArchived ? '#9ca3af' : PRIORITY_BORDER[item.priority]}`,
        opacity: isArchived ? 0.85 : 1,
      }}
    >
      {/* Klikatelný header */}
      <div
        className="px-4 py-3 cursor-pointer select-none"
        onClick={() => {
          if (isArchiveTab) {
            toggleSelect(item.id);
          } else {
            setExpandedId(isExpanded ? null : item.id);
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Checkbox v archivu */}
            {isArchiveTab && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)] flex-shrink-0"
              />
            )}
            {/* Typ */}
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
              style={{ background: isArchived ? '#9ca3af' : TYPE_COLORS[item.type] }}
            >
              {TYPE_LABELS[item.type]}
            </span>
            {/* Priorita */}
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0"
              style={{ borderColor: PRIORITY_COLORS[item.priority], color: PRIORITY_COLORS[item.priority] }}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
            {/* Stav */}
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
              style={{ background: STATUS_COLORS[item.status] }}
            >
              {STATUS_LABELS[item.status]}
            </span>
            {/* Z Bug logu */}
            {item.source_bug_id && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 flex-shrink-0"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2l1.88 1.88" /><path d="M14.12 3.88L16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
                </svg>
                Z Bug logu
              </span>
            )}
            {/* Datum */}
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {formatDate(item.created_at)}
            </span>
          </div>
          {/* Chevron (jen mimo archiv) */}
          {!isArchiveTab && <ChevronDown open={isExpanded} />}
        </div>

        {/* Název (vždy viditelný) */}
        <p
          className="font-medium text-sm mt-2"
          style={{
            color: 'var(--text-primary)',
            textDecoration: isSolved ? 'line-through' : 'none',
            opacity: isSolved || isArchived ? 0.6 : 1,
          }}
        >
          {item.title}
        </p>
      </div>

      {/* Archiv – akce na položce */}
      {isArchiveTab && (
        <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {item.content && (
            <p className="text-xs py-2 whitespace-pre-wrap flex-1" style={{ color: 'var(--text-muted)' }}>
              {item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content}
            </p>
          )}
          <div className="flex gap-1.5 flex-shrink-0 ml-auto pt-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => restoreItem(item.id)}
              className="px-2 py-1 rounded text-xs border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Obnovit z archivu (nastaví stav na Otevřeno)"
            >
              Obnovit
            </button>
            <button
              onClick={() => permanentDeleteOne(item.id)}
              className="px-2 py-1 rounded text-xs border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Trvale smazat
            </button>
          </div>
        </div>
      )}

      {/* Rozbalitelný obsah (jen mimo archiv) */}
      {!isArchiveTab && isExpanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Popis */}
          {item.content && (
            <p className="text-xs mt-3 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {item.content}
            </p>
          )}

          {/* Stav + Akce */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Stav:</span>
              {(['open', 'in_progress', 'solved'] as AppChangeStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => changeStatus(item.id, s)}
                  className="px-2 py-0.5 rounded-full text-xs font-medium border transition-all"
                  style={{
                    background: item.status === s ? STATUS_COLORS[s] : 'transparent',
                    color: item.status === s ? 'white' : 'var(--text-secondary)',
                    borderColor: STATUS_COLORS[s],
                  }}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openEdit(item)}
                className="px-2 py-1 rounded text-xs border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Upravit
              </button>
              <button
                onClick={() => archiveItem(item.id)}
                className="px-2 py-1 rounded text-xs border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Přesunout do archivu"
              >
                Archivovat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
