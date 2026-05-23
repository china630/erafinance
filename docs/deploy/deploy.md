# ERA Finance - Production Deployment (Ubuntu 24.04 + Docker Compose)

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
- **Moving to DigitalOcean with an empty database** (no restore from the old host): start with **section 0.1** below, then sections 1–9.

---

## 0.1. DigitalOcean migration playbook (greenfield database)

Use this section when you **deliberately do not migrate** business data from the old server (new Postgres instance or new Docker volume). You provision an **empty** database named **`erafinance`** (same as `env.production.example`, `.env.example`, and `docker-compose.prod.yml` defaults), then apply the single squashed migration. Do not restore dumps from an old server that used a different DB name or migration history.

**Do not** restore an old `pg_dump` into the new database unless you are following **section 7.0.1 (C)** (keep data + baseline). A dump from the old DB name or old migration history will conflict with the squashed migration.

### 0.1.1. Target architecture on DigitalOcean

| Component | Recommended (MVP) | Hardened (later) |
|-----------|-------------------|------------------|
| Region | **FRA1** or **AMS3** (EU; align with TZ §1.4 / §1.6) | Same |
| App (API + Web + workers) | **Droplet** Ubuntu 24.04, Docker Compose (`docker-compose.prod.yml`) | Same droplet or separate worker droplet |
| PostgreSQL 16 | Container `db` on the droplet (volume `pgdata`) | **Managed Database for PostgreSQL** (VPC private hostname) |
| Redis 7 | Container `redis` on the droplet | **Managed Redis** (`noeviction`, VPC only) |
| Files (logos, PDF) | `STORAGE_DRIVER=local` + host path | **Spaces** (S3-compatible; see §0.1.6) |
| HTTPS | **Caddy** or Nginx on the droplet → `127.0.0.1:3000` | Optional **Cloudflare** in front (TZ §1, WAF) |
| DNS | **A record** → droplet public IPv4 (or floating IP) | Same |

Network rules (TZ §1.6): Postgres and Redis must be reachable only from the **VPC / private interface** or localhost. On the droplet, **do not** expose `5432` / `6379` on the public interface (leave `POSTGRES_PUBLISH_PORT` / `REDIS_PUBLISH_PORT` unset or block with **DigitalOcean Cloud Firewall** + `ufw`).

### 0.1.2. Database name and credentials: `erafinance`

Standard for production and local dev (repository templates):

```bash
POSTGRES_USER=erafinance
POSTGRES_DB=erafinance
```

Set **`POSTGRES_USER`**, **`POSTGRES_DB`**, and **`POSTGRES_PASSWORD`** in production `.env` **before** the first `docker compose up`. `docker-compose.prod.yml` builds `DATABASE_URL` for the `api` service from these variables.

If a Postgres data volume was already initialized with a **different** `POSTGRES_DB`, changing `.env` alone does not rename the database. For greenfield: remove the volume (`docker compose … down -v`) or create a new empty Managed DB named **`erafinance`**.

### 0.1.3. Pre-migration checklist (old host → DO)

| Step | Action |
|------|--------|
| 1 | Agree **cutover window** (users see maintenance page). |
| 2 | Export **secrets** you still need: JWT secrets (or plan to rotate), SMTP, S3/Spaces keys, integration keys — **not** the old Postgres dump if you wipe. |
| 3 | Note **public URL** (`https://erp.example.com`) for `CORS_ORIGINS` and DNS. |
| 4 | On the **release commit**, run locally: `npm run build` (includes `i18n:audit`). If `resources.ts` changed: `npm run i18n:catalog` and commit `i18n-default-catalog-data.json`. |
| 5 | Optional: take a final backup on the old host (`scripts/backup-db.sh`) and store off-site **only for archival**, not for restore into greenfield DO. |

### 0.1.4. Create DigitalOcean resources

1. **Project** (optional): group droplet, DB, Spaces bucket.
2. **VPC** in **FRA1** or **AMS3** (default VPC is fine for a single droplet).
3. **Droplet**: Ubuntu **24.04**, size per load (start **2 vCPU / 4 GB** for pilot), region = VPC region, **SSH key**, enable **monitoring** if desired.
4. **Cloud Firewall** (recommended): inbound **22** (your IP), **80**, **443** → droplet; **deny** inbound to **5432**, **6379**, **4000** from `0.0.0.0/0`.
5. **Floating IP** (optional): attach before DNS cutover for stable IP.
6. **DNS**: lower TTL to **300** s a day before cutover; create **A** record to droplet (or floating IP).
7. **Spaces** (when using S3 storage): bucket in a region close to the droplet; create **Spaces access keys**; note endpoint like `https://fra1.digitaloceanspaces.com`.

Managed Postgres / Redis (optional instead of containers): create in the **same VPC**, enable **trusted sources** = droplet only, copy **private connection string** / URI. Wiring an external `DATABASE_URL` requires a compose override (not in default `docker-compose.prod.yml`); MVP path below uses the bundled `db` service.

### 0.1.5. Ordered steps on the new droplet (greenfield)

Replace placeholders: `YOUR_GIT_URL`, `your-domain.tld`, secrets.

```bash
# --- 1) OS + Docker (see also section 2) ---
ssh root@DROPLET_IP   # or deploy@ after user setup
# ... install Docker per section 2 ...

# --- 2) App directory ---
sudo mkdir -p /opt/erafinance_erp
sudo chown "$USER":"$USER" /opt/erafinance_erp
cd /opt/erafinance_erp
git clone YOUR_GIT_URL .
git checkout main   # or your release tag

# --- 3) Production .env ---
cp env.production.example .env
nano .env
```

**Minimum in `.env` for first boot:**

| Variable | Example / note |
|----------|----------------|
| `COMPOSE_PROJECT_NAME` | `erafinance_prod` |
| `POSTGRES_USER` | `erafinance` |
| `POSTGRES_DB` | `erafinance` |
| `POSTGRES_PASSWORD` | strong random |
| `REDIS_URL` | `redis://redis:6379` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | new long random strings (rotate if old host compromised) |
| `CORS_ORIGINS` | `https://your-domain.tld` |
| `NEXT_PUBLIC_API_URL` | `http://api:4000` (Compose internal; do not change for default stack) |
| `STORAGE_DRIVER` | `s3` + `S3_*` for Spaces, or `local` + `ERAFINANCE_STORAGE_HOST_PATH` |

```bash
# --- 4) Local storage dir (if STORAGE_DRIVER=local) ---
sudo mkdir -p /var/lib/erafinance/storage
sudo chown 1001:1001 /var/lib/erafinance/storage

# --- 5) Maintenance + empty database volume ---
# In .env: MAINTENANCE_MODE=1
docker compose -f docker-compose.prod.yml up -d --build

# First install OR after DB rename: ensure empty Postgres data
# WARNING: destroys all data in compose volume pgdata
docker compose -f docker-compose.prod.yml down
docker volume rm erafinance_prod_pgdata 2>/dev/null || docker volume rm $(docker volume ls -q | grep pgdata) 
# If unsure of volume name: docker volume ls | grep pgdata

docker compose -f docker-compose.prod.yml up -d db redis
# Wait until db healthy, then api+web:
docker compose -f docker-compose.prod.yml up -d --build

# --- 6) Schema + platform seed (greenfield, section 7.0.1 A) ---
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init

# --- 7) HTTPS (section 8) — Caddy → 127.0.0.1:3000 ---
# --- 8) Smoke (section 9) ---
# Remove MAINTENANCE_MODE from .env, then:
docker compose -f docker-compose.prod.yml up -d web
```

**Super-admin:** platform users from `db:seed` / `db:prod-init` follow repository seed rules. For a custom bootstrap password hash, see `npm run docker-init:super-admin-hash` in root `package.json` (run once with correct `DATABASE_URL`).

### 0.1.6. DigitalOcean Spaces (S3-compatible storage)

In `.env` for the `api` service:

```bash
STORAGE_DRIVER=s3
S3_ENDPOINT=https://fra1.digitaloceanspaces.com
S3_REGION=fra1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
# S3_PUBLIC_BASE_URL=https://your-bucket-name.fra1.cdn.digitaloceanspaces.com
```

Rebuild is **not** required for storage env changes — restart `api` after editing `.env`:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

### 0.1.7. Release updates after go-live

| Change type | Command |
|-------------|---------|
| Code / images only (no migration) | `bash scripts/deploy-prod-code.sh` |
| New Prisma migrations | `bash scripts/deploy-prod-db-migrate.sh` (backs up DB first) |
| i18n-only after `resources.ts` change | `docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune` |

Schedule **`scripts/backup-db.sh`** via cron on the droplet; store copies off-droplet (Spaces or another region). Details: `DR_RUNBOOK.md`.

### 0.1.8. Related documents

| Document | Purpose |
|----------|---------|
| `PRE-RELEASE-CHECKLIST.md` | Build, i18n catalog, smoke before tag |
| `DR_RUNBOOK.md` | Backups, restore, RPO/RTO |
| `../launch/STAGE_B_INFRASTRUCTURE.md` | Infra steps 34–65 |
| `TZ.md` §1.4–1.7, §1.6 | VPC, Redis `noeviction`, AZ/EU hosting |

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
sudo mkdir -p /opt/erafinance_erp
sudo chown "$USER":"$USER" /opt/erafinance_erp
cd /opt/erafinance_erp
git clone YOUR_GIT_URL .
```

`YOUR_GIT_URL` may point at any Git remote (after renaming the repo on GitHub, update `git remote` or use the new URL when cloning). The server directory (`/opt/erafinance_erp`) is a documented convention only; if you clone elsewhere, substitute your path in all commands below.

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
sudo cp /opt/erafinance_erp/docs/maintenance.html /var/www/html/maintenance.html
# include /opt/erafinance_erp/docs/nginx-maintenance.conf; inside server { ... }

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
npx dotenv-cli -e .env -- npm run db:audit-i18n-overrides -w @erafinance/database
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
- Windows local `.next` ENOTEMPTY/EPERM: stop Next, run `npm run clean -w @erafinance/web`, retry build.
- Stale/incorrect i18n labels after deploy: run section 7.3 command (`db:sync-i18n:prune`), clear browser cache, verify localStorage language key.

---

## 11. Runbook: rebuild droplet from scratch (without data)

Use this only when production contains no business data and full server recreation is acceptable.

### 11.1 On new machine (Ubuntu 24.04)

1) Install Docker and Git (sections 2-3).
2) Clone repository into `/opt/erafinance_erp`.
3) Prepare `.env`:

```bash
cd /opt/erafinance_erp
cp env.production.example .env
nano .env
```

Minimum: `POSTGRES_PASSWORD`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`.

### 11.2 Bring stack + migrations

```bash
cd /opt/erafinance_erp
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
cd /opt/erafinance_erp
docker compose -f docker-compose.prod.yml down -v
```

Then repeat steps from 11.2.
