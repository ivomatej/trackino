'use client';

import type { Workspace, Tariff, UserRole } from '@/types/database';
import { WS_COLORS } from './types';
import { inputStyle, selectCls } from './utils';
import type { MemberWithProfile } from './types';

interface Props {
  editingWorkspace: Workspace | null;
  setEditingWorkspace: (v: Workspace | null) => void;
  editName: string;
  setEditName: (v: string) => void;
  editTariff: Tariff;
  setEditTariff: (v: Tariff) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  editSaving: boolean;
  wsMembers: MemberWithProfile[];
  membersLoading: boolean;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: UserRole;
  setInviteRole: (v: UserRole) => void;
  inviting: boolean;
  inviteCode: string | null;
  onSave: () => void;
  onChangeMemberRole: (memberId: string, role: UserRole) => void;
  onRemoveMember: (memberId: string, name: string) => void;
  onAddMember: () => void;
}

export function EditWorkspaceModal({
  editingWorkspace, setEditingWorkspace,
  editName, setEditName,
  editTariff, setEditTariff,
  editColor, setEditColor,
  editSaving, wsMembers, membersLoading,
  inviteEmail, setInviteEmail,
  inviteRole, setInviteRole,
  inviting, inviteCode,
  onSave, onChangeMemberRole, onRemoveMember, onAddMember,
}: Props) {
  if (!editingWorkspace) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setEditingWorkspace(null); }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl shadow-xl z-10 flex flex-col"
        style={{ maxHeight: '90vh', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-base font-semibold">Upravit workspace</h2>
          <button
            onClick={() => setEditingWorkspace(null)}
            className="p-1 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          {/* Název */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název workspace</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={inputStyle}
            />
          </div>

          {/* Tarif */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tarif</label>
            <div className="relative">
              <select
                value={editTariff}
                onChange={(e) => setEditTariff(e.target.value as Tariff)}
                className={selectCls}
                style={inputStyle}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>

          {/* Barva */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Barva workspace
              <span className="ml-2 inline-block w-3 h-3 rounded-full align-middle" style={{ background: editColor }} />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WS_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setEditColor(c)}
                  className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
                  style={{
                    background: c,
                    outline: editColor === c ? '2px solid #000' : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Členové */}
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Členové</div>
            {membersLoading ? (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Načítám…</div>
            ) : wsMembers.length === 0 ? (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Žádní členové.</div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {wsMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: m.profile?.avatar_color ?? '#6366f1' }}
                    >
                      {(m.profile?.display_name ?? m.profile?.email ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {m.profile?.display_name ?? '—'}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{m.profile?.email}</div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <select
                        value={m.role}
                        onChange={(e) => onChangeMemberRole(m.id, e.target.value as UserRole)}
                        className="pl-2 pr-5 py-1 rounded-md border text-base sm:text-sm appearance-none cursor-pointer"
                        style={inputStyle}
                      >
                        <option value="owner">Vlastník</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Člen</option>
                      </select>
                      <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </div>
                    <button
                      onClick={() => onRemoveMember(m.id, m.profile?.display_name ?? m.profile?.email ?? '?')}
                      className="flex-shrink-0 p-1 rounded transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Přidat člena */}
          <div>
            <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Přidat / pozvat člena</div>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); }}
                placeholder="email@priklad.cz"
                className="flex-1 px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={inputStyle}
              />
              <div className="relative flex-shrink-0">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="pl-2 pr-6 py-2 rounded-lg border text-base sm:text-sm appearance-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Člen</option>
                </select>
                <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              <button
                onClick={onAddMember}
                disabled={inviting || !inviteEmail.trim()}
                className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {inviting ? '…' : 'Přidat'}
              </button>
            </div>
            {inviteCode && (
              <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg-hover)' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Uživatel nenalezen – sdílejte kód pozvánky nebo odkaz na registraci s kódem workspace:
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-mono font-bold text-base tracking-widest" style={{ color: 'var(--primary)' }}>{editingWorkspace.join_code}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>← kód workspace pro registraci</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setEditingWorkspace(null)}
            className="flex-1 py-2 rounded-lg border text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Zavřít
          </button>
          <button
            onClick={onSave}
            disabled={editSaving || !editName.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {editSaving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      </div>
    </div>
  );
}
