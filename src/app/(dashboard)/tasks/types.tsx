'use client';

import type { TaskPriority } from '@/types/database';

// ── Priority helpers ──
export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgentní', color: '#ef4444', dot: '#ef4444' },
  high:   { label: 'Vysoká',   color: '#f97316', dot: '#f97316' },
  medium: { label: 'Střední',  color: '#3b82f6', dot: '#3b82f6' },
  low:    { label: 'Nízká',    color: '#9ca3af', dot: '#9ca3af' },
  none:   { label: 'Žádná',    color: 'var(--text-muted)', dot: 'transparent' },
};

export type TaskView = 'list' | 'kanban' | 'table';
export type DeadlineFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'this_month' | 'no_deadline';

export interface Member {
  user_id: string;
  display_name: string;
  avatar_color: string;
  email: string;
}

// ── Cross-workspace types ──
export interface UserWorkspace { id: string; name: string; color: string | null; }
export interface CwsBoardInfo { id: string; name: string; workspace_id: string; color: string; }
export interface CwsColumnInfo { id: string; name: string; color: string; board_id: string; sort_order: number; }

export const WORKSPACE_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9'];
export const getWsColor = (wsId: string, ws?: UserWorkspace | null): string => {
  if (ws?.color) return ws.color;
  let hash = 0;
  for (let i = 0; i < wsId.length; i++) hash = wsId.charCodeAt(i) + ((hash << 5) - hash);
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length];
};

// ── Select helpers ──
export const selectCls = 'appearance-none pr-8 text-base sm:text-sm rounded-lg border px-3 py-2 w-full';
export function SelectChevron() {
  return (
    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );
}
