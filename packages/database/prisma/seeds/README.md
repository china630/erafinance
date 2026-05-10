# `prisma/seeds/` — layered orchestration only

- **`_engine/`** — CLI flags (`parseSeedCli`), `runSeedLayers`, `upsertByCode`, region resolution.
- **`../lib/`** — shared TS modules (chart/NAS, bank markdown); **not** a seed layer — imported from thin `seeds/*` files.
- **`../scripts/ops/`** — operational CLIs (`db:prod-init`, PII, i18n, demo `seed-tivi`, …); **not** part of layered `db:seed`.
- **Layer folders:** **`core/`**, **`national/`**, **`hr/`**, **`bank/`**, **`geo/`**, **`trade/`** — thin modules that call upserts; **no huge embedded datasets** here when avoidable.
- **Default layer order** (when `--layers` is omitted): `core` → `national` → `hr` → `bank` → `geo` → `trade`. The layer key **`geo-light`** remains an **alias** for `geo` in the runner for backward compatibility.
- **Bank layer (`bank/`):** `seedBank` runs `bank-glossary-seed` then applies branch rows from **`../catalog/bank/bank-branches.generated.ts`** (regenerated from `../catalog/bank/banks-table.md`).
- **National layer:** chart of accounts and tax rates under `national/` (active set depends on `ctx.region` / `SEED_REGION`).

All large static tables and markdown sources live under **`../catalog/`** only (see `catalog/README.md`); `seeds/` must not embed copy-paste dumps of the same data.

### `*.data.ts` next to seed modules

Small **TypeScript constants** (RBAC matrix, job titles, currency rows) live as `*.data.ts` **next to** the thin `*.ts` that upserts them — same pattern as before the `catalog/` split. They are **not** the same as `catalog/` blobs: they are typed seed rows, easy to import, and usually modest in size. When a table grows to hundreds of generated lines (banks, full HS trees), prefer **`catalog/<layer>/`** + a thin importer in **`lib/`** or the layer.
