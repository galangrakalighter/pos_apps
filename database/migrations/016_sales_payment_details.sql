BEGIN;

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS transaction_uuid UUID,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS transaction_total NUMERIC(18,2);

UPDATE history
   SET transaction_uuid = COALESCE(transaction_uuid, uuid),
       payment_method = COALESCE(payment_method, 'tunai'),
       transaction_total = COALESCE(transaction_total, harga * terjual),
       amount_paid = COALESCE(amount_paid, harga * terjual),
       change_amount = COALESCE(change_amount, 0);

ALTER TABLE history
  ALTER COLUMN transaction_uuid SET NOT NULL,
  ALTER COLUMN payment_method SET NOT NULL,
  ALTER COLUMN payment_method SET DEFAULT 'tunai',
  ALTER COLUMN amount_paid SET NOT NULL,
  ALTER COLUMN amount_paid SET DEFAULT 0,
  ALTER COLUMN change_amount SET NOT NULL,
  ALTER COLUMN change_amount SET DEFAULT 0,
  ALTER COLUMN transaction_total SET NOT NULL,
  ALTER COLUMN transaction_total SET DEFAULT 0,
  ADD CONSTRAINT ck_history_payment_method CHECK (payment_method IN ('tunai', 'qris', 'transfer', 'debit')),
  ADD CONSTRAINT ck_history_payment_amounts CHECK (amount_paid >= 0 AND change_amount >= 0 AND transaction_total >= 0);

CREATE INDEX IF NOT EXISTS idx_history_transaction_uuid ON history (mitra_id, transaction_uuid);

COMMIT;
