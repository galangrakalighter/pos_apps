BEGIN;

ALTER TABLE produk_mitra
  ADD COLUMN IF NOT EXISTS jenis_produk VARCHAR(20) NOT NULL DEFAULT 'bahan_baku',
  ADD COLUMN IF NOT EXISTS kategori VARCHAR(100),
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE produk_mitra
  DROP CONSTRAINT IF EXISTS ck_produk_mitra_jenis,
  ADD CONSTRAINT ck_produk_mitra_jenis
    CHECK (jenis_produk IN ('bahan_baku', 'produk_jadi'));

-- Nama yang sama boleh digunakan sebagai bahan baku dan produk jadi karena
-- keduanya merupakan inventaris yang berbeda.
ALTER TABLE produk_mitra
  DROP CONSTRAINT IF EXISTS uq_produk_mitra_owner_name,
  DROP CONSTRAINT IF EXISTS uq_produk_mitra_owner_kind_name;

ALTER TABLE produk_mitra
  ADD CONSTRAINT uq_produk_mitra_owner_kind_name
    UNIQUE (mitra_id, jenis_produk, nama_produk);

UPDATE produk_mitra
   SET kategori = COALESCE(kategori, 'Bahan baku')
 WHERE jenis_produk = 'bahan_baku';

CREATE INDEX IF NOT EXISTS idx_produk_mitra_tenant_kind_name
  ON produk_mitra (mitra_id, jenis_produk, nama_produk);

COMMIT;
