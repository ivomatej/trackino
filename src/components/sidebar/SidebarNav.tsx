'use client';

import Link from 'next/link';
import { NavItem, NavGroup, BadgeCounts } from './types';
import { StarIcon, RemoveIcon } from './icons';

interface SidebarNavProps {
  navGroups: NavGroup[];
  bottomItems: NavItem[];
  favoriteItems: NavItem[];
  favorites: string[];
  canUseFavorites: boolean;
  collapsedGroups: Set<string>;
  toggleGroup: (title: string) => void;
  toggleFavorite: (href: string, e: React.MouseEvent) => void;
  badgeCounts: BadgeCounts;
  onClose: () => void;
  pathname: string;
}

export function SidebarNav({
  navGroups,
  bottomItems,
  favoriteItems,
  favorites,
  canUseFavorites,
  collapsedGroups,
  toggleGroup,
  toggleFavorite,
  badgeCounts,
  onClose,
  pathname,
}: SidebarNavProps) {

  // Render položky s hvězdičkou (pro hlavní navigaci)
  const renderNavItem = (item: NavItem) => {
    const active = pathname === item.href;
    const isFavorited = favorites.includes(item.href);

    let badgeCount = 0;
    if (item.href === '/vacation') badgeCount = badgeCounts.pendingVacation;
    else if (item.href === '/invoices') badgeCount = badgeCounts.returnedInvoice + badgeCounts.pendingInvoiceApproval;
    else if (item.href === '/requests') badgeCount = badgeCounts.pendingRequest;
    else if (item.href === '/feedback') badgeCount = badgeCounts.unresolvedFeedback;

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
          {badgeCount > 0 && (
            <span
              className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: '#ef4444' }}
            >
              {badgeCount}
            </span>
          )}
        </Link>
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
    <nav className="flex-1 overflow-y-auto py-2 px-3 sidebar-scroll">

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
  );
}
