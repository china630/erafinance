# Deploy Documentation Center

This directory is the single entry point for deployment and recovery runbooks.

## Docker orchestration (compose)

| Compose file | When to use |
|--------------|-------------|
| [`docker-compose.yml`](../../docker-compose.yml) | Local Windows/Linux dev: **Postgres 16** + **Redis 7** under `DOCKER_DATA_ROOT` (see repo root `.env.example`). First Postgres init mounts only `prisma/docker-init/00-extensions.sql` (uuid-ossp). One-shot local DB fill: **`npm run db:bootstrap-local`** (`migrate` + `db:seed` + `db:sync-i18n`). See [`docker/README-docker-data.txt`](../../docker/README-docker-data.txt). |
| [`docker-compose.prod.yml`](../../docker-compose.prod.yml) | Production-like stack: **Postgres 16**, **Redis 7** (AOF + `maxmemory` + `noeviction`), **API** (Node 22), **Web** (Node 22). **Does not** mount migrations into `docker-entrypoint-initdb.d` (migrations run via API: `npm run db:migrate:deploy`). Includes **json-file log rotation** and **container healthchecks** (`/api/health`, web root). |
| [`docs/deploy/monitoring/docker-compose.monitoring.yml`](./monitoring/docker-compose.monitoring.yml) | **Optional** Prometheus + Grafana override (see [`monitoring/README.md`](./monitoring/README.md)). |

Build images **from the repository root**:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
```

Docker-related assets (host data README template, placeholder Dockerfile for discovery): [`docker/`](../../docker/).

**Prisma migrations:** the repo ships a **single squashed** migration ([`packages/database/prisma/migrations/20260520120000_squashed_schema`](../../packages/database/prisma/migrations/20260520120000_squashed_schema/migration.sql)). Fresh environments: empty database, then `npm run db:migrate:deploy` (or `npm run db:deploy` to include i18n prune). If your **local** Postgres still contains objects from the **old** migration chain, drop/recreate the database (or use a new DB name) before deploy — otherwise the first apply will fail with “already exists”.

Runtime secrets: copy `env.production.example` → `.env` next to `docker-compose.prod.yml`. Images do **not** embed `.env` (`.dockerignore`); Compose mounts `env_file` at runtime only.

**Stack versions (repo-wide):** Node.js **22**, Postgres **16-alpine**, Redis **7-alpine**, Prisma **7** (`packages/database/prisma.config.ts`, driver adapter). CI: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

## Local Windows helpers (not in git)

If you keep `*.bat` in the repo root (e.g. `START-ERP.bat`), verify each script: `cd /d` to the monorepo root (path may contain spaces), call `npm run dev` / `dev:api` / `dev:web` from [root `package.json`](../../package.json), free ports **3000** / **4000** before start (`npm run stop:next` / `stop:api`), and load the root `.env` (see [`.cursor/rules/erafinance-local-dev.mdc`](../../.cursor/rules/erafinance-local-dev.mdc)).

## Quick Scenario Map

| Scenario | Start Here | Then |
|---|---|---|
| **DigitalOcean migration (greenfield DB, wipe)** | `deploy.ru.md` §0.1 / `deploy.md` §0.1 | `PRE-RELEASE-CHECKLIST.md`, sections 1–9 of deploy guide |
| Production rollout (RU) | `deploy.ru.md` | `PRE-RELEASE-CHECKLIST.md` |
| Production rollout (EN) | `deploy.md` | `PRE-RELEASE-CHECKLIST.md` |
| Extension release (Assistant / DVX) | `EXTENSION_MVP_DEPLOY.md` | `deploy.ru.md` / `deploy.md` for shared infra steps |
| Disaster recovery drill / incident | `DR_RUNBOOK.md` | `TZ.md` DR sections if deeper validation is needed |
| Stage B infra checklist (steps 34–65) | [`../launch/STAGE_B_INFRASTRUCTURE.md`](../launch/STAGE_B_INFRASTRUCTURE.md) | This README + compose files |

## On-Call Reading Order

1. Identify incident type: `deploy`, `extension`, or `DR`.
2. Open the matching runbook from the scenario map.
3. Execute steps in strict order; do not skip verification checkpoints.
4. For DB-affecting changes, confirm migrations/seed/idempotent commands were executed.
5. Record command outputs, timestamps, and rollback decision in incident log.
6. If real-world flow diverges from runbook, escalate and update docs after resolution.

## Active Runbooks

- `deploy.ru.md` — primary production deployment guide (Russian).
- `deploy.md` — production deployment guide (English).
- `DR_RUNBOOK.md` — disaster recovery restore and validation procedure (includes RPO/RTO, PITR, WAL outline, capacity, firewall).
- `PRE-RELEASE-CHECKLIST.md` — pre-release readiness checklist.

## Extension Release

- `EXTENSION_MVP_DEPLOY.md` — ERA Finance Assistant rollout checklist (Staging/Production), including env vars, `tax_pro` seed step, and QA smoke tests.

## Reverse proxy examples

- `../nginx-maintenance.conf` — file-based maintenance toggle.
- `../nginx-erafinance-production.example.conf` — gzip, upstreams to API/Web, TLS placeholders.

## Generated Artifacts

- `generated/deploy.ru.html` — generated HTML export of the RU deploy guide.
