'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useDocuments } from './useDocuments';
import { FolderTree } from './FolderTree';
import { FolderModal } from './FolderModal';
import { ShareModal } from './ShareModal';
import { DocFormModal } from './DocFormModal';
import { fmtSize, getFileIcon } from './utils';

export function DocumentsContent() {
  const {
    folders, docs, members, loading,
    selectedFolder, setSelectedFolder,
    showFolderPanel, setShowFolderPanel,
    expanded, toggle,
    searchQ, setSearchQ,
    visibleDocs,
    folderModal, setFolderModal,
    savingFolder,
    openFolderModal, saveFolder, deleteFolder,
    shareModal, setShareModal,
    shareType, setShareType,
    shareUserIds, setShareUserIds,
    openShare, saveShare,
    docForm, setDocForm,
    editingDoc, setEditingDoc,
    savingDoc,
    deletingDoc,
    uploadError, setUploadError,
    fileInputRef,
    selectedFile, setSelectedFile,
    handleFileChange, openEditDoc, saveDocument, deleteDocument, getFileUrl,
    canManage, userId,
  } = useDocuments();

  if (loading) {
    return (
      <DashboardLayout moduleName="Dokumenty">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout moduleName="Dokumenty">
      <h1 className="text-xl font-bold mb-3 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>Dokumenty</h1>

      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0">

        {/* ── Left panel ── */}
        <div className="md:w-64 flex-shrink-0 flex flex-col gap-2">
          {/* Mobile toggle */}
          <button
            className="md:hidden flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            onClick={() => setShowFolderPanel(p => !p)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Složky
            <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showFolderPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <div className={`rounded-xl border md:flex md:flex-col overflow-y-auto flex-1${showFolderPanel ? ' flex flex-col' : ' hidden'}`} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {/* Search */}
            <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Hledat dokumenty…"
                className="w-full px-3 py-1.5 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>

            <div className="p-2 flex flex-col gap-0.5">
              {/* Vše */}
              {(() => { const active = selectedFolder === null; return (
                <button onClick={() => setSelectedFolder(null)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  Všechny dokumenty
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{docs.length}</span>
                </button>
              ); })()}

              {/* Bez složky */}
              {docs.some(d => !d.folder_id) && (() => { const active = selectedFolder === '__none__'; return (
                <button onClick={() => setSelectedFolder('__none__')}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: active ? 'var(--bg-active)' : 'transparent', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Nezařazené
                  <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{docs.filter(d => !d.folder_id).length}</span>
                </button>
              ); })()}

              {/* Složky */}
              {folders.length > 0 && (
                <>
                  <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }} />
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Složky</span>
                    {canManage && (
                      <button onClick={() => openFolderModal()} title="Nová složka"
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ color: 'var(--primary)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    )}
                  </div>
                  <FolderTree
                    folders={folders} selectedId={selectedFolder} expanded={expanded}
                    onSelect={id => setSelectedFolder(id)} onToggle={toggle}
                    onAddSub={pid => openFolderModal(pid)} onEdit={f => openFolderModal(null, f)}
                    onDelete={deleteFolder} onShare={openShare}
                    userId={userId} canManage={canManage} items={docs} />
                </>
              )}

              {/* Nová složka tlačítko (pokud žádné složky neexistují) */}
              {folders.length === 0 && canManage && (
                <>
                  <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }} />
                  <button onClick={() => openFolderModal()}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nová složka
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
              Firemní dokumenty, soubory a útilečné odkazy
            </p>
            {canManage && (
              <div className="flex gap-2 flex-shrink-0">
                {folders.length > 0 && (
                  <button
                    onClick={() => openFolderModal()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                    Složka
                  </button>
                )}
                <button
                  onClick={() => setDocForm({ open: true, mode: 'file', name: '', url: '', description: '', folder_id: selectedFolder && selectedFolder !== '__none__' ? selectedFolder : null })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Přidat
                </button>
              </div>
            )}
          </div>

          {/* Document list */}
          {visibleDocs.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {searchQ ? 'Žádné výsledky hledání.' : selectedFolder === null ? 'Zatím žádné dokumenty.' : 'V této složce nejsou žádné dokumenty.'}
              </p>
              {canManage && !searchQ && (
                <button
                  onClick={() => setDocForm({ open: true, mode: 'file', name: '', url: '', description: '', folder_id: selectedFolder && selectedFolder !== '__none__' ? selectedFolder : null })}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  Přidat dokument
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleDocs.map(doc => {
                const folder = doc.folder_id ? folders.find(f => f.id === doc.folder_id) : null;
                return (
                  <div key={doc.id} className="rounded-xl border p-4 flex items-start gap-3 group/doc" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex-shrink-0 mt-0.5">
                      {doc.type === 'link' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      ) : getFileIcon(doc.file_mime)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => getFileUrl(doc)} className="text-sm font-medium hover:underline text-left" style={{ color: 'var(--text-primary)' }}>
                        {doc.name}
                      </button>
                      {doc.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {folder && (
                          <span className="text-xs flex items-center gap-1" style={{ color: folder.color }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            {folder.name}
                          </span>
                        )}
                        {doc.file_size && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtSize(doc.file_size)}</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(doc.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                      <button onClick={() => getFileUrl(doc)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }} title={doc.type === 'link' ? 'Otevřít odkaz' : 'Otevřít soubor'}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </button>
                      {canManage && (
                        <button onClick={() => openEditDoc(doc)} className="p-1.5 rounded" style={{ color: 'var(--text-muted)' }} title="Upravit"
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => deleteDocument(doc)} disabled={deletingDoc === doc.id}
                          className="p-1.5 rounded disabled:opacity-50" style={{ color: 'var(--text-muted)' }} title="Smazat"
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <FolderModal
        folderModal={folderModal}
        setFolderModal={setFolderModal}
        savingFolder={savingFolder}
        saveFolder={saveFolder}
      />

      <ShareModal
        shareModal={shareModal}
        setShareModal={setShareModal}
        shareType={shareType}
        setShareType={setShareType}
        shareUserIds={shareUserIds}
        setShareUserIds={setShareUserIds}
        members={members}
        userId={userId}
        saveShare={saveShare}
      />

      <DocFormModal
        docForm={docForm}
        setDocForm={setDocForm}
        editingDoc={editingDoc}
        setEditingDoc={setEditingDoc}
        savingDoc={savingDoc}
        uploadError={uploadError}
        setUploadError={setUploadError}
        fileInputRef={fileInputRef}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        handleFileChange={handleFileChange}
        saveDocument={saveDocument}
        folders={folders}
      />
    </DashboardLayout>
  );
}
