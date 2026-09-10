BEGIN;

CREATE TABLE IF NOT EXISTS discounts (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('percent', 'fixed')),
  value NUMERIC(18,2) NOT NULL CHECK (value > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_discount_percent CHECK (type <> 'percent' OR value <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_discounts_active_name
  ON discounts (lower(name)) WHERE deleted_at IS NULL;

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS discount_id BIGINT REFERENCES discounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

COMMIT;
