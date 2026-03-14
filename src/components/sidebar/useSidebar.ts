'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import {
  isWorkspaceAdmin as checkWsAdmin,
  isManager as checkIsManager,
  canAccessAuditLog as checkAuditAccess,
  isMasterAdmin as checkMasterAdmin,
} from '@/lib/permissions';
import type { Workspace } from '@/types/database';
import { NavItem, NavGroup, BadgeCounts } from './types';
import { ICONS } from './icons';

export interface UseSidebarReturn {
  pathname: string;
  user: ReturnType<typeof useAuth>['user'];
  profile: ReturnType<typeof useAuth>['profile'];
  signOut: ReturnType<typeof useAuth>['signOut'];
  currentWorkspace: ReturnType<typeof useWorkspace>['currentWorkspace'];
  workspaces: Workspace[];
  selectWorkspace: (ws: Workspace) => void;
  showUserPanel: boolean;
  setShowUserPanel: (v: boolean) => void;
  collapsedGroups: Set<string>;
  toggleGroup: (title: string) => void;
  favorites: string[];
  canUseFavorites: boolean;
  toggleFavorite: (href: string, e: React.MouseEvent) => void;
  badgeCounts: BadgeCounts;
  navGroups: NavGroup[];
  bottomItems: NavItem[];
  favoriteItems: NavItem[];
  initials: string;
}

export function useSidebar(): UseSidebarReturn {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { currentWorkspace, workspaces, selectWorkspace, userRole, currentMembership, hasModule } = useWorkspace();
  const [showUserPanel, setShowUserPanel] = useState(false);

  // Master Admin – computed at hook level for use in both navGroups and bottomItems
  const isMasterAdminSidebar = useMemo(() => checkMasterAdmin(profile ?? null), [profile]);

  // Stav sbalení sekcí – persistováno v localStorage
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('sidebar_collapsed_groups');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try { localStorage.setItem('sidebar_collapsed_groups', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // ── Oblíbené ──────────────────────────────────────────────────────────────
  const canUseFavorites = currentWorkspace?.tariff === 'pro' || currentWorkspace?.tariff === 'max';
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!currentWorkspace) return;
    try {
      const key = `trackino_favorites_${currentWorkspace.id}`;
      const saved = localStorage.getItem(key);
      setFavorites(saved ? (JSON.parse(saved) as string[]) : []);
    } catch { setFavorites([]); }
  }, [currentWorkspace?.id]);

  const toggleFavorite = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentWorkspace || !canUseFavorites) return;
    const key = `trackino_favorites_${currentWorkspace.id}`;
    setFavorites(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // ── Badge counts ───────────────────────────────────────────────────────────
  const isAdminOrManager = useMemo(
    () => checkWsAdmin(userRole) || checkIsManager(userRole),
    [userRole]
  );
  const canProcessRequestsSidebar = useMemo(
    () => isAdminOrManager || checkMasterAdmin(profile ?? null) || (currentMembership?.can_process_requests ?? false),
    [isAdminOrManager, profile, currentMembership]
  );
  const canViewFeedbackSidebar = useMemo(
    () => checkMasterAdmin(profile ?? null) || checkWsAdmin(userRole) || (currentMembership?.can_receive_feedback ?? false),
    [userRole, profile, currentMembership]
  );
  const canInvoiceSidebar = currentMembership?.can_invoice ?? false;

  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
    pendingVacation: 0,
    returnedInvoice: 0,
    pendingInvoiceApproval: 0,
    pendingRequest: 0,
    unresolvedFeedback: 0,
  });

  useEffect(() => {
    if (!user || !currentWorkspace) {
      setBadgeCounts({ pendingVacation: 0, returnedInvoice: 0, pendingInvoiceApproval: 0, pendingRequest: 0, unresolvedFeedback: 0 });
      return;
    }

    const wsId = currentWorkspace.id;
    const uid = user.id;

    Promise.all([
      isAdminOrManager
        ? supabase.from('trackino_vacation_entries').select('id').eq('workspace_id', wsId).eq('status', 'pending').neq('user_id', uid)
        : Promise.resolve({ data: null }),
      canInvoiceSidebar
        ? supabase.from('trackino_invoices').select('id, billing_period_year, billing_period_month, status').eq('workspace_id', wsId).eq('user_id', uid)
        : Promise.resolve({ data: null }),
      isAdminOrManager
        ? supabase.from('trackino_invoices').select('id').eq('workspace_id', wsId).eq('status', 'pending')
        : Promise.resolve({ data: null }),
      canProcessRequestsSidebar
        ? supabase.from('trackino_requests').select('id').eq('workspace_id', wsId).eq('status', 'pending')
        : Promise.resolve({ data: null }),
      canViewFeedbackSidebar
        ? supabase.from('trackino_feedback').select('id').eq('workspace_id', wsId).eq('is_resolved', false)
        : Promise.resolve({ data: null }),
    ]).then(([vacRes, invUserRes, invPendRes, reqRes, fbRes]) => {
      let returnedCount = 0;
      if (invUserRes.data) {
        const list = invUserRes.data as Array<{ id: string; billing_period_year: number; billing_period_month: number; status: string }>;
        returnedCount = list.filter(inv => {
          if (inv.status !== 'returned') return false;
          return !list.some(
            other => other.id !== inv.id &&
              other.billing_period_year === inv.billing_period_year &&
              other.billing_period_month === inv.billing_period_month &&
              other.status !== 'returned' &&
              other.status !== 'cancelled'
          );
        }).length;
      }
      setBadgeCounts({
        pendingVacation: (vacRes.data ?? []).length,
        returnedInvoice: returnedCount,
        pendingInvoiceApproval: (invPendRes.data ?? []).length,
        pendingRequest: (reqRes.data ?? []).length,
        unresolvedFeedback: (fbRes.data ?? []).length,
      });
    });
  }, [user, currentWorkspace, isAdminOrManager, canProcessRequestsSidebar, canViewFeedbackSidebar, canInvoiceSidebar]);

  // ── Navigace ───────────────────────────────────────────────────────────────
  const navGroups = useMemo<NavGroup[]>(() => {
    const isAdmin = checkWsAdmin(userRole);
    const isManagerOrAdmin = checkIsManager(userRole) || isAdmin;
    const showAudit = checkAuditAccess(userRole, profile ?? null, currentMembership ?? null);
    const masterAdmin = checkMasterAdmin(profile ?? null);
    const hideTagsGlobally = currentWorkspace?.hide_tags_globally ?? false;
    const canUseVacation = currentMembership?.can_use_vacation ?? false;
    const canInvoice = currentMembership?.can_invoice ?? false;
    const canManageBilling = currentMembership?.can_manage_billing ?? false;

    const trackingItems: NavItem[] = [
      { label: 'Přehled', href: '/', icon: ICONS.dashboard },
    ];

    if (hasModule('time_tracker')) {
      trackingItems.push({ label: 'Měřič', href: '/tracker', icon: ICONS.timer });
    }
    if (hasModule('planner')) {
      trackingItems.push({ label: 'Plánovač', href: '/planner', icon: ICONS.planner });
    }
    if (hasModule('calendar')) {
      trackingItems.push({ label: 'Kalendář', href: '/calendar', icon: ICONS.calendar });
    }
    if (hasModule('important_days')) {
      trackingItems.push({ label: 'Důležité dny', href: '/important-days', icon: ICONS.importantDays });
    }
    if (hasModule('vacation') && (canUseVacation || isAdmin)) {
      trackingItems.push({ label: 'Dovolená', href: '/vacation', icon: ICONS.vacation });
    }
    if (hasModule('invoices') && (canInvoice || canManageBilling || isManagerOrAdmin)) {
      trackingItems.push({ label: 'Fakturace', href: '/invoices', icon: ICONS.invoice });
    }
    if (hasModule('requests')) {
      trackingItems.push({ label: 'Žádosti', href: '/requests', icon: ICONS.requests });
    }

    const analyzeItems: NavItem[] = [];
    if (hasModule('reports')) {
      analyzeItems.push({ label: 'Reporty', href: '/reports', icon: ICONS.reports });
    }
    if (hasModule('subordinates') && isManagerOrAdmin) {
      analyzeItems.push({ label: 'Podřízení', href: '/subordinates', icon: ICONS.subordinates });
    }
    if (hasModule('notes') && isManagerOrAdmin) {
      analyzeItems.push({ label: 'Poznámky manažera', href: '/notes', icon: ICONS.notes });
    }
    if (hasModule('attendance')) {
      analyzeItems.push({ label: 'Přehled hodin', href: '/attendance', icon: ICONS.attendance });
    }
    if (hasModule('category_report')) {
      analyzeItems.push({ label: 'Analýza kategorií', href: '/category-report', icon: ICONS.categoryReport });
    }

    const nastrojeItems: NavItem[] = [];
    if (hasModule('tasks')) {
      nastrojeItems.push({ label: 'Úkoly', href: '/tasks', icon: ICONS.tasks });
    }
    if (hasModule('notebook')) {
      nastrojeItems.push({ label: 'Poznámky', href: '/notebook', icon: ICONS.notebook });
    }
    if (hasModule('bookmarks')) {
      nastrojeItems.push({ label: 'Záložky', href: '/bookmarks', icon: ICONS.bookmarks });
    }
    if (hasModule('prompts')) {
      nastrojeItems.push({ label: 'Prompty', href: '/prompts', icon: ICONS.prompts });
    }
    if (hasModule('text_converter')) {
      nastrojeItems.push({ label: 'Převodník textu', href: '/text-converter', icon: ICONS.textConverter });
    }
    if (hasModule('ai_assistant')) {
      nastrojeItems.push({ label: 'AI asistent', href: '/ai-assistant', icon: ICONS.aiAssistant });
    }
    if (hasModule('subscriptions')) {
      nastrojeItems.push({ label: 'Předplatná', href: '/subscriptions', icon: ICONS.subscriptions });
    }
    if (hasModule('domains')) {
      nastrojeItems.push({ label: 'Evidence domén', href: '/domains', icon: ICONS.domains });
    }

    const spravaManagedItems: NavItem[] = [];
    if (hasModule('projects')) {
      spravaManagedItems.push({ label: 'Projekty', href: '/projects', icon: ICONS.projects });
    }
    if (hasModule('clients')) {
      spravaManagedItems.push({ label: 'Klienti', href: '/clients', icon: ICONS.clients });
    }
    if (hasModule('tags') && (!hideTagsGlobally || isAdmin)) {
      spravaManagedItems.push({ label: 'Štítky', href: '/tags', icon: ICONS.tags });
    }
    if (hasModule('team')) {
      spravaManagedItems.push({ label: 'Tým', href: '/team', icon: ICONS.team });
    }
    if (hasModule('settings') && isAdmin) {
      spravaManagedItems.push({ label: 'Nastavení', href: '/settings', icon: ICONS.settings });
    }
    if (hasModule('audit') && showAudit) {
      spravaManagedItems.push({ label: 'Audit log', href: '/audit', icon: ICONS.audit });
    }

    const groups: NavGroup[] = [{ title: 'SLEDOVÁNÍ', items: trackingItems }];

    if (analyzeItems.length > 0) {
      groups.push({ title: 'ANALÝZA', items: analyzeItems });
    }

    const researchItems: NavItem[] = [];
    if (hasModule('research')) {
      researchItems.push({ label: 'Domény', href: '/research/domains', icon: ICONS.researchDomains });
      researchItems.push({ label: 'Konkurence', href: '/research/competition', icon: ICONS.researchCompetition });
      researchItems.push({ label: 'GEOs', href: '/research/geos', icon: ICONS.researchGeos });
      researchItems.push({ label: 'SEO', href: '/research/seo', icon: ICONS.researchSeo });
    }
    if (researchItems.length > 0) {
      groups.push({ title: 'RESEARCH', items: researchItems });
    }

    if (nastrojeItems.length > 0) {
      groups.push({ title: 'NÁSTROJE', items: nastrojeItems });
    }
    if (spravaManagedItems.length > 0) {
      groups.push({ title: 'SPRÁVA', items: spravaManagedItems });
    }

    const spolecnostItems: NavItem[] = [];
    if (hasModule('knowledge_base')) {
      spolecnostItems.push({ label: 'Znalostní báze', href: '/knowledge-base', icon: ICONS.knowledgeBase });
    }
    if (hasModule('documents')) {
      spolecnostItems.push({ label: 'Dokumenty', href: '/documents', icon: ICONS.documents });
    }
    if (hasModule('company_rules')) {
      spolecnostItems.push({ label: 'Firemní pravidla', href: '/company-rules', icon: ICONS.companyRules });
    }
    if (hasModule('office_rules')) {
      spolecnostItems.push({ label: 'Pravidla v kanceláři', href: '/office-rules', icon: ICONS.officeRules });
    }
    if (hasModule('feedback')) {
      spolecnostItems.push({ label: 'Připomínky', href: '/feedback', icon: ICONS.feedback });
    }
    if (spolecnostItems.length > 0) {
      groups.push({ title: 'SPOLEČNOST', items: spolecnostItems });
    }

    if (masterAdmin) {
      groups.push({
        title: 'SYSTÉM',
        items: [
          { label: 'Správa workspace', href: '/admin', icon: ICONS.admin },
          { label: 'Nastavení aplikace', href: '/app-settings', icon: ICONS.appSettings },
        ],
      });
    }

    return groups;
  }, [userRole, profile, currentWorkspace?.tariff, currentWorkspace?.hide_tags_globally, currentMembership?.can_use_vacation, currentMembership?.can_invoice, currentMembership?.can_manage_billing, hasModule]);

  const bottomItems = useMemo<NavItem[]>(() => [
    { label: 'Nápověda', href: '/help', icon: ICONS.help },
    { label: 'Nahlásit chybu', href: '/bugs', icon: ICONS.bug },
    ...(isMasterAdminSidebar ? [{ label: 'Úpravy aplikace', href: '/app-changes', icon: ICONS.appChanges }] : []),
    ...(isMasterAdminSidebar || currentWorkspace?.tariff === 'max' ? [{ label: 'Dokumentace', href: '/changelog', icon: ICONS.docs }] : []),
  ], [isMasterAdminSidebar, currentWorkspace?.tariff]);

  const allNavItems = useMemo<NavItem[]>(() => [
    ...navGroups.flatMap(g => g.items),
    ...bottomItems,
  ], [navGroups, bottomItems]);

  const favoriteItems = useMemo<NavItem[]>(() => {
    if (!canUseFavorites) return [];
    return favorites
      .map(href => allNavItems.find(item => item.href === href))
      .filter((item): item is NavItem => item !== undefined);
  }, [favorites, allNavItems, canUseFavorites]);

  const initials = profile?.display_name
    ? profile.display_name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.charAt(0).toUpperCase() ?? '?');

  return {
    pathname,
    user,
    profile,
    signOut,
    currentWorkspace,
    workspaces: workspaces as Workspace[],
    selectWorkspace: selectWorkspace as (ws: Workspace) => void,
    showUserPanel,
    setShowUserPanel,
    collapsedGroups,
    toggleGroup,
    favorites,
    canUseFavorites,
    toggleFavorite,
    badgeCounts,
    navGroups,
    bottomItems,
    favoriteItems,
    initials,
  };
}
