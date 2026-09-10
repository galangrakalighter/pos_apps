BEGIN;

ALTER TABLE warehouse
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_warehouse_raw_available
  ON warehouse (is_available, tipe, nama_bumbu)
  WHERE jenis_produk = 'bahan_baku' AND deleted_at IS NULL;

COMMIT;
