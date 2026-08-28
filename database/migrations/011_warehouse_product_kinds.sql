BEGIN;

ALTER TABLE warehouse
  ADD COLUMN IF NOT EXISTS jenis_produk VARCHAR(20) NOT NULL DEFAULT 'bahan_baku';

ALTER TABLE warehouse
  DROP CONSTRAINT IF EXISTS ck_warehouse_jenis_produk,
  ADD CONSTRAINT ck_warehouse_jenis_produk
    CHECK (jenis_produk IN ('bahan_baku', 'produk_jadi'));

ALTER TABLE warehouse
  DROP CONSTRAINT IF EXISTS uq_warehouse_name_type,
  DROP CONSTRAINT IF EXISTS uq_warehouse_kind_name_type;

ALTER TABLE warehouse
  ADD CONSTRAINT uq_warehouse_kind_name_type
    UNIQUE (jenis_produk, nama_bumbu, tipe);

ALTER TABLE produk_mitra
  ADD COLUMN IF NOT EXISTS master_produk_id BIGINT REFERENCES warehouse(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_warehouse_kind_name
  ON warehouse (jenis_produk, nama_bumbu);

CREATE INDEX IF NOT EXISTS idx_produk_mitra_master
  ON produk_mitra (mitra_id, master_produk_id)
  WHERE master_produk_id IS NOT NULL;

COMMIT;
