'use client';

import { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { SelectWrap, ToolbarButtons } from './ui';
import { BugCard } from './BugCard';
import { useBugs } from './useBugs';

export function BugsContent() {
  const {
    bugs, myBugs, otherBugs,
    loading, submitting, submitError,
    workspaceFilter, setWorkspaceFilter,
    statusFilter, setStatusFilter,
    workspaces, userProfiles,
    movedBugIds, expandedId, editingId,
    noteEditId, noteText, setNoteText, movingId,
    editorRef, editEditorRef,
    isMasterAdmin,
    fetchBugs, fetchWorkspaces,
    submitBug, updateStatus, saveNote, deleteNote, saveEdit, deleteBug, moveBugToAppChanges,
    execCmd, execCmdEdit, formatDate,
    toggleExpand, startEdit, cancelEdit, startNoteEdit, cancelNoteEdit,
  } = useBugs();

  useEffect(() => { fetchBugs(); }, [fetchBugs]);
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const bugCardProps = {
    isMasterAdmin, workspaces, userProfiles, expandedId, editingId,
    noteEditId, noteText, movedBugIds, movingId,
    editEditorRef: editEditorRef as React.RefObject<HTMLDivElement>,
    onToggleExpand: toggleExpand,
    onStartEdit: startEdit,
    onCancelEdit: cancelEdit,
    onSaveEdit: saveEdit,
    onDelete: deleteBug,
    onUpdateStatus: updateStatus,
    onStartNoteEdit: startNoteEdit,
    onCancelNoteEdit: cancelNoteEdit,
    onSaveNote: saveNote,
    onDeleteNote: deleteNote,
    onNoteTextChange: setNoteText,
    onMoveToBugChanges: moveBugToAppChanges,
    onExecCmdEdit: execCmdEdit,
    formatDate,
  };

  return (
    <DashboardLayout moduleName="Hlášení chyb">
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Nahlásit chybu</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Popište chybu nebo problém, který jste v aplikaci objevili
          </p>
        </div>

        {/* Formulář pro nový bug report */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nový report</h2>
          </div>
          <ToolbarButtons onCmd={execCmd} />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Popište chybu podrobně – co jste dělali, co se stalo a co jste očekávali..."
            className="prose prose-sm max-w-none p-4 focus:outline-none"
            style={{ color: 'var(--text-primary)', minHeight: '120px', cursor: 'text' }}
          />
          <div className="px-4 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
            {submitError ? (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{submitError}</p>
            ) : <span />}
            <button
              onClick={submitBug}
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {submitting ? 'Odesílám...' : 'Odeslat report'}
            </button>
          </div>
        </div>

        {/* Filtry – jen pro Master Admin */}
        {isMasterAdmin && (
          <div className="flex gap-3 flex-wrap items-center">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>FILTRY</span>
            <SelectWrap>
              <select
                value={workspaceFilter}
                onChange={(e) => setWorkspaceFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="all">Všechny workspace</option>
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </SelectWrap>
            <SelectWrap>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="all">Všechny stavy</option>
                <option value="open">Otevřeno</option>
                <option value="in_progress">Řeší se</option>
                <option value="solved">Vyřešeno</option>
              </select>
            </SelectWrap>
          </div>
        )}

        {/* Seznam reportů */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bugs.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <p className="text-sm">Zatím žádné reporty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myBugs.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>MOJE REPORTY</div>
                <div className="space-y-2">
                  {myBugs.map(bug => <BugCard key={bug.id} bug={bug} isOwn={true} {...bugCardProps} />)}
                </div>
              </div>
            )}
            {isMasterAdmin && otherBugs.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>OSTATNÍ REPORTY</div>
                <div className="space-y-2">
                  {otherBugs.map(bug => <BugCard key={bug.id} bug={bug} isOwn={false} {...bugCardProps} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .prose h2 { font-size: 1.1rem; font-weight: 700; margin: 1rem 0 0.3rem; color: var(--text-primary); }
        .prose h3 { font-size: 0.95rem; font-weight: 600; margin: 0.8rem 0 0.3rem; color: var(--text-primary); }
        .prose p { margin: 0.3rem 0; color: var(--text-secondary); line-height: 1.6; }
        .prose ul { margin: 0.3rem 0 0.3rem 1.5rem; list-style-type: disc; }
        .prose ol { margin: 0.3rem 0 0.3rem 1.5rem; list-style-type: decimal; }
        .prose li { margin: 0.15rem 0; color: var(--text-secondary); }
        .prose strong { font-weight: 700; color: var(--text-primary); }
        [contenteditable] { color: var(--text-primary); }
        [contenteditable] p { color: var(--text-primary); }
        [contenteditable] li { color: var(--text-primary); }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; }
      `}</style>
    </DashboardLayout>
  );
}
