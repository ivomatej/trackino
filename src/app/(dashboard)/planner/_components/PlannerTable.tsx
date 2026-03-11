'use client';

import React from 'react';
import type { AvailabilityStatus } from '@/types/database';
import type { MemberRow, CellKey, DayKey } from './types';
import { toDateStr, formatDayName, formatDateShort, packStripLanes, getImportantDaysForDate } from './utils';
import { isCzechHoliday } from '@/lib/czech-calendar';
import { CellFull } from './CellFull';
import { CellHalf } from './CellHalf';
import { IconSplit, IconMerge } from './icons';

interface PlannerTableProps {
  weekDays: Date[];
  weekHolidays: { date: Date; name: string }[];
  members: MemberRow[];
  cells: Record<CellKey, { statusId: string | null; note: string }>;
  splitDays: Set<DayKey>;
  statuses: AvailabilityStatus[];
  hoveredCell: CellKey | null;
  setHoveredCell: (k: CellKey | null) => void;
  setTooltipPos: (p: { top: number; left: number } | null) => void;
  isToday: (d: Date) => boolean;
  canAdmin: boolean;
  isManager: boolean;
  managerAssignments: { member_user_id: string; manager_user_id: string }[];
  currentUserId: string | undefined;
  handleCellClick: (userId: string, date: string, half: 'am' | 'pm' | 'full', e: { currentTarget: EventTarget | null }) => void;
  handleExpand: (userId: string, date: string) => void;
  handleMerge: (userId: string, date: string) => void;
  togglePin: (userId: string) => void;
  getImportantDaysForDateCurried: (date: Date) => ReturnType<typeof getImportantDaysForDate>;
}

export function PlannerTable({
  weekDays,
  weekHolidays,
  members,
  cells,
  splitDays,
  statuses,
  hoveredCell,
  setHoveredCell,
  setTooltipPos,
  isToday,
  canAdmin,
  isManager,
  managerAssignments,
  currentUserId,
  handleCellClick,
  handleExpand,
  handleMerge,
  togglePin,
  getImportantDaysForDateCurried,
}: PlannerTableProps) {
  return (
    <div className="rounded-2xl border overflow-x-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          {(() => {
            // ── Sestavení proužků ────────────────────────────────────
            type StripItem = { id: string; title: string; color: string; startCol: number; endCol: number };
            const stripsArr: StripItem[] = [];

            // Státní svátky (jednodenvní proužky)
            weekDays.forEach((day, colIdx) => {
              const h = isCzechHoliday(day, weekHolidays);
              if (h.isHoliday) {
                stripsArr.push({ id: `holiday-${colIdx}`, title: '🎉 ' + h.name, color: '#ef4444', startCol: colIdx, endCol: colIdx });
              }
            });

            // Důležité dny (mohou přesahovat přes více dní týdne)
            const importantDaysThisWeek = weekDays.flatMap(d => getImportantDaysForDateCurried(d));
            const processed = new Set<string>();
            importantDaysThisWeek.forEach(imp => {
              if (processed.has(imp.id)) return;
              const matchingCols = weekDays
                .map((d, i) => (getImportantDaysForDateCurried(d).some(x => x.id === imp.id) ? i : -1))
                .filter(i => i >= 0);
              if (!matchingCols.length) return;
              processed.add(imp.id);
              // Skupiny po sobě jdoucích sloupců → samostatné proužky
              let spanStart = matchingCols[0];
              let prev = matchingCols[0];
              for (let i = 1; i <= matchingCols.length; i++) {
                const col = i < matchingCols.length ? matchingCols[i] : -1;
                if (col !== prev + 1) {
                  stripsArr.push({ id: `${imp.id}-${spanStart}`, title: imp.title, color: imp.color, startCol: spanStart, endCol: prev });
                  spanStart = col;
                }
                prev = col;
              }
            });

            const stripLanes = packStripLanes(stripsArr);

            return (
              <>
                {/* Záhlaví dnů – vždy nahoře */}
                <tr style={{ borderBottom: stripsArr.length === 0 ? '1px solid var(--border)' : 'none' }}>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-semibold"
                    style={{ color: 'var(--text-muted)', width: 160, background: 'var(--bg-card)' }}
                  >
                    Člen
                  </th>
                  {weekDays.map(day => (
                    <th
                      key={toDateStr(day)}
                      className="px-1 py-2 text-center text-xs font-semibold"
                      style={{
                        color: isToday(day) ? 'var(--primary)' : 'var(--text-muted)',
                        background: isToday(day)
                          ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
                          : 'var(--bg-card)',
                        minWidth: 110,
                      }}
                    >
                      <div>{formatDayName(day)}</div>
                      <div className="font-normal mt-0.5">{formatDateShort(day)}</div>
                    </th>
                  ))}
                </tr>

                {/* Řádky proužků (pod záhlavím dnů) */}
                {stripLanes.map((lane, laneIdx) => {
                  const laneNodes: React.ReactNode[] = [];
                  let col = 0;
                  for (const strip of lane) {
                    if (strip.startCol > col) {
                      laneNodes.push(
                        <th key={`gap-${laneIdx}-${col}`} colSpan={strip.startCol - col}
                          style={{ padding: '2px 0', background: 'var(--bg-card)', borderBottom: laneIdx === stripLanes.length - 1 ? '1px solid var(--border)' : 'none' }} />
                      );
                    }
                    const span = strip.endCol - strip.startCol + 1;
                    laneNodes.push(
                      <th key={strip.id} colSpan={span}
                        style={{ padding: '2px 3px', background: 'var(--bg-card)', borderBottom: laneIdx === stripLanes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div
                          title={strip.title}
                          style={{
                            background: strip.color + '22',
                            color: strip.color,
                            borderRadius: 5,
                            padding: '2px 7px',
                            fontSize: 10,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textAlign: 'left',
                            lineHeight: '1.4',
                          }}
                        >
                          {strip.title}
                        </div>
                      </th>
                    );
                    col = strip.endCol + 1;
                  }
                  if (col < 7) {
                    laneNodes.push(
                      <th key={`gap-end-${laneIdx}`} colSpan={7 - col}
                        style={{ padding: '2px 0', background: 'var(--bg-card)', borderBottom: laneIdx === stripLanes.length - 1 ? '1px solid var(--border)' : 'none' }} />
                    );
                  }
                  return (
                    <tr key={`strip-lane-${laneIdx}`}>
                      <th style={{ width: 160, background: 'var(--bg-card)', padding: '2px 0', borderBottom: laneIdx === stripLanes.length - 1 ? '1px solid var(--border)' : 'none' }} />
                      {laneNodes}
                    </tr>
                  );
                })}
              </>
            );
          })()}
        </thead>
        <tbody>
          {members.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                Žádní členové k zobrazení.
              </td>
            </tr>
          )}
          {members.map((member, rowIdx) => {
            const canEdit = member.userId === currentUserId || canAdmin ||
              (isManager && managerAssignments.some(a => a.member_user_id === member.userId));

            return (
              <tr
                key={member.userId}
                style={{ borderBottom: rowIdx < members.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                {/* Jméno */}
                <td className="px-3 py-2" style={{ background: 'var(--bg-card)', verticalAlign: 'middle' }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: member.avatarColor }}
                    >
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium truncate max-w-[90px]" style={{ color: 'var(--text-primary)' }}>
                      {member.displayName}
                    </span>
                    {!member.isSelf && (
                      <button
                        onClick={() => togglePin(member.userId)}
                        title={member.isPinned ? 'Odepnout' : 'Připnout'}
                        className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: member.isPinned ? 'var(--primary)' : 'var(--text-muted)' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24"
                          fill={member.isPinned ? 'currentColor' : 'none'}
                          stroke="currentColor" strokeWidth="2"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>

                {/* Buňky dní */}
                {weekDays.map(day => {
                  const dateStr = toDateStr(day);
                  const dayKey: DayKey = `${member.userId}|${dateStr}`;
                  const isSplit = splitDays.has(dayKey);

                  const amKey: CellKey = `${member.userId}|${dateStr}|am`;
                  const pmKey: CellKey = `${member.userId}|${dateStr}|pm`;
                  const fullKey: CellKey = `${member.userId}|${dateStr}|full`;

                  const amCell = cells[amKey];
                  const pmCell = cells[pmKey];
                  const fullCell = cells[fullKey];

                  const amStatus = amCell?.statusId
                    ? statuses.find(s => s.id === amCell.statusId) ?? null : null;
                  const pmStatus = pmCell?.statusId
                    ? statuses.find(s => s.id === pmCell.statusId) ?? null : null;
                  const fullStatus = fullCell?.statusId
                    ? statuses.find(s => s.id === fullCell.statusId) ?? null : null;

                  return (
                    <td
                      key={dateStr}
                      className="px-1.5 py-1.5"
                      style={{ background: 'transparent', verticalAlign: 'middle' }}
                    >
                      <div className="relative group">
                        {isSplit ? (
                          /* ── Rozdělený režim (DOP + ODP) ── */
                          <>
                            <div className="flex flex-col gap-0.5">
                              <CellHalf
                                label="DOP"
                                status={amStatus}
                                note={amCell?.note ?? ''}
                                canEdit={canEdit}
                                onClick={e => handleCellClick(member.userId, dateStr, 'am', e)}
                                cellKey={amKey}
                                hoveredCell={hoveredCell}
                                setHoveredCell={setHoveredCell}
                                setTooltipPos={setTooltipPos}
                              />
                              <CellHalf
                                label="ODP"
                                status={pmStatus}
                                note={pmCell?.note ?? ''}
                                canEdit={canEdit}
                                onClick={e => handleCellClick(member.userId, dateStr, 'pm', e)}
                                cellKey={pmKey}
                                hoveredCell={hoveredCell}
                                setHoveredCell={setHoveredCell}
                                setTooltipPos={setTooltipPos}
                              />
                            </div>
                            {/* Tlačítko sloučení – pravý horní roh, viditelné na hover */}
                            {canEdit && (
                              <button
                                className="absolute top-0 right-0 p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                                onClick={e => { e.stopPropagation(); handleMerge(member.userId, dateStr); }}
                                title="Sloučit na celý den"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <IconMerge />
                              </button>
                            )}
                          </>
                        ) : (
                          /* ── Celý den (výchozí) ── */
                          <>
                            <CellFull
                              status={fullStatus}
                              note={fullCell?.note ?? ''}
                              canEdit={canEdit}
                              onClick={e => handleCellClick(member.userId, dateStr, 'full', e)}
                              cellKey={fullKey}
                              hoveredCell={hoveredCell}
                              setHoveredCell={setHoveredCell}
                              setTooltipPos={setTooltipPos}
                            />
                            {/* Tlačítko rozdělení – pravý horní roh, viditelné na hover */}
                            {canEdit && (
                              <button
                                className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                                onClick={e => { e.stopPropagation(); handleExpand(member.userId, dateStr); }}
                                title="Rozdělit na DOP / ODP"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <IconSplit />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
