import type { AppChangeType, AppChangePriority, AppChangeStatus } from '@/types/database';

// ─── Konstanty ────────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<AppChangeType, string> = {
  bug: 'Bug',
  idea: 'Nápad',
  request: 'Požadavek',
  note: 'Poznámka',
};

export const TYPE_COLORS: Record<AppChangeType, string> = {
  bug: '#ef4444',
  idea: '#8b5cf6',
  request: '#3b82f6',
  note: '#6b7280',
};

export const PRIORITY_LABELS: Record<AppChangePriority, string> = {
  low: 'Nízká',
  medium: 'Střední',
  high: 'Vysoká',
};

export const PRIORITY_COLORS: Record<AppChangePriority, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
};

export const STATUS_LABELS: Record<AppChangeStatus, string> = {
  open: 'Otevřeno',
  in_progress: 'Řeší se',
  solved: 'Hotovo',
  archived: 'Archiv',
};

export const STATUS_COLORS: Record<AppChangeStatus, string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  solved: '#22c55e',
  archived: '#6b7280',
};

export const PRIORITY_BORDER: Record<AppChangePriority, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#ef4444',
};

// ─── Formulář ────────────────────────────────────────────────────────────────

export interface FormState {
  title: string;
  content: string;
  type: AppChangeType;
  priority: AppChangePriority;
  status: AppChangeStatus;
}

export const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  type: 'idea',
  priority: 'medium',
  status: 'open',
};

// ─── Filtrovací záložka ───────────────────────────────────────────────────────

export type FilterTab = 'all' | AppChangeType | 'solved' | 'archived';
