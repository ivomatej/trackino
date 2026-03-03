-- =====================================================
-- Trackino – migrace Fáze 3 (doplňky)
-- Spusť v Supabase SQL Editoru
-- =====================================================

-- 1. Globální skrytí štítků pro workspace
ALTER TABLE trackino_workspaces
  ADD COLUMN IF NOT EXISTS hide_tags_globally BOOLEAN DEFAULT FALSE;

-- 2. Tabulka pro obsah nápovědy (globální, editovatelná Master Adminem)
CREATE TABLE IF NOT EXISTS trackino_help_content (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Vložit výchozí prázdný záznam (jen jeden řádek existuje)
INSERT INTO trackino_help_content (content)
SELECT ''
WHERE NOT EXISTS (SELECT 1 FROM trackino_help_content)
RETURNING id;

-- 3. Tabulka pro bug reporty (vytvoř pokud neexistuje, jinak přidej chybějící sloupce)
CREATE TABLE IF NOT EXISTS trackino_bug_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Přidej sloupce, pokud v tabulce chybí (bezpečné i při opakovaném spuštění)
ALTER TABLE trackino_bug_reports
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS master_note TEXT          DEFAULT '';

-- Přidej CHECK constraint na status (ignoruje chybu, pokud už existuje)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trackino_bug_reports_status_check'
  ) THEN
    ALTER TABLE trackino_bug_reports
      ADD CONSTRAINT trackino_bug_reports_status_check
      CHECK (status IN ('open', 'in_progress', 'solved'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_bug_reports_workspace ON trackino_bug_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user      ON trackino_bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status    ON trackino_bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created   ON trackino_bug_reports(created_at DESC);

-- 4. Tabulka pro obsah dokumentace/changelogu (globální, editovatelná Master Adminem)
CREATE TABLE IF NOT EXISTS trackino_changelog_content (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Vložit výchozí prázdný záznam (jen jeden řádek existuje)
INSERT INTO trackino_changelog_content (content)
SELECT ''
WHERE NOT EXISTS (SELECT 1 FROM trackino_changelog_content)
RETURNING id;
