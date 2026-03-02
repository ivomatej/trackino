-- ================================================
-- TRACKINO – Databázové schéma pro Supabase
-- ================================================
-- Spusťte tento SQL v Supabase SQL Editoru (Dashboard → SQL Editor → New Query)

-- 1. WORKSPACES (firmy/pracovní prostory)
CREATE TABLE IF NOT EXISTS trackino_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 2. PROFILES (uživatelské profily)
CREATE TABLE IF NOT EXISTS trackino_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  email text NOT NULL,
  avatar_color text DEFAULT '#2563eb',
  language text DEFAULT 'cs' CHECK (language IN ('cs', 'en')),
  theme text DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  currency text DEFAULT 'CZK' CHECK (currency IN ('CZK', 'EUR', 'USD')),
  created_at timestamptz DEFAULT now()
);

-- 3. WORKSPACE MEMBERS (členství ve workspace + role + hierarchie)
CREATE TABLE IF NOT EXISTS trackino_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  hourly_rate numeric(10,2),
  monthly_hours_target numeric(6,1),
  manager_id uuid REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 4. DEPARTMENTS (oddělení)
CREATE TABLE IF NOT EXISTS trackino_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. USER-DEPARTMENT ASSIGNMENTS (přiřazení uživatelů k oddělením)
CREATE TABLE IF NOT EXISTS trackino_user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES trackino_departments(id) ON DELETE CASCADE,
  UNIQUE(user_id, department_id)
);

-- 6. PROJECTS (projekty)
CREATE TABLE IF NOT EXISTS trackino_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  client text,
  color text DEFAULT '#2563eb',
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 7. CATEGORIES (kategorie – patří pod oddělení)
CREATE TABLE IF NOT EXISTS trackino_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  department_id uuid REFERENCES trackino_departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 8. TASKS (úkoly/tasky)
CREATE TABLE IF NOT EXISTS trackino_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES trackino_projects(id) ON DELETE SET NULL,
  category_id uuid REFERENCES trackino_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 9. TIME ENTRIES (záznamy odpracovaného času)
CREATE TABLE IF NOT EXISTS trackino_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  project_id uuid REFERENCES trackino_projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES trackino_tasks(id) ON DELETE SET NULL,
  category_id uuid REFERENCES trackino_categories(id) ON DELETE SET NULL,
  description text DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration integer, -- v sekundách, počítáno při zastavení
  is_running boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. HELP PAGES (nápověda)
CREATE TABLE IF NOT EXISTS trackino_help (
  id text PRIMARY KEY DEFAULT '1',
  workspace_id uuid REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  content text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- 11. BUG REPORTS (hlášení chyb)
CREATE TABLE IF NOT EXISTS trackino_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 12. CHANGELOG (dokumentace verzí)
CREATE TABLE IF NOT EXISTS trackino_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ================================================
-- INDEXY pro výkon
-- ================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON trackino_workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON trackino_workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_workspace ON trackino_time_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON trackino_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start ON trackino_time_entries(start_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_running ON trackino_time_entries(is_running) WHERE is_running = true;
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON trackino_projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON trackino_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON trackino_categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_departments_workspace ON trackino_departments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_workspace ON trackino_bug_reports(workspace_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
-- Zapnout RLS na všech tabulkách
ALTER TABLE trackino_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_user_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_help ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackino_changelog ENABLE ROW LEVEL SECURITY;

-- Politiky: plný přístup pro přihlášené uživatele
-- (pro produkci by bylo lepší omezit na workspace level)
CREATE POLICY "Authenticated full access" ON trackino_workspaces FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_workspace_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_user_departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_help FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_bug_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trackino_changelog FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- PRVNÍ ZÁZNAM CHANGELOGU
-- ================================================
INSERT INTO trackino_changelog (version, title, content) VALUES (
  '0.1.0',
  'Založení projektu',
  'Inicializace aplikace Trackino. Základní struktura: přihlášení, registrace, výběr workspace, sidebar s navigací, tmavý/světlý režim.'
);
