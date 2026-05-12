# Stage C — Content, templates, and technical tails

This document is the **source of truth** for launch checklist items **66–97** in `100_STEPS_TO_LIVE.md`: what is implemented in-repo, what is intentionally stubbed, and what must be configured outside the monorepo.

## Seeds and demo data (66–67, 81)

| Topic | Location / behaviour |
|--------|----------------------|
| Default seed | `packages/database/prisma/seed.ts` — global NAS chart templates, pricing rows (`PRICING_MODULE_SEED_DEFAULTS`), quotas. Safe to run on prod for **catalog** data only when your runbook says so. |
| Demo org | **Not** created unless `SEED_DEMO_ORG=1`. Uses fixed UUID `00000000-0000-4000-8000-000000000001`, name **Demo LLC** — keep separate from paying tenants. |
| Chart sync all orgs | `SEED_SYNC_CHART_ALL=1` — use only with ops approval (re-syncs charts for every org). |
| Other scripts | `packages/database/scripts/*.ts` (e.g. trade/tax pro pricing) — run explicitly; not part of default `prisma db seed`. |

**Demo policy:** production onboarding uses `OrganizationService` chart provisioning; demo data is opt-in via env flags above.

## RPA / integration templates (68–71)

| Template | Path |
|----------|------|
| GTK (customs) | `apps/api/src/integrations/templates/customs/bgd-blank.xlsx` |
| DVX (e-Qaimə) | `apps/api/src/integrations/templates/dvx/e-qaime-blank.xlsx` |
| ƏMAS (e-Müqavilə) | `apps/api/src/integrations/templates/emas/e-muqavile-blank.xlsx` |

**HTTP delivery:** `TemplatesAssetsService` (`apps/api/src/integrations/templates-assets.service.ts`) resolves paths for `dvx` / `emas` / `customs` in dev and compiled layouts.

## OCR and billing PDF (72–73)

| Item | Status |
|------|--------|
| `OpenAiOcrProvider` / `GeminiOcrProvider` | **Intentional stubs** returning schema-valid prefill for pipeline tests. Replace with real vision calls when API keys and compliance review are ready. |
| `billing-payment-orders.service.ts` PDF | **Technical PDF** for payment orders: clearly labeled as non-fiscal stub in the document body. Customer-facing self-billing invoice PDF is tracked under Stage **D** (step 111). |

## Snapshots and rollback (74–75)

| Item | Status |
|------|--------|
| `SnapshotService.takeSnapshot` | Writes a **versioned JSON artifact** (`erafinance-tenant-snapshot-v1`) to object storage and stores `s3Key` / `sha256` / `sizeBytes` in `organization_data_snapshots`. |
| `LogicalTenantSnapshotWorker` | **No-op** until BullMQ + `COPY … TO STDOUT` full logical export is wired; table order draft: `tenant-tables.ts`. |
| `RollbackService.restoreFromSnapshot` | Queues `TenantRollbackRecord` only; **full ETL restore** is not implemented in this build (see service logs). |
| `RollbackService.restoreToPointInTime` | **Not implemented** — throws `NotImplementedException` after locating baseline snapshot (R5.2 forward replay backlog). |

## Notifications (76, 90)

| Channel | Status |
|---------|--------|
| Email (ownership dispute) | **AZ/RU/EN** body in `ownership-dispute-notification.copy.ts`; absolute links use `WEB_APP_PUBLIC_URL` or `WEB_URL`. |
| SMS | **Stub** — log line only; wire +994 provider when approved. |
| Legal markdown | `apps/api/src/platform-recovery/dispute/legal-templates/dispute-notice-az.md`, `dispute-notice-ru.md` |

## Banking, payroll, FX (77–78, 80)

| Item | Location |
|------|----------|
| Banking adapters / resiliency | `apps/api/src/banking/**` (circuit-style handling in gateway where applicable). |
| Payroll XLSX export | `apps/api/src/hr/payroll-export.service.ts` |
| CBAR / NAS | `cbar-rate-sync.*`, NAS templates in seed / `organizations.service` |

## Browser extension (79)

Source: `apps/extension/**` (WXT). Gating and org context: `apps/web/components/extension-bridge.tsx`, subscription context, and extension paywall views. Chrome IDs: `NEXT_PUBLIC_ERAFINANCE_EXT_IDS` (web `.env.example`).

## Help, legal, status, video (82, 88–89, 91–96)

| Feature | Implementation |
|---------|----------------|
| FAQ / first steps | Public route **`/help`** (`apps/web/app/help/page.tsx`) + i18n keys `help.*`. |
| Footer on auth screens | `PublicLegalFooter` — links appear when env URLs are set. |
| Env (web) | `NEXT_PUBLIC_ERAFINANCE_TERMS_URL`, `NEXT_PUBLIC_ERAFINANCE_PRIVACY_URL`, `NEXT_PUBLIC_ERAFINANCE_STATUS_URL`, `NEXT_PUBLIC_ERAFINANCE_DOCS_URL`, `NEXT_PUBLIC_ERAFINANCE_VIDEO_URL` — see `apps/web/.env.example`. |

Terms and privacy **content** lives outside the repo; the app only needs HTTPS URLs.

## i18n (86–87)

| Topic | Source |
|-------|--------|
| Web + extension strings | `packages/i18n/src/resources.ts` (re-exported from `apps/web/lib/i18n/resources.ts`). |
| Audit | `npm run i18n:audit` (RU + AZ). |
| Super-admin defaults | After resource changes: `npm run i18n:catalog` and commit `apps/api/src/admin/i18n-default-catalog-data.json`. |
| AZ glossary | Ongoing product review with a native speaker; UI uses shared keys (e.g. `invoices` / qaimə terminology) — track large renames in PRD/TZ, not ad-hoc in code. |

## Dispute UX (83–85, 84)

| Item | Path |
|------|------|
| Legal templates | `apps/api/src/platform-recovery/dispute/legal-templates/*.md` |
| Public counter-claim | `apps/web/app/dispute/[id]/page.tsx` — allowlisted in `middleware.ts` and root `layout.tsx` public paths. |
| Super-admin security | `apps/web/app/super-admin/organizations/[id]/security/page.tsx` |

## Marketing / landing (93)

Prefer hosting marketing outside the monorepo; optional `NEXT_PUBLIC_*` links from `/help` and auth footer point to it.

## Bank directory AZ (97)

There is **no** dedicated `bank_directory` table in Prisma today. SWIFT / MFO live on `OrganizationBankAccount` and `CounterpartyBankAccount`. A shared AZ bank list remains a **backlog** item (seed or reference table) when product requires autocomplete.

## Email templates (92)

Registration and billing flows use `MailService` with simple subjects/bodies. Rich HTML templates are a backlog; dispute flow uses the dedicated copy module above.

## RPA upsell (95)

`apps/web/components/rpa-upsell-modal.tsx` — keys under `bulk.upsell.*` in i18n.

---

**Maintenance:** When closing checklist boxes in `100_STEPS_TO_LIVE.md`, prefer linking here for nuanced items (stubs, external URLs, backlog) instead of duplicating long notes in the main launch file.
