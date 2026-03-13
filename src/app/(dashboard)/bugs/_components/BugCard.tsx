'use client';

import React from 'react';
import type { BugReport, BugStatus } from '@/types/database';
import type { UserInfo } from './types';
import { STATUS_LABELS, STATUS_COLORS } from './types';
import { ChevronDown, ToolbarButtons } from './ui';

interface BugCardProps {
  bug: BugReport;
  isOwn: boolean;
  isMasterAdmin: boolean;
  workspaces: { id: string; name: string }[];
  userProfiles: Record<string, UserInfo>;
  expandedId: string | null;
  editingId: string | null;
  noteEditId: string | null;
  noteText: string;
  movedBugIds: Set<string>;
  movingId: string | null;
  editEditorRef: React.RefObject<HTMLDivElement>;
  onToggleExpand: (id: string) => void;
  onStartEdit: (bug: BugReport) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: BugStatus) => void;
  onStartNoteEdit: (bug: BugReport) => void;
  onCancelNoteEdit: () => void;
  onSaveNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onNoteTextChange: (text: string) => void;
  onMoveToBugChanges: (bug: BugReport) => void;
  onExecCmdEdit: (cmd: string) => void;
  formatDate: (iso: string) => string;
}

export function BugCard({
  bug, isOwn, isMasterAdmin, workspaces, userProfiles,
  expandedId, editingId, noteEditId, noteText, movedBugIds, movingId,
  editEditorRef,
  onToggleExpand, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
  onUpdateStatus, onStartNoteEdit, onCancelNoteEdit, onSaveNote, onDeleteNote,
  onNoteTextChange, onMoveToBugChanges, onExecCmdEdit, formatDate,
}: BugCardProps) {
  const userInfo = userProfiles[bug.user_id];
  const userName = userInfo?.display_name || userInfo?.email || 'Neznámý';
  const isEditing = editingId === bug.id;
  const isEditingNote = noteEditId === bug.id;
  const isExpanded = expandedId === bug.id || isEditing;
  const isMoved = movedBugIds.has(bug.id);
  const statusColor = STATUS_COLORS[bug.status];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        borderLeft: `4px solid ${statusColor}`,
      }}
    >
      {/* Klikatelný header */}
      <div
        className="px-4 py-3 cursor-pointer select-none"
        onClick={() => {
          if (isEditing) return;
          onToggleExpand(bug.id);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Levá část: badges + info */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
              style={{ background: statusColor }}
            >
              {STATUS_LABELS[bug.status]}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{userName}</span>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {formatDate(bug.created_at)}
            </span>
            {isMasterAdmin && workspaces.length > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
              >
                {workspaces.find(w => w.id === bug.workspace_id)?.name ?? '—'}
              </span>
            )}
            {isMoved && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background: '#dcfce7', color: '#15803d' }}
              >
                Přesunuto ✓
              </span>
            )}
          </div>

          {/* Pravá část: akční tlačítka + chevron */}
          <div
            className="flex items-center gap-1.5 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {isOwn && !isEditing && (
              <button
                onClick={() => onStartEdit(bug)}
                className="px-2 py-1 rounded text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Upravit
              </button>
            )}
            {(isOwn || isMasterAdmin) && !isEditing && (
              <button
                onClick={() => onDelete(bug.id)}
                className="px-2 py-1 rounded text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--danger)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Smazat
              </button>
            )}
            <div onClick={(e) => { e.stopPropagation(); if (!isEditing) onToggleExpand(bug.id); }}>
              <ChevronDown open={isExpanded} />
            </div>
          </div>
        </div>
      </div>

      {/* Rozbalitelný obsah */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Content / Editor */}
          {isEditing ? (
            <div className="rounded-lg border overflow-hidden mt-3 mb-3" style={{ borderColor: 'var(--border)' }}>
              <ToolbarButtons onCmd={onExecCmdEdit} />
              <div
                ref={editEditorRef}
                contentEditable
                suppressContentEditableWarning
                className="prose prose-sm max-w-none p-3 focus:outline-none"
                style={{ color: 'var(--text-primary)', minHeight: '100px' }}
              />
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none mt-3"
              dangerouslySetInnerHTML={{ __html: bug.content }}
            />
          )}

          {isEditing && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={onCancelEdit}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={() => onSaveEdit(bug.id)}
                className="px-4 py-1.5 rounded-lg text-white text-sm font-medium"
                style={{ background: 'var(--primary)' }}
              >
                Uložit
              </button>
            </div>
          )}

          {/* Master Admin sekce */}
          {isMasterAdmin && !isEditing && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {/* Status + Přesun tlačítko */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Stav:</span>
                  {(['open', 'in_progress', 'solved'] as BugStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => onUpdateStatus(bug.id, s)}
                      className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        background: bug.status === s ? STATUS_COLORS[s] : 'transparent',
                        color: bug.status === s ? 'white' : 'var(--text-secondary)',
                        borderColor: STATUS_COLORS[s],
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>

                {/* Přesun do Úprav aplikace */}
                {isMoved ? (
                  <span
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium"
                    style={{ borderColor: '#22c55e', color: '#15803d', background: '#f0fdf4' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Přesunuto
                  </span>
                ) : (
                  <button
                    onClick={() => onMoveToBugChanges(bug)}
                    disabled={movingId === bug.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    title="Přidat do seznamu Úpravy aplikace"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                    {movingId === bug.id ? 'Přesouvám…' : 'Úpravy aplikace'}
                  </button>
                )}
              </div>

              {/* Poznámka */}
              {isEditingNote ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => onNoteTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveNote(bug.id);
                      if (e.key === 'Escape') onCancelNoteEdit();
                    }}
                    className="flex-1 px-2 py-1.5 rounded border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    placeholder="Poznámka pro uživatele..."
                    autoFocus
                  />
                  <button
                    onClick={onCancelNoteEdit}
                    className="px-2 py-1 rounded text-xs border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={() => onSaveNote(bug.id)}
                    className="px-3 py-1 rounded text-xs text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    Uložit
                  </button>
                </div>
              ) : bug.master_note ? (
                <div
                  className="mt-2 flex items-start justify-between gap-2 p-2 rounded-lg text-xs"
                  style={{ background: 'var(--bg-hover)' }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Poznámka:</strong> {bug.master_note}
                  </span>
                  <div className="flex gap-0.5 flex-shrink-0 ml-1">
                    <button
                      onClick={() => onStartNoteEdit(bug)}
                      title="Upravit poznámku"
                      className="p-1 rounded"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteNote(bug.id)}
                      title="Smazat poznámku"
                      className="p-1 rounded"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-light)'; e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onStartNoteEdit(bug)}
                  className="mt-2 text-xs"
                  style={{ color: 'var(--primary)' }}
                >
                  + Přidat poznámku
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
