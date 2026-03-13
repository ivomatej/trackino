// Trackino – typy pro fakturaci a důležité dny

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
