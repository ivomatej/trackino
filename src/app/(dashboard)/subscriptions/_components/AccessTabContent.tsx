'use client';

import type { Subscription, SubscriptionAccess, SubscriptionAccessUser } from '@/types/database';
import type { AccessView, AccessSortField, Member } from './types';
import { AccessByServiceView } from './AccessByServiceView';
import { AccessByUserView } from './AccessByUserView';
import { AccessSummaryView } from './AccessSummaryView';

interface AccessTabContentProps {
  subs: Subscription[];
  accesses: SubscriptionAccess[];
  externalUsers: SubscriptionAccessUser[];
  members: Member[];
  accessView: AccessView;
  setAccessView: (v: AccessView) => void;
  accessSearch: string;
  setAccessSearch: (v: string) => void;
  accessSortField: AccessSortField;
  accessSortDir: 'asc' | 'desc';
  toggleAccessSort: (field: AccessSortField) => void;
  canManage: boolean;
  toCzk: (price: number | null, currency: string) => number | null;
  getCostPerUser: (s: Subscription) => number;
  getUserTotalCost: (userId: string, isExternal: boolean) => number;
  getCatColor: (id: string) => string;
  getCatName: (id: string) => string;
  getAccessUserName: (a: SubscriptionAccess) => string;
  openAccessModal: (subId: string) => void;
  removeAccess: (id: string) => void;
  openEditExtUser: (u: SubscriptionAccessUser) => void;
  deleteExtUser: (u: SubscriptionAccessUser) => void;
}

const ACCESS_VIEWS: { id: AccessView; label: string }[] = [
  { id: 'by_service', label: 'Podle služby' },
  { id: 'by_user', label: 'Podle uživatele' },
  { id: 'summary', label: 'Souhrnný přehled' },
];

export function AccessTabContent({
  subs, accesses, externalUsers, members,
  accessView, setAccessView, accessSearch, setAccessSearch,
  accessSortField, accessSortDir, toggleAccessSort,
  canManage, toCzk, getCostPerUser, getUserTotalCost,
  getCatColor, getCatName, getAccessUserName,
  openAccessModal, removeAccess, openEditExtUser, deleteExtUser,
}: AccessTabContentProps) {
  const activeSubs = subs.filter(s => !s.is_tip);

  return (
    <>
      {/* Sub-přepínač pohledů */}
      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--bg-hover)' }}>
        {ACCESS_VIEWS.map(v => (
          <button
            key={v.id}
            className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-all text-center"
            style={{
              background: accessView === v.id ? 'var(--bg-card)' : 'transparent',
              color: accessView === v.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: accessView === v.id ? 'var(--shadow-sm)' : 'none',
            }}
            onClick={() => setAccessView(v.id)}
          >{v.label}</button>
        ))}
      </div>

      {accessView === 'by_service' && (
        <AccessByServiceView
          activeSubs={activeSubs}
          accesses={accesses}
          accessSearch={accessSearch}
          setAccessSearch={setAccessSearch}
          canManage={canManage}
          getCostPerUser={getCostPerUser}
          toCzk={toCzk}
          getCatColor={getCatColor}
          getAccessUserName={getAccessUserName}
          members={members}
          openAccessModal={openAccessModal}
          removeAccess={removeAccess}
        />
      )}

      {accessView === 'by_user' && (
        <AccessByUserView
          subs={subs}
          accesses={accesses}
          externalUsers={externalUsers}
          members={members}
          accessSearch={accessSearch}
          setAccessSearch={setAccessSearch}
          canManage={canManage}
          getCatColor={getCatColor}
          getUserTotalCost={getUserTotalCost}
          removeAccess={removeAccess}
          openEditExtUser={openEditExtUser}
          deleteExtUser={deleteExtUser}
        />
      )}

      {accessView === 'summary' && (
        <AccessSummaryView
          activeSubs={activeSubs}
          accesses={accesses}
          accessSearch={accessSearch}
          setAccessSearch={setAccessSearch}
          accessSortField={accessSortField}
          accessSortDir={accessSortDir}
          toggleAccessSort={toggleAccessSort}
          toCzk={toCzk}
          getCatColor={getCatColor}
          getCatName={getCatName}
        />
      )}
    </>
  );
}
