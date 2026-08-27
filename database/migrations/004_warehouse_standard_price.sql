BEGIN;

-- Central selling price is maintained once on the warehouse master. Partner
-- onboarding only supplies quantity; central revenue uses this standard price.
ALTER TABLE warehouse
  ADD COLUMN harga NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (harga >= 0);

UPDATE warehouse SET harga = CASE id
  WHEN 101 THEN 28000
  WHEN 102 THEN 35000
  WHEN 103 THEN 39000
  WHEN 104 THEN 45000
  ELSE harga
END;

COMMIT;
