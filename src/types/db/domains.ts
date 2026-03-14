// Trackino – typy pro evidenci domén + Openprovider integrace

export type DomainStatus = 'active' | 'expired' | 'transferred' | 'cancelled' | 'winding_down';

// ─── Openprovider integrace ────────────────────────────────────────────────

/** Nastavení Openprovider napojení per workspace */
export interface DomainSettings {
  id: string;
  workspace_id: string;
  openprovider_username: string | null;
  openprovider_password_encrypted: string | null;
  openprovider_base_url: string;
  notify_days_before: number[];
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Nameserver záznamy v Openprovider formátu */
export interface OpenproviderNameserver {
  name: string;
  ip?: string;
}

/** Lokální cache záznamu domény synchronizované z Openprovider */
export interface DomainCache {
  id: string;
  workspace_id: string;
  openprovider_id: number;
  domain_name: string;
  status: string;
  expiration_date: string | null;
  creation_date: string | null;
  is_locked: boolean;
  nameservers: OpenproviderNameserver[];
  registrant: Record<string, unknown> | null;
  ssl_expiry_date: string | null;
  auto_renew: boolean;
  raw_data: Record<string, unknown> | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

/** Log odeslaných notifikací o expiraci */
export interface DomainNotification {
  id: string;
  workspace_id: string;
  domain_cache_id: string;
  notification_type: 'domain_expiry' | 'ssl_expiry';
  days_before: number;
  sent_at: string;
}

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

// ─── Monitoring dostupnosti ─────────────────────────────────────────────────

/** Záznamy domén sledovaných v monitoringu dostupnosti */
export interface DomainMonitoring {
  id: string;
  workspace_id: string;
  domain_name: string;
  frequency: 'daily' | 'weekly';
  last_checked_at: string | null;
  last_status: string | null;
  notify_on_change: boolean;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Jeden záznam v historii kontrol dostupnosti */
export interface DomainCheckHistory {
  id: string;
  workspace_id: string;
  domain_name: string;
  status: string;
  checked_at: string;
  source: 'manual' | 'monitoring' | 'bulk';
  monitoring_id: string | null;
}

/** Výsledek jedné kontroly dostupnosti domény */
export interface DomainCheckResult {
  domain: string;
  /** free = volná, active = obsazená, unverified = zdroje se neshodly, error = chyba */
  status: 'free' | 'active' | 'reserved' | 'unverified' | 'error';
  premium?: boolean;
  /** true = potvrzeno oběma zdroji (Openprovider + RDAP) */
  validated?: boolean;
  /** Surový status z Openprovider API */
  openprovider_status?: string;
  /** Status z RDAP (přímý dotaz na registry): free | registered | unknown */
  rdap_status?: string;
  /** Status ze Subreg.cz SOAP API: free | active | unknown | error */
  subreg_status?: string | null;
}
