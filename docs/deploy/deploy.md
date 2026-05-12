# DayDay ERP - Production Deployment (Ubuntu 24.04 + Docker Compose)

Russian version: [deploy.ru.md](./deploy.ru.md).

Goal: bring up the stack from `docker-compose.prod.yml`:
- Postgres **16** (`db`)
- Redis **7** (`redis`)
- NestJS API (`api`)
- Next.js Web (`web`)

This guide is aligned with:
- **Node.js 22** (`apps/api/Dockerfile`, `apps/web/Dockerfile`)
- **Prisma ORM 7** + **`prisma.config.ts`** + driver adapter (`@prisma/adapter-pg`)
- **HTTPS required** for production web origin (see `TZ.md` section 1)

---

## 0. Quick checklist before start

- You have a domain and will configure HTTPS (Caddy/nginx/Traefik) that proxies traffic to `web:3000`.
- Root `.env` will exist in the repository (template: `env.production.example`).
- You understand `NEXT_PUBLIC_*` variables are embedded into the client bundle at build time.
- Only required external ports are open (typically 80/443); do not publicly expose Postgres/Redis.
- After **every** release with frontend code changes, do not skip i18n DB sync (section 7.3), otherwise `GET /api/public/translations` and i18n cache may diverge from bundled `resources.ts`.
- If **production** is a **greenfield wipe** (drop DB / empty volume, no data to keep), follow **section 7.0.1 (A)** — no baselining; then migrate + i18n + `db:prod-init` as usual.

---

## 1. SSH

```bash
ssh deploy@YOUR_SERVER_IP
```

---

## 2. Docker (Ubuntu 24.04)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"${VERSION_CODENAME:-noble}\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Reconnect SSH (or run `newgrp docker`), then verify:

```bash
docker version
docker compose version
```

---

## 3. Git

```bash
sudo apt-get install -y git
```

---

## 4. Clone repository

```bash
sudo mkdir -p /opt/dayday_erp
sudo chown "$USER":"$USER" /opt/dayday_erp
cd /opt/dayday_erp
git clone YOUR_GIT_URL .
```

---

## 5. Production `.env` (repository root)

```bash
cp env.production.example .env
nano .env
```

### Minimum required variables

- **Postgres**:
  - `POSTGRES_PASSWORD` (required)
  - optional `POSTGRES_USER`, `POSTGRES_DB`
- **API**:
  - `REDIS_URL=redis://redis:6379`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `AUDIT_HASH_SECRET` (recommended)
  - `CORS_ORIGINS=https://your-domain.tld` (comma-separated for multiple origins)
  - Edge reverse proxy should set primary **HSTS** / **CSP** / `X-Frame-Options`. In production the API process also enables **Helmet** (`apps/api/src/main.ts`; CSP off for JSON API) — align proxy and API so headers are not contradictory.
- **Web**:
  - `NEXT_PUBLIC_API_URL=http://api:4000` (Compose-internal URL for build/SSR)

### Commonly needed options (recommended before public launch)

- **Storage (logos, PDF)**:
  - production: `STORAGE_DRIVER=s3` + `S3_*`
  - alternative: `STORAGE_DRIVER=local` + `STORAGE_LOCAL_ROOT`
- **SMTP**:
  - `SMTP_HOST` + `SMTP_*` (without this, emails are not sent)
- **Sentry**:
  - API: `SENTRY_DSN_API`
  - Web client: `NEXT_PUBLIC_SENTRY_DSN`
  - web build sourcemap upload: `SENTRY_UPLOAD_SOURCEMAPS=1` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT_WEB`

### Important: `NEXT_PUBLIC_*`

`NEXT_PUBLIC_*` values are embedded during `docker build` (see `apps/web/Dockerfile`). If these values change, rebuild the `web` image.

---

## 6. First stack start

From repository root (where `docker-compose.prod.yml` is):

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Logs:

```bash
docker compose -f docker-compose.prod.yml logs -f api web
```

---

## 7. Prisma 7: migrations and initialization

Prisma is configured through `packages/database/prisma.config.ts`.
In production, apply migrations only via `prisma migrate deploy` (never `migrate dev`).

### 7.0 Maintenance mode before migrations (recommended)

Before `db:migrate:deploy`, enable maintenance mode to prevent user activity during schema changes.

#### Option A - one `.env` flag (simplest)

Set in root `.env` for `web` service:

```bash
MAINTENANCE_MODE=1
```

Accepted values: `1`, `true`, `yes`, `on` (case-insensitive). Disable with unset, `0`, or `false`.

`web` image rebuild is **not** needed; Compose already passes env vars into container. Restart Next process:

```bash
docker compose -f docker-compose.prod.yml up -d web
```

Run migrations/init (sections 7.1-7.2), then remove `MAINTENANCE_MODE` and run `up -d web` again.

**Limitation:** only the **Next (`web`)** container returns 503. Requests bypassing it (for example direct API host port exposure) are not blocked by this flag. For such setups, use Option B.

#### Option B - Nginx (or another reverse proxy) in front

Return 503 at HTTPS boundary before Node/Docker.

- `docs/maintenance.html` - maintenance page (AZ/RU)
- `docs/nginx-maintenance.conf` - snippet: return 503 when `/var/www/html/maintenance.enable` flag file exists

Example sequence on server:

```bash
# 1) one-time: place maintenance.html and include nginx snippet
sudo cp /opt/dayday_erp/docs/maintenance.html /var/www/html/maintenance.html
# include /opt/dayday_erp/docs/nginx-maintenance.conf; inside server { ... }

# 2) enable maintenance
sudo touch /var/www/html/maintenance.enable
sudo nginx -t && sudo systemctl reload nginx

# 3) migrations / i18n / initialization
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init

# 4) disable maintenance
sudo rm -f /var/www/html/maintenance.enable
sudo nginx -t && sudo systemctl reload nginx
```

### 7.0.1 Single squashed migration and database strategies

The repo ships **one** Prisma Migrate folder: **`20260520120000_squashed_schema`**. Choose the path that matches your server.

#### A) Production greenfield: wipe the database and install from scratch (explicitly supported)

If you **accept total loss of business data** on that Postgres instance (first go-live, staging rebuild, or deliberate cutover with no carry-over), you do **not** need baselining or `migrate resolve`. After the database is **empty** (no application tables), a normal deploy applies the full schema.

1. Enable maintenance mode (section 7.0).
2. Stop traffic to the DB, then **drop the application database** (or remove the Postgres data volume / provision a new empty instance). Recreate an empty database with the same `POSTGRES_DB` name and credentials as in `.env` / `DATABASE_URL`.
3. Bring Postgres (and Redis) up, then run from the `api` container as in sections 7.1–7.2, for example:

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
```

4. Disable maintenance mode.

**Irreversible:** without a backup restore, dropped data is gone. Do **not** use this path on a production server that must keep existing tenants or ledger history.

#### B) Brand-new empty database (first install, never had app schema)

Same as the end state of (A): run `npm run db:migrate:deploy` in `api` (or `prisma migrate deploy` with correct `DATABASE_URL`). Prisma applies `migration.sql` and fills `_prisma_migrations`.

#### C) Existing database with schema from an old migration history (must keep data)

Do **not** run `migrate deploy` blindly against an already-populated schema from removed migration folders; you get errors like "relation already exists". Prefer backup, then either **(A)** if you can wipe, or baseline:

1. Create a Postgres backup.
2. Clear only the migration ledger (no business tables):

```sql
DELETE FROM "_prisma_migrations";
```

3. Mark the squashed migration as already applied **without** executing its SQL (schema must already match what the app expects):

```bash
npx prisma migrate resolve --applied 20260520120000_squashed_schema
```

4. Then run:

```bash
npx prisma migrate deploy
```

Inside Docker Compose (from repo root):

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate resolve --applied 20260520120000_squashed_schema
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
```

**Developer note:** the checked-in `migration.sql` is produced with Prisma 7, for example `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` from `packages/database`. See Prisma docs: *Baselining* / *drift*.

### 7.1 Migrations (required)

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
```

`DATABASE_URL` and other env vars come from host `.env` via `env_file` in `docker-compose.prod.yml`; no separate `dotenv-cli` is required inside the image.

### 7.2 Idempotent platform finalization (recommended)

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
```

Note: `db:prod-init` must be idempotent; this is not reset. Root `npm run db:prod-init` includes `db:migrate:deploy`, `db:seed`, `db:sync-i18n:prune`, and database workspace `db:prod-init` script.

### 7.3 i18n sync to Postgres - do not skip in production

UI RU/AZ strings live in `apps/web/lib/i18n/resources.ts` (copied into API image during build). Table `translation_overrides` and endpoint `GET /api/public/translations?locale=ru|az` must match this dictionary.

Recommended step after each `db:migrate:deploy`:

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
```

What it does:
- upsert all `ru` and `az` flat keys from `resources.ts` into `translation_overrides`
- delete stale keys removed from `resources.ts`
- bump `system_config.i18n.cacheVersion`

One-line alternative (migrations + i18n prune sync; no seed):

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:deploy
```

For upsert-only without prune (rare in production): `npm run db:sync-i18n`.

### 7.4 Local (Windows/dev): same order "migrate + prune + bump"

From monorepo root, with `DATABASE_URL` in root `.env`:

```bash
npx dotenv-cli -e .env -- npm run db:deploy
```

Dry-run DB consistency check with i18n override pipeline:

```bash
npx dotenv-cli -e .env -- npm run db:audit-i18n-overrides -w @dayday/database
```

Expected: `dropped normalized keys=0`, `invalid raw keys=0`.

---

## 8. HTTPS (required for production)

Production web origin must be **HTTPS**.

### 8.1 Recommended path: Caddy

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```caddy
your-domain.tld {
  reverse_proxy 127.0.0.1:3000
}
```

Apply:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy automatically issues/renews Let's Encrypt certificate.

### 8.2 Alternative: Nginx

Keep routing: `https://your-domain.tld` -> `http://127.0.0.1:3000` (container `web`).

API does not need separate public exposure: browser uses same-origin `/api/*` through Next rewrites.

---

## 9. Post-deploy checks

- `GET /api/health` through public web origin (for example `https://your-domain.tld/api/health`)
- UI login/registration works
- Translations load correctly (no `Failed to fetch` / `Unexpected end of JSON input`)
- After section 7.3: verify `GET /api/public/translations?locale=ru` and `?locale=az`

---

## 10. Common issues

- `npm install` / `prisma generate` fails because of `DATABASE_URL`: verify root `.env` and `POSTGRES_*`.
- Windows local `.next` ENOTEMPTY/EPERM: stop Next, run `npm run clean -w @dayday/web`, retry build.
- Stale/incorrect i18n labels after deploy: run section 7.3 command (`db:sync-i18n:prune`), clear browser cache, verify localStorage language key.

---

## 11. Runbook: rebuild droplet from scratch (without data)

Use this only when production contains no business data and full server recreation is acceptable.

### 11.1 On new machine (Ubuntu 24.04)

1) Install Docker and Git (sections 2-3).
2) Clone repository into `/opt/dayday_erp`.
3) Prepare `.env`:

```bash
cd /opt/dayday_erp
cp env.production.example .env
nano .env
```

Minimum: `POSTGRES_PASSWORD`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`.

### 11.2 Bring stack + migrations

```bash
cd /opt/dayday_erp
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
```

### 11.3 Verification

- Web opens via HTTPS
- `GET https://your-domain.tld/api/health` returns 200
- login/registration work

### 11.4 Repeat from zero if needed

Stop and remove containers with volumes:

```bash
cd /opt/dayday_erp
docker compose -f docker-compose.prod.yml down -v
```

Then repeat steps from 11.2.
