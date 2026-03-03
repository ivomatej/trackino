// Trackino – databázové typy

export type UserRole = 'owner' | 'admin' | 'manager' | 'member';

export type Tariff = 'free' | 'pro' | 'max';

export interface RequiredFields {
  project: boolean;
  category: boolean;
  task: boolean;
  description: boolean;
  tag: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  logo_url: string | null;
  tariff: Tariff;
  week_start_day: number; // 0=Ne, 1=Po
  date_format: string;
  number_format: string;
  currency: 'CZK' | 'EUR' | 'USD';
  required_fields: RequiredFields;
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
  is_master_admin: boolean;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: UserRole;
  hourly_rate: number | null;
  monthly_hours_target: number | null;
  manager_id: string | null; // zpětná kompatibilita, preferovat manager_assignments
  hide_tags: boolean;
  joined_at: string;
}

export interface ManagerAssignment {
  id: string;
  workspace_id: string;
  member_user_id: string;
  manager_user_id: string;
  created_at: string;
}

export interface WorkspaceBilling {
  id: string;
  workspace_id: string;
  company_name: string;
  representative_name: string;
  address: string;
  postal_code: string;
  ico: string;
  dic: string;
  email: string;
  phone: string;
  billing_note: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  actor_user_id: string;
  action: string;
  target_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Invitation {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string;
  token: string;
  accepted: boolean;
  created_at: string;
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
  manager_note: string;
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
