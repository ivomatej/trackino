'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  isMasterAdmin as checkMasterAdmin,
  isWorkspaceAdmin as checkWsAdmin,
  isManager as checkManager,
  canManualEntry as checkManualEntry,
  canSeeTags as checkSeeTags,
  canManageWorkspaces as checkManageWs,
  canAccessSettings as checkAccessSettings,
  canAccessAuditLog as checkAccessAuditLog,
} from '@/lib/permissions';

export function usePermissions() {
  const { profile } = useAuth();
  const { currentMembership, userRole, currentWorkspace } = useWorkspace();

  return useMemo(() => ({
    /** Platformový Master Admin */
    isMasterAdmin: checkMasterAdmin(profile),
    /** Workspace Admin (owner/admin) */
    isWorkspaceAdmin: checkWsAdmin(userRole),
    /** Team Manager */
    isManager: checkManager(userRole),
    /** Může vytvářet/mazat workspace */
    canManageWorkspaces: checkManageWs(profile),
    /** Může používat manuální zadání */
    canManualEntry: checkManualEntry(userRole),
    /** Vidí štítky */
    canSeeTags: checkSeeTags(currentMembership, currentWorkspace?.hide_tags_globally),
    /** Má přístup k nastavení workspace */
    canAccessSettings: checkAccessSettings(userRole),
    /** Má přístup k audit logu */
    canAccessAuditLog: checkAccessAuditLog(userRole, profile, currentMembership),
    /** Aktuální role */
    role: userRole,
    /** Aktuální membership */
    membership: currentMembership,
  }), [profile, userRole, currentMembership, currentWorkspace?.hide_tags_globally]);
}
