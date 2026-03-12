'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useBookmarks } from './useBookmarks';
import BookmarksLeftPanel from './BookmarksLeftPanel';
import BookmarkCard from './BookmarkCard';
import { FolderModal, ShareModal, BookmarkModal } from './BookmarkModals';

export default function BookmarksContent() {
  const router = useRouter();
  const bm = useBookmarks();

  useEffect(() => {
    if (bm.currentWorkspace && !bm.hasModule('bookmarks')) router.push('/');
  }, [bm.currentWorkspace, bm.hasModule, router]);

  if (!bm.currentWorkspace) return null;

  return (
    <DashboardLayout>
      <div className="flex -m-4 lg:-m-6 overflow-hidden" style={{ height: 'calc(100vh - var(--topbar-height))' }}>

        {/* Left Panel */}
        <BookmarksLeftPanel
          folders={bm.folders}
          bookmarks={bm.bookmarks}
          favorites={bm.favorites}
          members={bm.members}
          selectedFolder={bm.selectedFolder}
          setSelectedFolder={bm.setSelectedFolder}
          listFilter={bm.listFilter}
          setListFilter={bm.setListFilter}
          expanded={bm.expanded}
          toggle={bm.toggle}
          authorSectionExpanded={bm.authorSectionExpanded}
          setAuthorSectionExpanded={bm.setAuthorSectionExpanded}
          searchQ={bm.searchQ}
          setSearchQ={bm.setSearchQ}
          showFolderPanel={bm.showFolderPanel}
          setShowFolderPanel={bm.setShowFolderPanel}
          openFolderModal={bm.openFolderModal}
          deleteFolder={bm.deleteFolder}
          openShare={bm.openShare}
          userId={bm.userId}
        />

        {/* Right Panel */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Mobile toggle button */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <button onClick={() => bm.setShowFolderPanel(p => !p)}
              className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              Panel
            </button>
            <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
              {bm.selectedFolder ? bm.folders.find(f => f.id === bm.selectedFolder)?.name ?? 'Záložky'
                : bm.listFilter?.type === 'favorites' ? 'Oblíbené'
                : bm.listFilter?.type === 'shared' ? 'Sdílené'
                : bm.listFilter?.type === 'recent' ? 'Naposledy přidané'
                : bm.listFilter?.type === 'unfiled' ? 'Nezařazené'
                : 'Všechny záložky'}
            </span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3 p-4 lg:p-6 overflow-y-auto">

            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              {bm.listFilter?.type === 'recent' ? null : (
                <div className="relative flex-shrink-0">
                  <select value={bm.sortBy} onChange={e => bm.setSortBy(e.target.value as 'date' | 'likes' | 'title')}
                    className="appearance-none pr-8 px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                    <option value="date">Nejnovější</option>
                    <option value="likes">Nejvíce liků</option>
                    <option value="title">Název A–Z</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
              )}
              <button onClick={() => bm.openBmModal()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 ml-auto"
                style={{ background: 'var(--primary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nová záložka
              </button>
            </div>

            {/* Bookmark list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {bm.filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p className="text-sm">Žádné záložky</p>
                  <button onClick={() => bm.openBmModal()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'var(--primary)' }}>
                    Přidat první záložku
                  </button>
                </div>
              )}
              {bm.filtered.map(b => (
                <BookmarkCard
                  key={b.id}
                  b={b}
                  userId={bm.userId}
                  likes={bm.likes}
                  favorites={bm.favorites}
                  comments={bm.comments}
                  getMember={bm.getMember}
                  openComments={bm.openComments}
                  setOpenComments={bm.setOpenComments}
                  newComment={bm.newComment}
                  setNewComment={bm.setNewComment}
                  addingComment={bm.addingComment}
                  editingComment={bm.editingComment}
                  setEditingComment={bm.setEditingComment}
                  toggleLike={bm.toggleLike}
                  toggleFavorite={bm.toggleFavorite}
                  openBmModal={bm.openBmModal}
                  deleteBm={bm.deleteBm}
                  addComment={bm.addComment}
                  deleteComment={bm.deleteComment}
                  updateComment={bm.updateComment}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FolderModal
        folderModal={bm.folderModal}
        setFolderModal={bm.setFolderModal}
        folderName={bm.folderName}
        setFolderName={bm.setFolderName}
        saveFolder={bm.saveFolder}
      />
      <ShareModal
        shareModal={bm.shareModal}
        setShareModal={bm.setShareModal}
        shareType={bm.shareType}
        setShareType={bm.setShareType}
        shareUserIds={bm.shareUserIds}
        setShareUserIds={bm.setShareUserIds}
        members={bm.members}
        userId={bm.userId}
        saveShare={bm.saveShare}
      />
      <BookmarkModal
        bmModal={bm.bmModal}
        setBmModal={bm.setBmModal}
        bmTitle={bm.bmTitle}
        setBmTitle={bm.setBmTitle}
        bmUrl={bm.bmUrl}
        setBmUrl={bm.setBmUrl}
        bmDesc={bm.bmDesc}
        setBmDesc={bm.setBmDesc}
        bmFolderId={bm.bmFolderId}
        setBmFolderId={bm.setBmFolderId}
        bmIsShared={bm.bmIsShared}
        setBmIsShared={bm.setBmIsShared}
        bmSaving={bm.bmSaving}
        folders={bm.folders}
        saveBm={bm.saveBm}
      />
    </DashboardLayout>
  );
}
