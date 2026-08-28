BEGIN;

ALTER TABLE product_recipes
  ADD COLUMN IF NOT EXISTS satuan VARCHAR(20);

UPDATE product_recipes r
   SET satuan = w.satuan
  FROM warehouse w
 WHERE w.id = r.ingredient_id AND r.satuan IS NULL;

ALTER TABLE product_recipes
  ALTER COLUMN satuan SET NOT NULL,
  DROP CONSTRAINT IF EXISTS ck_product_recipe_satuan,
  ADD CONSTRAINT ck_product_recipe_satuan
    CHECK (satuan IN ('gram', 'kilogram', 'mililiter', 'liter', 'pcs', 'pack', 'botol', 'kaleng'));

CREATE OR REPLACE FUNCTION convert_inventory_unit(
  amount NUMERIC,
  from_unit VARCHAR,
  to_unit VARCHAR
) RETURNS NUMERIC
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN from_unit = to_unit THEN amount
    WHEN from_unit = 'kilogram' AND to_unit = 'gram' THEN amount * 1000
    WHEN from_unit = 'gram' AND to_unit = 'kilogram' THEN amount / 1000
    WHEN from_unit = 'liter' AND to_unit = 'mililiter' THEN amount * 1000
    WHEN from_unit = 'mililiter' AND to_unit = 'liter' THEN amount / 1000
    ELSE NULL
  END;
$$;

COMMIT;
