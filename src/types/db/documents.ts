// Trackino – typy pro správu dokumentů a složek

export interface DocumentFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  sort_order: number;
  owner_id: string | null;
  is_shared: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocFolderShare {
  id: string;
  folder_id: string;
  workspace_id: string;
  user_id: string | null; // null = celý workspace
  shared_by: string;
  created_at: string;
}

export type DocumentItemType = 'file' | 'link';

export interface WorkspaceDocument {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  type: DocumentItemType;
  // Pro soubory: cesta v Supabase Storage
  file_path: string | null;
  file_size: number | null;     // v bajtech
  file_mime: string | null;
  // Pro odkazy: URL
  url: string | null;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
