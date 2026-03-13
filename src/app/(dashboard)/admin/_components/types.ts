import type { Workspace, WorkspaceMember, Profile, Tariff } from '@/types/database';

export const TARIFF_LABELS: Record<Tariff, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Max',
};

export const WS_COLORS = [
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

export type WsTab = 'active' | 'archived' | 'deleted';

export interface WorkspaceExt extends Workspace {
  memberCount: number;
  activeCount: number;
  adminProfile: Profile | null;
}

export interface MemberWithProfile extends WorkspaceMember {
  profile?: Profile;
}
