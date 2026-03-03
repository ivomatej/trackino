// Trackino – databázové typy

export type UserRole = 'owner' | 'admin' | 'manager' | 'member';

export type Tariff = 'free' | 'pro' | 'max';

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

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_color: string;
  language: 'cs' | 'en';
  theme: 'light' | 'dark' | 'system';
  currency: 'CZK' | 'EUR' | 'USD';
  is_master_admin: boolean;
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
  address: string;
  postal_code: string;
  ico: string;
  dic: string;
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

export interface VacationEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  days: number;
  note: string;
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
