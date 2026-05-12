# DR Runbook: PostgreSQL Restore

This runbook describes how to restore ERA Finance PostgreSQL data from backups produced by `scripts/db-backup.sh`.

## 1) Preconditions

- Access to backup archive: `*.sql.gz`
- PostgreSQL server is reachable
- Credentials for target DB (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`)
- Maintenance window approved (restore is destructive for target DB)

## 2) Identify Restore Point

1. Locate backup folder (default): `backups/db/`
2. Pick archive by timestamp, for example:
   - `erafinance-erafinance-20260511-020001.sql.gz`
3. Verify file integrity:
   - `gzip -t "<backup-file>.sql.gz"`

## 3) Prepare Target Database

> If restoring into a fresh DB, create it first.  
> If restoring over existing DB, terminate active connections and recreate DB.

Example (psql):

```bash
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${PGDATABASE}' AND pid <> pg_backend_pid();"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "DROP DATABASE IF EXISTS ${PGDATABASE};"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "CREATE DATABASE ${PGDATABASE};"
```

## 4) Restore From Dump

```bash
gunzip -c "<backup-file>.sql.gz" | psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE"
```

## 5) Post-Restore Validation

1. Apply schema migrations (if needed):
   - `npm run db:migrate`
2. Verify core tables have data:
   - `organizations`, `users`, `transactions`, `journal_entries`
3. Run API health check and basic smoke tests:
   - login, open dashboard, run one report
4. Confirm background workers reconnect normally.

## 6) Rollback Plan

- If restore fails: keep service in maintenance mode, pick earlier backup and repeat.
- If app-level checks fail after restore: re-run restore with previous valid snapshot.

## 7) Operational Notes

- Backup retention is controlled by `RETENTION_DAYS` (default 7).
- Keep at least one off-host copy of critical backups.
- Test restore procedure regularly (at least monthly) on staging.

## 8) Automated DR drill (repo scripts)

1. **Validate counts only** (point `DATABASE_URL` at the DB you just restored, e.g. staging):

   ```bash
   npm run platform:dr-validate
   npm run platform:dr-validate -- --baseline=backups/dr-baseline.example.json
   ```

2. **Full drill** (latest `backups/db/*.sql.gz` → throwaway Postgres in Docker → validate → destroy container). Requires Docker, bash (Git Bash/WSL on Windows), and `gzip`:

   ```bash
   bash scripts/dr-drill.sh
   bash scripts/dr-drill.sh --baseline=backups/dr-baseline.example.json
   ```

   Override backup directory: `BACKUP_DIR=/path/to/backups bash scripts/dr-drill.sh`.  
   Override host port: `DR_DRILL_PORT=55433 bash scripts/dr-drill.sh`.

3. Copy **`backups/dr-baseline.example.json`** to a secure path and adjust numbers after a known-good production snapshot if you want strict equality checks.

## 9) RPO / RTO targets (planning)

| Metric | Typical target (self-hosted Compose) | Managed Postgres (RDS / Cloud SQL) |
|--------|--------------------------------------|------------------------------------|
| **RPO** (max acceptable data loss) | Between logical dumps: up to `scripts/db-backup.sh` schedule (default daily). | Native PITR / WAL shipping — often minutes. |
| **RTO** (time to restore service) | Restore dump + migrations + app restart; measure in staging. | Same app steps; DB PITR reduces DB-only RTO. |

Record agreed numbers in your incident wiki and revisit after each DR drill.

## 10) PITR / WAL (managed vs self-hosted)

- **Managed database:** enable automated backups + PITR in the provider console; restore via provider UI/CLI. Do **not** rely on `pg_dump` alone for sub-daily RPO.
- **Self-hosted Postgres:** configure continuous WAL archiving (`archive_mode`, `archive_command`) to durable object storage (e.g. S3-compatible bucket with versioning). Test restore to a **new** cluster before production reliance.

Cross-check: `docs/deploy/deploy.md` (stack layout) and `docker-compose.prod.yml` (no public DB ports in hardened installs).

## 11) WAL archives to S3 (outline)

1. Dedicated IAM user/bucket prefix `postgres-wal/<cluster>/…` with versioning + lifecycle (compliance as required).
2. `archive_command` ships `%p` to object storage; `restore_command` pulls segments during recovery.
3. Quarterly restore drill: clone WAL chain + base backup → temporary instance → `npm run platform:dr-validate`.

## 12) Node.js memory / `ulimit` (API + Web containers)

- Prefer **container memory limits** (`mem_limit` / orchestrator resources) over ad-hoc `NODE_OPTIONS=--max-old-space-size` unless you profiled OOM.
- On bare metal, document `ulimit -n` (open files) for high concurrency; ensure systemd unit sets `LimitNOFILE=` appropriately.

## 13) Capacity planning (starting point)

Rough guidance for **small SaaS** until you have metrics: Postgres **2 vCPU / 8 GiB** minimum for OLTP + reporting; API **1–2 vCPU / 2–4 GiB**; Web **1 vCPU / 1–2 GiB**; Redis **512 MiB–2 GiB** with persistence (`docker-compose.prod.yml` ships `maxmemory` + `noeviction` to avoid silent key eviction for BullMQ). Scale horizontally by **additional API replicas** sharing the same `REDIS_URL` / DB — BullMQ consumers coordinate across processes.

## 14) Firewall / SSH / edge

- **Firewall:** only `80/443` (and VPN/bastion) public; Postgres `5432`, Redis `6379`, Prometheus `9090`, Grafana `3001` must stay on private networks or localhost.
- **SSH:** key-based auth only, `PasswordAuthentication no`, allowlist admin IPs where possible.
- **Cloudflare / WAF:** optional DDoS + bot mitigation in front of public HTTPS; keep origin TLS strict.
