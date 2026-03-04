-- Trackino v2.1.0 – Tabulka Úpravy aplikace
-- Spustit v Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS trackino_app_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text DEFAULT '',
  type text NOT NULL DEFAULT 'idea' CHECK (type IN ('bug', 'idea', 'request')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'solved')),
  source_bug_id uuid REFERENCES trackino_bug_reports(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trackino_app_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_app_changes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_app_changes_status ON trackino_app_changes(status);
CREATE INDEX IF NOT EXISTS idx_app_changes_type ON trackino_app_changes(type);
