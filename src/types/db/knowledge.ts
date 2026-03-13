// Trackino – typy pro znalostní bázi (KB)

export type KbPageStatus = 'draft' | 'active' | 'archived';

export interface KbFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  owner_id: string;
  is_shared?: boolean;
  created_at: string;
  updated_at: string;
}

export interface KbFolderShare {
  id: string;
  folder_id: string;
  workspace_id: string;
  user_id: string | null;
  shared_by: string;
}

export interface KbPage {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  content: string;
  tasks: { id: string; text: string; checked: boolean }[];
  status: KbPageStatus;
  tags: string[];
  is_restricted: boolean;
  public_token: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbVersion {
  id: string;
  page_id: string;
  workspace_id: string;
  content: string;
  title: string;
  edited_by: string;
  created_at: string;
}

export interface KbComment {
  id: string;
  page_id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface KbReview {
  id: string;
  workspace_id: string;
  page_id: string | null;
  folder_id: string | null;
  assigned_to: string;
  review_date: string;
  note: string;
  is_done: boolean;
  created_by: string;
  created_at: string;
}

export interface KbAccess {
  id: string;
  workspace_id: string;
  page_id: string | null;
  user_id: string;
  can_edit: boolean;
  created_at: string;
}
