BEGIN;

ALTER TABLE order_items
  ALTER COLUMN jumlah_pesan TYPE NUMERIC(18,3) USING jumlah_pesan::numeric,
  ADD COLUMN IF NOT EXISTS satuan VARCHAR(20);

UPDATE order_items oi
   SET satuan = COALESCE(w.satuan, 'pcs')
  FROM warehouse w
 WHERE w.id = oi.warehouse_id
   AND oi.satuan IS NULL;

UPDATE order_items SET satuan = 'pcs' WHERE satuan IS NULL;

ALTER TABLE order_items
  ALTER COLUMN satuan SET NOT NULL,
  ALTER COLUMN satuan SET DEFAULT 'pcs',
  ADD CONSTRAINT ck_order_items_satuan
    CHECK (satuan IN ('gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng'));

COMMIT;
