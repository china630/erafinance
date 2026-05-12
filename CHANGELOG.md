# Changelog

All notable production-hardening steps are tracked in [docs/launch/100_STEPS_TO_LIVE.md](docs/launch/100_STEPS_TO_LIVE.md).

## [Unreleased]

### Stage A — Foundations (closed in repo)

- Node **22** + Prisma **7** baseline; global rate limiting; production **Helmet** on API; bulk DTO array caps; `@RequiresModule` on Excel bulk and OCR controllers; `npm run audit:verify`; GitHub Actions CI (migrate, lint, API unit tests under `src/`, monorepo build).

### Stage B — Infrastructure (closed in repo)

- `docker-compose.prod.yml`: Redis **maxmemory** + **noeviction**, **json-file** log rotation, **healthchecks** for API/Web; BullMQ **Redis DB** path parsing; optional **Prometheus/Grafana** compose under `docs/deploy/monitoring/`; **Nginx** production example; **DR_RUNBOOK** RPO/RTO/PITR/WAL/capacity/firewall/SSH; **`ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL`** on workers; OCR queue **backoff**; billing monthly **retries**; **`SNAPSHOT_RETENTION_DAYS`** (default 30) for snapshot metadata `expiresAt`; docs **`STAGE_B_INFRASTRUCTURE.md`** + expanded **`docs/deploy/README.md`**.
