# Seed & catalog inventory (plan E)

## E1 — Catalog placeholders vs seeds

| Location | Status | Classification |
|----------|--------|----------------|
| `prisma/catalog/geo/.gitkeep` | deferred | Geo rows: `prisma/seeds/geo/` (countries/cities). |
| `prisma/catalog/hr/.gitkeep` | deferred | HR seeds: `prisma/seeds/hr/`. |
| `prisma/catalog/trade/.gitkeep` | deferred | Trade seeds: `prisma/seeds/trade/`. |
| `prisma/catalog/core/.gitkeep` | deferred | Core seeds: `prisma/seeds/core/` (RBAC, currencies, UoM, notifications, etc.). |
| `prisma/catalog/bank/*` | filled | Banks/branches from MD import + generated branches seed where applicable. |
| `prisma/catalog/national/*` | filled | NAS chart JSONs (`commercial`, `budget`, `ngo`), IFRS template mapping. |
| `prisma/seeds/national/tax-rates.ts` | filled | VAT (18/8/2/0/exempt) + sample excise; extend when PRD adds rates. |

## E2 — Source map (PRD / TZ)

| Seed layer / folder | PRD (modules) | TZ |
|---------------------|---------------|-----|
| `seeds/core/currencies`, `currencies.data` | Core SaaS, treasury baseline | §2, §6.0 |
| `seeds/core/rbac/*` | IAM, org roles | §2, §9 |
| `seeds/core/system-users` | Platform bootstrap | §15 |
| `seeds/core/system-product-templates` | Catalog products baseline | §4 |
| `seeds/core/audit-categories`, `activity-types`, `notification-types` | Platform hygiene | §9 |
| `seeds/national/tax-rates` | Sales/purchase ƏDV | §4, §6 |
| `seeds/national/chart` (via `seed.ts` + `chart-seed`) | Accounting NAS | §6 |
| `seeds/geo/*` | Counterparty addresses | §4 |
| `seeds/hr/*` | HR / payroll prep | §7.0 |
| `seeds/trade/*` | Procurement baseline | §4 |
| `seeds/bank/*` | Banking glossary | §6.0 |

## E3 — Fill vs defer

**Filled for active MVP paths:** core dictionaries (currency, UoM, RBAC), national tax rates + NAS catalogs, bank glossary pipeline.

**Defer (inactive modules / roadmap):** expanding HR/trade/geo beyond current MVP rows until module gates ship; extra catalog folders remain `.gitkeep` until files replace placeholders.

**Trigger to revisit deferrals:** PRD/TZ marks module **COMPLETED** for that vertical, or product requests empty-selector UX in staging.

## E4 — Quality gate

Run from repo root (no DB required for unit specs):

```bash
npm run db:seed:verify -w @dayday/database
```

This runs `build:chart` plus `jest` over `packages/database` (includes seed idempotency, enum/mapper, parsers).

Operational lists at runtime (avoid duplicating in seeds):

- FX dashboard codes: `system_config` → `fx.dashboard_currency_codes`
- FX CBAR check codes: `fx.cbar_check_currency_codes`
- Web currencies: `GET /api/system/currencies`
- Invoice VAT options: `GET /api/system/invoice-vat-rates`
- Team invite roles: `GET /api/system/team-assignable-roles`
- Stock movement enums (filters/UI): `GET /api/system/inventory-movement-enums`
- Org bank account kinds / allowed currencies: `@dayday/api-contracts` (`ORGANIZATION_BANK_ACCOUNT_TYPES`, `ORGANIZATION_BANK_ACCOUNT_CURRENCIES`)
