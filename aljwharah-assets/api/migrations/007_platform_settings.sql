-- 007_platform_settings.sql
-- Aljwharah — Platform configuration (singleton)

CREATE TABLE IF NOT EXISTS platform_settings (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_bps  INT NOT NULL DEFAULT 500,        -- 5.00% = 500 basis points
  minimum_fee     NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed singleton row
INSERT INTO platform_settings (id, commission_bps, minimum_fee)
VALUES (1, 500, 0)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE TRIGGER set_platform_settings_updated_at
    BEFORE UPDATE ON platform_settings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
