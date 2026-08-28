BEGIN;

ALTER TABLE warehouse
  ADD COLUMN IF NOT EXISTS satuan VARCHAR(20) NOT NULL DEFAULT 'pcs';

ALTER TABLE warehouse
  DROP CONSTRAINT IF EXISTS ck_warehouse_satuan,
  ADD CONSTRAINT ck_warehouse_satuan
    CHECK (satuan IN ('gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng'));

CREATE TABLE IF NOT EXISTS product_recipes (
  id BIGSERIAL PRIMARY KEY,
  finished_product_id BIGINT NOT NULL REFERENCES warehouse(id) ON DELETE CASCADE,
  ingredient_id BIGINT NOT NULL REFERENCES warehouse(id) ON DELETE RESTRICT,
  quantity_required NUMERIC(18,3) NOT NULL CHECK (quantity_required > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_recipe_ingredient UNIQUE (finished_product_id, ingredient_id),
  CONSTRAINT ck_product_recipe_different CHECK (finished_product_id <> ingredient_id)
);

UPDATE produk_mitra p
   SET master_produk_id = w.id
  FROM warehouse w
 WHERE p.jenis_produk = 'bahan_baku'
   AND p.master_produk_id IS NULL
   AND lower(p.nama_produk) = lower(w.nama_bumbu)
   AND w.jenis_produk = 'bahan_baku';

CREATE INDEX IF NOT EXISTS idx_product_recipes_finished
  ON product_recipes (finished_product_id, ingredient_id);

COMMIT;
