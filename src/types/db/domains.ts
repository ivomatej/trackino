// Trackino – typy pro evidenci domén

export type DomainStatus = 'active' | 'expired' | 'transferred' | 'cancelled' | 'winding_down';

export interface Domain {
  id: string;
  workspace_id: string;
  name: string;
  registrar: string;
  subscription_id: string | null;
  registration_date: string | null;
  expiration_date: string | null;
  status: DomainStatus;
  notes: string;
  target_url: string;
  project_name: string;
  company_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DomainRegistrar {
  id: string;
  workspace_id: string;
  name: string;
  website_url: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
