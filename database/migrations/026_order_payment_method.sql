BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'tunai';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_payment_method;
ALTER TABLE orders
  ADD CONSTRAINT ck_orders_payment_method CHECK (payment_method IN ('tunai', 'qris'));

COMMIT;
