BEGIN;

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS raw_material_addons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE history DROP CONSTRAINT IF EXISTS ck_history_raw_material_addons_array;
ALTER TABLE history
  ADD CONSTRAINT ck_history_raw_material_addons_array
  CHECK (jsonb_typeof(raw_material_addons) = 'array');

COMMIT;
