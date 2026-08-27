BEGIN;

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS stock_applied_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM produk_mitra p
      JOIN (
        SELECT mitra_id, id_produk, SUM(terjual)::integer AS sold
          FROM history
         WHERE stock_applied_at IS NULL
         GROUP BY mitra_id, id_produk
      ) h ON h.mitra_id = p.mitra_id AND h.id_produk = p.id
     WHERE p.stock < h.sold
  ) THEN
    RAISE EXCEPTION 'Stok Mitra tidak cukup untuk rekonsiliasi history lama';
  END IF;
END $$;

WITH sold AS (
  SELECT mitra_id, id_produk, SUM(terjual)::integer AS quantity
    FROM history
   WHERE stock_applied_at IS NULL
   GROUP BY mitra_id, id_produk
)
UPDATE produk_mitra p
   SET stock = p.stock - sold.quantity,
       updated_at = now()
  FROM sold
 WHERE p.mitra_id = sold.mitra_id AND p.id = sold.id_produk;

UPDATE history
   SET stock_applied_at = COALESCE(synced_at, now())
 WHERE stock_applied_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_history_unapplied_stock
  ON history (mitra_id, id)
  WHERE stock_applied_at IS NULL;

COMMIT;
