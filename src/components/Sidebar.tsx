'use client';

import { SidebarProps } from './sidebar/types';
import { useSidebar } from './sidebar/useSidebar';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarNav } from './sidebar/SidebarNav';
import { SidebarUserPanel } from './sidebar/SidebarUserPanel';

export default function Sidebar({ open, onClose, collapsed = false, onCollapseDesktop }: SidebarProps) {
  const {
    pathname,
    user,
    profile,
    signOut,
    currentWorkspace,
    workspaces,
    selectWorkspace,
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
  } = useSidebar();

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
          ${!collapsed ? 'lg:translate-x-0' : 'lg:-translate-x-full'}
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}
      >
        <SidebarHeader
          currentWorkspaceName={currentWorkspace?.name ?? ''}
          onClose={onClose}
          onCollapseDesktop={onCollapseDesktop}
        />

        <SidebarNav
          navGroups={navGroups}
          bottomItems={bottomItems}
          favoriteItems={favoriteItems}
          favorites={favorites}
          canUseFavorites={canUseFavorites}
          collapsedGroups={collapsedGroups}
          toggleGroup={toggleGroup}
          toggleFavorite={toggleFavorite}
          badgeCounts={badgeCounts}
          onClose={onClose}
          pathname={pathname}
        />

        <SidebarUserPanel
          showUserPanel={showUserPanel}
          setShowUserPanel={setShowUserPanel}
          profile={profile}
          user={user}
          signOut={signOut}
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          selectWorkspace={selectWorkspace}
          initials={initials}
          pathname={pathname}
          onClose={onClose}
        />
      </aside>
    </>
  );
}
