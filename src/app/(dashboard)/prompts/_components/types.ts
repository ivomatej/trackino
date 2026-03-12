export const MAX_DEPTH = 5;

export interface PromptFolder {
  id: string; workspace_id: string; parent_id: string | null;
  name: string; owner_id: string; is_shared: boolean; created_at: string;
}

export interface FolderShare { id: string; folder_id: string; user_id: string | null; }

export interface Prompt {
  id: string; workspace_id: string; folder_id: string | null;
  title: string; content: string; is_shared: boolean;
  created_by: string; created_at: string; updated_at: string;
}

export interface PromptComment {
  id: string; prompt_id: string; user_id: string; content: string; created_at: string;
}

export interface Member {
  user_id: string; display_name: string; email: string; avatar_color: string;
}

export type PromptFilter =
  | null
  | { type: 'favorites' }
  | { type: 'shared' }
  | { type: 'recent' }
  | { type: 'unfiled' }
  | { type: 'author'; userId: string };
