// Trackino – typy pro dovolenou a plánovač dostupnosti

export interface VacationAllowance {
  id: string;
  workspace_id: string;
  year: number;
  days_per_year: number;
  created_at: string;
}

export type VacationStatus = 'approved' | 'pending' | 'rejected';

export interface VacationEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  days: number;
  note: string;
  status: VacationStatus;         // 'approved' | 'pending' | 'rejected'
  reviewed_by: string | null;     // user_id reviewera
  reviewed_at: string | null;     // ISO timestamp
  reviewer_note: string;          // poznámka při zamítnutí
  created_at: string;
}

export interface AvailabilityStatus {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export type AvailabilityHalf = 'am' | 'pm' | 'full';

export interface AvailabilityEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  half: AvailabilityHalf;
  status_id: string | null;
  note: string;
  created_at: string;
}

export interface PlannerPin {
  id: string;
  workspace_id: string;
  user_id: string;
  pinned_user_id: string;
  created_at: string;
}
