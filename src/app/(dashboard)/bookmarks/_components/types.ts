export interface BookmarkFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  owner_id: string;
  is_shared: boolean;
  created_at: string;
}

export interface FolderShare {
  id: string;
  folder_id: string;
  user_id: string | null;
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

export interface Member {
  user_id: string;
  display_name: string;
  email: string;
  avatar_color: string;
}

export type BookmarkFilter =
  | null
  | { type: 'favorites' }
  | { type: 'shared' }
  | { type: 'recent' }
  | { type: 'unfiled' }
  | { type: 'author'; userId: string };

export const MAX_DEPTH = 5;
