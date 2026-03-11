import type { WorkspaceMember, Profile } from '@/types/database';

export type Tab = 'members' | 'departments' | 'categories' | 'tasks' | 'managers';

export interface ManagerAssignmentRow {
  id: string;
  member_user_id: string;
  manager_user_id: string;
}

export interface MemberWithProfile extends WorkspaceMember {
  profile?: Profile;
}

export const AVATAR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#0891b2', '#be185d', '#4f46e5', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#4338ca',
];

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlastník',
  admin: 'Admin',
  manager: 'Team Manager',
  member: 'Člen',
};

// Pořadí rolí pro řazení (nižší číslo = vyšší právo = nahoře)
export const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, manager: 2, member: 3 };

export function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)}.${parseInt(m)}.${y}`;
}

export const inputCls = 'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
export const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };

export function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}
