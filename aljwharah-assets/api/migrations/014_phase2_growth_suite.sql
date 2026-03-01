-- 014_phase2_growth_suite.sql
-- Aljwharah Phase 2 (Stages 15-23): orders timeline, auctions, ads, plans, support, AI, legal, owner, SSO

-- -----------------------------------------------------------------------------
-- Status alignment (Stage 15)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FULFILLED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- Platform settings extensions (owner + operations)
-- -----------------------------------------------------------------------------
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS settlement_delay_days INT NOT NULL DEFAULT 7;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS auction_pick_next_highest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS enforce_domain_allowlist BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- Order events timeline
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_events (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role  VARCHAR(50),
  type        VARCHAR(80) NOT NULL,
  message     TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_created ON order_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_type_created ON order_events(type, created_at DESC);

-- -----------------------------------------------------------------------------
-- Auctions (Stage 16)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auctions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  seller_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LIVE', 'ENDED', 'CANCELLED')),
  starting_price        NUMERIC(14,2) NOT NULL CHECK (starting_price >= 0),
  bid_increment         NUMERIC(14,2) NOT NULL CHECK (bid_increment > 0),
  reserve_price         NUMERIC(14,2),
  buy_now_price         NUMERIC(14,2),
  anti_sniping_seconds  INT NOT NULL DEFAULT 120 CHECK (anti_sniping_seconds >= 0),
  current_price         NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auctions_status_ends ON auctions(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_auctions_seller_created ON auctions(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auctions_listing ON auctions(listing_id);

DO $$ BEGIN
  CREATE TRIGGER set_auctions_updated_at
    BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS bids (
  id          BIGSERIAL PRIMARY KEY,
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_auction_amount ON bids(auction_id, amount DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bids_user_created ON bids(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auction_winners (
  auction_id        UUID PRIMARY KEY REFERENCES auctions(id) ON DELETE CASCADE,
  winner_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  winning_bid_id    BIGINT NOT NULL REFERENCES bids(id) ON DELETE RESTRICT,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_winners_user ON auction_winners(winner_user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Ads and boosts (Stage 17)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(40) NOT NULL UNIQUE,
  price_amount   NUMERIC(14,2) NOT NULL CHECK (price_amount >= 0),
  currency       VARCHAR(3) NOT NULL DEFAULT 'SAR',
  duration_days  INT NOT NULL CHECK (duration_days > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER set_ad_products_updated_at
    BEFORE UPDATE ON ad_products FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

INSERT INTO ad_products (code, price_amount, currency, duration_days)
VALUES
  ('FEATURED_HOME', 499, 'SAR', 7),
  ('BOOST_SEARCH', 199, 'SAR', 5),
  ('CATEGORY_SPOTLIGHT', 349, 'SAR', 7)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  listing_id     UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  product_code   VARCHAR(40) NOT NULL REFERENCES ad_products(code) ON DELETE RESTRICT,
  status         VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
  tap_charge_id  VARCHAR(255) UNIQUE,
  starts_at      TIMESTAMPTZ,
  ends_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status_dates ON ad_campaigns(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_seller ON ad_campaigns(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_listing ON ad_campaigns(listing_id);

DO $$ BEGIN
  CREATE TRIGGER set_ad_campaigns_updated_at
    BEFORE UPDATE ON ad_campaigns FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS ad_impressions (
  id           BIGSERIAL PRIMARY KEY,
  campaign_id  UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  page         VARCHAR(120) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_created ON ad_impressions(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id           BIGSERIAL PRIMARY KEY,
  campaign_id  UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  page         VARCHAR(120) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign_created ON ad_clicks(campaign_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Plans & subscriptions (Stage 18)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  code                      VARCHAR(20) PRIMARY KEY,
  title_ar                  VARCHAR(120) NOT NULL,
  title_en                  VARCHAR(120) NOT NULL,
  price_amount              NUMERIC(14,2) NOT NULL CHECK (price_amount >= 0),
  currency                  VARCHAR(3) NOT NULL DEFAULT 'SAR',
  period                    VARCHAR(20) NOT NULL CHECK (period IN ('MONTHLY', 'YEARLY')),
  commission_bps_override   INT,
  listing_limit             INT NOT NULL,
  auction_limit             INT NOT NULL,
  ad_credit_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  support_sla               VARCHAR(40) NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER set_plans_updated_at
    BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

INSERT INTO plans (code, title_ar, title_en, price_amount, currency, period, commission_bps_override, listing_limit, auction_limit, ad_credit_amount, support_sla)
VALUES
  ('FREE', 'مجاني', 'Free', 0, 'SAR', 'MONTHLY', NULL, 10, 1, 0, 'BEST_EFFORT'),
  ('PRO', 'احترافي', 'Pro', 299, 'SAR', 'MONTHLY', 350, 100, 10, 300, '12H'),
  ('ENTERPRISE', 'مؤسسي', 'Enterprise', 1499, 'SAR', 'MONTHLY', 250, 1000, 50, 2000, '1H')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code              VARCHAR(20) NOT NULL REFERENCES plans(code) ON DELETE RESTRICT,
  status                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED')),
  current_period_start   TIMESTAMPTZ NOT NULL,
  current_period_end     TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status, current_period_end DESC);

DO $$ BEGIN
  CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS subscription_invoice_sequences (
  year     INT PRIMARY KEY,
  last_no  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_no       VARCHAR(30) NOT NULL UNIQUE,
  amount           NUMERIC(14,2) NOT NULL,
  currency         VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status           VARCHAR(20) NOT NULL DEFAULT 'FAILED' CHECK (status IN ('PAID', 'FAILED')),
  tap_charge_id    VARCHAR(255) UNIQUE,
  period_start     TIMESTAMPTZ NOT NULL,
  period_end       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_sub_created ON subscription_invoices(subscription_id, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER set_subscription_invoices_updated_at
    BEFORE UPDATE ON subscription_invoices FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- Support system (Stage 19)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject        VARCHAR(300) NOT NULL,
  category       VARCHAR(80) NOT NULL,
  priority       VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status         VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED')),
  last_reply_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_reply ON support_tickets(status, last_reply_at DESC NULLS LAST);

DO $$ BEGIN
  CREATE TRIGGER set_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS support_messages (
  id           BIGSERIAL PRIMARY KEY,
  ticket_id    UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type  VARCHAR(20) NOT NULL CHECK (sender_type IN ('USER', 'AGENT', 'SYSTEM')),
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  attachments  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_assignments (
  ticket_id       UUID PRIMARY KEY REFERENCES support_tickets(id) ON DELETE CASCADE,
  agent_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_sla (
  plan_code                 VARCHAR(20) PRIMARY KEY REFERENCES plans(code) ON DELETE CASCADE,
  first_response_minutes    INT NOT NULL CHECK (first_response_minutes > 0),
  resolution_hours          INT NOT NULL CHECK (resolution_hours > 0)
);

INSERT INTO support_sla (plan_code, first_response_minutes, resolution_hours)
VALUES
  ('FREE', 1440, 120),
  ('PRO', 120, 48),
  ('ENTERPRISE', 30, 12)
ON CONFLICT (plan_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- AI request log (Stage 20)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_requests (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  role              VARCHAR(20) NOT NULL CHECK (role IN ('BUYER', 'SELLER', 'ADMIN')),
  feature           VARCHAR(80) NOT NULL,
  prompt_hash       VARCHAR(120) NOT NULL,
  response_summary  TEXT NOT NULL,
  meta              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created ON ai_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_feature_created ON ai_requests(feature, created_at DESC);

-- -----------------------------------------------------------------------------
-- Legal compliance queue (Stage 21)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS infringement_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       UUID REFERENCES listings(id) ON DELETE SET NULL,
  reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason           TEXT NOT NULL,
  details          TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')),
  resolution       TEXT,
  action_taken     VARCHAR(30),
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infringement_reports_status_created ON infringement_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infringement_reports_listing ON infringement_reports(listing_id);

DO $$ BEGIN
  CREATE TRIGGER set_infringement_reports_updated_at
    BEFORE UPDATE ON infringement_reports FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- Owner console operational state (Stage 22)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_runs (
  id          BIGSERIAL PRIMARY KEY,
  job_name    VARCHAR(80) NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_created ON job_runs(job_name, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_risk_events (
  id          BIGSERIAL PRIMARY KEY,
  type        VARCHAR(80) NOT NULL,
  severity    VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  entity_type VARCHAR(80),
  entity_id   TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_risk_events_created ON platform_risk_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_risk_events_type_created ON platform_risk_events(type, created_at DESC);

-- -----------------------------------------------------------------------------
-- Enterprise SSO (Stage 23)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sso_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       VARCHAR(30) NOT NULL CHECK (provider IN ('google', 'microsoft')),
  provider_sub   VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_sub),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS sso_domain_allowlist (
  id          BIGSERIAL PRIMARY KEY,
  domain      VARCHAR(255) NOT NULL UNIQUE,
  provider    VARCHAR(30) CHECK (provider IN ('google', 'microsoft')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_accounts_user ON sso_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_accounts_provider ON sso_accounts(provider, provider_sub);
