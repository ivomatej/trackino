'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useAppChanges } from './useAppChanges';
import { AppChangeItem } from './AppChangeItem';
import { AppChangeFormModal } from './AppChangeFormModal';
import { inputStyle } from './utils';

export function AppChangesContent() {
  const {
    authLoading, user, profile, isMasterAdmin,
    loading, filtered, tabs,
    search, setSearch,
    filterTab, setFilterTab,
    expandedId, setExpandedId,
    selectedIds, toggleSelectAll, toggleSelect,
    showForm, setShowForm,
    editingItem, form, setForm, saving, formError,
    descTextareaRef,
    openAdd, openEdit, saveItem,
    archiveItem, restoreItem, permanentDeleteOne, permanentDeleteSelected, changeStatus,
  } = useAppChanges();

  const isArchiveTab = filterTab === 'archived';

  // Loading – čekáme na auth
  if (authLoading || !user || profile === null) {
    return (
      <DashboardLayout moduleName="Úpravy aplikace">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isMasterAdmin) return null;

  return (
    <DashboardLayout moduleName="Úpravy aplikace">
      <div className="max-w-4xl">

        {/* Hlavička */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Úpravy aplikace</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Evidence nápadů, požadavků a bugů na rozvoj aplikace
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Přidat
          </button>
        </div>

        {/* Vyhledávání + Záložky */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Hledat v úkolech..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-hover)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0"
                style={{
                  background: filterTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: filterTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: filterTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.key === 'archived' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                )}
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: filterTab === tab.key ? (tab.key === 'archived' ? '#6b7280' : 'var(--primary)') : 'var(--border)',
                    color: filterTab === tab.key ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Archiv – panel hromadných akcí */}
        {isArchiveTab && filtered.length > 0 && (
          <div
            className="mb-3 px-4 py-2.5 rounded-xl border flex items-center justify-between gap-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)]"
              />
              {selectedIds.size === 0
                ? 'Označit vše'
                : `Vybráno ${selectedIds.size} z ${filtered.length}`}
            </label>
            {selectedIds.size > 0 && (
              <button
                onClick={permanentDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ background: 'var(--danger)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
                Trvale smazat ({selectedIds.size})
              </button>
            )}
          </div>
        )}

        {/* Seznam položek */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            {isArchiveTab ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                <p className="text-sm">Archiv je prázdný.</p>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <p className="text-sm">
                  {search ? 'Žádné výsledky pro hledaný výraz.' : 'Žádné položky v této kategorii.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <AppChangeItem
                key={item.id}
                item={item}
                isArchiveTab={isArchiveTab}
                expandedId={expandedId}
                selectedIds={selectedIds}
                setExpandedId={setExpandedId}
                toggleSelect={toggleSelect}
                openEdit={openEdit}
                archiveItem={archiveItem}
                restoreItem={restoreItem}
                permanentDeleteOne={permanentDeleteOne}
                changeStatus={changeStatus}
              />
            ))}
          </div>
        )}

        {/* Modal: Přidat / Upravit */}
        <AppChangeFormModal
          showForm={showForm}
          editingItem={editingItem}
          form={form}
          setForm={setForm}
          formError={formError}
          saving={saving}
          descTextareaRef={descTextareaRef}
          onClose={() => setShowForm(false)}
          onSave={saveItem}
        />
      </div>
    </DashboardLayout>
  );
}
