'use client';

import { useAdmin } from './useAdmin';
import { NewWorkspaceForm } from './NewWorkspaceForm';
import { WorkspaceCard } from './WorkspaceCard';
import { EditWorkspaceModal } from './EditWorkspaceModal';
import { inputStyle } from './utils';
import type { WsTab } from './types';

export function AdminContent() {
  const {
    isMasterAdmin,
    loading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    copiedId,
    setCopiedId,
    editingWorkspace,
    setEditingWorkspace,
    editName,
    setEditName,
    editTariff,
    setEditTariff,
    editColor,
    setEditColor,
    editSaving,
    wsMembers,
    membersLoading,
    showNewWs,
    setShowNewWs,
    newWsName,
    setNewWsName,
    newWsTariff,
    setNewWsTariff,
    newWsColor,
    setNewWsColor,
    creatingWs,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviting,
    inviteCode,
    setInviteCode,
    openEdit,
    createNewWorkspace,
    saveEdit,
    toggleLock,
    archiveWorkspace,
    restoreWorkspace,
    softDeleteWorkspace,
    hardDeleteWorkspace,
    changeMemberRole,
    removeMember,
    addMemberByCode,
    tabCounts,
    filteredWorkspaces,
  } = useAdmin();

  if (!isMasterAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Přístup odepřen – pouze Master Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Správa workspace</h1>
        <button
          onClick={() => { setShowNewWs(v => !v); setNewWsName(''); setNewWsTariff('free'); }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--primary)' }}
        >
          + Nový workspace
        </button>
      </div>

      {/* Formulář nového workspace */}
      {showNewWs && (
        <NewWorkspaceForm
          newWsName={newWsName}
          setNewWsName={setNewWsName}
          newWsTariff={newWsTariff}
          setNewWsTariff={setNewWsTariff}
          newWsColor={newWsColor}
          setNewWsColor={setNewWsColor}
          creatingWs={creatingWs}
          onCreate={createNewWorkspace}
          onCancel={() => setShowNewWs(false)}
        />
      )}

      {/* Vyhledávání */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Hledat workspace…"
          className="w-full pl-9 pr-8 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          style={inputStyle}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {/* Záložky */}
      <div className="flex gap-1 rounded-xl p-1 mb-4" style={{ background: 'var(--bg-hover)' }}>
        {([
          { key: 'active' as WsTab,   label: 'Aktivní',      count: tabCounts.active },
          { key: 'archived' as WsTab, label: 'Archivované',  count: tabCounts.archived },
          { key: 'deleted' as WsTab,  label: 'Smazané',      count: tabCounts.deleted },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
            <span
              className="text-[10px] min-w-[18px] px-1 py-0.5 rounded-full text-center"
              style={{
                background: activeTab === tab.key ? 'var(--bg-hover)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Seznam workspace */}
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Načítám…</div>
      ) : (
        <div className="space-y-3">
          {filteredWorkspaces.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'Žádné workspace neodpovídá hledání.' : 'Žádné workspace v této kategorii.'}
            </p>
          )}
          {filteredWorkspaces.map(ws => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              copiedId={copiedId}
              setCopiedId={setCopiedId}
              onToggleLock={toggleLock}
              onArchive={archiveWorkspace}
              onRestore={restoreWorkspace}
              onSoftDelete={softDeleteWorkspace}
              onHardDelete={hardDeleteWorkspace}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      <EditWorkspaceModal
        editingWorkspace={editingWorkspace}
        setEditingWorkspace={setEditingWorkspace}
        editName={editName}
        setEditName={setEditName}
        editTariff={editTariff}
        setEditTariff={setEditTariff}
        editColor={editColor}
        setEditColor={setEditColor}
        editSaving={editSaving}
        wsMembers={wsMembers}
        membersLoading={membersLoading}
        inviteEmail={inviteEmail}
        setInviteEmail={v => { setInviteEmail(v); setInviteCode(null); }}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        inviting={inviting}
        inviteCode={inviteCode}
        onSave={saveEdit}
        onChangeMemberRole={changeMemberRole}
        onRemoveMember={removeMember}
        onAddMember={addMemberByCode}
      />
    </div>
  );
}
