-- Trackino v2.0.0 – Časové zóny workspace
-- Spustit v Supabase Dashboard → SQL Editor

ALTER TABLE trackino_workspaces ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Prague';
