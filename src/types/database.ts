// Trackino – databázové typy

export type UserRole = 'owner' | 'admin' | 'manager' | 'member';

export type Tariff = 'free' | 'pro' | 'max';

/** Identifikátory modulů aplikace */
export type ModuleId =
  | 'time_tracker'
  | 'planner'
  | 'vacation'
  | 'invoices'
  | 'reports'
  | 'attendance'
  | 'category_report'
  | 'subordinates'
  | 'notes'
  | 'projects'
  | 'clients'
  | 'tags'
  | 'team'
  | 'settings'
  | 'audit'
  | 'text_converter'
  | 'important_days'
  | 'calendar'
  | 'requests'
  | 'feedback'
  | 'knowledge_base'
  | 'documents'
  | 'company_rules'
  | 'office_rules'
  | 'prompts'
  | 'bookmarks'
  | 'notebook'
  | 'ai_assistant';

/** Per-uživatelský override modulu (nad rámec tarifu nebo zakázání) */
export interface UserModuleOverride {
  id: string;
  workspace_id: string;
  user_id: string;
  module_id: ModuleId;
  enabled: boolean;
  created_at: string;
}

export interface RequiredFields {
  project: boolean;
  category: boolean;
  task: boolean;
  description: boolean;
  tag: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  join_code: string;
  logo_url: string | null;
  tariff: Tariff;
  week_start_day: number; // 0=Ne, 1=Po
  date_format: string;
  number_format: string;
  currency: 'CZK' | 'EUR' | 'USD';
  required_fields: RequiredFields;
  hide_tags_globally: boolean;
  locked: boolean;
  color: string | null;
  timezone: string; // IANA timezone, např. 'Europe/Prague'
  society_modules_enabled: Record<string, boolean>; // per-workspace zapnutí Společnost modulů
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

export interface WorkspaceSubscription {
  id: string;
  workspace_id: string;
  year: number;
  month: number;      // 1–12
  tariff: Tariff;
  active_members: number;
  created_at: string;
}

export interface HelpContent {
  id: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
}

export type BugStatus = 'open' | 'in_progress' | 'solved';

export interface BugReport {
  id: string;
  workspace_id: string;
  user_id: string;
  content: string;
  status: BugStatus;
  master_note: string;
  created_at: string;
  updated_at: string;
}

// Úpravy aplikace – úkolník pro Master Admina
export type AppChangeType = 'bug' | 'idea' | 'request' | 'note';
export type AppChangePriority = 'low' | 'medium' | 'high';
export type AppChangeStatus = 'open' | 'in_progress' | 'solved' | 'archived';

export interface AppChange {
  id: string;
  title: string;
  content: string;
  type: AppChangeType;
  priority: AppChangePriority;
  status: AppChangeStatus;
  source_bug_id: string | null; // odkaz na původní bug report (pokud přesunut z Bug logu)
  created_at: string;
  updated_at: string;
}

// Systémová oznámení (Master Admin → všichni uživatelé)
export interface SystemNotification {
  id: string;
  title: string;       // krátký nadpis (volitelný)
  message: string;     // text oznámení
  color: string;       // hex barva banneru (#f59e0b = oranžová)
  is_active: boolean;  // aktivní / neaktivní
  show_from: string | null;  // ISO timestamp – od kdy zobrazovat (null = okamžitě)
  show_until: string | null; // ISO timestamp – do kdy zobrazovat (null = navždy)
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  display_nickname: string;    // oslovení v aplikaci (max 30 znaků)
  email: string;
  avatar_color: string;
  language: 'cs' | 'en';
  theme: 'light' | 'dark' | 'system';
  currency: 'CZK' | 'EUR' | 'USD';
  is_master_admin: boolean;
  phone: string;      // telefonní číslo
  position: string;   // pracovní pozice (nastavuje admin)
  timer_always_visible: boolean;  // zobrazit Měřič ve všech stránkách
  timer_bottom_mobile: boolean;   // na mobilu připnout Měřič ke spodní hraně (default false)
  calendar_day_start: number;    // začátek pracovního dne (0–23)
  calendar_day_end: number;      // konec pracovního dne (1–24)
  birth_date: string | null;     // datum narození (YYYY-MM-DD), pro Narozeniny v kalendáři
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: UserRole;
  hourly_rate: number | null;
  monthly_hours_target: number | null;
  manager_id: string | null; // zpětná kompatibilita, preferovat manager_assignments
  hide_tags: boolean;
  approved: boolean;
  joined_at: string;
  can_use_vacation: boolean;
  cooperation_type_id: string | null;
  can_invoice: boolean;
  can_manage_billing: boolean;
  billing_profile_id: string | null; // přiřazený fakturační profil
  can_view_audit: boolean;      // může vidět audit log
  can_process_requests: boolean; // zpracovává žádosti (schvaluje/zamítá)
  can_receive_feedback: boolean; // přijímá anonymní připomínky
  can_manage_documents: boolean; // může spravovat dokumenty (nahrávat, mazat, editovat složky)
  can_view_birthdays: boolean;   // vidí narozeniny kolegů v kalendáři
  can_use_ai_assistant: boolean; // může používat AI asistenta (nad rámec role admin/owner)
  ai_allowed_models: string[] | null; // null = všechny modely; jinak jen uvedené model IDs
}

export interface ManagerAssignment {
  id: string;
  workspace_id: string;
  member_user_id: string;
  manager_user_id: string;
  created_at: string;
}

export interface WorkspaceBilling {
  id: string;
  workspace_id: string;
  name: string;       // název profilu, např. "Hlavní s.r.o."
  is_default: boolean; // výchozí profil pro workspace
  company_name: string;
  representative_name: string;
  address: string;  // ulice + číslo popisné
  city: string;
  country: string;
  postal_code: string;
  ico: string;
  dic: string;
  is_vat_payer: boolean; // plátce DPH
  email: string;
  phone: string;
  billing_note: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  actor_user_id: string;
  action: string;
  target_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Invitation {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string;
  token: string;
  accepted: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  client: string | null;
  color: string;
  archived: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  department_id: string | null;
  name: string;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  category_id: string | null;
  name: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  category_id: string | null;
  description: string;
  start_time: string;
  end_time: string | null;
  duration: number | null; // v sekundách
  is_running: boolean;
  manager_note: string;
  created_at: string;
  updated_at: string;
}

// === Fáze 2: Klienti, Štítky ===

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ClientProject {
  id: string;
  client_id: string;
  project_id: string;
}

export interface Tag {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TimeEntryTag {
  id: string;
  time_entry_id: string;
  tag_id: string;
}

export interface MemberRate {
  id: string;
  workspace_member_id: string;
  hourly_rate: number;
  valid_from: string; // YYYY-MM-DD
  valid_to: string | null;
  created_at: string;
}

export interface VacationAllowance {
  id: string;
  workspace_id: string;
  year: number;
  days_per_year: number;
  created_at: string;
}

export interface CooperationType {
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
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

// === Fakturace ===

export interface MemberInvoiceSettings {
  id: string;
  workspace_member_id: string;
  use_workspace_billing: boolean; // true = použít fakturační údaje workspace
  company_name: string;
  representative_name: string;
  address: string;
  postal_code: string;
  ico: string;
  dic: string;
  email: string;
  phone: string;
  bank_account: string;
  updated_at: string;
}

export type InvoiceStatus = 'pending' | 'approved' | 'paid' | 'cancelled' | 'returned';

// === Plánovač ===

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

// === Fakturace ===

export interface Invoice {
  id: string;
  workspace_id: string;
  user_id: string;
  billing_period_year: number;  // rok fakturace
  billing_period_month: number; // měsíc fakturace (1-12)
  issue_date: string;           // YYYY-MM-DD
  due_date: string;             // YYYY-MM-DD
  variable_symbol: string;
  is_vat_payer: boolean;
  total_hours: number | null;   // doplněno při schvalování
  amount: number | null;        // doplněno při schvalování (hrubá částka)
  pdf_url: string | null;       // cesta v Supabase Storage
  status: InvoiceStatus;
  submitted_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

// Důležité dny – osobní calendar events s opakováním
export type ImportantDayRecurring = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface ImportantDay {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD (= start_date pro jednorázové)
  color: string;        // hex barva
  is_recurring: boolean;
  recurring_type: ImportantDayRecurring;
  note: string;
  created_at: string;
  updated_at: string;
}

// === Kalendář ===

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

// === Dokumenty ===

export interface DocumentFolder {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
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

// ─── ZNALOSTNÍ BÁZE ────────────────────────────────────────────────────────

export type KbPageStatus = 'draft' | 'active' | 'archived';

export interface KbFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface KbPage {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  content: string;
  status: KbPageStatus;
  tags: string[];
  is_restricted: boolean;
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

// === AI asistent ===

export interface AiConversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  model_id: string;
  system_prompt: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  workspace_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  web_context: boolean;
  created_at: string;
}

export type AiLimitType = 'daily' | 'weekly' | 'monthly';

export interface AiUsageLimit {
  id: string;
  workspace_id: string;
  user_id: string | null; // null = workspace-wide default
  limit_type: AiLimitType;
  token_limit: number | null; // null = bez limitu
  created_at: string;
  updated_at: string;
}

// === Poznámky (notebook) ===

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
