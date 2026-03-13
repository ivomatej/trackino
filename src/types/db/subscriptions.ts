// Trackino – typy pro evidenci předplatných

export interface SubscriptionCategory {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
}

export type SubscriptionType = 'saas' | 'hosting' | 'license' | 'domain' | 'other';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial' | 'pending_approval';
export type SubscriptionFrequency = 'monthly' | 'quarterly' | 'yearly' | 'biennial' | 'one_time';
export type SubscriptionPriority = 'high' | 'medium' | 'low';
export type SubscriptionCurrency = 'CZK' | 'EUR' | 'USD';

export interface Subscription {
  id: string;
  workspace_id: string;
  name: string;
  type: SubscriptionType;
  website_url: string;
  login_url: string;
  registration_email: string;
  company_name: string;
  registered_by: string | null; // user_id z workspace
  description: string;
  notes: string; // HTML formátované poznámky
  priority: SubscriptionPriority;
  status: SubscriptionStatus;
  renewal_type: 'auto' | 'manual';
  price: number | null;
  currency: SubscriptionCurrency;
  frequency: SubscriptionFrequency;
  next_payment_date: string | null; // YYYY-MM-DD
  registration_date: string | null; // YYYY-MM-DD
  category_id: string | null;
  is_tip: boolean; // true = tip/doporučení, ne aktivní předplatné
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRating {
  id: string;
  subscription_id: string;
  workspace_id: string;
  user_id: string;
  rating: number; // 1-5
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  date: string;     // YYYY-MM-DD
  currency: string; // EUR, USD
  rate: number;     // kurz k CZK
  fetched_at: string;
}

// ── Evidence přístupů k předplatným ─────────────────────────────────────

export interface SubscriptionAccessUser {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionAccess {
  id: string;
  workspace_id: string;
  subscription_id: string;
  user_id: string | null;
  external_user_id: string | null;
  role: string;
  granted_at: string | null;
  note: string;
  created_by: string;
  created_at: string;
}
