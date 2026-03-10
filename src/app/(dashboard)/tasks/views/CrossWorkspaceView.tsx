'use client';

import type { TaskItem } from '@/types/database';
import { PRIORITY_CONFIG, getWsColor } from '../types';
import type { Member, UserWorkspace, CwsBoardInfo, CwsColumnInfo } from '../types';

interface CrossWorkspaceViewProps {
  cwsLoading: boolean;
  cwsFilteredTasks: TaskItem[];
  cwsBoardsMap: Map<string, CwsBoardInfo>;
  cwsColsMap: Map<string, CwsColumnInfo>;
  cwsAllMembers: Map<string, Member>;
  userWorkspaces: UserWorkspace[];
  openDetail: (task: TaskItem) => void;
}

export function CrossWorkspaceView({
  cwsLoading, cwsFilteredTasks, cwsBoardsMap, cwsColsMap, cwsAllMembers,
  userWorkspaces, openDetail,
}: CrossWorkspaceViewProps) {
  return (
    <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
      {cwsLoading ? (
        <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Načítám data...
        </div>
      ) : cwsFilteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-muted)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span className="text-sm">Žádné úkoly</span>
        </div>
      ) : (
        <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)' }}>
              <th className="text-left px-4 py-2.5 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Název</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Projekt</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Workspace</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Řešitel</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Priorita</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-muted)' }}>Termín</th>
            </tr>
          </thead>
          <tbody>
            {cwsFilteredTasks.map((task, idx) => {
              const board = cwsBoardsMap.get(task.board_id);
              const col = cwsColsMap.get(task.column_id ?? '');
              const ws = userWorkspaces.find(w => w.id === board?.workspace_id);
              const wsColor = ws ? getWsColor(ws.id, ws) : '#9ca3af';
              const assignee = cwsAllMembers.get(task.assigned_to ?? '');
              const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG['none'];
              const isOverdue = task.deadline && !task.is_completed && task.deadline < new Date().toISOString().slice(0, 10);
              return (
                <tr key={task.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderTop: idx > 0 ? `1px solid var(--border)` : undefined }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => openDetail(task)}>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <span className={`text-sm font-medium truncate${task.is_completed ? ' line-through opacity-50' : ''}`}>{task.title}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {board && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: board.color + '20', color: board.color }}>{board.name}</span>}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    {ws && (
                      <span className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: wsColor }} />
                        {ws.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {assignee ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: assignee.avatar_color }}>
                          {assignee.display_name.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate max-w-[80px]">{assignee.display_name}</span>
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pc.color + '20', color: pc.color }}>
                      {pc.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    {col && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{col.name}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {task.deadline ? (
                      <span className="text-xs whitespace-nowrap" style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                        {task.deadline}
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
