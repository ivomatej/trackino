'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { ICONS } from './constants';
import { useDomains } from './useDomains';
import { DomainsTabContent } from './DomainsTabContent';
import { RegistrarsTabContent } from './RegistrarsTabContent';
import { DomainFormModal } from './DomainFormModal';
import { RegistrarFormModal } from './RegistrarFormModal';
import { DomainDetailModal } from './DomainDetailModal';
import type { TabType } from './types';

export function DomainsContent() {
  const {
    loading, wsLoading,
    domains, registrars, subscriptions,
    activeTab, setActiveTab,
    searchQ, setSearchQ,
    filterStatus, setFilterStatus,
    filterCompany, setFilterCompany,
    filterRegistrar, setFilterRegistrar,
    companies, registrarNames,
    sortField, sortDir, toggleSort,
    filteredDomains, stats,
    canManage, hasSubscriptionsModule,
    message,
    modal, setModal, editing, saving, form, setForm,
    openNew, openEdit, saveDomain,
    deleteDomain,
    regModal, setRegModal, editingReg, savingReg, regForm, setRegForm,
    openNewReg, openEditReg, saveRegistrar, deleteRegistrar,
    detailDomain, setDetailDomain,
    getSubName,
  } = useDomains();

  if (wsLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Message banner ── */}
        {message && (
          <div className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: message.type === 'success' ? '#16a34a' : '#ef4444',
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
            }}>
            {message.text}
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Evidence domén</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Správa a evidence firemních domén</p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2 self-start">
              <button
                onClick={openNew}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
              >
                {ICONS.plus} Přidat doménu
              </button>
            </div>
          )}
        </div>

        {/* ── Záložky ── */}
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
          {([
            { id: 'domains' as TabType, label: 'Domény' },
            { id: 'registrars' as TabType, label: 'Registrátoři' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 text-sm font-medium transition-colors relative"
              style={{
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {tab.id === 'registrars' && registrars.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{registrars.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Domény ── */}
        {activeTab === 'domains' && (
          <DomainsTabContent
            filteredDomains={filteredDomains}
            domains={domains}
            stats={stats}
            searchQ={searchQ}
            setSearchQ={setSearchQ}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterCompany={filterCompany}
            setFilterCompany={setFilterCompany}
            filterRegistrar={filterRegistrar}
            setFilterRegistrar={setFilterRegistrar}
            companies={companies}
            registrarNames={registrarNames}
            sortField={sortField}
            sortDir={sortDir}
            toggleSort={toggleSort}
            canManage={canManage}
            onOpenEdit={openEdit}
            onDelete={deleteDomain}
            onDetail={d => setDetailDomain(d)}
          />
        )}

        {/* ── Tab: Registrátoři ── */}
        {activeTab === 'registrars' && (
          <RegistrarsTabContent
            registrars={registrars}
            domains={domains}
            canManage={canManage}
            onNewReg={openNewReg}
            onEditReg={openEditReg}
            onDeleteReg={deleteRegistrar}
          />
        )}
      </div>

      {/* ── Modály ── */}
      <DomainFormModal
        modal={modal}
        editing={editing}
        saving={saving}
        form={form}
        setForm={setForm}
        onClose={() => setModal(false)}
        onSave={saveDomain}
        registrars={registrars}
        subscriptions={subscriptions}
        hasSubscriptionsModule={hasSubscriptionsModule}
        canManage={canManage}
        onNewRegistrar={() => { setModal(false); openNewReg(); }}
      />

      <RegistrarFormModal
        regModal={regModal}
        editingReg={editingReg}
        savingReg={savingReg}
        regForm={regForm}
        setRegForm={setRegForm}
        onClose={() => setRegModal(false)}
        onSave={saveRegistrar}
      />

      <DomainDetailModal
        detailDomain={detailDomain}
        onClose={() => setDetailDomain(null)}
        onEdit={openEdit}
        canManage={canManage}
        getSubName={getSubName}
      />
    </DashboardLayout>
  );
}
