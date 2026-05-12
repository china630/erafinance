# Stage B — Infrastructure & DevOps (execution notes)

Maps to [100_STEPS_TO_LIVE.md](./100_STEPS_TO_LIVE.md) steps **34–65**. Product law: [PRD.md](../../PRD.md), [TZ.md](../../TZ.md).

## Docker / Compose (34, 50, 64)

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local dev: Postgres + Redis on `DOCKER_DATA_ROOT` (Windows path). |
| `docker-compose.prod.yml` | Production-style stack: `db`, `redis`, `api`, `web`. **No `.env` baked into images** — `.dockerignore` excludes `.env`; runtime uses `env_file: .env` on the host only. |
| `apps/api/Dockerfile`, `apps/web/Dockerfile` | Multi-stage Node 22 builds; `DATABASE_URL` placeholder only for Prisma generate at build time. |

**Worker isolation (64):** BullMQ workers run inside the Nest API process today. For higher load, run **multiple `api` replicas** behind a load balancer with the same `REDIS_URL` / `DATABASE_URL` — BullMQ coordinates consumers. A dedicated worker-only process (HTTP disabled) is a future enhancement.

## Backups & DR (35–37, 54)

- Logical dumps: `scripts/db-backup.sh` (rotation `RETENTION_DAYS`, default 7).
- Validation: `npm run platform:dr-validate`, `bash scripts/dr-drill.sh`.
- PITR / WAL / RPO / RTO / capacity / firewall / SSH: **`docs/deploy/DR_RUNBOOK.md`** sections 1–14.

## Redis (38)

- Prod Compose: **AOF** + **`maxmemory` / `noeviction`** so queue keys are not silently evicted.
- Optional **logical DB separation**: append `/N` to `REDIS_URL` (e.g. `redis://redis:6379/2`); `connectionFromRedisUrl` maps the path to BullMQ `db`.

## BullMQ queues (39–43)

| Queue | Source file |
|-------|-------------|
| Payroll heavy | `apps/api/src/hr/payroll-heavy.queue.ts` + `payroll-heavy.worker.ts` |
| Billing monthly | `billing-monthly.queue.ts` + `billing-monthly.worker.ts` |
| Bank direct sync | `bank-sync.queue.ts` + `bank-sync.worker.ts` |
| Bank balances | `bank-balances-sync.queue.ts` + `bank-balances-sync.worker.ts` |
| OCR | `ocr.queue.ts` (backoff + `removeOnFail`) + `ocr.worker.ts` |
| Audit archive | `audit-archive.queue.ts` + `audit-archive.worker.ts` |

Failed jobs: optional webhook **`ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL`** (wired via `apps/api/src/queue/bullmq-worker-alerts.ts`).

## Metrics (44, 58)

- Optional stack: `docs/deploy/monitoring/` (`docker-compose.monitoring.yml` + `prometheus.yml`).
- Manual: `redis-cli`, RedisInsight, or provider metrics for Postgres.

## Logs (45)

- `docker-compose.prod.yml`: **json-file** logging with `max-size` / `max-file` per service.

## Health checks (46)

- `docker-compose.prod.yml`: **api** → `GET /api/health`; **web** → `GET /` (non-5xx).

## Next.js prod (47)

- `apps/web/next.config.ts` — rewrites `/api/*` to `NEXT_PUBLIC_API_URL`; Sentry via `withSentryConfig`.
- Build-time public env: see `apps/web/Dockerfile` and `env.production.example`.

## Extension (48)

- `docs/deploy/EXTENSION_MVP_DEPLOY.md` — Assistant / connector rollout; shares same API/Web health and secrets discipline.

## S3 Object Lock vs snapshot retention (49, 55, 63)

- **Object Lock ceilings:** `apps/api/src/storage/storage.constants.ts` (`PREFIX_RETENTION_DAYS`).
- **Snapshot metadata TTL:** `SNAPSHOT_RETENTION_DAYS` (default **30**) in `apps/api/src/platform-recovery/snapshot/snapshot.service.ts` — align S3 lifecycle delete-after with counsel + `expiresAt` cleanup jobs.

## Nginx / TLS (56–57)

- Maintenance snippet: `docs/nginx-maintenance.conf`.
- Full example (gzip, upstreams, TLS stubs): `docs/nginx-erafinance-production.example.conf`.
- Let's Encrypt / Caddy: `docs/deploy/deploy.md` (reverse proxy section).

## Sentry web (59)

- Client DSN: `NEXT_PUBLIC_SENTRY_DSN` at **web build** time; tunnel path optional (`SENTRY_TUNNEL_PATH`).

## Telegram / platform alerts (60)

- Reuse patterns: `AUDIT_ALERT_WEBHOOK_URL` (audit cron), **`ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL`** (BullMQ failures). Telegram Bot `sendMessage` URL works if you encode `chat_id` in the query string.
- External synthetic monitoring (UptimeRobot, etc.) should hit **`/api/health`** through the public edge.

## Timezone (52)

- DB stores **UTC**; UI locale Azerbaijan per PRD — smoke after deploy: create transaction, verify displayed local date.

## Cloudflare WAF (62)

- Optional in front of HTTPS; document allowlist for webhooks hitting origin directly.

## Vault / CI secrets (50)

- CI: GitHub Actions should inject secrets via **repository / environment secrets**, never commit `.env`.
- Images must not contain production `.env` (verified via `.dockerignore`).
