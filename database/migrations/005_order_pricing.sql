BEGIN;

ALTER TABLE orders
  ADD COLUMN total_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0);

ALTER TABLE order_items
  ADD COLUMN unit_price NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  ADD COLUMN line_total NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0);

CREATE INDEX idx_orders_supplier_status_revenue
  ON orders (pemberi_id, status, created_at DESC) INCLUDE (total_amount);

COMMIT;
