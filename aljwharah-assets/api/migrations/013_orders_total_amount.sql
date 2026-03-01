-- 013_orders_total_amount.sql
-- Immutable total snapshot alias for reporting compatibility

ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2);

UPDATE orders
SET total_amount = total
WHERE total_amount IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);