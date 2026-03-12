'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { usePrompts } from './usePrompts';
import { PromptsLeftPanel } from './PromptsLeftPanel';
import { PromptCard } from './PromptCard';
import { PromptModals } from './PromptModals';
import { extractCodeBlocks } from './utils';

export function PromptsContent() {
  const [showFolderPanel, setShowFolderPanel] = useState(false);

  const {
    folders, prompts, comments, likes, favorites, members,
    selectedFolder, setSelectedFolder,
    listFilter, setListFilter,
    expanded, toggle,
    authorSectionExpanded, setAuthorSectionExpanded,
    sortBy, setSortBy,
    searchQ, setSearchQ,
    // Folder modal
    folderModal, setFolderModal,
    folderName, setFolderName,
    // Share modal
    shareModal, setShareModal,
    shareType, setShareType,
    shareUserIds, setShareUserIds,
    // Prompt modal
    promptModal, setPromptModal,
    pmTitle, setPmTitle,
    pmContent, setPmContent,
    pmIsShared, setPmIsShared,
    pmFolderId, setPmFolderId,
    pmSaving,
    // Comment state
    copied,
    // Computed
    userId, filtered,
    // Functions
    openFolderModal, saveFolder, deleteFolder,
    openShare, saveShare,
    openPromptModal, savePrompt, deletePrompt,
    toggleLike, toggleFavorite,
    copyText, getMember,
    currentWorkspace,
  } = usePrompts();

  if (!currentWorkspace) return null;

  return (
    <DashboardLayout moduleName="Prompty">
      <div className="flex -m-4 lg:-m-6 overflow-hidden" style={{ height: 'calc(100vh - var(--topbar-height))' }}>

        <PromptsLeftPanel
          showFolderPanel={showFolderPanel}
          setShowFolderPanel={setShowFolderPanel}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          listFilter={listFilter}
          setListFilter={setListFilter}
          selectedFolder={selectedFolder}
          setSelectedFolder={setSelectedFolder}
          authorSectionExpanded={authorSectionExpanded}
          setAuthorSectionExpanded={setAuthorSectionExpanded}
          folders={folders}
          prompts={prompts}
          favorites={favorites}
          members={members}
          expanded={expanded}
          toggle={toggle}
          openFolderModal={openFolderModal}
          deleteFolder={deleteFolder}
          openShare={openShare}
          userId={userId}
        />

        {/* ── Right Panel ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Mobile toggle button */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <button onClick={() => setShowFolderPanel(p => !p)} className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              Panel
            </button>
            <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name ?? 'Prompty'
                : listFilter?.type === 'favorites' ? 'Oblíbené'
                : listFilter?.type === 'shared' ? 'Sdílené'
                : listFilter?.type === 'recent' ? 'Naposledy přidané'
                : listFilter?.type === 'unfiled' ? 'Nezařazené'
                : 'Všechny prompty'}
            </span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3 p-4 lg:p-6 overflow-y-auto">
          <div className="flex items-center gap-3 flex-wrap">
            {listFilter?.type !== 'recent' && (
              <div className="relative flex-shrink-0">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'date' | 'likes' | 'title')}
                  className="text-base sm:text-sm border rounded-lg pl-3 pr-8 py-2 appearance-none cursor-pointer"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)', outline: 'none' }}
                >
                  <option value="date">Nejnovější</option>
                  <option value="likes">Nejvíce liků</option>
                  <option value="title">Název A–Z</option>
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            )}
            <button onClick={() => openPromptModal()}
              className="ml-auto px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
              style={{ background: 'var(--primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nový prompt
            </button>
          </div>

          {/* Prompt list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--text-muted)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <p className="text-sm">Žádné prompty</p>
                <button onClick={() => openPromptModal()} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Přidat první prompt</button>
              </div>
            )}
            {filtered.map(p => {
              const author = getMember(p.created_by);
              const myLike = (likes[p.id] ?? []).includes(userId);
              const likeCount = (likes[p.id] ?? []).length;
              const isFav = favorites.has(p.id);
              const isOwner = p.created_by === userId;
              const codes = extractCodeBlocks(p.content);
              const commentCount = comments.filter(c => c.prompt_id === p.id).length;

              return (
                <PromptCard
                  key={p.id}
                  p={p}
                  author={author}
                  myLike={myLike}
                  likeCount={likeCount}
                  isFav={isFav}
                  isOwner={isOwner}
                  codes={codes}
                  commentCount={commentCount}
                  copied={copied}
                  onLike={() => toggleLike(p.id)}
                  onFavorite={() => toggleFavorite(p.id)}
                  onEdit={() => openPromptModal(p)}
                  onDelete={() => deletePrompt(p)}
                  onCopy={copyText}
                />
              );
            })}
          </div>
        </div>
      </div>
      </div>

      <PromptModals
        folderModal={folderModal}
        setFolderModal={setFolderModal}
        folderName={folderName}
        setFolderName={setFolderName}
        saveFolder={saveFolder}
        shareModal={shareModal}
        setShareModal={setShareModal}
        shareType={shareType}
        setShareType={setShareType}
        shareUserIds={shareUserIds}
        setShareUserIds={setShareUserIds}
        saveShare={saveShare}
        members={members}
        userId={userId}
        promptModal={promptModal}
        setPromptModal={setPromptModal}
        pmTitle={pmTitle}
        setPmTitle={setPmTitle}
        pmContent={pmContent}
        setPmContent={setPmContent}
        pmIsShared={pmIsShared}
        setPmIsShared={setPmIsShared}
        pmFolderId={pmFolderId}
        setPmFolderId={setPmFolderId}
        pmSaving={pmSaving}
        savePrompt={savePrompt}
        folders={folders}
      />
    </DashboardLayout>
  );
}
