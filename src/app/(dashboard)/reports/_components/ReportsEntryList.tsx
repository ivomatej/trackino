'use client';

import type { TimeEntry, Project } from '@/types/database';
import { fmtDuration, fmtTime, fmtDateGroup, fmtCost } from './utils';

interface ReportsEntryListProps {
  loading: boolean;
  entries: TimeEntry[];
  sortedDays: string[];
  groupedEntries: Record<string, TimeEntry[]>;
  canManageNotes: boolean;
  canSeeOthers: boolean;
  userFilter: string;
  user: { id: string } | null;
  projects: Project[];
  currencySymbol: string;
  editingNoteId: string | null;
  setEditingNoteId: (v: string | null) => void;
  noteText: string;
  setNoteText: (v: string) => void;
  savingNoteId: string | null;
  saveNote: (entryId: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  categoryName: (id: string | null) => string | null;
  taskName: (id: string | null) => string | null;
  memberName: (userId: string) => string;
  getEntryRate: (userId: string, entryDate: string) => number | null;
}

export function ReportsEntryList({
  loading, entries, sortedDays, groupedEntries,
  canManageNotes, canSeeOthers, userFilter, user, projects, currencySymbol,
  editingNoteId, setEditingNoteId, noteText, setNoteText, savingNoteId,
  saveNote, deleteEntry, categoryName, taskName, memberName, getEntryRate,
}: ReportsEntryListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <p className="text-sm">Žádné záznamy pro vybrané období</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedDays.map(day => {
        const dayEntries = groupedEntries[day];
        const dayTotal = dayEntries.reduce((s, e) => s + (e.duration ?? 0), 0);
        return (
          <div key={day} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
                {fmtDateGroup(day + 'T12:00:00')}
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {fmtDuration(dayTotal)}
              </span>
            </div>
            <div className="entry-divider">
              {dayEntries.map(entry => {
                const cat = categoryName(entry.category_id);
                const task = taskName(entry.task_id);
                const proj = projects.find(p => p.id === entry.project_id);
                return (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex gap-3">
                      {/* Barevný pruh projektu */}
                      <div
                        className="w-1 rounded-full flex-shrink-0 self-stretch"
                        style={{ background: proj?.color ?? 'var(--border)', minHeight: '20px' }}
                      />
                      {/* Obsah – 3 řádky */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        {/* Řádek 1: Název */}
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {entry.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                        </div>

                        {/* Řádek 2: Projekt / Kategorie / Úkol / Uživatel */}
                        {(proj || cat || (canSeeOthers && userFilter !== 'me')) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {proj && (
                              <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: proj.color + '22', color: proj.color }}>
                                {proj.name}
                              </span>
                            )}
                            {cat && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat}{task ? ` / ${task}` : ''}</span>
                            )}
                            {canSeeOthers && userFilter !== 'me' && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{memberName(entry.user_id)}</span>
                            )}
                          </div>
                        )}

                        {/* Řádek 3: Čas, trvání a akce */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs tabular-nums flex-1" style={{ color: 'var(--text-muted)' }}>
                            {fmtTime(entry.start_time)} – {entry.end_time ? fmtTime(entry.end_time) : '—'}
                          </span>
                          {(() => {
                            if (!canSeeOthers || !entry.duration) return null;
                            const _rd = new Date(entry.start_time);
                            const rateDay = `${_rd.getFullYear()}-${String(_rd.getMonth() + 1).padStart(2, '0')}-${String(_rd.getDate()).padStart(2, '0')}`;
                            const rate = getEntryRate(entry.user_id, rateDay);
                            if (rate === null) return null;
                            const cost = (entry.duration / 3600) * rate;
                            return (
                              <div className="text-xs tabular-nums hidden sm:block text-right" style={{ color: 'var(--text-muted)', minWidth: '64px' }}>
                                {fmtCost(cost)} {currencySymbol}
                              </div>
                            );
                          })()}
                          <div className="text-sm font-semibold tabular-nums w-16 text-right" style={{ color: 'var(--text-primary)' }}>
                            {fmtDuration(entry.duration ?? 0)}
                          </div>
                          {/* Poznámka – jen pro manažery/adminy */}
                          {canManageNotes && (
                            <button
                              onClick={() => {
                                if (editingNoteId === entry.id) {
                                  setEditingNoteId(null);
                                } else {
                                  setEditingNoteId(entry.id);
                                  setNoteText(entry.manager_note || '');
                                }
                              }}
                              title={entry.manager_note ? 'Upravit poznámku' : 'Přidat poznámku'}
                              className="p-1 rounded transition-colors"
                              style={{ color: entry.manager_note ? '#d97706' : 'var(--text-muted)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#d97706'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = entry.manager_note ? '#d97706' : 'var(--text-muted)'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                          {/* Smazat */}
                          {(canManageNotes || entry.user_id === user?.id) && (
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                              title="Smazat"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" /><path d="M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Zobrazení existující poznámky (mimo editaci) */}
                    {canManageNotes && entry.manager_note && editingNoteId !== entry.id && (
                      <div
                        className="text-xs px-2.5 py-1.5 rounded-md cursor-pointer flex items-start gap-1.5 ml-4"
                        style={{ background: '#f59e0b18', color: '#b45309' }}
                        onClick={() => { setEditingNoteId(entry.id); setNoteText(entry.manager_note || ''); }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>{entry.manager_note}</span>
                      </div>
                    )}

                    {/* Editace poznámky */}
                    {canManageNotes && editingNoteId === entry.id && (
                      <div className="flex gap-2 ml-4">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(entry.id); }
                            if (e.key === 'Escape') setEditingNoteId(null);
                          }}
                          autoFocus
                          placeholder="Interní poznámka manažera… (Enter = uložit, Shift+Enter = nový řádek)"
                          rows={2}
                          className="flex-1 px-2.5 py-1.5 rounded-md border text-base sm:text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={{ borderColor: '#f59e0b50', background: '#f59e0b08', color: 'var(--text-primary)' }}
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => saveNote(entry.id)}
                            disabled={savingNoteId === entry.id}
                            className="px-2.5 py-1 rounded-md text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--primary)' }}
                          >
                            {savingNoteId === entry.id ? '…' : '✓'}
                          </button>
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="px-2.5 py-1 rounded-md text-xs"
                            style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
