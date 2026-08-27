# Architecture and implementation guide

## 1. Boundaries

```text
Expo application
  UI / feature modules
    ├─ POS -> sales.repository -> SQLite (source of truth while offline)
    ├─ Procurement -> REST API + Socket.IO
    └─ Sync coordinator -> NetInfo -> batch REST API

NestJS API
  ├─ Auth/tenant boundary (JWT guard in production)
  ├─ HistorySyncModule -> PostgreSQL idempotent ingestion
  ├─ OrdersModule -> transaction + inventory reservation
  └─ OrdersGateway -> user-specific Socket.IO rooms

PostgreSQL
  ├─ tenant-owned products and sales history
  └─ central warehouse and B2B orders
```

Suggested feature modules as the product grows:

- Mobile: `features/auth`, `features/catalog`, `features/pos`,
  `features/procurement`, `database`, `sync`, and `shared`.
- API: `auth`, `users`, `products`, `history-sync`, `warehouse`, `orders`,
  `realtime`, and `health`.
- Never accept `mitra_id` from a request body. Derive it from the authenticated
  bearer JWT and reload the current user from PostgreSQL in the request guard.

Account management endpoints use the authenticated UUID from the bearer token:

```text
POST  /api/v1/admin/partners/onboard-with-stock
                              atomically creates partner, transfers initial stock,
                              and records central revenue
GET   /api/v1/profile         current user's profile
PATCH /api/v1/profile         current user updates their own profile/credentials
```

New partner passwords and changed passwords are bcrypt-hashed. Initial stock is
optional. When supplied, the same serializable transaction locks warehouse rows,
reduces central stock, creates `produk_mitra`, and records revenue in
`partner_stock_distributions`. The admin submits quantity only: central pricing comes
from `warehouse.harga`, while a partner product starts with price `0` until the partner
sets it. Changing a username never changes the immutable tenant UUID.

## 2. Database decisions

Run `database/migrations/001_initial.sql` once with a migration account. UUID is
used for users and offline transaction identifiers; server-generated numeric IDs
remain efficient for high-volume tables. Money is `NUMERIC(18,2)` centrally and
integer cents locally, avoiding floating-point rounding.

The supplied model was extended with `order_items.warehouse_id`. A name is display
data, not a safe inventory key; storing both gives referential integrity and keeps
the original `nama_barang` snapshot. `TIMESTAMPTZ` is used centrally so timestamps
sent by devices retain an unambiguous instant.

Tenant-leading indexes cover common product/history queries. The unique `uuid`
index is the idempotency boundary. For larger installations, consider monthly
partitioning of `history`, but 20 partners alone does not justify that complexity.

## 3. Offline POS flow

1. Initialize SQLite once during application bootstrap. WAL improves read/write
   concurrency, while foreign keys and constraints catch corrupted data early.
2. `recordSale()` atomically decrements local stock and inserts the history event.
   A crash cannot leave only one half committed.
3. `startHistorySync()` runs at startup and whenever NetInfo reports connectivity.
   An in-process promise mutex prevents overlapping sync loops.
4. The client posts at most 100 pending rows. It marks only server-acknowledged UUIDs
   as synced. Network failure leaves them pending.
5. The API inserts up to 500 rows with `ON CONFLICT (uuid) DO NOTHING`; retries are
   therefore safe. Original `created_at` remains the device transaction time, while
   `synced_at` records ingestion time.

API contract:

```http
POST /api/v1/history/sync
Authorization: Bearer <jwt>
Content-Type: application/json

{"items":[{"uuid":"...","productId":"42","soldQuantity":2,
"price":"15000.00","createdAt":"2026-08-20T10:00:00.000Z"}]}
```

```json
{"acknowledgedUuids":["..."]}
```

For production, also run sync when the app returns to foreground. NetInfo is only a
signal; failed HTTP calls must remain retryable. Add exponential backoff with jitter,
request timeouts, structured logs, and a dead-letter UI for validation failures.

## 4. Procurement and real-time notifications

`POST /api/v1/orders` takes a supplier and warehouse item IDs. It records the
request and item-name snapshot without consuming warehouse stock. Fulfillment uses:

```text
GET   /api/v1/orders/incoming       central admin inbox
GET   /api/v1/orders/mine           requesting partner history
PATCH /api/v1/orders/:id/status     central admin transition
GET   /api/v1/admin/sales/summary   sales aggregation and filters
GET   /api/v1/admin/partners        partner list with central stock snapshots
GET   /api/v1/admin/partners/:mitraId/stock
                                     selected partner product balances
```

The status service:

1. locks the order and validates the single allowed next state;
2. on `diterima -> dikirim`, updates warehouse rows using `stock >= requested`;
3. changes status in the same `SERIALIZABLE` transaction; and
4. emits `orders:status-changed` to `user:<pemesan_id>` only after commit.

Socket.IO clients connect to namespace `/orders` and provide a token in production:

```ts
const socket = io(`${SERVER_URL}/orders`, { auth: { token: accessToken } });
socket.on('orders:new', (order) => refreshOrders(order));
socket.on('orders:status-changed', (order) => updateOrderBadge(order));
```

The starter gateway uses `auth.userId` to make the room behavior easy to run. It is
not secure until a WebSocket JWT guard verifies the token and derives the room from
its `sub` claim.

## 5. Preventing stock race conditions

Never implement stock mutation as `SELECT stock`, check in application code, then a
separate unguarded `UPDATE`. Concurrent requests can both pass that check.

This starter combines row locks, a transaction, and the defensive predicate
`UPDATE ... WHERE stock >= requested`. Lock rows in a deterministic order to reduce
deadlocks. Catch PostgreSQL serialization/deadlock errors (`40001`, `40P01`) at the
request boundary and retry the complete transaction a small number of times with
jitter.

The implementation consumes stock exactly once during `diterima -> dikirim`.
Repeated requests for the current status are idempotent, while skipped or reversed
transitions are rejected. The guarded status update remains conditional:

```sql
UPDATE orders SET status = 'dikirim', updated_at = now()
WHERE id = $1 AND status = 'diterima';
```

Only continue when exactly one row changed. Every status transition should use the
same pattern and an audit/event table. For reliable notifications across multiple
API replicas, use a transactional outbox plus a Redis Socket.IO adapter; direct
in-process emission can be lost if the process stops immediately after commit.

## 6. Production checklist

- JWT access/refresh tokens, Argon2id password hashes, role and ownership guards.
- PostgreSQL Row Level Security as defense in depth for tenant-owned tables.
- Schema migrations through CI; never enable TypeORM `synchronize` in production.
- Idempotency key for order creation as well as history sync.
- NTP/device-clock warning and server-side bounds for implausible timestamps.
- TLS, encrypted secure storage, database backups, metrics, tracing, and audit logs.
- Integration tests with concurrent order requests and forced sync retries.
