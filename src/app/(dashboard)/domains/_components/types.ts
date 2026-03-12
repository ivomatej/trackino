import type { Domain, DomainStatus, DomainRegistrar, Subscription } from '@/types/database';

export type DisplayStatus = DomainStatus | 'expiring';
export type SortField = 'name' | 'expiration_date' | 'registrar' | 'status';
export type SortDir = 'asc' | 'desc';
export type TabType = 'domains' | 'registrars';

export interface DomainFormState {
  name: string;
  registrar: string;
  subscription_id: string | null;
  registration_date: string;
  expiration_date: string;
  status: DomainStatus;
  notes: string;
  target_url: string;
  project_name: string;
  company_name: string;
}

export interface RegFormState {
  name: string;
  website_url: string;
  notes: string;
}

export interface DomainStats {
  total: number;
  active: number;
  expiring: number;
  windingDown: number;
  expired: number;
}

export type { Domain, DomainStatus, DomainRegistrar, Subscription };
