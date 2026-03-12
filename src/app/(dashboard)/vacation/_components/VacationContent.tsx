'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useVacation } from './useVacation';
import { VacationStats } from './VacationStats';
import { VacationForm } from './VacationForm';
import { VacationRecordsTab } from './VacationRecordsTab';
import { VacationRequestsTab } from './VacationRequestsTab';
import { VacationArchiveTab } from './VacationArchiveTab';
import { RejectModal } from './RejectModal';
import { ActiveTab } from './types';
import { inputStyle } from './utils';

export function VacationContent() {
  const v = useVacation();

  // Vstupní stráž: bez nároku a bez admin/manager role
  if (!v.canUseVacation && !v.isWorkspaceAdmin && !v.isManager) {
    return (
      <DashboardLayout moduleName="Dovolená">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Dovolená</h1>
          <div className="rounded-xl border p-6 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              Nemáte nastaven nárok na dovolenou. Kontaktujte administrátora workspace.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isAddingForOther = v.isWorkspaceAdmin && v.formUserId && v.formUserId !== v.user?.id;
  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'records', label: 'Záznamy' },
    { key: 'requests', label: 'Žádosti' },
    { key: 'archive', label: 'Archiv' },
  ];

  return (
    <DashboardLayout moduleName="Dovolená">
      <div className="max-w-3xl">

        {/* Hlavička */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dovolená</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Přehled za rok {v.currentYear}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {v.isWorkspaceAdmin && v.allProfiles.length > 0 && v.activeTab === 'records' && (
              <div className="relative flex-shrink-0">
                <select
                  value={v.selectedUserId}
                  onChange={(e) => v.setSelectedUserId(e.target.value)}
                  className="pl-3 pr-8 py-2 rounded-lg border text-base sm:text-sm appearance-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="me">Moje dovolená</option>
                  <option value="all">Všichni</option>
                  {v.allProfiles.filter(p => p.id !== v.user?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            )}
            {(v.canUseVacation || v.isWorkspaceAdmin) && v.activeTab === 'records' && (
              <button
                onClick={() => v.setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ background: 'var(--primary)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="hidden sm:inline">Přidat dovolenou</span>
                <span className="sm:hidden">Přidat</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs: Záznamy / Žádosti / Archiv */}
        {v.canSeeRequests && (
          <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => v.setActiveTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: v.activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: v.activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: v.activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
                {tab.key === 'requests' && v.pendingRequestEntries.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'var(--danger)' }}
                  >
                    {v.pendingRequestEntries.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab: Záznamy ── */}
        {v.activeTab === 'records' && (
          <>
            <VacationStats
              usedDays={v.usedDays}
              totalDays={v.totalDays}
              remainingDays={v.remainingDays}
              currentYear={v.currentYear}
              isWorkspaceAdmin={v.isWorkspaceAdmin}
              selectedUserId={v.selectedUserId}
            />

            {v.showForm && (
              <VacationForm
                isWorkspaceAdmin={v.isWorkspaceAdmin}
                allProfiles={v.allProfiles}
                userId={v.user?.id ?? ''}
                formUserId={v.formUserId}
                setFormUserId={v.setFormUserId}
                formStartDate={v.formStartDate}
                setFormStartDate={v.setFormStartDate}
                formEndDate={v.formEndDate}
                setFormEndDate={v.setFormEndDate}
                computedDays={v.computedDays}
                willNeedApproval={v.willNeedApproval}
                formNote={v.formNote}
                setFormNote={v.setFormNote}
                saving={v.saving}
                onSubmit={v.addEntry}
                onCancel={() => {
                  v.setShowForm(false);
                  v.setFormStartDate('');
                  v.setFormEndDate('');
                  v.setFormNote('');
                }}
              />
            )}

            <VacationRecordsTab
              loading={v.loading}
              approvedEntries={v.approvedEntries}
              isWorkspaceAdmin={v.isWorkspaceAdmin}
              selectedUserId={v.selectedUserId}
              currentYear={v.currentYear}
              myPendingRejectedEntries={v.myPendingRejectedEntries}
              onDelete={v.deleteEntry}
            />
          </>
        )}

        {/* ── Tab: Žádosti ── */}
        {v.activeTab === 'requests' && (
          <VacationRequestsTab
            loading={v.loading}
            pendingRequestEntries={v.pendingRequestEntries}
            approving={v.approving}
            isWorkspaceAdmin={v.isWorkspaceAdmin}
            onApprove={v.approveEntry}
            onOpenRejectModal={(id) => v.setRejectModal({ id, note: '' })}
          />
        )}

        {/* ── Tab: Archiv ── */}
        {v.activeTab === 'archive' && (
          <VacationArchiveTab
            loading={v.loading}
            archiveEntries={v.archiveEntries}
            isWorkspaceAdmin={v.isWorkspaceAdmin}
          />
        )}
      </div>

      {/* Modal: Zamítnutí */}
      <RejectModal
        rejectModal={v.rejectModal}
        setRejectModal={v.setRejectModal}
        onReject={v.rejectEntry}
        rejecting={v.rejecting}
      />
    </DashboardLayout>
  );
}
