'use client';

import type { TaskItem, TaskColumn, TaskBoard, TaskSubtask } from '@/types/database';
import { PRIORITY_CONFIG } from '../types';
import type { Member } from '../types';
import { Avatar } from '../components/Avatar';

interface ListViewProps {
  filteredTasks: TaskItem[];
  sortedColumns: TaskColumn[];
  listSortBy: 'default' | 'updated_at' | 'created_at' | 'deadline' | 'priority' | 'title';
  hideCompleted: boolean;
  doneColumnId: string | null;
  myTasksMode: boolean;
  boards: TaskBoard[];
  members: Member[];
  subtaskMap: Map<string, TaskSubtask[]>;
  openDetail: (task: TaskItem) => void;
  toggleComplete: (task: TaskItem) => Promise<void>;
}

export function ListView({
  filteredTasks, sortedColumns, listSortBy, hideCompleted, doneColumnId,
  myTasksMode, boards, members, subtaskMap, openDetail, toggleComplete,
}: ListViewProps) {
  const sortTasksList = (list: TaskItem[]): TaskItem[] => {
    if (listSortBy === 'default') return list;
    return [...list].sort((a, b) => {
      if (listSortBy === 'updated_at') return (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at);
      if (listSortBy === 'created_at') return b.created_at.localeCompare(a.created_at);
      if (listSortBy === 'deadline') return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
      if (listSortBy === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        return order[a.priority] - order[b.priority];
      }
      if (listSortBy === 'title') return a.title.localeCompare(b.title, 'cs');
      return 0;
    });
  };

  const renderListRow = (task: TaskItem) => {
    const assignee = members.find(m => m.user_id === task.assigned_to);
    const subs = subtaskMap.get(task.id) ?? [];
    const doneSubs = subs.filter(s => s.is_done).length;
    const pc = PRIORITY_CONFIG[task.priority];
    const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();
    const boardName = myTasksMode ? boards.find(b => b.id === task.board_id)?.name : null;
    return (
      <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-colors"
        onClick={() => openDetail(task)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') openDetail(task); }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{ background: 'transparent' }}>
        <button className="flex-shrink-0" onClick={e => { e.stopPropagation(); toggleComplete(task); }}>
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors" style={{ borderColor: task.is_completed ? '#22c55e' : 'var(--border)', background: task.is_completed ? '#22c55e' : 'transparent' }}>
            {task.is_completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
          </div>
        </button>
        <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)', textDecoration: task.is_completed ? 'line-through' : 'none', opacity: task.is_completed ? 0.5 : 1 }}>{task.title}</span>
        {boardName && <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{boardName}</span>}
        {task.priority !== 'none' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: pc.color + '18', color: pc.color }}>{pc.label}</span>
        )}
        {subs.length > 0 && (
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{doneSubs}/{subs.length}</span>
        )}
        {task.deadline && (
          <span className="text-xs flex-shrink-0" style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
            {new Date(task.deadline).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
          </span>
        )}
        {assignee ? <Avatar name={assignee.display_name} color={assignee.avatar_color} size={22} /> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {listSortBy !== 'default' ? (
        <>
          {sortTasksList(filteredTasks).map(renderListRow)}
          {filteredTasks.length === 0 && <div className="text-xs py-2 px-3" style={{ color: 'var(--text-muted)' }}>Žádné úkoly</div>}
        </>
      ) : (
        sortedColumns.map(col => {
          const colTasks = filteredTasks.filter(t => t.column_id === col.id).sort((a, b) => a.sort_order - b.sort_order);
          if (hideCompleted && col.id === doneColumnId && colTasks.length === 0) return null;
          return (
            <div key={col.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>{colTasks.length}</span>
              </div>
              {colTasks.map(renderListRow)}
              {colTasks.length === 0 && <div className="text-xs py-2 px-3" style={{ color: 'var(--text-muted)' }}>Žádné úkoly</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
