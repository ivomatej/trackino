// Trackino – typy pro žádosti, feedback a workspace stránky

// === Žádosti ===

export type RequestType =
  | 'hardware'
  | 'software'
  | 'access'
  | 'office'
  | 'financial'
  | 'hr'
  | 'education'
  | 'travel'
  | 'benefits'
  | 'recruitment'
  | 'security'
  | 'it_support'
  | 'legal';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface TrackingRequest {
  id: string;
  workspace_id: string;
  user_id: string;
  type: RequestType;
  title: string;
  note: string;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_note: string;
  // Doplňkové pole pro typ 'vacation'
  vacation_start_date: string | null;
  vacation_end_date: string | null;
  vacation_days: number | null;
  // Propojení se schválenou dovolenkovou žádostí
  vacation_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

// === Připomínky (anonymní) ===

export interface FeedbackEntry {
  id: string;
  workspace_id: string;
  // Bez user_id – záměrně anonymní
  message: string;
  is_resolved: boolean;
  created_at: string;
}

// === Textové stránky workspace (Firemní pravidla, Pravidla v kanceláři) ===

export interface WorkspacePage {
  id: string;
  workspace_id: string;
  slug: string;    // 'company-rules' | 'office-rules'
  content: string; // HTML obsah
  updated_at: string;
  updated_by: string | null;
}
