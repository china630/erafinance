# Stage E–F — Localization, smoke, and Go-Live

Companion to `100_STEPS_TO_LIVE.md` §E (127–152) and §F (153–172). **Formal sign-off** (step 144 / 172) is a business gate; this file lists technical prerequisites and repeatable checks.

## Localization pipeline (127–132, 145)

| Step | Command / artifact | When |
|------|-------------------|------|
| RU+AZ completeness | `npm run i18n:audit` | **Every** root `npm run build` (gate). |
| Super-Admin defaults | `npm run i18n:catalog` → `apps/api/src/admin/i18n-default-catalog-data.json` | Same PR as new/changed keys in `packages/i18n/src/resources.ts`. |
| DB overrides | `npm run db:sync-i18n` or `npm run db:deploy` | Staging/prod after i18n PR (see `erafinance-local-dev.mdc`). |
| Dangerous overrides | `npm run db:audit-i18n-overrides -w @erafinance/database` | Before prod deploy if editors touched `translation_overrides`. |
| UI fallback | `apps/web/lib/i18n/ui-lang.ts` — `ru` vs default **`az`** | No action if unchanged. |
| Zod / API messages | `@erafinance/api-contracts` + web copy | Prefer AZ/RU in user-visible strings; English-only developer messages are OK if never surfaced. |

**Dispute / security strings:** `superAdmin.security*` and `disputePublic.*` in `packages/i18n/src/resources.ts` (RU+AZ).

## Pre-deploy (cross-link)

- [docs/deploy/PRE-RELEASE-CHECKLIST.md](../deploy/PRE-RELEASE-CHECKLIST.md) — migrations, build, minimal smoke.
- [docs/deploy/deploy.ru.md](../deploy/deploy.ru.md) — post-deploy order.
- [docs/DR_RUNBOOK.md](../deploy/DR_RUNBOOK.md) — rollback / PITR (step 138).

## Smoke matrix (133–136, minimal)

Run against **staging** (or prod after maintenance window) with a **non-super-admin** test user.

| # | Area | Suggested checks |
|---|------|------------------|
| 133 | Auth | Register org (or login), JWT refresh, org switcher, `GET /api/health`. |
| 134 | Core | Create counterparty, invoice (qaimə), post if applicable, OSV or trial balance read. |
| 135 | Payroll | Only if `hr_full`: one employee, payroll run or export path. |
| 136 | Banking | Only if `banking_pro`: account list, statement import or sync smoke. |

Record pass/fail and commit hash in the release ticket.

## Operations (137–144, 158–167)

| Topic | Notes |
|-------|--------|
| Load test (137) | Optional k6/Locust; watch PDF and BullMQ workers separately (step 159). |
| On-call (139) | Telegram/webhook alerts from `ERAFINANCE_BULLMQ_ALERT_WEBHOOK_URL`, `AUDIT_ALERT_WEBHOOK_URL`, monitoring stack in `docs/deploy/monitoring/`. |
| 48h KPI (141) | Error rate, latency, failed webhooks, `billingStatus` stuck SOFT/HARD. |
| Legal links (142) | `NEXT_PUBLIC_ERAFINANCE_TERMS_URL`, `PRIVACY`, `STATUS` on auth footer + `/help`. |
| Freeze window (143) | No schema drift; migrations only via `migrate deploy`. |
| Go-Live sign-off (144, 172) | Product + engineering + support agree; this doc is not a substitute. |

## Product polish (146–152)

| Step | Status in repo |
|------|----------------|
| Transfer certificate PDF | `transfer-certificate.service.ts` — branding/layout can be iterated post-MVP. |
| SEO | `SeoHeadSync` in `apps/web/app/providers.tsx` uses `seo.title` / `seo.description` (RU/AZ). Landing SEO = separate site. |
| Favicon | `apps/web/app/icon.svg` (App Router convention). |
| Responsive | Manual pass on invoices / payroll / settings (tablet width). |
| Password reset (150) | **Not implemented** in API/web as of this doc — plan support-assisted reset or ship forgot-password before public marketing. |
| NAS seeds (151) | `prisma seed` + Super-Admin chart template; re-run policy in PRD. |
| OCR (152) | Providers are stubs until keys and prompt calibration; after go-live, monitor `ocr_jobs` error rate. |

## Stage F highlights (153–172)

| Step | Architect note |
|------|----------------|
| Extension store (153) | Follow `EXTENSION_MVP_DEPLOY.md`; separate review cycle from ERP API. |
| Staging cleanup (155) | `db:wipe-tenant` — **tenant-scoped**; never ad-hoc wipe prod. |
| Pen-test (160) | Out-of-band from functional QA; fix criticals before broad marketing. |
| VAT exempt -1 (168) | Search `vatRate` / `VAT` in API+web for regressions when touching invoices. |
| Dispute freeze test (169) | Add integration coverage when CI stable — guard is in `APP_GUARD`. |
| api-contracts vs web (171) | Breaking DTO changes require coordinated bump of `@erafinance/api-contracts` and web callers. |

---

**Single command before tag cut:** `npm run build` (includes `i18n:audit`) + `npm run db:migrate:deploy` on target DB + smoke rows in the table above.
