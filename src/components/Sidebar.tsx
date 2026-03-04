'use client';

import { useState, useEffect, useMemo, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { isWorkspaceAdmin as checkWsAdmin, isManager as checkIsManager, canAccessAuditLog as checkAuditAccess, isMasterAdmin as checkMasterAdmin } from '@/lib/permissions';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Ikony jako konstanty
const ICONS = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  timer: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  planner: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  reports: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  projects: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  team: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  audit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  help: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  bug: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.88 1.88" /><path d="M14.12 3.88L16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg>,
  docs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  clients: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  tags: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path d="M6 6h.008v.008H6V6z" /></svg>,
  subordinates: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>,
  notes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  vacation: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>,
  invoice: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>,
  admin: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  appSettings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
  profile: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>,
  attendance: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>,
  categoryReport: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
  textConverter: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>,
  importantDays: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /></svg>,
  appChanges: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  favorites: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h5" /><circle cx="17" cy="17" r="4" /><path d="M17 15v2l1 1" /></svg>,
  requests: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="11" y2="17" /></svg>,
  feedback: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  knowledgeBase: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="12" y1="7" x2="16" y2="7" /><line x1="12" y1="11" x2="16" y2="11" /><line x1="12" y1="15" x2="14" y2="15" /></svg>,
  documents: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>,
  companyRules: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  officeRules: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
};

// Ikonka hvězdičky pro tlačítko oblíbených (inline SVG pro různé stavy)
function StarIcon({ filled, size = 13 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// Ikonka křížku pro odebrání z oblíbených
function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { currentWorkspace, userRole, currentMembership, hasModule } = useWorkspace();
  const [showUserPanel, setShowUserPanel] = useState(false);

  // Master Admin – computed at component level for use in both navGroups and bottomItems
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
  // Dostupné jen pro tarif Pro a Max
  const canUseFavorites = currentWorkspace?.tariff === 'pro' || currentWorkspace?.tariff === 'max';
  const [favorites, setFavorites] = useState<string[]>([]);

  // Načti oblíbené z localStorage po změně workspace
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

  // Badge u Dovolené – počet čekajících žádostí (pro managera/admina)
  const isManagerOrAdminForVacation = useMemo(
    () => checkWsAdmin(userRole) || checkIsManager(userRole),
    [userRole]
  );
  const [pendingVacationCount, setPendingVacationCount] = useState(0);

  useEffect(() => {
    if (!user || !currentWorkspace || !isManagerOrAdminForVacation) {
      setPendingVacationCount(0);
      return;
    }
    supabase
      .from('trackino_vacation_entries')
      .select('id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('status', 'pending')
      .neq('user_id', user.id)
      .then(({ data }) => setPendingVacationCount((data ?? []).length));
  }, [user, currentWorkspace, isManagerOrAdminForVacation]);

  // Červená tečka u Fakturace – vrácené faktury k opravě (bez těch, které už byly znovu podány)
  const canInvoice = currentMembership?.can_invoice ?? false;
  const [returnedInvoiceCount, setReturnedInvoiceCount] = useState(0);

  useEffect(() => {
    if (!user || !currentWorkspace || !canInvoice) {
      setReturnedInvoiceCount(0);
      return;
    }
    supabase
      .from('trackino_invoices')
      .select('id, billing_period_year, billing_period_month, status')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .then(({ data }) => {
        const list = (data ?? []) as Array<{ id: string; billing_period_year: number; billing_period_month: number; status: string }>;
        // Počítáme jen vrácené faktury, pro které uživatel NEPODAL novou (non-returned, non-cancelled)
        const count = list.filter(inv => {
          if (inv.status !== 'returned') return false;
          return !list.some(
            other => other.id !== inv.id &&
              other.billing_period_year === inv.billing_period_year &&
              other.billing_period_month === inv.billing_period_month &&
              other.status !== 'returned' &&
              other.status !== 'cancelled'
          );
        }).length;
        setReturnedInvoiceCount(count);
      });
  }, [user, currentWorkspace, canInvoice]);

  // Dynamicky sestavit navigaci dle oprávnění a povolených modulů
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

    // Time Tracker
    if (hasModule('time_tracker')) {
      trackingItems.push({ label: 'Měřič', href: '/tracker', icon: ICONS.timer });
    }

    // Plánovač
    if (hasModule('planner')) {
      trackingItems.push({ label: 'Plánovač', href: '/planner', icon: ICONS.planner });
    }

    // Kalendář
    if (hasModule('calendar')) {
      trackingItems.push({ label: 'Kalendář', href: '/calendar', icon: ICONS.calendar });
    }

    // Dovolená – viditelné pro uživatele s nárokem nebo adminy
    if (hasModule('vacation') && (canUseVacation || isAdmin)) {
      trackingItems.push({ label: 'Dovolená', href: '/vacation', icon: ICONS.vacation });
    }

    // Fakturace – viditelné pro uživatele s can_invoice, can_manage_billing nebo managery/adminy
    if (hasModule('invoices') && (canInvoice || canManageBilling || isManagerOrAdmin)) {
      trackingItems.push({ label: 'Fakturace', href: '/invoices', icon: ICONS.invoice });
    }

    // Žádosti – viditelné všem členům (každý může podávat žádosti)
    if (hasModule('requests')) {
      trackingItems.push({ label: 'Žádosti', href: '/requests', icon: ICONS.requests });
    }

    // ANALÝZA
    const analyzeItems: NavItem[] = [];

    if (hasModule('reports')) {
      analyzeItems.push({ label: 'Reporty', href: '/reports', icon: ICONS.reports });
    }
    if (hasModule('subordinates') && isManagerOrAdmin) {
      analyzeItems.push({ label: 'Podřízení', href: '/subordinates', icon: ICONS.subordinates });
    }
    if (hasModule('notes') && isManagerOrAdmin) {
      analyzeItems.push({ label: 'Poznámky', href: '/notes', icon: ICONS.notes });
    }
    if (hasModule('attendance')) {
      analyzeItems.push({ label: 'Přehled hodin', href: '/attendance', icon: ICONS.attendance });
    }
    if (hasModule('category_report')) {
      analyzeItems.push({ label: 'Analýza kategorií', href: '/category-report', icon: ICONS.categoryReport });
    }

    // NÁSTROJE
    const nastrojeItems: NavItem[] = [];
    if (hasModule('text_converter')) {
      nastrojeItems.push({ label: 'Převodník textu', href: '/text-converter', icon: ICONS.textConverter });
    }
    if (hasModule('important_days')) {
      nastrojeItems.push({ label: 'Důležité dny', href: '/important-days', icon: ICONS.importantDays });
    }

    // Připomínky – viditelné všem členům (každý může posílat zpětnou vazbu)
    if (hasModule('feedback')) {
      nastrojeItems.push({ label: 'Připomínky', href: '/feedback', icon: ICONS.feedback });
    }

    // SPRÁVA
    const spravaManagedItems: NavItem[] = [];

    if (hasModule('projects')) {
      spravaManagedItems.push({ label: 'Projekty', href: '/projects', icon: ICONS.projects });
    }
    if (hasModule('clients')) {
      spravaManagedItems.push({ label: 'Klienti', href: '/clients', icon: ICONS.clients });
    }

    // Štítky – skryté pro běžné členy pokud je zapnuto hide_tags_globally
    if (hasModule('tags') && (!hideTagsGlobally || isAdmin)) {
      spravaManagedItems.push({ label: 'Štítky', href: '/tags', icon: ICONS.tags });
    }

    if (hasModule('team')) {
      spravaManagedItems.push({ label: 'Tým', href: '/team', icon: ICONS.team });
    }

    // Nastavení – pouze pro admin/owner
    if (hasModule('settings') && isAdmin) {
      spravaManagedItems.push({ label: 'Nastavení', href: '/settings', icon: ICONS.settings });
    }

    // Audit log – Master Admin, Workspace Admin nebo uživatel s can_view_audit
    if (hasModule('audit') && showAudit) {
      spravaManagedItems.push({ label: 'Audit log', href: '/audit', icon: ICONS.audit });
    }

    const groups: NavGroup[] = [
      {
        title: 'SLEDOVÁNÍ',
        items: trackingItems,
      },
    ];

    if (analyzeItems.length > 0) {
      groups.push({
        title: 'ANALÝZA',
        items: analyzeItems,
      });
    }

    if (nastrojeItems.length > 0) {
      groups.push({
        title: 'NÁSTROJE',
        items: nastrojeItems,
      });
    }

    if (spravaManagedItems.length > 0) {
      groups.push({
        title: 'SPRÁVA',
        items: spravaManagedItems,
      });
    }

    // SPOLEČNOST (Pro+, 4 moduly)
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
    if (spolecnostItems.length > 0) {
      groups.push({
        title: 'SPOLEČNOST',
        items: spolecnostItems,
      });
    }

    // Správa systému – jen pro Master Admin
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

  // Všechny položky dostupné pro oblíbené (navGroups + bottomItems)
  const allNavItems = useMemo<NavItem[]>(() => [
    ...navGroups.flatMap(g => g.items),
    ...bottomItems,
  ], [navGroups, bottomItems]);

  // Položky oblíbených s jejich metadaty
  const favoriteItems = useMemo<NavItem[]>(() => {
    if (!canUseFavorites) return [];
    return favorites
      .map(href => allNavItems.find(item => item.href === href))
      .filter((item): item is NavItem => item !== undefined);
  }, [favorites, allNavItems, canUseFavorites]);

  const initials = profile?.display_name
    ? profile.display_name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.charAt(0).toUpperCase() ?? '?');

  // Render položky s hvězdičkou (pro hlavní navigaci)
  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href;
    const hasReturnedBadge = item.href === '/invoices' && returnedInvoiceCount > 0;
    const hasPendingVacationBadge = item.href === '/vacation' && pendingVacationCount > 0;
    const isFavorited = favorites.includes(item.href);

    return (
      <div key={item.href} className="relative group/nav">
        <Link
          href={item.href}
          onClick={onClose}
          className={`flex items-center gap-3 pl-3 ${canUseFavorites ? 'pr-8' : 'pr-3'} py-2 rounded-lg text-sm font-medium transition-colors`}
          style={{
            color: active ? 'var(--primary)' : 'var(--text-secondary)',
            background: active ? 'var(--bg-active)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent'; }}
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {hasReturnedBadge && (
            <span
              className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: '#ef4444' }}
            >
              {returnedInvoiceCount}
            </span>
          )}
          {hasPendingVacationBadge && (
            <span
              className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: '#ef4444' }}
            >
              {pendingVacationCount}
            </span>
          )}
        </Link>
        {/* Hvězdička oblíbených – zobrazí se jen pro Pro/Max */}
        {canUseFavorites && (
          <button
            onClick={(e) => toggleFavorite(item.href, e)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-all"
            title={isFavorited ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
            style={{
              color: isFavorited ? '#f59e0b' : 'var(--text-muted)',
              opacity: isFavorited ? 0.8 : 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = isFavorited ? '0.8' : '0'; }}
          >
            <StarIcon filled={isFavorited} />
          </button>
        )}
      </div>
    );
  };

  // Render položky v sekci Oblíbené (s křížkem pro odebrání)
  const renderFavoriteItem = (item: NavItem) => {
    const active = pathname === item.href;
    return (
      <div key={`fav-${item.href}`} className="relative group/fav">
        <Link
          href={item.href}
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            color: active ? 'var(--primary)' : 'var(--text-secondary)',
            background: active ? 'var(--bg-active)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent'; }}
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
        </Link>
        {/* Křížek pro odebrání z oblíbených */}
        <button
          onClick={(e) => toggleFavorite(item.href, e)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-all opacity-0 group-hover/fav:opacity-60 hover:!opacity-100"
          title="Odebrat z oblíbených"
          style={{ color: 'var(--text-muted)' }}
        >
          <RemoveIcon />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Overlay pro mobil */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-50 w-[var(--sidebar-width)] flex flex-col
          border-r transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
        {/* Logo + Workspace */}
        <div className="flex items-center gap-3 px-4 h-[var(--topbar-height)] border-b" style={{ borderColor: 'var(--border)' }}>
          <Link href="/" onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'var(--primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Trackino</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {currentWorkspace?.name ?? ''}
              </div>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigace se skupinami */}
        <nav className="flex-1 overflow-y-auto py-2 px-3">

          {/* ── Sekce OBLÍBENÉ (jen Pro+, jen pokud existují oblíbené) ── */}
          {canUseFavorites && favoriteItems.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => toggleGroup('OBLÍBENÉ')}
                className="w-full flex items-center justify-between px-3 py-1 rounded-md transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[10px] font-semibold tracking-wider flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  OBLÍBENÉ
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform 0.18s', transform: collapsedGroups.has('OBLÍBENÉ') ? 'rotate(-90deg)' : 'none', flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {!collapsedGroups.has('OBLÍBENÉ') && (
                <div className="space-y-0.5 mt-0.5">
                  {favoriteItems.map(renderFavoriteItem)}
                </div>
              )}
            </div>
          )}

          {/* Hlavní skupiny navigace */}
          {navGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.title);
            return (
              <div key={group.title} className="mb-3">
                {/* Klikatelná hlavička sekce */}
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-1 rounded-md transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="text-[10px] font-semibold tracking-wider">{group.title}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.18s', transform: isCollapsed ? 'rotate(-90deg)' : 'none', flexShrink: 0 }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {/* Položky sekce */}
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {group.items.map(renderNavItem)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Spodní sekce */}
          <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-0.5">
              {bottomItems.map((item) => {
                const active = pathname === item.href;
                const isFavorited = favorites.includes(item.href);
                return (
                  <div key={item.href} className="relative group/nav">
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        background: active ? 'var(--bg-active)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent'; }}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                    {/* Hvězdička oblíbených pro bottom items */}
                    {canUseFavorites && (
                      <button
                        onClick={(e) => toggleFavorite(item.href, e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-all"
                        title={isFavorited ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                        style={{
                          color: isFavorited ? '#f59e0b' : 'var(--text-muted)',
                          opacity: isFavorited ? 0.8 : 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = isFavorited ? '0.8' : '0'; }}
                      >
                        <StarIcon filled={isFavorited} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User panel */}
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {showUserPanel && (
            <div className="px-3 py-2 border-b animate-fade-in" style={{ borderColor: 'var(--border)' }}>
              {/* Detailní nastavení */}
              <Link
                href="/profile"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full"
                style={{
                  color: pathname === '/profile' ? 'var(--primary)' : 'var(--text-secondary)',
                  background: pathname === '/profile' ? 'var(--bg-active)' : 'transparent',
                }}
                onMouseEnter={e => { if (pathname !== '/profile') e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = pathname === '/profile' ? 'var(--bg-active)' : 'transparent'; }}
              >
                {ICONS.profile}
                <span>Detailní nastavení</span>
              </Link>
              {/* Odhlásit se */}
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light, #fee2e2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Odhlásit se
              </button>
            </div>
          )}

          <button
            onClick={() => setShowUserPanel(!showUserPanel)}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: profile?.avatar_color ?? 'var(--primary)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{profile?.display_name ?? profile?.email ?? 'Uživatel'}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: 'var(--text-muted)', transform: showUserPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
