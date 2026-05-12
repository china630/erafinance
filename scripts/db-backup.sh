#!/usr/bin/env bash
set -euo pipefail

# Daily PostgreSQL logical backup with rotation (7 days) and gzip compression.
# Requires: pg_dump, gzip, find
#
# This is a **logical** dump (plain SQL). For RPO below dump frequency, use managed
# Postgres PITR (RDS, Cloud SQL, etc.) or self-hosted WAL archiving — see
# `docs/deploy/DR_RUNBOOK.md` sections 9–11.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups/db}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +'%Y%m%d-%H%M%S')"

DB_HOST="${PGHOST:-${POSTGRES_HOST:-127.0.0.1}}"
DB_PORT="${PGPORT:-${POSTGRES_PORT:-5432}}"
DB_NAME="${PGDATABASE:-${POSTGRES_DB:-erafinance}}"
DB_USER="${PGUSER:-${POSTGRES_USER:-erafinance}}"

# Either export PGPASSWORD, or rely on ~/.pgpass.
: "${PGPASSWORD:=}"
export PGPASSWORD

mkdir -p "${BACKUP_DIR}"

RAW_FILE="${BACKUP_DIR}/erafinance-${DB_NAME}-${TIMESTAMP}.sql"
ARCHIVE_FILE="${RAW_FILE}.gz"

echo "[db-backup] Dumping database ${DB_NAME} from ${DB_HOST}:${DB_PORT}"
pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  "${DB_NAME}" > "${RAW_FILE}"

gzip -9 "${RAW_FILE}"
echo "[db-backup] Created ${ARCHIVE_FILE}"

echo "[db-backup] Rotating backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -print -delete

echo "[db-backup] Completed"
