BEGIN;

ALTER TABLE warehouse
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE warehouse
  DROP CONSTRAINT IF EXISTS uq_warehouse_kind_name_type;

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_active_kind_name_type
  ON warehouse (jenis_produk, nama_bumbu, tipe)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_active_kind_name
  ON warehouse (jenis_produk, nama_bumbu, id)
  WHERE deleted_at IS NULL;

COMMIT;
