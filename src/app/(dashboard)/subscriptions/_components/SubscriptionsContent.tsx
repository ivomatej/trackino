'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useSubscriptions } from './useSubscriptions';
import { StatsDashboard } from './StatsDashboard';
import { SubsTabContent } from './SubsTabContent';
import { CategoriesTabContent } from './CategoriesTabContent';
import { AccessTabContent } from './AccessTabContent';
import { DetailModal } from './DetailModal';
import { SubFormModal } from './SubFormModal';
import { AccessModal } from './AccessModal';
import { ExtUserModal } from './ExtUserModal';
import { CatFormModal } from './CatFormModal';
import { ICONS, btnPrimary } from './constants';
import type { Tab } from './types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'subscriptions', label: 'Předplatná' },
  { id: 'tips', label: 'Tipy' },
  { id: 'categories', label: 'Kategorie' },
  { id: 'access', label: 'Přístupy' },
];

export function SubscriptionsContent() {
  const h = useSubscriptions();

  /* ── Loading ── */
  if (h.wsLoading || h.loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
      </DashboardLayout>
    );
  }

  /* ── Render ── */
  return (
    <DashboardLayout>
      <h1 className="text-xl font-bold mb-4 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
        Předplatná
      </h1>

      {/* Dashboard statistiky */}
      <StatsDashboard stats={h.stats} />

      {/* Záložky */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className="px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={{
              borderColor: h.activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: h.activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
            }}
            onClick={() => h.setActiveTab(t.id)}
          >
            {t.label}
            {t.id === 'tips' && h.subs.filter(s => s.is_tip).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                {h.subs.filter(s => s.is_tip).length}
              </span>
            )}
            {t.id === 'access' && h.accesses.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                {h.accesses.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tlačítka přidání */}
      {h.canManage ? (
        <div className="flex justify-end mt-3 mb-4 gap-2">
          {h.activeTab === 'access' && (
            <button
              className={`${btnPrimary} flex items-center gap-1.5`}
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              onClick={h.openNewExtUser}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              <span className="hidden sm:inline">Přidat externího uživatele</span>
              <span className="sm:hidden">Ext. uživatel</span>
            </button>
          )}
          <button
            className={`${btnPrimary} flex items-center gap-1.5`}
            style={{ background: 'var(--primary)' }}
            onClick={() => {
              if (h.activeTab === 'categories') h.openNewCat();
              else if (h.activeTab === 'access') h.openAccessModal();
              else h.openNew(h.activeTab === 'tips');
            }}
          >
            {ICONS.plus}
            <span className="hidden sm:inline">
              {h.activeTab === 'categories' ? 'Přidat kategorii'
                : h.activeTab === 'access' ? 'Přidat přístup'
                : h.activeTab === 'tips' ? 'Přidat tip'
                : 'Přidat předplatné'}
            </span>
            <span className="sm:hidden">Přidat</span>
          </button>
        </div>
      ) : (
        <div className="mb-4" />
      )}

      {/* TAB: Předplatná / Tipy */}
      {(h.activeTab === 'subscriptions' || h.activeTab === 'tips') && (
        <SubsTabContent
          displaySubs={h.displaySubs}
          categories={h.categories}
          rootCategories={h.rootCategories}
          getSubcategories={h.getSubcategories}
          avgRatings={h.avgRatings}
          myRatings={h.myRatings}
          searchQ={h.searchQ}
          setSearchQ={h.setSearchQ}
          filterStatus={h.filterStatus}
          setFilterStatus={h.setFilterStatus}
          filterCategory={h.filterCategory}
          setFilterCategory={h.setFilterCategory}
          filterType={h.filterType}
          setFilterType={h.setFilterType}
          sortField={h.sortField}
          sortDir={h.sortDir}
          toggleSort={h.toggleSort}
          setDetailSub={h.setDetailSub}
          setMyRating={h.setMyRating}
          openEdit={h.openEdit}
          deleteSub={h.deleteSub}
          canManage={h.canManage}
          activeTab={h.activeTab as 'subscriptions' | 'tips'}
          toCzk={h.toCzk}
        />
      )}

      {/* TAB: Kategorie */}
      {h.activeTab === 'categories' && (
        <CategoriesTabContent
          categories={h.categories}
          rootCategories={h.rootCategories}
          getSubcategories={h.getSubcategories}
          getCatCountWithSubs={h.getCatCountWithSubs}
          subs={h.subs}
          canManage={h.canManage}
          openNewCat={h.openNewCat}
          openEditCat={h.openEditCat}
          deleteCat={h.deleteCat}
        />
      )}

      {/* TAB: Přístupy */}
      {h.activeTab === 'access' && (
        <AccessTabContent
          subs={h.subs}
          accesses={h.accesses}
          externalUsers={h.externalUsers}
          members={h.members}
          accessView={h.accessView}
          setAccessView={h.setAccessView}
          accessSearch={h.accessSearch}
          setAccessSearch={h.setAccessSearch}
          accessSortField={h.accessSortField}
          accessSortDir={h.accessSortDir}
          toggleAccessSort={h.toggleAccessSort}
          canManage={h.canManage}
          toCzk={h.toCzk}
          getCostPerUser={h.getCostPerUser}
          getUserTotalCost={h.getUserTotalCost}
          getCatColor={h.getCatColor}
          getCatName={h.getCatName}
          getAccessUserName={h.getAccessUserName}
          openAccessModal={h.openAccessModal}
          removeAccess={h.removeAccess}
          openEditExtUser={h.openEditExtUser}
          deleteExtUser={h.deleteExtUser}
        />
      )}

      {/* ── Modaly ── */}

      {/* Detail předplatného */}
      {h.detailSub && (
        <DetailModal
          detailSub={h.detailSub}
          onClose={() => h.setDetailSub(null)}
          accesses={h.accesses}
          members={h.members}
          myRatings={h.myRatings}
          avgRatings={h.avgRatings}
          ratings={h.ratings}
          canManage={h.canManage}
          toCzk={h.toCzk}
          getCatColor={h.getCatColor}
          getCatName={h.getCatName}
          getMemberName={h.getMemberName}
          getAccessUserName={h.getAccessUserName}
          setMyRating={h.setMyRating}
          openEdit={h.openEdit}
          deleteSub={h.deleteSub}
          openAccessModal={h.openAccessModal}
          removeAccess={h.removeAccess}
        />
      )}

      {/* Formulář předplatného */}
      {h.modal && (
        <SubFormModal
          form={h.form}
          setForm={h.setForm}
          editing={!!h.editing}
          saving={h.saving}
          categories={h.categories}
          rootCategories={h.rootCategories}
          getSubcategories={h.getSubcategories}
          members={h.members}
          rates={h.rates}
          onClose={() => h.setModal(false)}
          onSave={h.saveSub}
        />
      )}

      {/* Formulář přístupu */}
      {h.accessModal && (
        <AccessModal
          accessForm={h.accessForm}
          setAccessForm={h.setAccessForm}
          subs={h.subs}
          members={h.members}
          externalUsers={h.externalUsers}
          saving={h.saving}
          onClose={() => h.setAccessModal(false)}
          onSave={h.saveAccess}
          openNewExtUser={h.openNewExtUser}
        />
      )}

      {/* Formulář externího uživatele */}
      {h.extUserModal && (
        <ExtUserModal
          extUserForm={h.extUserForm}
          setExtUserForm={h.setExtUserForm}
          editingExtUser={h.editingExtUser !== null}
          saving={h.saving}
          onClose={() => h.setExtUserModal(false)}
          onSave={h.saveExtUser}
        />
      )}

      {/* Formulář kategorie */}
      {h.catModal && (
        <CatFormModal
          catForm={h.catForm}
          setCatForm={h.setCatForm}
          editingCat={h.editingCat}
          rootCategories={h.rootCategories}
          onClose={() => h.setCatModal(false)}
          onSave={h.saveCat}
        />
      )}
    </DashboardLayout>
  );
}
