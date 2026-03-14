'use client';

import { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { ICONS } from './constants';
import { useDomains } from './useDomains';
import { DomainsTabContent } from './DomainsTabContent';
import { RegistrarsTabContent } from './RegistrarsTabContent';
import { DomainCheckerTab } from './DomainCheckerTab';
import { DomainMonitoringTab } from './DomainMonitoringTab';
import { DomainFormModal } from './DomainFormModal';
import { RegistrarFormModal } from './RegistrarFormModal';
import { DomainDetailModal } from './DomainDetailModal';
import type { TabType } from './types';

// ─── Ikony pro Openprovider sekci ─────────────────────────────────────────────
const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const XCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
const SyncIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

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
    // monitoring
    monitoringList, checkHistory, loadingMonitoring,
    fetchMonitoring, addToMonitoring, deleteMonitoring, checkMonitoringNow,
    deleteHistoryEntry, deleteHistoryEntries, clearHistory,
    // checker
    checkerResults, setCheckerResults, checkDomains,
    // openprovider
    openproviderConfigured, fetchOpenproviderStatus,
    // subreg
    subregConfigured, fetchSubregStatus,
    // geos
    geos,
  } = useDomains();

  // Načíst Openprovider + Subreg status při prvním renderu
  useEffect(() => {
    fetchOpenproviderStatus();
    fetchSubregStatus();
  }, [fetchOpenproviderStatus, fetchSubregStatus]);

  // Synchronizace domén z Openprovider
  const handleSync = async () => {
    try {
      const res = await fetch('/api/openprovider/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Synchronizace dokončena: ${data.synced ?? 0} domén synchronizováno`);
      } else {
        alert(data.error ?? 'Chyba synchronizace');
      }
    } catch {
      alert('Chyba při synchronizaci');
    }
  };

  if (wsLoading || loading) {
    return (
      <DashboardLayout moduleName="Evidence domén">
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const TABS: { id: TabType; label: string }[] = [
    { id: 'domains', label: 'Domény' },
    { id: 'registrars', label: 'Registrátoři' },
    { id: 'checker', label: 'Kontrola dostupnosti' },
    { id: 'monitoring', label: 'Monitoring' },
  ];

  return (
    <DashboardLayout moduleName="Evidence domén">
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
          {canManage && activeTab === 'domains' && (
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
        <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 text-sm font-medium transition-colors relative flex-shrink-0"
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
              {tab.id === 'monitoring' && monitoringList.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{monitoringList.length}</span>
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
          <div className="space-y-6">
            <RegistrarsTabContent
              registrars={registrars}
              domains={domains}
              canManage={canManage}
              onNewReg={openNewReg}
              onEditReg={openEditReg}
              onDeleteReg={deleteRegistrar}
            />

            {/* ── Openprovider API sekce ── */}
            <div className="rounded-xl border p-5 space-y-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Openprovider API
              </h3>

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                {openproviderConfigured === null && (
                  <span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {openproviderConfigured === true && (
                  <>
                    <span style={{ color: '#22c55e' }}><CheckCircleIcon /></span>
                    <span style={{ color: '#166534' }}>Připojeno</span>
                  </>
                )}
                {openproviderConfigured === false && (
                  <>
                    <span style={{ color: '#ef4444' }}><XCircleIcon /></span>
                    <span style={{ color: '#991b1b' }}>Nepřipojeno</span>
                  </>
                )}
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Přihlašovací údaje jsou konfigurovány přes prostředí serveru (env vars: OPENPROVIDER_USERNAME, OPENPROVIDER_PASSWORD).
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={fetchOpenproviderStatus}
                  className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                >
                  <SyncIcon /> Testovat připojení
                </button>
              </div>

              {/* Synchronizace */}
              <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Synchronizace domén</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Synchronizuje domény z Openprovider do lokální cache pro rychlé zobrazení.
                </p>
                {canManage && (
                  <button
                    onClick={handleSync}
                    className="px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                    style={{ background: 'var(--primary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                  >
                    <SyncIcon /> Synchronizovat domény z Openprovider
                  </button>
                )}
              </div>
            </div>

            {/* ── Subreg.cz API sekce ── */}
            <div className="rounded-xl border p-5 space-y-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Subreg.cz API
              </h3>

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                {subregConfigured === null && (
                  <span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin inline-block" />
                )}
                {subregConfigured === true && (
                  <>
                    <span style={{ color: '#22c55e' }}><CheckCircleIcon /></span>
                    <span style={{ color: '#166534' }}>Připojeno</span>
                  </>
                )}
                {subregConfigured === false && (
                  <>
                    <span style={{ color: '#ef4444' }}><XCircleIcon /></span>
                    <span style={{ color: '#991b1b' }}>Nepřipojeno</span>
                  </>
                )}
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Záložní zdroj pro ověření dostupnosti domén. Přihlašovací údaje jsou konfigurovány přes prostředí serveru (env vars: SUBREG_LOGIN, SUBREG_PASSWORD).
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={fetchSubregStatus}
                  className="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                >
                  <SyncIcon /> Testovat připojení
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Kontrola dostupnosti ── */}
        {activeTab === 'checker' && (
          <DomainCheckerTab
            openproviderConfigured={openproviderConfigured}
            subregConfigured={subregConfigured}
            checkerResults={checkerResults}
            setCheckerResults={setCheckerResults}
            checkDomains={checkDomains}
            onAddToMonitoring={name => addToMonitoring(name, 'daily')}
            monitoringList={monitoringList}
            canManage={canManage}
          />
        )}

        {/* ── Tab: Monitoring ── */}
        {activeTab === 'monitoring' && (
          <DomainMonitoringTab
            monitoringList={monitoringList}
            checkHistory={checkHistory}
            loadingMonitoring={loadingMonitoring}
            canManage={canManage}
            openproviderConfigured={openproviderConfigured}
            onFetchMonitoring={fetchMonitoring}
            onAddToMonitoring={addToMonitoring}
            onDeleteMonitoring={deleteMonitoring}
            onCheckNow={checkMonitoringNow}
            onDeleteHistoryEntry={deleteHistoryEntry}
            onDeleteHistoryEntries={deleteHistoryEntries}
            onClearHistory={clearHistory}
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
        geos={geos}
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
        geos={geos}
      />
    </DashboardLayout>
  );
}
