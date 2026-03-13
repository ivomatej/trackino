// Trackino – základní typy: workspace, uživatelé, role, admin

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
  | 'ai_assistant'
  | 'automation'
  | 'subscriptions'
  | 'domains'
  | 'tasks';

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
  can_manage_subscriptions: boolean; // může spravovat evidenci předplatných
  can_manage_domains: boolean; // může spravovat evidenci domén
  can_manage_tasks: boolean; // může spravovat úkoly (vytvářet, editovat, mazat, přesouvat)
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

export interface CooperationType {
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}
