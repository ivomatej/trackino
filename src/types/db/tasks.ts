// Trackino – typy pro úkolník (task boards, kanban)

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface TaskBoardSettings {
  auto_complete_column_id?: string | null;
  column_colors_enabled?: boolean;
  detail_size?: 'compact' | 'normal' | 'large';
}

export interface TaskBoard {
  id: string;
  workspace_id: string;
  name: string;
  created_by: string;
  settings: TaskBoardSettings;
  folder_id: string | null;
  color: string;
  description: string;
  is_shared: boolean;
  created_at: string;
}

export interface TaskColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface TaskItem {
  id: string;
  workspace_id: string;
  board_id: string;
  column_id: string | null;
  title: string;
  description: string;
  priority: TaskPriority;
  deadline: string | null;
  sort_order: number;
  created_by: string;
  assigned_to: string | null;
  reviewer_id?: string | null;
  time_estimate?: number | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  assigned_to: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_mime: string;
  uploaded_by: string;
  created_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface TaskFolder {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  sort_order: number;
  parent_id: string | null;
  created_by: string;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskFolderShare {
  id: string;
  folder_id: string;
  workspace_id: string;
  user_id: string | null;
  shared_by: string;
  created_at: string;
}

export interface TaskBoardMember {
  id: string;
  board_id: string;
  workspace_id: string;
  user_id: string;
  can_edit: boolean;
  created_at: string;
}
