-- ================================================
-- TRACKINO – Fáze 1 Migrace: Role, Oprávnění, Workspace nastavení
-- ================================================
-- Spusťte tento SQL v Supabase SQL Editoru (Dashboard → SQL Editor → New Query)

-- 1. Master admin flag na profilu
ALTER TABLE trackino_profiles ADD COLUMN IF NOT EXISTS is_master_admin boolean NOT NULL DEFAULT false;

-- 2. Multi-manager podpora (1 uživatel = více nadřízených)
CREATE TABLE IF NOT EXISTS trackino_manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, member_user_id, manager_user_id)
);
CREATE INDEX IF NOT EXISTS idx_mgr_asgn_member ON trackino_manager_assignments(workspace_id, member_user_id);
CREATE INDEX IF NOT EXISTS idx_mgr_asgn_manager ON trackino_manager_assignments(workspace_id, manager_user_id);
ALTER TABLE trackino_manager_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_manager_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Hide tags per user
ALTER TABLE trackino_workspace_members ADD COLUMN IF NOT EXISTS hide_tags boolean NOT NULL DEFAULT false;

-- 4. Workspace rozšíření
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS tariff text NOT NULL DEFAULT 'free';
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS week_start_day int NOT NULL DEFAULT 1;
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'dd.MM.yyyy';
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS number_format text NOT NULL DEFAULT 'cs';
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CZK';
ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS required_fields jsonb NOT NULL DEFAULT '{"project":false,"category":false,"task":false,"description":false,"tag":false}'::jsonb;

-- 5. Fakturační údaje workspace
CREATE TABLE IF NOT EXISTS trackino_workspace_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  company_name text DEFAULT '',
  representative_name text DEFAULT '',
  address text DEFAULT '',
  postal_code text DEFAULT '',
  ico text DEFAULT '',
  dic text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  billing_note text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_workspace_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_workspace_billing FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Audit log
CREATE TABLE IF NOT EXISTS trackino_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id),
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON trackino_audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON trackino_audit_log(created_at);
ALTER TABLE trackino_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Manager poznámky na time entries
ALTER TABLE trackino_time_entries ADD COLUMN IF NOT EXISTS manager_note text DEFAULT '';

-- 8. Pozvánky do workspace
CREATE TABLE IF NOT EXISTS trackino_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, email)
);
ALTER TABLE trackino_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_invitations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Nastav tvůj účet jako Master Admin (uprav email dle potřeby)
UPDATE trackino_profiles SET is_master_admin = true WHERE email = 'ivo.matej@gmail.com';
