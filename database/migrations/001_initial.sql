BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE order_status AS ENUM ('pending', 'diterima', 'dikirim', 'selesai');

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(100) NOT NULL,
    password    VARCHAR(255) NOT NULL,
    wilayah     VARCHAR(100),
    nama_mitra  VARCHAR(150) NOT NULL,
    "isPusat"  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_username UNIQUE (username)
);

CREATE TABLE produk_mitra (
    id          BIGSERIAL PRIMARY KEY,
    mitra_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    nama_produk VARCHAR(200) NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    harga       NUMERIC(18,2) NOT NULL CHECK (harga >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_produk_mitra_owner_name UNIQUE (mitra_id, nama_produk),
    CONSTRAINT uq_produk_mitra_owner_id UNIQUE (mitra_id, id)
);

CREATE TABLE history (
    id          BIGSERIAL PRIMARY KEY,
    uuid        UUID NOT NULL,
    mitra_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    id_produk   BIGINT NOT NULL REFERENCES produk_mitra(id) ON DELETE RESTRICT,
    terjual     INTEGER NOT NULL CHECK (terjual > 0),
    harga       NUMERIC(18,2) NOT NULL CHECK (harga >= 0),
    created_at  TIMESTAMPTZ NOT NULL,
    keterangan  TEXT,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_history_uuid UNIQUE (uuid),
    -- Prevent a client from posting a product owned by another partner.
    CONSTRAINT fk_history_owned_product
      FOREIGN KEY (mitra_id, id_produk)
      REFERENCES produk_mitra(mitra_id, id)
      ON DELETE RESTRICT
);

CREATE TABLE warehouse (
    id          BIGSERIAL PRIMARY KEY,
    nama_bumbu  VARCHAR(200) NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    tipe        VARCHAR(100) NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_warehouse_name_type UNIQUE (nama_bumbu, tipe),
    -- Enables a composite FK from order_items.
    CONSTRAINT uq_warehouse_id_name UNIQUE (id, nama_bumbu)
);

CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    pemesan_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    pemberi_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status      order_status NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_orders_different_parties CHECK (pemesan_id <> pemberi_id)
);

CREATE TABLE order_items (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    warehouse_id  BIGINT NOT NULL,
    nama_barang   VARCHAR(200) NOT NULL,
    jumlah_pesan  INTEGER NOT NULL CHECK (jumlah_pesan > 0),
    CONSTRAINT fk_order_item_warehouse_name
      FOREIGN KEY (warehouse_id, nama_barang)
      REFERENCES warehouse(id, nama_bumbu)
      ON DELETE RESTRICT,
    CONSTRAINT uq_order_item_product UNIQUE (order_id, warehouse_id)
);

-- Tenant-first indexes for the most common filters and keyset pagination.
CREATE INDEX idx_produk_mitra_tenant_id ON produk_mitra (mitra_id, id);
CREATE INDEX idx_history_tenant_created ON history (mitra_id, created_at DESC, id DESC);
CREATE INDEX idx_history_product_created ON history (mitra_id, id_produk, created_at DESC);
CREATE INDEX idx_orders_recipient_status_created
    ON orders (pemberi_id, status, created_at DESC, id DESC);
CREATE INDEX idx_orders_requester_created
    ON orders (pemesan_id, created_at DESC, id DESC);
CREATE INDEX idx_order_items_order ON order_items (order_id);

COMMIT;
