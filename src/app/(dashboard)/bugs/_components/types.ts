import type { BugStatus } from '@/types/database';

export interface UserInfo {
  display_name: string;
  email: string;
}

export const STATUS_LABELS: Record<BugStatus, string> = {
  open: 'Otevřeno',
  in_progress: 'Řeší se',
  solved: 'Vyřešeno',
};

export const STATUS_COLORS: Record<BugStatus, string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  solved: '#22c55e',
};
