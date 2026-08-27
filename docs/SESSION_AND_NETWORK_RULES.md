# Session and network business rules

## Authentication lifecycle

1. With no stored session, `LoginScreen` calls `NetInfo.fetch()`. Offline login is
   rejected before an HTTP request is attempted.
2. `POST /api/v1/auth/login` validates PostgreSQL credentials and returns a signed
   bearer token without an `exp` claim plus the user/tenant identity.
3. The mobile app stores that object in Expo SecureStore. App bootstrap reads it
   before selecting a screen, without contacting the server.
4. Explicit logout deletes the SecureStore key. Network loss, app restart, and
   process termination do not delete the session.

The no-expiry policy is implemented as requested, but it raises the impact of a
stolen token. Production should support server-side device-session revocation even
if normal sessions never expire.

## Feature matrix

| Feature | Offline | Online |
| --- | --- | --- |
| Restore existing session | allowed | allowed |
| First login after logout | blocked | server verification |
| POS checkout | SQLite `pending` | SQLite then immediate sync |
| History sync | waits | automatic bounded batches |
| Procurement | blocked at UI and request boundary | direct API request |

`NetInfo` is a usability guard, not proof that the server is reachable. Every HTTP
call still handles network errors. POS never depends on that call; procurement
fails without creating a misleading local order.

## Development accounts

After running `002_development_seed.sql`:

```text
Mitra:  mitra.demo / mitra123
Pusat:  pusat.admin / admin123
```

Seed passwords are upgraded to bcrypt hashes on first successful login. Never use
the development seed in production.
