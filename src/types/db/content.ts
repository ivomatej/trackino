// Trackino – typy pro obsah: prompty, záložky, poznámky (notebook)

// ─── PROMPTY ───────────────────────────────────────────────────────────────

export interface PromptFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  owner_id: string;
  is_shared: boolean;
  created_at: string;
}

export interface PromptFolderShare {
  id: string;
  folder_id: string;
  user_id: string | null; // null = celý workspace
  created_at: string;
}

export interface Prompt {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  content: string; // HTML
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PromptComment {
  id: string;
  prompt_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// ─── ZÁLOŽKY ───────────────────────────────────────────────────────────────

export interface BookmarkFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  owner_id: string;
  is_shared: boolean;
  created_at: string;
}

export interface BookmarkFolderShare {
  id: string;
  folder_id: string;
  user_id: string | null; // null = celý workspace
  created_at: string;
}

export interface Bookmark {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  url: string;
  description: string;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BookmarkComment {
  id: string;
  bookmark_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// ─── POZNÁMKY (NOTEBOOK) ───────────────────────────────────────────────────

export interface Note {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  tasks: { id: string; text: string; checked: boolean }[];
  folder_id: string | null;
  is_favorite: boolean;
  is_important: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteFolder {
  id: string;
  workspace_id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  is_shared: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NoteFolderShare {
  id: string;
  folder_id: string;
  workspace_id: string;
  user_id: string | null; // null = celý workspace
  shared_by: string;
  created_at: string;
}
