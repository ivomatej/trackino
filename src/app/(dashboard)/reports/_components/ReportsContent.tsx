'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useReports } from './useReports';
import { ManualEntryForm } from './ManualEntryForm';
import { ReportsFilters } from './ReportsFilters';
import { ReportsSummary } from './ReportsSummary';
import { ReportsEntryList } from './ReportsEntryList';

export function ReportsContent() {
  const r = useReports();

  return (
    <DashboardLayout moduleName="Reporty">
      <div className="max-w-5xl space-y-6">
        {/* Záhlaví */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reporty</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Přehled odpracovaného času s filtry a ručním zadáváním
            </p>
          </div>
          {r.canManualEntry && (
            <button
              onClick={() => r.setShowManual(!r.showManual)}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{ background: 'var(--primary)', color: 'white' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Přidat záznam
            </button>
          )}
        </div>

        {/* Formulář ručního zadání */}
        {r.showManual && r.canManualEntry && (
          <ManualEntryForm
            user={r.user}
            projects={r.projects}
            categories={r.categories}
            tasks={r.tasks}
            members={r.members}
            canSeeOthers={r.canSeeOthers}
            manualDate={r.manualDate}
            setManualDate={r.setManualDate}
            manualStart={r.manualStart}
            setManualStart={r.setManualStart}
            manualEnd={r.manualEnd}
            setManualEnd={r.setManualEnd}
            manualProject={r.manualProject}
            setManualProject={r.setManualProject}
            manualCategory={r.manualCategory}
            setManualCategory={r.setManualCategory}
            manualTask={r.manualTask}
            setManualTask={r.setManualTask}
            manualDesc={r.manualDesc}
            setManualDesc={r.setManualDesc}
            manualForUser={r.manualForUser}
            setManualForUser={r.setManualForUser}
            manualSaving={r.manualSaving}
            manualError={r.manualError}
            saveManual={r.saveManual}
            onClose={() => r.setShowManual(false)}
          />
        )}

        {/* Filtry */}
        <ReportsFilters
          preset={r.preset}
          setPreset={r.setPreset}
          customFrom={r.customFrom}
          setCustomFrom={r.setCustomFrom}
          customTo={r.customTo}
          setCustomTo={r.setCustomTo}
          userFilter={r.userFilter}
          setUserFilter={r.setUserFilter}
          projectFilter={r.projectFilter}
          setProjectFilter={r.setProjectFilter}
          canSeeOthers={r.canSeeOthers}
          user={r.user}
          members={r.members}
          projects={r.projects}
        />

        {/* Souhrn + per-user stats */}
        <ReportsSummary
          totalSeconds={r.totalSeconds}
          totalCost={r.totalCost}
          hasCosts={r.hasCosts}
          currencySymbol={r.currencySymbol}
          entriesCount={r.entries.length}
          sortedDaysCount={r.sortedDays.length}
          perUserStats={r.perUserStats}
          canSeeOthers={r.canSeeOthers}
          loading={r.loading}
          memberName={r.memberName}
        />

        {/* Záznamy */}
        <ReportsEntryList
          loading={r.loading}
          entries={r.entries}
          sortedDays={r.sortedDays}
          groupedEntries={r.groupedEntries}
          canManageNotes={r.canManageNotes}
          canSeeOthers={r.canSeeOthers}
          userFilter={r.userFilter}
          user={r.user}
          projects={r.projects}
          currencySymbol={r.currencySymbol}
          editingNoteId={r.editingNoteId}
          setEditingNoteId={r.setEditingNoteId}
          noteText={r.noteText}
          setNoteText={r.setNoteText}
          savingNoteId={r.savingNoteId}
          saveNote={r.saveNote}
          deleteEntry={r.deleteEntry}
          categoryName={r.categoryName}
          taskName={r.taskName}
          memberName={r.memberName}
          getEntryRate={r.getEntryRate}
        />
      </div>
    </DashboardLayout>
  );
}
