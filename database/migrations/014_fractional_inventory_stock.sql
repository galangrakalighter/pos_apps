BEGIN;

ALTER TABLE warehouse
  ALTER COLUMN stock TYPE NUMERIC(18,3) USING stock::numeric;

ALTER TABLE produk_mitra
  ALTER COLUMN stock TYPE NUMERIC(18,3) USING stock::numeric;

ALTER TABLE partner_stock_distribution_items
  ALTER COLUMN quantity TYPE NUMERIC(18,3) USING quantity::numeric;

COMMIT;
