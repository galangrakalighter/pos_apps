BEGIN;

CREATE TABLE IF NOT EXISTS partner_stock_adjustments (
  uuid UUID PRIMARY KEY,
  mitra_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES produk_mitra(id) ON DELETE CASCADE,
  delta NUMERIC(18,3) NOT NULL CHECK (delta <> 0),
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_stock_adjustments_mitra_created
  ON partner_stock_adjustments (mitra_id, created_at DESC);

COMMIT;
