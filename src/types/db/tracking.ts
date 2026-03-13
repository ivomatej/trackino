// Trackino – typy pro sledování času (time tracking)

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

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ClientProject {
  id: string;
  client_id: string;
  project_id: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeEntryTag {
  id: string;
  time_entry_id: string;
  tag_id: string;
}

export interface MemberRate {
  id: string;
  workspace_member_id: string;
  hourly_rate: number;
  valid_from: string; // YYYY-MM-DD
  valid_to: string | null;
  created_at: string;
}
