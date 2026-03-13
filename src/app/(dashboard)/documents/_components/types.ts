import type { DocumentFolder } from '@/types/database';

export interface Member {
  user_id: string;
  display_name: string;
  email: string;
  avatar_color: string;
}

export interface DocForm {
  open: boolean;
  mode: 'file' | 'link';
  name: string;
  url: string;
  description: string;
  folder_id: string | null;
}

export interface FolderModalState {
  open: boolean;
  parentId: string | null;
  editing: DocumentFolder | null;
  name: string;
  color: string;
}

export interface ShareModalState {
  open: boolean;
  folder: DocumentFolder | null;
}

export const MAX_DEPTH = 5;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
];

export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
