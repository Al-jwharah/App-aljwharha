-- 010_status_alignment.sql
-- Align order statuses with operational flow

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'EXPIRED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);