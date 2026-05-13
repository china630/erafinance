# `prisma/catalog/` — versioned reference data (`@erafinance/database`)

**Layout mirrors `prisma/seeds/`** (same layer names; no `_engine/` here): `core/`, `national/`, `bank/`, `geo/`, `hr/`, `trade/`. Each folder holds artifacts for that layer; empty dirs keep a `.gitkeep` until data is moved out of TS modules. **`seeds/`** only orchestrates and imports from here.

This folder holds **operational source files and generated snapshots** that ship with the database package (unlike repo-root `docs/`, which may be omitted from production images).

| Path | Role |
|------|------|
| `national/chart-of-accounts-commercial.json` | NAS commercial plan (AZ/RU names); loaded by `loadChartJson(COMMERCIAL)` in `prisma/lib/chart/chart-seed.ts`. |
| `national/chart-of-accounts-budget.json` | NAS budget / government plan (`OrganizationKind.BUDGET`). |
| `national/chart-of-accounts-ngo.json` | NAS non-commercial organizations plan (`OrganizationKind.NGO`). |
| `national/template-ifrs-mapping.v1.json` | IFRS mapping package for `loadTemplateIfrsMappingPackage`. |
| `trade/customs-tariff-rates.json` | AZ customs tariff rows for `seedCustomsTariffs` / `db:seed-customs-tariffs`; regenerate via `npm run db:parse-az-customs-md`. |
| `trade/customs-law-uom-mapping.json` | Law appendix UOM codes → `units_of_measure.code`. |
| `trade/customs-tariff-import.template.csv` | CSV template for manual / semi-automatic tariff imports. |
| `bank/banks-table.md` | Source markdown for bank / branch tables (CBA-style rows). Edit here, then run `npm run db:gen:banks-branches-seed` in this workspace. |
| `bank/bank-branches.generated.ts` | **Generated** branch seed consumed at runtime by `prisma db seed` — do not edit by hand. |
