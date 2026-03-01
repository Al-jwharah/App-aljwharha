-- 011_seller_finance.sql
-- Seller balances, ledger and payout requests

CREATE TABLE IF NOT EXISTS seller_balances (
  seller_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (available_amount >= 0),
  pending_amount    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (pending_amount >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_ledger (
  id          BIGSERIAL PRIMARY KEY,
  seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'ADJUSTMENT')),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  note        TEXT,
  entry_key   TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reason       TEXT,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_ledger_seller ON seller_ledger(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_ledger_order ON seller_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_seller ON payout_requests(seller_id, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER set_seller_balances_updated_at
    BEFORE UPDATE ON seller_balances FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_payout_requests_updated_at
    BEFORE UPDATE ON payout_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;