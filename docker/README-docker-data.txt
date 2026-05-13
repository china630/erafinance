ERA Finance — local Docker data on Windows (D: drive)
=====================================================

Copy this file to your host data root as README.txt, for example:

  D:\DockerData\erafinance_erp\README.txt

Recommended directories under DOCKER_DATA_ROOT (see repo root .env.example, DOCKER_DATA_ROOT):

  postgres/   — PostgreSQL 16 data (docker-compose.yml volume)

Prisma + local Postgres (root `docker-compose.yml`)
----------------------------------------------------
On **first** database init, Postgres runs only `prisma/docker-init/00-extensions.sql` (uuid-ossp).
**Schema** comes from the host: `npm run db:migrate` (`prisma migrate deploy`).

After a **new empty** data directory, from the repo root (once, before app dev):

  npm run db:bootstrap-local

That runs **`npm run db:migrate`**, **`npm run db:seed`** (core layer includes platform super-admins; national/hr/… per default `--layers`), then **`npm run db:sync-i18n`** so **`translation_overrides`** matches **`apps/web/lib/i18n/resources.ts`** (canonical per TZ §17). It replaces the old docker-entrypoint path that used large SQL snapshots.

Optional: **`npm run docker-init:export`** / **`npm run db:dump-to-prod`** dumps reference SQL to **stdout** (set **`DOCKER_INIT_OUT=path.sql`** to write a file) for rare manual imports — not part of normal bootstrap.

If migration history and DDL drift (local dev only): `npm run db:migrate:reset-public-dev` then `npm run db:migrate`.
If `migrate deploy` says no pending but tables are missing: `npm run db:migrate:clear-squash-row` then `npm run db:migrate`.

Or reset Postgres data under DOCKER_DATA_ROOT/postgres and run `docker compose up -d` again.

  redis/      — Redis AOF/data
  storage/    — optional local file storage for API (STORAGE_LOCAL_ROOT / ERAFINANCE_STORAGE_HOST_PATH)
  npm-cache/  — optional npm cache (root .npmrc cache=...)
  tmp/        — optional TEMP/TMP for tooling (.vscode/settings.json)

Dockerfiles (production images; build context = monorepo root "."):

  apps/api/Dockerfile
  apps/web/Dockerfile

Examples:

  docker build -f apps/api/Dockerfile -t erafinance-api:latest .
  docker build -f apps/web/Dockerfile -t erafinance-web:latest .

Local full stack (project name `erafinance_erp`, see docker/stack.local.env):

  docker compose --env-file docker/stack.local.env -f docker-compose.prod.yml build
  docker compose --env-file docker/stack.local.env -f docker-compose.prod.yml up -d

First-time DB: apply migrations from the host (Postgres is published on POSTGRES_PUBLISH_PORT from stack file):

  npx dotenv-cli -e docker/migrate-to-stack.env -o -- npm run db:migrate:deploy -w @erafinance/database

If Postgres was ever initialized with a different password, reset the volume before migrate:

  docker compose --env-file docker/stack.local.env -f docker-compose.prod.yml down -v

Default published ports in docker/stack.local.env: web http://127.0.0.1:13000 , API http://127.0.0.1:14000 .
