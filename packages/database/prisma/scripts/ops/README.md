# `prisma/scripts/ops/` — operational CLIs

One-off and maintenance TypeScript entrypoints (not `prisma db seed` layers). Invoked via `npm run db:*` in `@erafinance/database`.

| Folder | Scripts |
|--------|---------|
| **`platform/`** | `prod-init.ts`, `platform-raw-sql.ts`, `wipe-tenant-data.ts` |
| **`i18n/`** | Translation sync / audit vs `apps/web` resources |
| **`pii/`** | PII cutover, nullify, org tax cipher, asserts |
| **`nas/`** | NAS account name migration, per-user NAS resync |
| **`ifrs/`** | IFRS template apply, demo mapping |
| **`audit/`** | Currency code audit |
| **`demo/`** | `seed-tivi.ts` (presentation data) |

Imports use **`../../../prisma-client`** and **`../../../lib/...`** relative to each `ops/<folder>/` file.
