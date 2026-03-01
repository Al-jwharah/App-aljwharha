-- 012_notifications_outbox.sql
-- Queue-safe email outbox

CREATE TABLE IF NOT EXISTS notifications_outbox (
  id             BIGSERIAL PRIMARY KEY,
  event_type     VARCHAR(80) NOT NULL,
  recipient      VARCHAR(320) NOT NULL,
  subject        TEXT NOT NULL,
  body_text      TEXT,
  body_html      TEXT,
  payload        JSONB NOT NULL DEFAULT '{}',
  status         VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempts       INT NOT NULL DEFAULT 0,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_outbox_status_created
  ON notifications_outbox(status, created_at ASC);

DO $$ BEGIN
  CREATE TRIGGER set_notifications_outbox_updated_at
    BEFORE UPDATE ON notifications_outbox FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;