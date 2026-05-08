# Stage A — Foundations (execution notes)

Single narrative for [100_STEPS_TO_LIVE.md](./100_STEPS_TO_LIVE.md) steps **1–33**. Product law remains [PRD.md](../../PRD.md) / [TZ.md](../../TZ.md).

## Environment load order (`apps/api`)

1. Repository root `.env` (if present)  
2. `apps/api/.env` (if present) — **overrides** the root file for duplicate keys.

See `apps/api/src/load-env-paths.ts`. In deployment, avoid putting production-only overrides in `apps/api/.env` unless intentional.

## Required / documented secrets (root `.env`)

| Variable | Role |
|----------|------|
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Auth |
| `DATABASE_URL`, `REDIS_URL` | Data / queues |
| `AUDIT_HASH_SECRET` | Audit HMAC chain (`AuditService`; falls back to `JWT_SECRET` with warning) |
| `STEP_UP_HMAC_SECRET` | Super-admin step-up HMAC (`step-up-auth.service.ts`; dev fallback `JWT_SECRET`) |
| `INVOICE_PORTAL_TOKEN_SECRET` | Guest portal token (falls back to `JWT_SECRET` if unset) |
| `AUDIT_ALERT_WEBHOOK_URL` | External alert on chain break (`audit-chain-cron.service.ts`) |
| `SMTP_*` | Real mail in prod (`mail.service.ts`) |
| `S3_*`, `STORAGE_DRIVER` | Object storage (`s3-storage.service.ts`, `storage.constants.ts`) |

## Guards (on-call)

Global order in `apps/api/src/app.module.ts` (`APP_GUARD`):

1. `ThrottlerGuard` — default quota (see `ThrottlerModule.forRoot` in `app.module.ts`); `@SkipThrottle` / `@Throttle` on selected routes  
2. `JwtAuthGuard`  
3. `DisputeFreezeGuard`  
4. `SubscriptionReadOnlyGuard`  
5. `BillingAccessGuard`  
6. `AuditorMutationGuard`

`SubscriptionGuard` + `@RequiresModule` are applied **per controller/handler** where entitlements apply (not global).

## Raw SQL audit (manual)

Files using `$queryRaw` / `$executeRaw` / `Unsafe` under `apps/api/src` were reviewed for Stage A. Prefer `tenant-prisma-raw.service.ts` for tenant-scoped raw SQL. Integration/OCR paths use fixed SQL with explicit `organization_id` / job id parameters — see grep in repo when extending.

## MFA / step-up roadmap

Current: email OTP + `X-Step-Up-Token` in `apps/api/src/platform-recovery/step-up/*`. Future: TOTP and mandatory step-up on all Super-Admin **mutations** (`admin/*`) — track in release planning, not blocking Stage A code closure.

## S3 versioning / Object Lock

`S3StorageService.ensureBucketVersioningAndObjectLock` logs once per failure class (no tight loops). Confirm bucket supports Object Lock where compliance prefixes require it (`storage.constants.ts`).

## Operational steps (not in git)

Steps **11–12** (`db:migrate` / `db:deploy` on staging/prod) and **29** (full chain verify on a DB copy with 1000+ audit rows) are **environment** actions: run from release runbook after merge, with recorded timestamps.

`npm run audit:verify` runs `apps/api/scripts/audit-verify.ts` (minimal Nest context). By default it **logs** a trimmed summary and exits `0` so local dev DBs do not break scripts. On staging/prod copies set **`AUDIT_VERIFY_STRICT=1`** so a broken chain fails the process. Full `compromisedIds`: **`AUDIT_VERIFY_VERBOSE=1`**.

## Release PR (step 25)

Tag + changelog entry: link this file and `CHANGELOG.md` in the release PR description.
