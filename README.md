# POS Offline-first + Procurement

Starter architecture for a multi-partner POS system:

```text
pos_apps/
├── database/migrations/001_initial.sql
├── apps/api/                         # NestJS + TypeORM + Socket.IO
│   └── src/
│       ├── database/entities/
│       ├── history-sync/
│       └── orders/
└── apps/mobile/                      # Expo integration layer
    └── src/
        ├── database/
        └── sync/
```

The complete architecture, data flow, API contracts, setup, and concurrency notes
are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

1. Create a PostgreSQL database and execute `database/migrations/001_initial.sql`.
   For local development only, optionally execute `002_development_seed.sql`.
   Execute `003_partner_stock_distributions.sql` for combined partner onboarding.
   Execute `004_warehouse_standard_price.sql` for quantity-only stock allocation.
2. Configure `DATABASE_URL` in `apps/api/.env`, install API dependencies, then
   run `npm run start:dev` from `apps/api`.
3. Add the contents of `apps/mobile` to an Expo project, install the dependencies
   listed in its `package.json`, and call `initializeDatabase()` once at app start.

Bearer JWT authentication and persistent mobile sessions are implemented. Before
production, rotate `JWT_SECRET`, remove development seed accounts, and add a
server-side device-token revocation mechanism.
