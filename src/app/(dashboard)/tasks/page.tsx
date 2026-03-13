'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';

import { PRIORITY_CONFIG, selectCls, SelectChevron, getWsColor, type TaskView, type DeadlineFilter } from './types';
import { TaskLeftSidebar } from './components/TaskLeftSidebar';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { BoardSettingsModal, ShareModal, BoardEditModal, CwsNewTaskModal } from './components/TaskModals';
import { ListView } from './views/ListView';
import { KanbanView } from './views/KanbanView';
import { TableView } from './views/TableView';
import { CrossWorkspaceView } from './views/CrossWorkspaceView';

import { useTasksData } from './_hooks/useTasksData';
import { useCrossWorkspace } from './_hooks/useCrossWorkspace';
import { useTasksCrud } from './_hooks/useTasksCrud';
import { useTasksDetail } from './_hooks/useTasksDetail';

// ══════════════════════════════════════
// ██  MAIN PAGE COMPONENT
// ══════════════════════════════════════
function TasksContent() {
  const { user, profile } = useAuth();
  const { currentWorkspace, currentMembership, hasModule } = useWorkspace();
  const isMasterAdmin = profile?.is_master_admin ?? false;
  const isAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const canManage = isMasterAdmin || isAdmin || (currentMembership?.can_manage_tasks ?? false);
  const wsId = currentWorkspace?.id;

  // ── Data hook (state + fetch + computed) ──
  const {
    boards, setBoards, columns, setColumns, tasks, setTasks,
    subtasks, setSubtasks, comments, setComments, attachments, setAttachments,
    members, loading,
    folders, setFolders, folderShares, setFolderShares, boardMembers, setBoardMembers,
    activeBoardId, setActiveBoardId, expandedFolders, setExpandedFolders,
    leftOpen, setLeftOpen, sidebarCollapsed, setSidebarCollapsed,
    showBoardSettings, setShowBoardSettings,
    editingColumnId, setEditingColumnId, editColumnName, setEditColumnName,
    dragType, setDragType,
    newFolderName, setNewFolderName, addingFolder, setAddingFolder,
    newBoardName, setNewBoardName, addingBoard, setAddingBoard,
    addingBoardFolderId, setAddingBoardFolderId,
    showShareModal, setShowShareModal, shareMode, setShareMode,
    shareSelectedUsers, setShareSelectedUsers,
    showBoardModal, setShowBoardModal,
    boardModalName, setBoardModalName, boardModalColor, setBoardModalColor,
    boardModalDesc, setBoardModalDesc, boardModalFolderId, setBoardModalFolderId,
    boardModalEditId, setBoardModalEditId,
    view, setView, selectedTask, setSelectedTask,
    search, setSearch, filterAssignee, setFilterAssignee,
    filterPriority, setFilterPriority, filterDeadline, setFilterDeadline,
    onlyMine, setOnlyMine, hideCompleted, setHideCompleted,
    activeId, setActiveId,
    quickAddCol, setQuickAddCol, quickAddTitle, setQuickAddTitle,
    addingColumn, setAddingColumn, newColumnName, setNewColumnName,
    sortBy, setSortBy, sortDir, setSortDir, listSortBy, setListSortBy,
    myTasksMode, setMyTasksMode,
    favoriteBoards, toggleFavoriteBoard, isMobile, sensors,
    activeBoard, sortedColumns, doneColumnId,
    subtaskMap, commentCountMap, attachCountMap, filteredTasks,
    rootFolders, unfiledBoards, favBoards, getFolderChildren, getBoardsInFolder,
  } = useTasksData({ user, wsId, canManage, isAdmin, isMasterAdmin });

  // ── Cross-workspace hook ──
  const {
    crossWsMode, setCrossWsMode, userWorkspaces, cwsTab, setCwsTab,
    cwsLoading, cwsTasks, cwsBoardsMap, cwsColsMap, cwsAllMembers,
    showCwsFilters, setShowCwsFilters, cwsSearch, setCwsSearch,
    cwsFilterPriority, setCwsFilterPriority, cwsFilterDeadline, setCwsFilterDeadline,
    cwsFilterBoard, setCwsFilterBoard, cwsFilterAssignee, setCwsFilterAssignee,
    cwsHideCompleted, setCwsHideCompleted, cwsSortBy, setCwsSortBy, cwsSortDir, setCwsSortDir,
    showCwsNewTask, setShowCwsNewTask,
    cwsNewWsId, setCwsNewWsId, cwsNewBoardId, setCwsNewBoardId, cwsNewColId, setCwsNewColId,
    cwsNewTitle, setCwsNewTitle, cwsNewPriority, setCwsNewPriority,
    cwsNewDeadline, setCwsNewDeadline, cwsNewAssignee, setCwsNewAssignee,
    cwsNewSaving, cwsNewTaskBoards, cwsNewTaskCols, cwsNewTaskMembers,
    fetchCrossWsData, handleCreateCwsTask, cwsFilteredTasks, cwsActiveFilterCount,
  } = useCrossWorkspace({ user });

  // ── CRUD + DnD + sharing hook ──
  const {
    showFolderShareModal, setShowFolderShareModal,
    folderShareTargetId, setFolderShareTargetId,
    folderShareMode, setFolderShareMode,
    folderShareUsers, setFolderShareUsers,
    createTask, updateTask, deleteTask,
    addColumn, renameColumn, deleteColumn,
    toggleComplete, saveBoardSettings, updateColumnColor,
    createFolder, deleteFolder, renameFolder,
    createBoard, deleteBoard, updateBoard,
    saveBoardSharing, saveFolderSharing,
    handleDragStart, handleDragEnd,
  } = useTasksCrud({
    user, wsId, canManage,
    activeBoard, sortedColumns,
    tasks, setTasks, columns, setColumns,
    boards, setBoards, activeBoardId, setActiveBoardId,
    selectedTask, setSelectedTask,
    subtasks, setSubtasks, comments, setComments, attachments, setAttachments,
    folders, setFolders, folderShares, setFolderShares, boardMembers, setBoardMembers,
    showShareModal, setShowShareModal,
    shareMode, shareSelectedUsers,
    dragType, setDragType, activeId, setActiveId,
  });

  // ── Detail panel hook ──
  const {
    detailSubtasks, setDetailSubtasks,
    detailComments, setDetailComments,
    detailAttachments, setDetailAttachments,
    detailHistory,
    newComment, setNewComment,
    editingTitle, setEditingTitle,
    editTitle, setEditTitle,
    savingDesc,
    newSubtaskText, setNewSubtaskText,
    showAllHistory, setShowAllHistory,
    descRef, commentRef,
    openDetail, saveTitle, saveDescription,
    addSubtask, toggleSubtask, deleteSubtask,
    addComment, deleteComment,
    uploadFile, deleteAttachment, downloadAttachment,
    moveTaskTo, historyText,
  } = useTasksDetail({
    selectedTask, setSelectedTask,
    updateTask,
    user, wsId,
    sortedColumns, tasks,
    subtasks, setSubtasks,
    comments, setComments,
    attachments, setAttachments,
    members,
  });

  if (!hasModule('tasks')) return <DashboardLayout moduleName="Úkoly"><div /></DashboardLayout>;

  if (loading) {
    return (
      <DashboardLayout moduleName="Úkoly">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        </div>
      </DashboardLayout>
    );
  }

  // ══════════════════════════════════════
  // ██  RENDER
  // ══════════════════════════════════════

  return (
    <DashboardLayout moduleName="Úkoly">
    <div className="flex -m-4 lg:-m-6" style={{ height: 'calc(100vh - var(--topbar-height, 56px))' }}>

      {/* ── LEFT SIDEBAR ── */}
      <TaskLeftSidebar
        leftOpen={leftOpen}
        setLeftOpen={setLeftOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        addingFolder={addingFolder}
        setAddingFolder={setAddingFolder}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        addingBoard={addingBoard}
        setAddingBoard={setAddingBoard}
        newBoardName={newBoardName}
        setNewBoardName={setNewBoardName}
        addingBoardFolderId={addingBoardFolderId ?? null}
        activeBoardId={activeBoardId ?? null}
        setActiveBoardId={setActiveBoardId}
        expandedFolders={expandedFolders}
        setExpandedFolders={setExpandedFolders}
        crossWsMode={crossWsMode}
        setCrossWsMode={setCrossWsMode}
        myTasksMode={myTasksMode}
        setMyTasksMode={setMyTasksMode}
        setOnlyMine={setOnlyMine}
        setView={setView}
        setListSortBy={setListSortBy}
        fetchCrossWsData={fetchCrossWsData}
        boards={boards}
        favBoards={favBoards}
        rootFolders={rootFolders}
        unfiledBoards={unfiledBoards}
        favoriteBoards={favoriteBoards}
        toggleFavoriteBoard={toggleFavoriteBoard}
        getFolderChildren={getFolderChildren}
        getBoardsInFolder={getBoardsInFolder}
        canManage={canManage}
        createFolder={createFolder}
        deleteFolder={deleteFolder}
        renameFolder={renameFolder}
        setFolderShareTargetId={setFolderShareTargetId}
        setFolderShareMode={setFolderShareMode}
        setShowFolderShareModal={setShowFolderShareModal}
        createBoard={createBoard}
        deleteBoard={deleteBoard}
        setBoardModalEditId={setBoardModalEditId}
        setBoardModalName={setBoardModalName}
        setBoardModalColor={setBoardModalColor}
        setBoardModalDesc={setBoardModalDesc}
        setBoardModalFolderId={setBoardModalFolderId}
        setShowBoardModal={setShowBoardModal}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-4 lg:p-6">

    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
        {/* Left panel toggle (inline with header) */}
        <button className="flex-shrink-0 p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
          title={sidebarCollapsed ? 'Zobrazit projekty' : 'Skrýt projekty'}
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth >= 768) {
              setSidebarCollapsed(prev => { const next = !prev; localStorage.setItem('trackino_tasks_sidebar_collapsed', next ? '1' : '0'); return next; });
            } else {
              setLeftOpen(true);
            }
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {crossWsMode ? 'Přehled workspace' : (myTasksMode ? 'Moje úkoly' : (activeBoard?.name ?? 'Úkoly'))}
        </h1>
        {!crossWsMode && <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* View switcher */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {(['list', 'kanban', 'table'] as TaskView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors"
                style={{ background: view === v ? 'var(--primary)' : 'var(--bg-card)', color: view === v ? '#fff' : 'var(--text-muted)' }}>
                {v === 'list' ? 'Seznam' : v === 'kanban' ? 'Kanban' : 'Tabulka'}
              </button>
            ))}
          </div>

          {/* List sort selector */}
          {view === 'list' && (
            <div className="relative">
              <select value={listSortBy} onChange={e => setListSortBy(e.target.value as typeof listSortBy)}
                className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 140 }}>
                <option value="default">Dle sloupce</option>
                <option value="updated_at">Naposledy přiřazené</option>
                <option value="created_at">Nejnovější</option>
                <option value="deadline">Dle termínu</option>
                <option value="priority">Dle priority</option>
                <option value="title">Dle názvu</option>
              </select>
              <SelectChevron />
            </div>
          )}

          <div className="flex-1" />

          {/* Only mine toggle */}
          <button onClick={() => setOnlyMine(!onlyMine)}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors"
            style={{ background: onlyMine ? 'var(--primary)' : 'var(--bg-card)', color: onlyMine ? '#fff' : 'var(--text-muted)', borderColor: onlyMine ? 'var(--primary)' : 'var(--border)' }}>
            Moje úkoly
          </button>

          {/* Hide completed toggle */}
          <button onClick={() => setHideCompleted(!hideCompleted)}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors"
            style={{ background: hideCompleted ? 'var(--bg-hover)' : 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            {hideCompleted ? 'Skrýt hotové' : 'Zobrazit vše'}
          </button>

          {/* Settings button */}
          {canManage && activeBoard && (
            <button onClick={() => setShowBoardSettings(true)} className="p-1.5 rounded-lg transition-colors" title="Nastavení projektu"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          )}

          {/* Share button */}
          {canManage && activeBoard && (
            <button onClick={() => {
              const bm = boardMembers.filter(m => m.board_id === activeBoard.id);
              setShareMode(activeBoard.is_shared ? 'users' : 'none');
              setShareSelectedUsers(new Set(bm.map(m => m.user_id)));
              setShowShareModal(true);
            }} className="p-1.5 rounded-lg transition-colors" title="Sdílet projekt"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          )}

          {/* New task button */}
          {canManage && (
            <button onClick={async () => {
              const firstCol = sortedColumns[0];
              if (!firstCol) return;
              const t = await createTask('Nový úkol', firstCol.id);
              if (t) openDetail(t);
            }}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              + Nový úkol
            </button>
          )}
        </div>}
        {crossWsMode && (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="flex-1" />
            {/* Reload */}
            <button onClick={() => fetchCrossWsData(true)}
              className="p-1.5 rounded-lg transition-colors" title="Obnovit data"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            {/* Filters toggle */}
            <button onClick={() => setShowCwsFilters(!showCwsFilters)}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors flex items-center gap-1.5"
              style={{ background: showCwsFilters ? 'var(--bg-hover)' : 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" strokeWidth="3"/></svg>
              Filtry
              {cwsActiveFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold text-white" style={{ background: 'var(--primary)' }}>{cwsActiveFilterCount}</span>
              )}
            </button>
            {/* New task */}
            <button onClick={() => { setCwsNewWsId(userWorkspaces[0]?.id ?? ''); setShowCwsNewTask(true); }}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              + Nový úkol
            </button>
          </div>
        )}
      </div>

      {/* ── Cross-workspace workspace tabs ── */}
      {crossWsMode && (
        <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setCwsTab('all')}
            className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex-shrink-0"
            style={{ background: cwsTab === 'all' ? 'var(--primary)' : 'var(--bg-hover)', color: cwsTab === 'all' ? '#fff' : 'var(--text-muted)' }}>
            Vše ({cwsFilteredTasks.length})
          </button>
          {userWorkspaces.map(ws => {
            const wsColor = getWsColor(ws.id, ws);
            const wsTasks = cwsTasks.filter(t => cwsBoardsMap.get(t.board_id)?.workspace_id === ws.id);
            return (
              <button key={ws.id} onClick={() => setCwsTab(ws.id)}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-colors flex-shrink-0 border"
                style={{ background: cwsTab === ws.id ? wsColor + '18' : 'var(--bg-hover)', color: cwsTab === ws.id ? wsColor : 'var(--text-muted)', borderColor: cwsTab === ws.id ? wsColor + '50' : 'transparent' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: wsColor }} />
                {ws.name}
                <span className="opacity-60">({wsTasks.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters row ── */}
      {!crossWsMode && <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat úkol..."
            className="text-base sm:text-sm rounded-lg border pl-8 pr-3 py-2 w-full" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        </div>

        {/* Assignee filter */}
        <div className="relative">
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
            className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 130 }}>
            <option value="all">Všichni</option>
            <option value="unassigned">Nepřiřazené</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </select>
          <SelectChevron />
        </div>

        {/* Priority filter */}
        <div className="relative">
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as typeof filterPriority)}
            className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 110 }}>
            <option value="all">Priorita</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <SelectChevron />
        </div>

        {/* Deadline filter */}
        <div className="relative">
          <select value={filterDeadline} onChange={e => setFilterDeadline(e.target.value as DeadlineFilter)}
            className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 120 }}>
            <option value="all">Termín</option>
            <option value="overdue">Po termínu</option>
            <option value="today">Dnes</option>
            <option value="this_week">Tento týden</option>
            <option value="this_month">Tento měsíc</option>
            <option value="no_deadline">Bez termínu</option>
          </select>
          <SelectChevron />
        </div>
      </div>}

      {/* ── Cross-workspace search + filters ── */}
      {crossWsMode && (
        <div className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={cwsSearch} onChange={e => setCwsSearch(e.target.value)} placeholder="Hledat úkol..."
                className="text-base sm:text-sm rounded-lg border pl-8 pr-3 py-2 w-full" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {/* Sort */}
            <div className="relative">
              <select value={cwsSortBy} onChange={e => setCwsSortBy(e.target.value as typeof cwsSortBy)}
                className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 140 }}>
                <option value="deadline">Dle termínu</option>
                <option value="priority">Dle priority</option>
                <option value="title">Dle názvu</option>
                <option value="created_at">Nejnovější</option>
              </select>
              <SelectChevron />
            </div>
            {/* Sort direction */}
            <button onClick={() => setCwsSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg border transition-colors" title={cwsSortDir === 'asc' ? 'Vzestupně' : 'Sestupně'}
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              {cwsSortDir === 'asc' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              )}
            </button>
            {/* Hide completed */}
            <button onClick={() => setCwsHideCompleted(!cwsHideCompleted)}
              className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border font-medium transition-colors"
              style={{ background: cwsHideCompleted ? 'var(--bg-hover)' : 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              {cwsHideCompleted ? 'Skrýt hotové' : 'Zobrazit vše'}
            </button>
          </div>
          {/* Collapsible filter panel */}
          {showCwsFilters && (
            <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {/* Priority */}
              <div className="relative">
                <select value={cwsFilterPriority} onChange={e => setCwsFilterPriority(e.target.value as typeof cwsFilterPriority)}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 110 }}>
                  <option value="all">Priorita</option>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <SelectChevron />
              </div>
              {/* Deadline */}
              <div className="relative">
                <select value={cwsFilterDeadline} onChange={e => setCwsFilterDeadline(e.target.value as DeadlineFilter)}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 120 }}>
                  <option value="all">Termín</option>
                  <option value="overdue">Po termínu</option>
                  <option value="today">Dnes</option>
                  <option value="this_week">Tento týden</option>
                  <option value="this_month">Tento měsíc</option>
                  <option value="no_deadline">Bez termínu</option>
                </select>
                <SelectChevron />
              </div>
              {/* Board / project */}
              <div className="relative">
                <select value={cwsFilterBoard} onChange={e => setCwsFilterBoard(e.target.value)}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 140 }}>
                  <option value="all">Projekt</option>
                  {[...cwsBoardsMap.values()].map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <SelectChevron />
              </div>
              {/* Assignee */}
              <div className="relative">
                <select value={cwsFilterAssignee} onChange={e => setCwsFilterAssignee(e.target.value)}
                  className={selectCls} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 130 }}>
                  <option value="all">Řešitel</option>
                  <option value="mine">Moje</option>
                  {[...cwsAllMembers.values()].map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                </select>
                <SelectChevron />
              </div>
              {/* Reset */}
              {cwsActiveFilterCount > 0 && (
                <button onClick={() => { setCwsFilterPriority('all'); setCwsFilterDeadline('all'); setCwsFilterBoard('all'); setCwsFilterAssignee('all'); }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                  style={{ color: '#ef4444', borderColor: '#ef444440', background: '#ef444408' }}>
                  Vymazat filtry
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VIEWS ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-w-0 overflow-auto">

          {/* Cross-workspace table view */}
          {crossWsMode && (
            <CrossWorkspaceView
              cwsLoading={cwsLoading}
              cwsFilteredTasks={cwsFilteredTasks}
              cwsBoardsMap={cwsBoardsMap}
              cwsColsMap={cwsColsMap}
              cwsAllMembers={cwsAllMembers}
              userWorkspaces={userWorkspaces}
              openDetail={openDetail}
            />
          )}

          {/* List view */}
          {!crossWsMode && view === 'list' && (
            <ListView
              filteredTasks={filteredTasks}
              sortedColumns={sortedColumns}
              listSortBy={listSortBy}
              hideCompleted={hideCompleted}
              doneColumnId={doneColumnId}
              myTasksMode={myTasksMode}
              boards={boards}
              members={members}
              subtaskMap={subtaskMap}
              openDetail={openDetail}
              toggleComplete={toggleComplete}
            />
          )}

          {/* Kanban view */}
          {!crossWsMode && view === 'kanban' && (
            <KanbanView
              sortedColumns={sortedColumns}
              filteredTasks={filteredTasks}
              activeBoard={activeBoard}
              members={members}
              subtaskMap={subtaskMap}
              commentCountMap={commentCountMap}
              attachCountMap={attachCountMap}
              selectedTask={selectedTask}
              canManage={canManage}
              isMobile={isMobile}
              activeId={activeId}
              dragType={dragType}
              tasks={tasks}
              editingColumnId={editingColumnId}
              editColumnName={editColumnName}
              quickAddCol={quickAddCol}
              quickAddTitle={quickAddTitle}
              addingColumn={addingColumn}
              newColumnName={newColumnName}
              sensors={sensors}
              setEditingColumnId={setEditingColumnId}
              setEditColumnName={setEditColumnName}
              setQuickAddCol={setQuickAddCol}
              setQuickAddTitle={setQuickAddTitle}
              setAddingColumn={setAddingColumn}
              setNewColumnName={setNewColumnName}
              openDetail={openDetail}
              toggleComplete={toggleComplete}
              renameColumn={renameColumn}
              deleteColumn={deleteColumn}
              createTask={createTask}
              addColumn={addColumn}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
            />
          )}

          {/* Table view */}
          {!crossWsMode && view === 'table' && (
            <TableView
              filteredTasks={filteredTasks}
              sortedColumns={sortedColumns}
              members={members}
              subtaskMap={subtaskMap}
              sortBy={sortBy}
              sortDir={sortDir}
              setSortBy={setSortBy}
              setSortDir={setSortDir}
              openDetail={openDetail}
            />
          )}

        </div>

        {/* Detail panel */}
        {selectedTask && (
          <TaskDetailPanel
            selectedTask={selectedTask}
            setSelectedTask={setSelectedTask}
            crossWsMode={crossWsMode}
            cwsBoardsMap={cwsBoardsMap}
            userWorkspaces={userWorkspaces}
            cwsColsMap={cwsColsMap}
            boards={boards}
            sortedColumns={sortedColumns}
            activeBoard={activeBoard ?? undefined}
            members={members}
            canManage={canManage}
            toggleComplete={toggleComplete}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            saveTitle={saveTitle}
            descRef={descRef}
            saveDescription={saveDescription}
            detailSubtasks={detailSubtasks}
            setDetailSubtasks={setDetailSubtasks}
            toggleSubtask={toggleSubtask}
            addSubtask={addSubtask}
            deleteSubtask={deleteSubtask}
            newSubtaskText={newSubtaskText}
            setNewSubtaskText={setNewSubtaskText}
            detailAttachments={detailAttachments}
            downloadAttachment={downloadAttachment}
            deleteAttachment={deleteAttachment}
            uploadFile={uploadFile}
            detailComments={detailComments}
            deleteComment={deleteComment}
            commentRef={commentRef}
            setNewComment={setNewComment}
            addComment={addComment}
            showAllHistory={showAllHistory}
            setShowAllHistory={setShowAllHistory}
            detailHistory={detailHistory}
            historyText={historyText}
            deleteTask={deleteTask}
            updateTask={updateTask}
            moveTaskTo={moveTaskTo}
            userId={user?.id}
          />
        )}
      </div>
    </div>

      {/* ── Modals ── */}
      {activeBoard && showBoardSettings && (
        <BoardSettingsModal
          showBoardSettings={showBoardSettings}
          setShowBoardSettings={setShowBoardSettings}
          activeBoard={activeBoard}
          sortedColumns={sortedColumns}
          setColumns={setColumns}
          saveBoardSettings={saveBoardSettings}
          updateColumnColor={updateColumnColor}
        />
      )}

      {activeBoard && showShareModal && (
        <ShareModal
          showShareModal={showShareModal}
          setShowShareModal={setShowShareModal}
          activeBoard={activeBoard}
          shareMode={shareMode}
          setShareMode={setShareMode}
          shareSelectedUsers={shareSelectedUsers}
          setShareSelectedUsers={setShareSelectedUsers}
          members={members}
          userId={user?.id}
          saveBoardSharing={saveBoardSharing}
        />
      )}

      <BoardEditModal
        showBoardModal={showBoardModal}
        setShowBoardModal={setShowBoardModal}
        boardModalEditId={boardModalEditId}
        setBoardModalEditId={setBoardModalEditId}
        boardModalName={boardModalName}
        setBoardModalName={setBoardModalName}
        boardModalColor={boardModalColor}
        setBoardModalColor={setBoardModalColor}
        boardModalDesc={boardModalDesc}
        setBoardModalDesc={setBoardModalDesc}
        boardModalFolderId={boardModalFolderId}
        setBoardModalFolderId={setBoardModalFolderId}
        folders={folders}
        deleteBoard={deleteBoard}
        createBoard={createBoard}
        updateBoard={updateBoard}
        setShowShareModal={setShowShareModal}
      />

      </div>

      <CwsNewTaskModal
        showCwsNewTask={showCwsNewTask}
        setShowCwsNewTask={setShowCwsNewTask}
        userWorkspaces={userWorkspaces}
        cwsNewWsId={cwsNewWsId}
        setCwsNewWsId={setCwsNewWsId}
        cwsNewBoardId={cwsNewBoardId}
        setCwsNewBoardId={setCwsNewBoardId}
        cwsNewColId={cwsNewColId}
        setCwsNewColId={setCwsNewColId}
        cwsNewTitle={cwsNewTitle}
        setCwsNewTitle={setCwsNewTitle}
        cwsNewPriority={cwsNewPriority}
        setCwsNewPriority={setCwsNewPriority}
        cwsNewDeadline={cwsNewDeadline}
        setCwsNewDeadline={setCwsNewDeadline}
        cwsNewAssignee={cwsNewAssignee}
        setCwsNewAssignee={setCwsNewAssignee}
        cwsNewSaving={cwsNewSaving}
        cwsNewTaskBoards={cwsNewTaskBoards}
        cwsNewTaskCols={cwsNewTaskCols}
        cwsNewTaskMembers={cwsNewTaskMembers}
        handleCreateCwsTask={handleCreateCwsTask}
      />

    </div>
    </DashboardLayout>
  );
}

/* ── Export ── */

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <TasksContent />
    </WorkspaceProvider>
  );
}
