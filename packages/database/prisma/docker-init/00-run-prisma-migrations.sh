#!/bin/sh
# LEGACY / OPTIONAL: not used by repo root `docker-compose.yml` (only `00-extensions.sql` is mounted).
# Local schema: `npm run db:migrate`; first-fill: `npm run db:bootstrap-local` (seed + i18n sync on host).
# Keep this script for custom compose overrides that mount `prisma/migrations` at `/erafinance-prisma-migrations`.
set -eu
if [ ! -d /erafinance-prisma-migrations ]; then
  echo "erafinance: /erafinance-prisma-migrations not mounted — skipping init migrations."
  exit 0
fi

# Hotfix: allow fresh init even if some historical migrations ALTER enums
# that may not exist yet in this custom init flow.
psql -v ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  -c "DO \$\$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankStatementLineOrigin') THEN
          CREATE TYPE \"BankStatementLineOrigin\" AS ENUM (
            'FILE_IMPORT',
            'DIRECT_SYNC',
            'WEBHOOK',
            'INVOICE_PAYMENT_SYSTEM',
            'MANUAL_CASH_OUT',
            'MANUAL_BANK_ENTRY'
          );
        END IF;
      END \$\$;"
find /erafinance-prisma-migrations -mindepth 2 -maxdepth 2 -name migration.sql -print \
  | LC_ALL=C sort \
  | while IFS= read -r f; do
    echo "erafinance: applying $f"
    psql -v ON_ERROR_STOP=1 \
      --username "${POSTGRES_USER}" \
      --dbname "${POSTGRES_DB}" \
      -f "$f"

    mig_name=$(basename "$(dirname "$f")")
    chk=$(sha256sum "$f" | awk '{print $1}')

    # Replace any row for this migration (e.g. failed host `migrate deploy` before init finished,
    # or a stale row). Otherwise INSERT ... WHERE NOT EXISTS skips and Prisma on the host reapplies
    # migration.sql → P3018 "type UserLocale already exists".
    psql -v ON_ERROR_STOP=1 \
      --username "${POSTGRES_USER}" \
      --dbname "${POSTGRES_DB}" \
      -c "CREATE TABLE IF NOT EXISTS public.\"_prisma_migrations\" (
            id character varying(36) NOT NULL,
            checksum character varying(64) NOT NULL,
            finished_at timestamp with time zone,
            migration_name character varying(255) NOT NULL,
            logs text,
            rolled_back_at timestamp with time zone,
            started_at timestamp with time zone DEFAULT now() NOT NULL,
            applied_steps_count integer DEFAULT 0 NOT NULL,
            CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
          );
          DELETE FROM public.\"_prisma_migrations\" WHERE migration_name = '${mig_name}';
          INSERT INTO public.\"_prisma_migrations\" (
            id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
          ) VALUES (
            gen_random_uuid()::text, '${chk}', NOW(), '${mig_name}', NULL, NULL, NOW(), 1
          );"
  done
