// Trackino – databázové typy

export type UserRole = 'owner' | 'admin' | 'manager' | 'member';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_color: string;
  language: 'cs' | 'en';
  theme: 'light' | 'dark' | 'system';
  currency: 'CZK' | 'EUR' | 'USD';
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: UserRole;
  hourly_rate: number | null;
  monthly_hours_target: number | null;
  manager_id: string | null;
  joined_at: string;
}

export interface Department {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  client: string | null;
  color: string;
  archived: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  department_id: string | null;
  name: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  category_id: string | null;
  name: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  category_id: string | null;
  description: string;
  start_time: string;
  end_time: string | null;
  duration: number | null; // v sekundách
  is_running: boolean;
  created_at: string;
  updated_at: string;
}

export interface HelpPage {
  id: string;
  workspace_id: string;
  content: string;
  updated_at: string;
}

export interface BugReport {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  content: string;
  created_at: string;
}
