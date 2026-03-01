-- 003_cart_orders.sql
-- Aljwharah — Cart, Orders & Reservation Schema

-- Order status enum
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('PENDING','RESERVED','PAID','CANCELLED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Carts (one per user)
CREATE TABLE IF NOT EXISTS carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, listing_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  status                order_status NOT NULL DEFAULT 'PENDING',
  total                 NUMERIC(14,2) NOT NULL,
  currency              VARCHAR(3) DEFAULT 'SAR',
  provider_charge_id    VARCHAR(255),
  provider_reference    VARCHAR(255),
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id),
  price       NUMERIC(14,2) NOT NULL,
  currency    VARCHAR(3) DEFAULT 'SAR'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Triggers
CREATE TRIGGER set_carts_updated_at
  BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Add FK for reserved_by_order_id (added column in 002 without FK)
DO $$ BEGIN
  ALTER TABLE listings ADD CONSTRAINT fk_listings_reserved_order
  FOREIGN KEY (reserved_by_order_id) REFERENCES orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
