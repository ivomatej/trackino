import type {
  SubscriptionType,
  SubscriptionStatus,
  SubscriptionFrequency,
  SubscriptionPriority,
  SubscriptionCurrency,
} from '@/types/database';

export type Tab = 'subscriptions' | 'tips' | 'categories' | 'access';
export type SortField = 'name' | 'price' | 'next_payment' | 'status' | 'rating';
export type SortDir = 'asc' | 'desc';
export type AccessView = 'by_service' | 'by_user' | 'summary';
export type AccessSortField = 'name' | 'users' | 'cost_per_user';

export interface Member {
  user_id: string;
  display_name: string;
  avatar_color: string;
}

export interface Rates {
  CZK: number;
  EUR: number | null;
  USD: number | null;
}

export interface Stats {
  totalMonthly: number;
  totalYearly: number;
  activeCount: number;
  upcomingCount: number;
  totalCount: number;
}

export interface SubForm {
  name: string;
  type: SubscriptionType;
  website_url: string;
  login_url: string;
  registration_email: string;
  company_name: string;
  registered_by: string | null;
  description: string;
  notes: string;
  priority: SubscriptionPriority;
  status: SubscriptionStatus;
  renewal_type: 'auto' | 'manual';
  price: string;
  currency: SubscriptionCurrency;
  frequency: SubscriptionFrequency;
  next_payment_date: string;
  registration_date: string;
  category_id: string | null;
  is_tip: boolean;
}

export interface CatForm {
  name: string;
  color: string;
  parent_id: string | null;
}

export interface AccessForm {
  subscription_id: string;
  type: 'internal' | 'external';
  user_id: string;
  external_user_id: string;
  role: string;
  granted_at: string;
  note: string;
}

export interface ExtUserForm {
  name: string;
  email: string;
  note: string;
}
