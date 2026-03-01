-- 001_initial_schema.sql
-- Aljwharah Assets — Initial Database Schema

-- Enums
CREATE TYPE listing_status AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');
CREATE TYPE listing_type   AS ENUM ('TRADEMARK', 'FACTORY', 'STORE');

-- Users (minimal — full auth in Stage 4)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE,
  phone       VARCHAR(20) UNIQUE,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  role        VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name_ar     VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255),
  slug        VARCHAR(100) NOT NULL UNIQUE,
  parent_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Listings
CREATE TABLE listings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  type        listing_type NOT NULL,
  status      listing_status NOT NULL DEFAULT 'DRAFT',
  price       NUMERIC(14,2),
  currency    VARCHAR(3) DEFAULT 'SAR',
  city        VARCHAR(100),
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attachments
CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  file_type   VARCHAR(50),
  size_bytes  BIGINT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_listings_status   ON listings(status);
CREATE INDEX idx_listings_type     ON listings(type);
CREATE INDEX idx_listings_owner    ON listings(owner_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_attachments_listing ON attachments(listing_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_attachments_updated_at
  BEFORE UPDATE ON attachments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Seed categories
INSERT INTO categories (name_ar, name_en, slug) VALUES
  ('علامات تجارية', 'Trademarks', 'trademarks'),
  ('مصانع', 'Factories', 'factories'),
  ('محلات', 'Stores', 'stores');
