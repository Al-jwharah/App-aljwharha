-- 004_payments_idempotency.sql
-- Aljwharah — Payments table for idempotency tracking

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  tap_charge_id   VARCHAR(255) UNIQUE,
  status          VARCHAR(50) NOT NULL DEFAULT 'PENDING',   -- PENDING | PAID | FAILED | CANCELLED
  amount          NUMERIC(14,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'SAR',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active payment per order (prevent double charge)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_unique
  ON payments(order_id) WHERE status NOT IN ('FAILED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_payments_charge ON payments(tap_charge_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
