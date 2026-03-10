'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskItem, TaskSubtask } from '@/types/database';
import { PRIORITY_CONFIG } from '../types';
import { Avatar } from './Avatar';
import type { Member } from '../types';

interface SortableCardProps {
  task: TaskItem;
  members: Member[];
  subtaskMap: Map<string, TaskSubtask[]>;
  commentCountMap: Map<string, number>;
  attachCountMap: Map<string, number>;
  onOpen: (t: TaskItem) => void;
  canDrag: boolean;
  onToggleComplete?: (t: TaskItem) => void;
  isSelected?: boolean;
}

export function SortableCard({ task, members, subtaskMap, commentCountMap, attachCountMap, onOpen, canDrag, onToggleComplete, isSelected }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, disabled: !canDrag,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : task.is_completed ? 0.5 : 1 };
  const assignee = members.find(m => m.user_id === task.assigned_to);
  const subs = subtaskMap.get(task.id) ?? [];
  const doneSubs = subs.filter(s => s.is_done).length;
  const commentCount = commentCountMap.get(task.id) ?? 0;
  const attachCount = attachCountMap.get(task.id) ?? 0;
  const pc = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.deadline && new Date(task.deadline + 'T23:59:59') < new Date();

  return (
    <div ref={setNodeRef} {...attributes} {...(canDrag ? listeners : {})}
      className="rounded-lg border p-3 mb-2 cursor-pointer transition-colors overflow-hidden"
      onClick={() => onOpen(task)}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(task); }}
      style={{ ...style, background: 'var(--bg-card)', borderColor: isSelected ? 'var(--primary)' : 'var(--border)', boxShadow: isSelected ? '0 0 0 2px var(--primary)' : undefined, textDecoration: task.is_completed ? 'line-through' : 'none' }}
    >
      {/* Priority strip */}
      {task.priority !== 'none' && <div className="rounded-t-lg -mx-3 -mt-3 mb-2" style={{ height: 3, background: pc.color }} />}
      <div className="flex items-center gap-2 mb-1">
        {/* Completion checkbox */}
        {onToggleComplete && (
          <button className="flex-shrink-0" onClick={e => { e.stopPropagation(); onToggleComplete(task); }}>
            <div className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors"
              style={{ borderColor: task.is_completed ? '#22c55e' : 'var(--border)', background: task.is_completed ? '#22c55e' : 'transparent' }}>
              {task.is_completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
          </button>
        )}
        <div className="text-sm font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {task.deadline && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isOverdue ? '#ef444418' : 'var(--bg-hover)', color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
            {new Date(task.deadline).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
          </span>
        )}
        {subs.length > 0 && (
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/></svg>
            {doneSubs}/{subs.length}
          </span>
        )}
        {commentCount > 0 && (
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {commentCount}
          </span>
        )}
        {attachCount > 0 && (
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            {attachCount}
          </span>
        )}
        <div className="flex-1" />
        {assignee && <Avatar name={assignee.display_name} color={assignee.avatar_color} size={22} />}
      </div>
    </div>
  );
}
