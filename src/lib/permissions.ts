// Trackino – centralizované oprávnění (čisté funkce, žádný React)

import type { Profile, UserRole, WorkspaceMember } from '@/types/database';


/** Je uživatel Master Admin (platformová úroveň)? */
export function isMasterAdmin(profile: Profile | null): boolean {
  return profile?.is_master_admin === true;
}

/** Je uživatel Admin workspace (owner nebo admin role)? */
export function isWorkspaceAdmin(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/** Je uživatel Team Manager? */
export function isManager(role: UserRole | null | undefined): boolean {
  return role === 'manager';
}

/** Může uživatel spravovat workspace (vytvářet, mazat, přejmenovávat)? Jen Master Admin. */
export function canManageWorkspaces(profile: Profile | null): boolean {
  return isMasterAdmin(profile);
}

/** Může uživatel používat manuální zadání času? Member NE, ostatní ANO. */
export function canManualEntry(role: UserRole | null | undefined): boolean {
  return role !== 'member';
}

/** Vidí uživatel štítky? Závisí na hide_tags v membership a hide_tags_globally v workspace. */
export function canSeeTags(
  membership: WorkspaceMember | null | undefined,
  hideTagsGlobally?: boolean
): boolean {
  if (!membership) return false;
  if (hideTagsGlobally) return false; // Globální skrytí (nastavení workspace)
  return !membership.hide_tags; // Per-member nastavení
}

/** Může uživatel editovat time entry jiného uživatele?
 *  - Admin/Owner: může editovat kohokoliv ve workspace
 *  - Manager: jen podřízených (isManagerOf musí být true)
 *  - Member: jen své vlastní
 */
export function canEditTimeEntry(
  currentUserRole: UserRole | null | undefined,
  entryUserId: string,
  currentUserId: string,
  isManagerOfEntryUser: boolean
): boolean {
  // Vlastní záznamy může editovat kdokoliv (kromě membera, který nemůže manuálně)
  if (entryUserId === currentUserId) return true;
  // Admin/Owner může editovat všechny
  if (isWorkspaceAdmin(currentUserRole)) return true;
  // Manager může editovat záznamy svých podřízených
  if (isManager(currentUserRole) && isManagerOfEntryUser) return true;
  return false;
}

/** Může uživatel přistupovat k nastavení workspace? */
export function canAccessSettings(role: UserRole | null | undefined): boolean {
  return isWorkspaceAdmin(role);
}

/** Může uživatel vidět audit log?
 *  - Master Admin: vždy
 *  - Workspace Admin: vždy
 *  - Ostatní: jen pokud mají can_view_audit příznak
 */
export function canAccessAuditLog(
  role: UserRole | null | undefined,
  profile: Profile | null,
  membership: WorkspaceMember | null | undefined
): boolean {
  if (isMasterAdmin(profile)) return true;
  if (isWorkspaceAdmin(role)) return true;
  return membership?.can_view_audit === true;
}


/**
 * Může uživatel používat AI asistenta?
 * - Master Admin: vždy (nelze zakázat)
 * - Ostatní (včetně owner/admin): jen pokud mají can_use_ai_assistant příznak
 */
export function canUseAiAssistant(
  role: UserRole | null | undefined,
  profile: Profile | null,
  membership: WorkspaceMember | null | undefined
): boolean {
  if (isMasterAdmin(profile)) return true;
  return membership?.can_use_ai_assistant === true;
}
