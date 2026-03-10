import type { ModuleId } from '@/types/database';

export interface MemberModuleInfo {
  user_id: string;
  display_name: string;
  email: string;
  avatar_color: string;
  role: string;
  overrides: { id: string; module_id: ModuleId; enabled: boolean }[];
}

export interface AiMemberInfo {
  user_id: string;
  display_name: string;
  email: string;
  avatar_color: string;
  role: string;
  is_master_admin: boolean;
  can_use_ai_assistant: boolean;
  ai_allowed_models: string[] | null;
}

export interface CronSchedule {
  timezone: string;
  hours: number[];
  minutes: number[];
  wdays: number[];
  mdays: number[];
  months: number[];
  expiresAt: number;
}

export interface CronJob {
  jobId: number;
  url: string;
  title: string;
  enabled: boolean;
  schedule: CronSchedule;
}

export interface CronHistoryItem {
  historyId: number;
  identifier: string;
  date: number;
  duration: number;
  status: number;
  httpStatus: number;
}

export interface CronTemplate {
  id: string;
  title: string;
  description: string;
  url: string;
  scheduleLabel: string;
  schedule: CronSchedule;
}
