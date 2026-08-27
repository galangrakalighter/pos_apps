BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stock_applied_at TIMESTAMPTZ;

-- Versions before this migration already reduced central stock when an order
-- became `dikirim`, but did not add it to the partner on `selesai`. Reconcile
-- those completed orders once without decrementing the warehouse again.
INSERT INTO produk_mitra (mitra_id, nama_produk, stock, harga)
SELECT o.pemesan_id, oi.nama_barang, SUM(oi.jumlah_pesan)::integer, 0
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
 WHERE o.status = 'selesai' AND o.stock_applied_at IS NULL
 GROUP BY o.pemesan_id, oi.nama_barang
ON CONFLICT (mitra_id, nama_produk)
DO UPDATE SET stock = produk_mitra.stock + EXCLUDED.stock, updated_at = now();

UPDATE orders
   SET stock_applied_at = COALESCE(updated_at, now())
 WHERE status = 'selesai' AND stock_applied_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_unapplied_completed
  ON orders (id)
  WHERE status = 'selesai' AND stock_applied_at IS NULL;

COMMIT;
