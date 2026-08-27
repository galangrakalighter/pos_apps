BEGIN;

-- A central revenue ledger for stock supplied to partners. This must not be
-- written to `history`, which represents POS sales owned by a partner.
CREATE TABLE partner_stock_distributions (
    id            BIGSERIAL PRIMARY KEY,
    pusat_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mitra_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_amount  NUMERIC(18,2) NOT NULL CHECK (total_amount >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_distribution_different_parties CHECK (pusat_id <> mitra_id)
);

CREATE TABLE partner_stock_distribution_items (
    id                    BIGSERIAL PRIMARY KEY,
    distribution_id       BIGINT NOT NULL REFERENCES partner_stock_distributions(id) ON DELETE CASCADE,
    warehouse_id          BIGINT NOT NULL REFERENCES warehouse(id) ON DELETE RESTRICT,
    partner_product_id    BIGINT NOT NULL REFERENCES produk_mitra(id) ON DELETE RESTRICT,
    item_name             VARCHAR(200) NOT NULL,
    quantity              INTEGER NOT NULL CHECK (quantity > 0),
    central_unit_price    NUMERIC(18,2) NOT NULL CHECK (central_unit_price >= 0),
    partner_retail_price  NUMERIC(18,2) NOT NULL CHECK (partner_retail_price >= 0),
    line_total            NUMERIC(18,2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT uq_distribution_warehouse UNIQUE (distribution_id, warehouse_id)
);

CREATE INDEX idx_distributions_central_created
    ON partner_stock_distributions (pusat_id, created_at DESC, id DESC);
CREATE INDEX idx_distributions_partner_created
    ON partner_stock_distributions (mitra_id, created_at DESC, id DESC);
CREATE INDEX idx_distribution_items_distribution
    ON partner_stock_distribution_items (distribution_id);

COMMIT;
