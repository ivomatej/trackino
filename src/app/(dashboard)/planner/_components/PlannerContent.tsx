'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { usePlanner } from './usePlanner';
import { StatusManager } from './StatusManager';
import { PlannerTable } from './PlannerTable';
import { CellPicker } from './CellPicker';
import { addDays, formatDateShort, getMonday } from './utils';

export function PlannerContent() {
  const {
    loading,
    weekStart,
    setWeekStart,
    statuses,
    members,
    cells,
    splitDays,
    showStatusManager,
    setShowStatusManager,
    editingCell,
    cellPickerPos,
    hoveredCell,
    setHoveredCell,
    tooltipPos,
    setTooltipPos,
    newStatusName,
    setNewStatusName,
    newStatusColor,
    setNewStatusColor,
    editingStatus,
    setEditingStatus,
    savingStatus,
    cellPickerRef,
    canAdmin,
    weekDays,
    weekHolidays,
    workspaceTodayStr,
    isToday,
    isManager,
    managerAssignments,
    currentUserId,
    handleExpand,
    handleMerge,
    handleCellClick,
    setAvailability,
    togglePin,
    saveStatus,
    deleteStatus,
    getImportantDaysForDate,
  } = usePlanner();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout moduleName="Plánovač">
      <div style={{ minWidth: 0 }}>

        {/* Hlavička */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Plánovač</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Přehled dostupnosti týmu na aktuální týden
            </p>
          </div>
          {canAdmin && (
            <button
              onClick={() => setShowStatusManager(v => !v)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: showStatusManager ? 'var(--primary)' : 'var(--bg-hover)',
                color: showStatusManager ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              Spravovat stavy
            </button>
          )}
        </div>

        {/* Správa stavů */}
        {showStatusManager && canAdmin && (
          <StatusManager
            statuses={statuses}
            newStatusName={newStatusName}
            setNewStatusName={setNewStatusName}
            newStatusColor={newStatusColor}
            setNewStatusColor={setNewStatusColor}
            editingStatus={editingStatus}
            setEditingStatus={setEditingStatus}
            savingStatus={savingStatus}
            saveStatus={saveStatus}
            deleteStatus={deleteStatus}
          />
        )}

        {/* Navigace týdnem */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >‹</button>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatDateShort(weekStart)} – {formatDateShort(addDays(weekStart, 6))} {weekStart.getFullYear()}
          </span>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >›</button>
          <button
            onClick={() => setWeekStart(getMonday(new Date(workspaceTodayStr + 'T12:00:00')))}
            className="px-3 py-1 rounded-lg text-xs border transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >Dnes</button>
        </div>

        {/* Tabulka */}
        <PlannerTable
          weekDays={weekDays}
          weekHolidays={weekHolidays}
          members={members}
          cells={cells}
          splitDays={splitDays}
          statuses={statuses}
          hoveredCell={hoveredCell}
          setHoveredCell={setHoveredCell}
          setTooltipPos={setTooltipPos}
          isToday={isToday}
          canAdmin={canAdmin}
          isManager={isManager}
          managerAssignments={managerAssignments}
          currentUserId={currentUserId}
          handleCellClick={handleCellClick}
          handleExpand={handleExpand}
          handleMerge={handleMerge}
          togglePin={togglePin}
          getImportantDaysForDateCurried={getImportantDaysForDate}
        />

        {/* Legenda stavů */}
        {statuses.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {statuses.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{ background: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Picker stavů – floating */}
      {editingCell && cellPickerPos && (
        <CellPicker
          editingCell={editingCell}
          cellPickerPos={cellPickerPos}
          cellPickerRef={cellPickerRef}
          statuses={statuses}
          cells={cells}
          canAdmin={canAdmin}
          setAvailability={setAvailability}
        />
      )}

      {/* Tooltip pro poznámku */}
      {hoveredCell && cells[hoveredCell]?.note && tooltipPos && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg text-xs shadow-lg pointer-events-none"
          style={{
            top: tooltipPos.top - 40,
            left: tooltipPos.left,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            maxWidth: 220,
          }}
        >
          {cells[hoveredCell]?.note}
        </div>
      )}
    </DashboardLayout>
  );
}
