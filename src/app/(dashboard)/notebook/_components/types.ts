// ─── Notebook Types ───────────────────────────────────────────────────────────

export interface TaskItem { id: string; text: string; checked: boolean; }

export interface Note {
  id: string; workspace_id: string; user_id: string;
  title: string; content: string; tasks: TaskItem[];
  folder_id: string | null; is_favorite: boolean; is_important: boolean;
  is_archived: boolean; is_done: boolean; created_at: string; updated_at: string;
}

export interface NoteFolder {
  id: string; workspace_id: string; name: string;
  parent_id: string | null; owner_id: string; is_shared: boolean;
  sort_order: number; created_at: string; updated_at: string;
}

export interface FolderShare { id: string; folder_id: string; user_id: string | null; }

export interface Member { user_id: string; display_name: string; avatar_color: string; email?: string; }

export interface CalEventNote {
  event_ref: string; event_id: string; title: string; date: string;
  start_time: string | null; end_time: string | null; is_all_day: boolean;
  content: string; tasks: TaskItem[]; is_favorite: boolean; is_important: boolean;
}

export type NoteFilter =
  | { type: 'inbox' }
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'important' }
  | { type: 'recent' }
  | { type: 'archive' }
  | { type: 'calendar_events' }
  | { type: 'folder'; folderId: string };
