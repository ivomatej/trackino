// ─── Calendar Module – Local Types ───────────────────────────────────────────
// Přesunuto z page.tsx (ř. 13–80 + 517–542)

export interface DisplayEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  color: string;
  source: 'manual' | 'vacation' | 'important_day' | 'subscription' | 'holiday' | 'shared' | 'birthday' | 'nameday';
  source_id: string;
  calendar_id?: string;
  description?: string;
  location?: string;
  url?: string;
  reminder_minutes?: number | null;
  is_all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  // Sdílené události
  is_shared?: boolean;
  show_details?: boolean;
  shared_owner_name?: string;
  shared_calendar_name?: string;
  // Účastnické události (kde user je účastník, ne vlastník)
  attendee_status?: 'pending' | 'accepted' | 'declined' | 'maybe' | 'updated';
  event_owner_id?: string;
  // Předchozí hodnoty pro zobrazení změn (status 'updated')
  attendee_prev_start_date?: string | null;
  attendee_prev_end_date?: string | null;
  attendee_prev_start_time?: string | null;
  attendee_prev_end_time?: string | null;
  attendee_prev_location?: string | null;
  attendee_prev_description?: string | null;
  // Opakující se událost
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_day?: number | null;
}

/** Sdílený kalendář (přijatý od jiného uživatele) */
export interface SharedCalendarInfo {
  share_id: string;
  calendar_id: string;         // ID kalendáře vlastníka (nebo subscription ID)
  type: 'calendar' | 'subscription';
  name: string;
  owner_name: string;
  owner_user_id: string;
  base_color: string;          // barva z DB
  show_details: boolean;
  is_enabled: boolean;         // preference příjemce
  color_override: string | null;
}

/** Člen workspace s profilem */
export interface MemberWithProfile {
  user_id: string;
  display_name: string;
  avatar_color: string;
}

/** Člen workspace s narozeninami (pro Narozeniny v kalendáři) */
export interface BirthdayMember {
  user_id: string;
  display_name: string;
  birth_date: string; // YYYY-MM-DD
}

export type ViewType = 'list' | 'week' | 'month' | 'today' | 'three_days' | 'year';

// ─── Poznámky k událostem ─────────────────────────────────────────────────────

export interface TaskItem { id: string; text: string; checked: boolean; }

export interface EventNote {
  id?: string;
  content: string;
  tasks: TaskItem[];
  is_important?: boolean;
  is_done?: boolean;
  is_favorite?: boolean;
}

/** Poznámka, jejíž původní událost již neexistuje */
export interface OrphanNote {
  id: string;
  event_ref: string;
  event_title: string;
  event_date: string;
  content: string;
  tasks: TaskItem[];
  is_important: boolean;
  is_done: boolean;
  is_favorite: boolean;
  updated_at: string;
}
