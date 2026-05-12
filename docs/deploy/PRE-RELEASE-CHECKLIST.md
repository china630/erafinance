# Pre-Release Checklist

Single source of truth for cross-cutting release tasks. **Stage A (Foundations)** execution log: [docs/launch/STAGE_A_FOUNDATIONS.md](../launch/STAGE_A_FOUNDATIONS.md) and [docs/launch/100_STEPS_TO_LIVE.md](../launch/100_STEPS_TO_LIVE.md) (steps 1–33).

## Runtime & ORM (status: aligned with repo)

- [x] **Node.js 22.x** — `package.json#engines.node`, Dockerfiles, GitHub Actions `node-version: 22`.
- [x] **Postgres 16.x** — `docker-compose.yml` / `docker-compose.prod.yml` images (`postgres:16-alpine`).
- [x] **Redis 7.x** — compose images (`redis:7-alpine`).
- [x] **Prisma 7.x** — `packages/database` (`prisma`, `@prisma/client`, `@prisma/adapter-pg`), `prisma.config.ts`, driver adapter per [deploy.md](./deploy.md).
- [x] **Replace legacy `package.json#prisma` config** — superseded by `prisma.config.ts` in `@erafinance/database`.

## Before each production deploy

- [ ] Database backup taken (see `scripts/backup-db.sh` and `DR_RUNBOOK.md`).
- [ ] If this is a **new** production database (greenfield), apply migrations once: `npm run db:migrate:deploy` against an **empty** Postgres database (single squashed migration in `packages/database/prisma/migrations`). Do not mount raw `migration.sql` into `docker-entrypoint-initdb.d` in parallel with Prisma (see `docker-compose.prod.yml` comments).
- [ ] `npm run db:migrate:deploy` (or `npm run db:deploy` if i18n prune is part of release) on target DB.
- [ ] `npm run build` on the release commit (includes `i18n:audit`).
- [ ] If `packages/i18n` changed: `npm run i18n:catalog` and commit `apps/api/src/admin/i18n-default-catalog-data.json`.
- [ ] Smoke: auth, one ledger read, health (`GET /api/health`).
- [ ] Optional drill: `npm run audit:verify` on a recent DB snapshot copy.

## Go-Live (Stage E–F)

Extended checklist and smoke matrix: [docs/launch/STAGE_E_GO_LIVE.md](../launch/STAGE_E_GO_LIVE.md) and [docs/launch/100_STEPS_TO_LIVE.md](../launch/100_STEPS_TO_LIVE.md) (steps 127–172).
- [ ] Billing smoke for new org: registration in current month -> `isTrial=true` until month end (UTC), no invoice for signup month.
- [ ] Billing smoke for first payable month: on next 1st day, invoice generated for full previous month usage; `SOFT_BLOCK/HARD_BLOCK` only for unpaid issued invoice after grace window.

## Full verification after major ORM / runtime upgrades

- [ ] `npm run db:generate`
- [ ] `npm run build -w @erafinance/database -w @erafinance/api`
- [ ] `npm run dev` smoke (API + Web)
- [ ] Basic auth (login/register) against running API
