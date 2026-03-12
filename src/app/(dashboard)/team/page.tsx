'use client';

import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useTeam } from './_components/useTeam';
import MembersTab from './_components/MembersTab';
import StructureTab from './_components/StructureTab';
import ManagersTab from './_components/ManagersTab';
import EditMemberModal from './_components/EditMemberModal';

function TeamContent() {
  const t = useTeam();
  if (!t.currentWorkspace) return null;

  return (
    <DashboardLayout moduleName="Tým">
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Tým & Struktura</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Členové, oddělení, kategorie a úkoly
            </p>
          </div>
        </div>

        {/* Taby */}
        <div className="relative mb-6">
          <div
            className="flex gap-1 rounded-lg p-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ background: 'var(--bg-hover)' }}
          >
            {t.tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { t.setActiveTab(tab.key); t.resetForm(); }}
                className="flex-shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                style={{
                  background: t.activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: t.activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: t.activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
                <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{tab.count}</span>
              </button>
            ))}
          </div>
          {/* Gradient indikátor scrollu doprava */}
          <div
            className="absolute right-1 top-1 bottom-1 w-8 pointer-events-none rounded-r-lg"
            style={{ background: 'linear-gradient(to right, transparent, var(--bg-hover))' }}
          />
        </div>

        {/* Tab: Členové */}
        {t.activeTab === 'members' && (
          <MembersTab
            isWorkspaceAdmin={t.isWorkspaceAdmin}
            currentWorkspace={t.currentWorkspace}
            members={t.members}
            loading={t.loading}
            memberSearch={t.memberSearch}
            setMemberSearch={t.setMemberSearch}
            memberSort={t.memberSort}
            setMemberSort={t.setMemberSort}
            codeCopied={t.codeCopied}
            regenerating={t.regenerating}
            copiedEmailId={t.copiedEmailId}
            copiedPhoneId={t.copiedPhoneId}
            copyEmail={t.copyEmail}
            copyPhone={t.copyPhone}
            copyJoinCode={t.copyJoinCode}
            regenerateJoinCode={t.regenerateJoinCode}
            isMasterAdmin={t.isMasterAdmin}
            isManager={t.isManager}
            isManagerOf={t.isManagerOf}
            activeRates={t.activeRates}
            currencySymbol={t.currencySymbol}
            cooperationTypes={t.cooperationTypes}
            openEditMember={t.openEditMember}
            removeMember={t.removeMember}
            updateMemberRole={t.updateMemberRole}
            approveMember={t.approveMember}
            rejectMember={t.rejectMember}
            user={t.user}
          />
        )}

        {/* Tab: Oddělení / Kategorie / Úkoly */}
        {t.activeTab !== 'members' && t.activeTab !== 'managers' && (
          <StructureTab
            isWorkspaceAdmin={t.isWorkspaceAdmin}
            activeTab={t.activeTab}
            showForm={t.showForm}
            setShowForm={t.setShowForm}
            formName={t.formName}
            setFormName={t.setFormName}
            formDepartment={t.formDepartment}
            setFormDepartment={t.setFormDepartment}
            formProject={t.formProject}
            setFormProject={t.setFormProject}
            formCategory={t.formCategory}
            setFormCategory={t.setFormCategory}
            saving={t.saving}
            loading={t.loading}
            departments={t.departments}
            categories={t.categories}
            tasks={t.tasks}
            projects={t.projects}
            saveItem={t.saveItem}
            resetForm={t.resetForm}
            deleteItem={t.deleteItem}
            tabLabels={t.tabLabels}
          />
        )}

        {/* Tab: Manažeři */}
        {t.activeTab === 'managers' && (
          <ManagersTab
            isWorkspaceAdmin={t.isWorkspaceAdmin}
            isMasterAdmin={t.isMasterAdmin}
            loading={t.loading}
            savingAssignment={t.savingAssignment}
            members={t.members}
            wsManagerAssignments={t.wsManagerAssignments}
            toggleManagerAssignment={t.toggleManagerAssignment}
          />
        )}
      </div>

      {/* Edit member modal */}
      <EditMemberModal
        editingMember={t.editingMember}
        setEditingMember={t.setEditingMember}
        editName={t.editName} setEditName={t.setEditName}
        editEmail={t.editEmail} setEditEmail={t.setEditEmail}
        editPhone={t.editPhone} setEditPhone={t.setEditPhone}
        editPosition={t.editPosition} setEditPosition={t.setEditPosition}
        editBirthDate={t.editBirthDate} setEditBirthDate={t.setEditBirthDate}
        editColor={t.editColor} setEditColor={t.setEditColor}
        editInitials={t.editInitials}
        editSaving={t.editSaving}
        saveMemberEdit={t.saveMemberEdit}
        editCanUseVacation={t.editCanUseVacation} setEditCanUseVacation={t.setEditCanUseVacation}
        editCanInvoice={t.editCanInvoice} setEditCanInvoice={t.setEditCanInvoice}
        editCanManageBilling={t.editCanManageBilling} setEditCanManageBilling={t.setEditCanManageBilling}
        editCanViewAudit={t.editCanViewAudit} setEditCanViewAudit={t.setEditCanViewAudit}
        editCanProcessRequests={t.editCanProcessRequests} setEditCanProcessRequests={t.setEditCanProcessRequests}
        editCanReceiveFeedback={t.editCanReceiveFeedback} setEditCanReceiveFeedback={t.setEditCanReceiveFeedback}
        editCanManageDocuments={t.editCanManageDocuments} setEditCanManageDocuments={t.setEditCanManageDocuments}
        editCanManageSubscriptions={t.editCanManageSubscriptions} setEditCanManageSubscriptions={t.setEditCanManageSubscriptions}
        editCanManageDomains={t.editCanManageDomains} setEditCanManageDomains={t.setEditCanManageDomains}
        editCanManageTasks={t.editCanManageTasks} setEditCanManageTasks={t.setEditCanManageTasks}
        editCanViewBirthdays={t.editCanViewBirthdays} setEditCanViewBirthdays={t.setEditCanViewBirthdays}
        editCooperationTypeId={t.editCooperationTypeId} setEditCooperationTypeId={t.setEditCooperationTypeId}
        editBillingProfileId={t.editBillingProfileId} setEditBillingProfileId={t.setEditBillingProfileId}
        cooperationTypes={t.cooperationTypes}
        billingProfiles={t.billingProfiles}
        memberRates={t.memberRates}
        ratesLoading={t.ratesLoading}
        showAddRate={t.showAddRate} setShowAddRate={t.setShowAddRate}
        newRateAmount={t.newRateAmount} setNewRateAmount={t.setNewRateAmount}
        newRateFrom={t.newRateFrom} setNewRateFrom={t.setNewRateFrom}
        addingRate={t.addingRate}
        addMemberRate={t.addMemberRate}
        deleteMemberRate={t.deleteMemberRate}
        rateValidToEdits={t.rateValidToEdits}
        setRateValidToEdits={t.setRateValidToEdits}
        savingRateId={t.savingRateId}
        saveRateValidTo={t.saveRateValidTo}
        currencySymbol={t.currencySymbol}
      />
    </DashboardLayout>
  );
}

export default function TeamPage() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <WorkspaceProvider>
      <TeamContent />
    </WorkspaceProvider>
  );
}
