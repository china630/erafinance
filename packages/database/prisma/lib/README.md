# `prisma/lib/` — shared TypeScript modules

Reusable domain logic consumed by **`seeds/`**, **`scripts/`**, and **`prisma/*.ts`** entrypoints (not Prisma migrations).

- **`chart/`** — NAS / chart of accounts / IFRS mapping loaders (`chart-seed`, `template-ifrs`). Commercial/budget/NGO rows ship as JSON under `prisma/catalog/national/`.
- **`core/`** — `pricing-module-seed` (`pricing_modules` defaults; invoked from `seeds/core` and re-exported via package `index.js`).
- **`bank/`** — bank glossary seed, markdown parser/importer for `catalog/bank/`.

Versioned **data files** stay under **`prisma/catalog/<layer>/`**; this folder holds **code** only.
