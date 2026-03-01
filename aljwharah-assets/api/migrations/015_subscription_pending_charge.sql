-- 015_subscription_pending_charge.sql
-- Store pending Tap charge ids for subscription checkout idempotency

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pending_tap_charge_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_pending_charge ON subscriptions(pending_tap_charge_id) WHERE pending_tap_charge_id IS NOT NULL;
