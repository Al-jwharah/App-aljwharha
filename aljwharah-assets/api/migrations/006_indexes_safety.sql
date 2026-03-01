-- 006_indexes_safety.sql
-- Aljwharah — DB safety: migration tracking + indexes

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  filename    VARCHAR(255) UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure key indexes exist (IF NOT EXISTS makes idempotent)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_listing ON cart_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing ON order_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_listings_is_sold ON listings(is_sold) WHERE is_sold = false;
CREATE INDEX IF NOT EXISTS idx_listings_reserved ON listings(reserved_until) WHERE reserved_until IS NOT NULL;

-- Ensure updated_at triggers on tables that need them
DO $$ BEGIN
  CREATE TRIGGER set_payments_updated_at
    BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_cart_items_updated_at
    BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
