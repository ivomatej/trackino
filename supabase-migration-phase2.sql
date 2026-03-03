-- ================================================
-- TRACKINO – Fáze 2 Migrace: Klienti, Štítky
-- ================================================

-- 1. Klienti
CREATE TABLE IF NOT EXISTS trackino_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_ws ON trackino_clients(workspace_id);
ALTER TABLE trackino_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Klient-Projekt vazba (many-to-many)
CREATE TABLE IF NOT EXISTS trackino_client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES trackino_clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES trackino_projects(id) ON DELETE CASCADE,
  UNIQUE(client_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_cp_client ON trackino_client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_project ON trackino_client_projects(project_id);
ALTER TABLE trackino_client_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_client_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Štítky
CREATE TABLE IF NOT EXISTS trackino_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#8b5cf6',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tags_ws ON trackino_tags(workspace_id);
ALTER TABLE trackino_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Štítek-TimeEntry vazba (many-to-many)
CREATE TABLE IF NOT EXISTS trackino_time_entry_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES trackino_time_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES trackino_tags(id) ON DELETE CASCADE,
  UNIQUE(time_entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_tet_entry ON trackino_time_entry_tags(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_tet_tag ON trackino_time_entry_tags(tag_id);
ALTER TABLE trackino_time_entry_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_time_entry_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Migrace existujících project.client textů do trackino_clients
-- (Jen pokud existují projekty s vyplněným klientem)
INSERT INTO trackino_clients (workspace_id, name)
SELECT DISTINCT workspace_id, client
FROM trackino_projects
WHERE client IS NOT NULL AND client != ''
ON CONFLICT DO NOTHING;

-- Vytvořit vazby klient-projekt
INSERT INTO trackino_client_projects (client_id, project_id)
SELECT c.id, p.id
FROM trackino_projects p
JOIN trackino_clients c ON c.workspace_id = p.workspace_id AND c.name = p.client
WHERE p.client IS NOT NULL AND p.client != ''
ON CONFLICT DO NOTHING;
