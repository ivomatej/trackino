// Trackino – typy pro kalendář (události, sdílení, ICS, RSVP)

export interface Calendar {
  id: string;
  workspace_id: string;
  owner_user_id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CalendarEventSource = 'manual' | 'vacation' | 'important_day' | 'subscription';

export type CalendarEventRecurrence =
  | 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  | 'first_day_month' | 'last_day_month'
  | 'first_day_week' | 'last_day_week'
  | 'first_day_quarter' | 'last_day_quarter'
  | 'first_day_year' | 'last_day_year'
  | 'monthly_on_day';

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  description: string;
  location: string;          // místo konání
  url: string;               // URL odkaz
  reminder_minutes: number | null; // upozornění X minut před událostí
  start_date: string;    // YYYY-MM-DD
  end_date: string;      // YYYY-MM-DD
  is_all_day: boolean;
  start_time: string | null;  // HH:MM
  end_time: string | null;    // HH:MM
  color: string | null;
  source: CalendarEventSource;
  source_id: string | null;
  recurrence_type: CalendarEventRecurrence; // typ opakování
  recurrence_day: number | null;             // den v měsíci (1–31), jen pro monthly_on_day
  created_at: string;
  updated_at: string;
}

export interface CalendarShare {
  id: string;
  calendar_id: string;
  shared_with_user_id: string | null; // null = workspace-wide (viz share_with_workspace)
  share_with_workspace: boolean;      // true = sdílet s celým workspace
  show_details: boolean;              // false = příjemce vidí jen "Nemá čas"
  can_edit: boolean;
  created_at: string;
}

/** Preference příjemce sdíleného kalendáře (barva, zapnuto/vypnuto) */
export interface CalendarSharePref {
  id: string;
  calendar_id: string;
  user_id: string;
  is_enabled: boolean;
  color_override: string | null;
  created_at: string;
}

/** Cache ICS událostí pro sdílení (příjemce nevidí URL) */
export interface IcsEventCache {
  id: string;
  subscription_id: string;
  workspace_id: string;
  uid: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  synced_at: string;
}

/** Účastník události (RSVP) */
export interface CalendarEventAttendee {
  id: string;
  event_id: string;
  workspace_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'maybe' | 'updated';
  created_at: string;
  prev_start_date?: string | null;
  prev_end_date?: string | null;
  prev_start_time?: string | null;
  prev_end_time?: string | null;
  prev_location?: string | null;
  prev_description?: string | null;
}

export interface CalendarSubscription {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  url: string;
  color: string;
  is_enabled: boolean;
  created_at: string;
}
