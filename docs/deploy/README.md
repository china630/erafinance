# Deploy Documentation Center

This directory is the single entry point for deployment and recovery runbooks.

## Docker orchestration (compose)

| Compose file | When to use |
|--------------|-------------|
| [`docker-compose.yml`](../../docker-compose.yml) | Local Windows/Linux dev: Postgres + Redis with data under `DOCKER_DATA_ROOT` (see repo root `.env.example`). |
| [`docker-compose.prod.yml`](../../docker-compose.prod.yml) | Production-like stack: **Postgres**, **Redis** (AOF + `maxmemory` + `noeviction`), **API**, **Web**. Includes **json-file log rotation** and **container healthchecks** (`/api/health`, web root). |
| [`docs/deploy/monitoring/docker-compose.monitoring.yml`](./monitoring/docker-compose.monitoring.yml) | **Optional** Prometheus + Grafana override (see [`monitoring/README.md`](./monitoring/README.md)). |

Build images **from the repository root**:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
```

Runtime secrets: copy `env.production.example` → `.env` next to `docker-compose.prod.yml`. Images do **not** embed `.env` (`.dockerignore`); Compose mounts `env_file` at runtime only.

## Quick Scenario Map

| Scenario | Start Here | Then |
|---|---|---|
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

- `EXTENSION_MVP_DEPLOY.md` — DayDay Assistant rollout checklist (Staging/Production), including env vars, `tax_pro` seed step, and QA smoke tests.

## Reverse proxy examples

- `../nginx-maintenance.conf` — file-based maintenance toggle.
- `../nginx-dayday-production.example.conf` — gzip, upstreams to API/Web, TLS placeholders.

## Generated Artifacts

- `generated/deploy.ru.html` — generated HTML export of the RU deploy guide.
