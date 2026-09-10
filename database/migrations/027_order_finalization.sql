BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_finalized'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_finalized BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN finalized_at TIMESTAMPTZ;
    -- Pesanan lama dianggap sudah dikonfirmasi agar operasional tidak terblokir.
    UPDATE orders SET is_finalized = TRUE, finalized_at = updated_at;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_supplier_finalized_status
  ON orders (pemberi_id, is_finalized, status, created_at DESC);

COMMIT;
