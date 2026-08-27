BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_partner_lock
  ON users (is_locked, username)
  WHERE "isPusat" = FALSE;

COMMIT;
