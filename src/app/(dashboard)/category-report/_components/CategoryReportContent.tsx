'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCategoryReport } from './useCategoryReport';
import { CategoryFilters } from './CategoryFilters';
import { SummaryBar } from './SummaryBar';
import { CategoryPieChart } from './CategoryPieChart';
import { CategoryBarChart } from './CategoryBarChart';
import { CategoryTable } from './CategoryTable';

export function CategoryReportContent() {
  const { loading, currentWorkspace } = useWorkspace();
  const {
    preset, from, to, today,
    stats, loadingData,
    totalSeconds, totalCount,
    selectedUserId, members,
    canAdmin, isManager,
    setFrom, setTo, setSelectedUserId,
    applyPreset,
  } = useCategoryReport();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentWorkspace) return <WorkspaceSelector />;

  return (
    <DashboardLayout moduleName="Analýza kategorií">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analýza kategorií</h1>
        </div>

        {/* Filters */}
        <CategoryFilters
          preset={preset}
          from={from}
          to={to}
          today={today}
          selectedUserId={selectedUserId}
          members={members}
          canAdmin={canAdmin}
          isManager={isManager}
          onPresetChange={applyPreset}
          onFromChange={setFrom}
          onToChange={setTo}
          onUserChange={setSelectedUserId}
        />

        {/* Summary bar */}
        {!loadingData && stats.length > 0 && (
          <SummaryBar
            totalSeconds={totalSeconds}
            totalCount={totalCount}
            categoryCount={stats.length}
          />
        )}

        {/* Loading / empty / charts */}
        {loadingData ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné záznamy pro vybrané období.</p>
          </div>
        ) : (
          <>
            <CategoryPieChart stats={stats} totalSeconds={totalSeconds} />
            <CategoryBarChart stats={stats} />
            <CategoryTable stats={stats} totalSeconds={totalSeconds} totalCount={totalCount} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
