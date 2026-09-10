ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_normalized
  ON users (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

