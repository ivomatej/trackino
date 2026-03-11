'use client';

import type { CooperationType, UserRole } from '@/types/database';
import { formatPhone } from '@/lib/utils';
import type { MemberWithProfile } from './types';
import { ROLE_LABELS, ROLE_ORDER, TrashIcon, inputStyle } from './types';

interface Props {
  isWorkspaceAdmin: boolean;
  currentWorkspace: { join_code?: string | null; currency?: string | null };
  members: MemberWithProfile[];
  loading: boolean;
  memberSearch: string;
  setMemberSearch: (v: string) => void;
  memberSort: 'role' | 'name_asc' | 'name_desc';
  setMemberSort: (v: 'role' | 'name_asc' | 'name_desc') => void;
  codeCopied: boolean;
  regenerating: boolean;
  copiedEmailId: string | null;
  copiedPhoneId: string | null;
  copyEmail: (id: string, email: string) => void;
  copyPhone: (id: string, phone: string) => void;
  copyJoinCode: () => void;
  regenerateJoinCode: () => void;
  isMasterAdmin: boolean;
  isManager: boolean;
  isManagerOf: (userId: string) => boolean;
  activeRates: Record<string, number>;
  currencySymbol: string;
  cooperationTypes: CooperationType[];
  openEditMember: (member: MemberWithProfile) => void;
  removeMember: (id: string, name: string) => void;
  updateMemberRole: (id: string, role: UserRole) => void;
  approveMember: (id: string) => void;
  rejectMember: (id: string, name: string) => void;
  user: { id: string } | null;
}

export default function MembersTab({
  isWorkspaceAdmin, currentWorkspace, members, loading,
  memberSearch, setMemberSearch, memberSort, setMemberSort,
  codeCopied, regenerating, copiedEmailId, copiedPhoneId,
  copyEmail, copyPhone, copyJoinCode, regenerateJoinCode,
  isMasterAdmin, isManager, isManagerOf,
  activeRates, currencySymbol, cooperationTypes,
  openEditMember, removeMember, updateMemberRole, approveMember, rejectMember,
  user,
}: Props) {

  const approvedMembers = members.filter(
    m => m.approved && (isMasterAdmin || !m.profile?.is_master_admin)
  );

  const filteredSortedMembers = approvedMembers
    .filter(m =>
      !memberSearch.trim() ||
      m.profile?.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.profile?.email?.toLowerCase().includes(memberSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (memberSort === 'name_asc') return (a.profile?.display_name ?? '').localeCompare(b.profile?.display_name ?? '', 'cs');
      if (memberSort === 'name_desc') return (b.profile?.display_name ?? '').localeCompare(a.profile?.display_name ?? '', 'cs');
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return (a.profile?.display_name ?? '').localeCompare(b.profile?.display_name ?? '', 'cs');
    });

  return (
    <>
      {/* Kód pro připojení */}
      {isWorkspaceAdmin && currentWorkspace.join_code && (
        <div className="mb-6 p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Kód pro připojení</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Sdílejte tento kód s novými členy. Zadají ho při registraci.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 px-4 py-3 rounded-lg border font-mono text-2xl font-bold text-center select-all"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--primary)', letterSpacing: '0.3em' }}
            >
              {currentWorkspace.join_code}
            </div>
            <button
              onClick={copyJoinCode}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                borderColor: codeCopied ? 'var(--success)' : 'var(--border)',
                background: 'var(--bg-hover)',
                color: codeCopied ? 'var(--success)' : 'var(--text-secondary)',
              }}
            >
              {codeCopied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Zkopírováno
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Kopírovat
                </>
              )}
            </button>
          </div>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Jak to funguje:</strong>{' '}
              Nový člen se zaregistruje a zadá tento kód. Po registraci se objeví níže jako čekající – admin ho schválí.
            </p>
            <button
              onClick={regenerateJoinCode}
              disabled={regenerating}
              className="mt-2 text-[11px] transition-colors disabled:opacity-50"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {regenerating ? 'Generuji...' : '↻ Vygenerovat nový kód (zneplatní starý)'}
            </button>
          </div>
        </div>
      )}

      {/* Vyhledávání a řazení */}
      {!loading && approvedMembers.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--text-muted)' }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Hledat člena..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            {memberSearch && (
              <button
                onClick={() => setMemberSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-muted)' }}
                title="Vymazat hledání"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-xs mr-0.5" style={{ color: 'var(--text-muted)' }}>Řadit:</span>
            {([
              { key: 'role' as const, label: 'Práva' },
              { key: 'name_asc' as const, label: 'A → Z' },
              { key: 'name_desc' as const, label: 'Z → A' },
            ] as const).map(s => (
              <button
                key={s.key}
                onClick={() => setMemberSort(s.key)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: memberSort === s.key ? 'var(--primary)' : 'var(--bg-card)',
                  color: memberSort === s.key ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${memberSort === s.key ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Čekající na schválení */}
          {isWorkspaceAdmin && members.some(m => !m.approved) && (
            <div className="mb-4 rounded-xl border overflow-hidden" style={{ borderColor: '#f59e0b' }}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#fffbeb', borderBottom: '1px solid #f59e0b' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#92400e' }}>
                  Čeká na schválení
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'var(--danger)' }}
                  >
                    {members.filter(m => !m.approved).length}
                  </span>
                </span>
              </div>
              <div style={{ background: 'var(--bg-card)' }}>
                {members.filter(m => !m.approved).map(member => {
                  const p = member.profile;
                  const initials = p?.display_name ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
                  return (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 opacity-60" style={{ background: p?.avatar_color ?? '#94a3b8' }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p?.display_name ?? 'Neznámý'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{p?.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => rejectMember(member.id, p?.display_name ?? '')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                          style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-light)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          Zamítnout
                        </button>
                        <button
                          onClick={() => approveMember(member.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          style={{ background: 'var(--success)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Schválit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seznam schválených členů */}
          <div className="space-y-2">
            {filteredSortedMembers.length === 0 && memberSearch.trim() && (
              <div className="text-center py-8 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné výsledky hledání.</p>
              </div>
            )}
            {filteredSortedMembers.map(member => {
              const p = member.profile;
              const initials = p?.display_name ? p.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';
              const isCurrentUser = member.user_id === user?.id;
              return (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: p?.avatar_color ?? 'var(--primary)' }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p?.display_name ?? 'Neznámý'}</span>
                      {isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>Ty</span>}
                    </div>
                    {p?.position && (
                      <div className="text-xs truncate font-medium" style={{ color: 'var(--primary)', opacity: 0.85 }}>
                        {p.position}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p?.email}</span>
                      {p?.email && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyEmail(member.id, p.email!); }}
                          title="Kopírovat e-mail"
                          className="flex-shrink-0 p-0.5 rounded transition-colors"
                          style={{ color: copiedEmailId === member.id ? '#16a34a' : 'var(--text-muted)' }}
                        >
                          {copiedEmailId === member.id ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                    {p?.phone && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatPhone(p.phone)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyPhone(member.id, p.phone!); }}
                          title="Kopírovat telefon"
                          className="flex-shrink-0 p-0.5 rounded transition-colors"
                          style={{ color: copiedPhoneId === member.id ? '#16a34a' : 'var(--text-muted)' }}
                        >
                          {copiedPhoneId === member.id ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {(activeRates[member.id] !== undefined || member.hourly_rate !== null) &&
                   (isWorkspaceAdmin || isCurrentUser || (isManager && isManagerOf(member.user_id))) && (
                    <span className="text-xs hidden sm:inline flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {activeRates[member.id] ?? member.hourly_rate} {currencySymbol}/h
                    </span>
                  )}

                  {isWorkspaceAdmin && member.cooperation_type_id && (() => {
                    const ct = cooperationTypes.find(c => c.id === member.cooperation_type_id);
                    return ct ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full hidden sm:inline-block flex-shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {ct.name}
                      </span>
                    ) : null;
                  })()}

                  {isWorkspaceAdmin && !isCurrentUser && member.role !== 'owner' ? (
                    <div className="relative flex-shrink-0">
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value as UserRole)}
                        className="px-2 py-1 pr-6 rounded-md border text-base sm:text-sm appearance-none cursor-pointer"
                        style={inputStyle}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Team Manager</option>
                        <option value="member">Člen</option>
                      </select>
                      <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  )}

                  {isWorkspaceAdmin && !isCurrentUser && (
                    <button
                      onClick={() => openEditMember(member)}
                      className="p-1.5 rounded transition-colors flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Upravit uživatele"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}

                  {isWorkspaceAdmin && !isCurrentUser && member.role !== 'owner' && (
                    <button
                      onClick={() => removeMember(member.id, p?.display_name ?? '')}
                      className="p-1.5 rounded transition-colors flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Odebrat z workspace"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
