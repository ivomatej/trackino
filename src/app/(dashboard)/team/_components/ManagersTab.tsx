'use client';

import type { MemberWithProfile, ManagerAssignmentRow } from './types';
import { ROLE_LABELS } from './types';

interface Props {
  isWorkspaceAdmin: boolean;
  isMasterAdmin: boolean;
  loading: boolean;
  savingAssignment: boolean;
  members: MemberWithProfile[];
  wsManagerAssignments: ManagerAssignmentRow[];
  toggleManagerAssignment: (memberUserId: string, managerUserId: string) => void;
}

export default function ManagersTab({
  isWorkspaceAdmin, isMasterAdmin, loading, savingAssignment,
  members, wsManagerAssignments, toggleManagerAssignment,
}: Props) {
  if (!isWorkspaceAdmin) return null;

  const eligibleMembers = members.filter(
    m => m.approved && m.role !== 'owner' && (isMasterAdmin || !m.profile?.is_master_admin)
  );

  return (
    <div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Kliknutím na manažera ho přiřadíte nebo odeberete. Každý člen může mít více manažerů.
      </p>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : eligibleMembers.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádní členové.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eligibleMembers.map(member => {
            const p = member.profile;
            const initials = p?.display_name
              ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
              : '?';
            const assignedManagerIds = wsManagerAssignments
              .filter(a => a.member_user_id === member.user_id)
              .map(a => a.manager_user_id);
            const availableManagers = members.filter(
              m2 => m2.approved && m2.user_id !== member.user_id && (m2.role === 'manager' || m2.role === 'admin')
            );

            return (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 rounded-xl border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                {/* Avatar + jméno */}
                <div className="flex items-center gap-3 min-w-0 sm:w-52 sm:flex-shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: p?.avatar_color ?? 'var(--primary)' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {p?.display_name ?? 'Neznámý'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </div>
                  </div>
                </div>

                {/* Oddělovač – jen na desktopu */}
                <div className="hidden sm:block w-px self-stretch" style={{ background: 'var(--border)' }} />

                {/* Manažeři */}
                <div className="flex flex-wrap gap-2 flex-1">
                  {availableManagers.length === 0 ? (
                    <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      Žádní manažeři k dispozici
                    </span>
                  ) : (
                    availableManagers.map(mgr => {
                      const mgrProfile = mgr.profile;
                      const isAssigned = assignedManagerIds.includes(mgr.user_id);
                      return (
                        <button
                          key={mgr.user_id}
                          onClick={() => toggleManagerAssignment(member.user_id, mgr.user_id)}
                          disabled={savingAssignment}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50"
                          style={{
                            background: isAssigned ? 'var(--primary)' : 'var(--bg-hover)',
                            borderColor: isAssigned ? 'var(--primary)' : 'var(--border)',
                            color: isAssigned ? '#fff' : 'var(--text-secondary)',
                          }}
                          title={isAssigned ? 'Kliknutím odeberete manažera' : 'Kliknutím přiřadíte manažera'}
                        >
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{
                              background: isAssigned ? 'rgba(255,255,255,0.25)' : (mgrProfile?.avatar_color ?? 'var(--primary)'),
                              color: '#fff',
                            }}
                          >
                            {mgrProfile?.display_name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          {mgrProfile?.display_name ?? 'Neznámý'}
                          {isAssigned && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
