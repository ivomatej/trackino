'use client';

import type { TaskItem, TaskColumn, TaskSubtask } from '@/types/database';
import { PRIORITY_CONFIG } from '../types';
import type { Member } from '../types';
import { Avatar } from '../components/Avatar';

interface TableViewProps {
  filteredTasks: TaskItem[];
  sortedColumns: TaskColumn[];
  members: Member[];
  subtaskMap: Map<string, TaskSubtask[]>;
  sortBy: 'title' | 'assigned_to' | 'priority' | 'deadline' | 'created_at';
  sortDir: 'asc' | 'desc';
  setSortBy: (v: 'title' | 'assigned_to' | 'priority' | 'deadline' | 'created_at') => void;
  setSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  openDetail: (task: TaskItem) => void;
}

export function TableView({
  filteredTasks, sortedColumns, members, subtaskMap,
  sortBy, sortDir, setSortBy, setSortDir, openDetail,
}: TableViewProps) {
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'title') cmp = a.title.localeCompare(b.title, 'cs');
    else if (sortBy === 'priority') {
      const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      cmp = order[a.priority] - order[b.priority];
    } else if (sortBy === 'deadline') cmp = (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
    else if (sortBy === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
    else if (sortBy === 'assigned_to') cmp = (a.assigned_to ?? '').localeCompare(b.assigned_to ?? '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            {([
              { key: 'title', label: 'Název' },
              { key: 'status', label: 'Status' },
              { key: 'assigned_to', label: 'Řešitel' },
              { key: 'priority', label: 'Priorita' },
              { key: 'deadline', label: 'Termín' },
              { key: 'created_at', label: 'Vytvořeno' },
            ] as const).map(col => (
              <th key={col.key} className="text-left px-3 py-2.5 text-xs font-semibold cursor-pointer select-none"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => {
                  const k = col.key;
                  if (k === 'status') return;
                  if (sortBy === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                  else { setSortBy(k); setSortDir('asc'); }
                }}>
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortBy === col.key && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points={sortDir === 'asc' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedTasks.map(task => {
            const col = sortedColumns.find(c => c.id === task.column_id);
            const assignee = members.find(m => m.user_id === task.assigned_to);
            const pc = PRIORITY_CONFIG[task.priority];
            const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();
            const subs = subtaskMap.get(task.id) ?? [];
            return (
              <tr key={task.id} className="border-t cursor-pointer transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => openDetail(task)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td className="px-3 py-2.5 font-medium">{task.title}
                  {subs.length > 0 && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{subs.filter(s => s.is_done).length}/{subs.length}</span>}
                </td>
                <td className="px-3 py-2.5">
                  {col && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: col.color + '20', color: col.color }}>{col.name}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {assignee
                    ? <div className="flex items-center gap-1.5"><Avatar name={assignee.display_name} color={assignee.avatar_color} size={20}/><span className="text-xs">{assignee.display_name}</span></div>
                    : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>}
                </td>
                <td className="px-3 py-2.5">
                  {task.priority !== 'none' && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: pc.color + '18', color: pc.color }}>{pc.label}</span>}
                </td>
                <td className="px-3 py-2.5">
                  {task.deadline
                    ? <span className="text-xs" style={{ color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>{new Date(task.deadline).toLocaleDateString('cs-CZ')}</span>
                    : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>}
                </td>
                <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(task.created_at).toLocaleDateString('cs-CZ')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filteredTasks.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Žádné úkoly odpovídající filtrům</div>
      )}
    </div>
  );
}
