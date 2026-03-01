-- 002_auth_tables.sql
-- Aljwharah — Auth & Ownership Schema

-- Add password_hash and is_verified to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Update role default
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'USER';

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Listing reservation fields (for Phase 3, added early to avoid schema blocker)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_sold BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS reserved_by_order_id UUID;
