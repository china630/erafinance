# Stage D — Billing and commerce (steps 98–126)

Operational companion to `100_STEPS_TO_LIVE.md` §D: what is implemented in the monorepo, which env keys matter, and what remains product/ops backlog.

## Pricing and catalog (98–99)

| Item | Location |
|------|-----------|
| `PricingModule` rows | Seeded via `packages/database/prisma/seed.ts` (layer `core`) + `prisma/lib/core/pricing-module-seed.ts`; optional scripts `packages/database/scripts/ensure-*-pricing.ts`. |
| `SystemConfig` | `apps/api/src/system-config/system-config.service.ts` — `billing.price.{TIER}`, `quota.tier.{TIER}`, `billing.foundation_monthly_azn`, `billing.yearly_discount_percent`, `billing.quota_unit_pricing_v1`, **`quota.ocr_jobs_per_org_month_v1`** (number, default **200** if unset). |

Super-Admin can adjust prices/quotas in line with `AdminModule` / pricing APIs where exposed.

## Access, guards, HTTP codes (100–106, 116)

| Mechanism | Behaviour |
|-----------|-----------|
| `SubscriptionAccessService` | Tier + `activeModules` + `customConfig.modules` + `organization_modules` lifecycle; **ENTERPRISE** bypasses module checks. |
| `SubscriptionGuard` + `@RequiresModule` | Declarative module gates (e.g. `trade_pro` on customs/OCR, `tax_pro` on invoice tax flows). |
| `QuotaService` / `@CheckQuota` + `QuotaGuard` | Employees, invoices/month, orgs/user, storage; OCR monthly cap via `assertOcrJobsPerMonth`. |
| **402** `QUOTA_EXCEEDED` | Thrown by `QuotaExceededException`. |
| **402** billing | `BillingAccessGuard`: **SOFT_BLOCK** blocks paths containing `export`, `pdf`, `xlsx`, `xml`, `tax-export`; **HARD_BLOCK** blocks mutating methods except billing checkout/webhooks. |
| **403** `SUBSCRIPTION_READ_ONLY` | After subscription `expiresAt` (trial rollover handled separately in `getOrganizationSnapshot`). |
| **SOFT vs HARD vs “read-only”** | SOFT = платёжное напоминание + ограничение экспорта; HARD = почти полный read-only для мутаций; subscription read-only = истёк срок подписки/триала (другой код и UX). |

## Cron and jobs (106)

| Cron | Schedule | Role |
|------|----------|------|
| Monthly invoices | `0 0 1 * *` | `BillingMonthlyService.runMonthlyBilling` — post-paid `SubscriptionInvoice` for previous UTC month, **SOFT_BLOCK** on billed orgs. |
| Reminder | `0 10 25 * *` | `runBillingReminderCron` — email/in-app heads-up before month end. |
| HARD_BLOCK | `0 0 6 * *` | `runHardBlockEscalationCron` — unpaid items for previous period → **HARD_BLOCK**. |

BullMQ worker `BillingMonthlyWorker` processes queued `monthly_subscription_invoices` when Redis is enabled (`BILLING_MONTHLY_DISABLED` optional).

## Reconciliation script (107)

```bash
npm run platform:billing-reconcile
npx tsx scripts/billing-reconciliation.ts --period=2026-04
```

Exit code **1** on material drift (TZ §14.8.12). Run in CI/cron against prod read-replica as policy allows.

## Webhooks and checkout (108–109, 115)

| Concern | Implementation |
|---------|------------------|
| Idempotency | `payment_order` transition **PENDING → PAID** uses `updateMany` + re-read; `recordPaidOrderInvoice` dedupes on `subscriptionInvoice.paymentOrderId`. |
| Signature | `PashaBankPaymentProvider.verifyWebhookSignature` (mock mode in dev). |
| Ops | Production: set `API_PUBLIC_URL`, `WEB_APP_PUBLIC_URL`, PAŞA keys from provider portal; smoke test mock → live small amount. |

## Module gates (110)

| Module | Where gated |
|--------|-------------|
| `trade_pro` | `CustomsController`, `OcrController` (+ other trade features as added). |
| `recovery_pro` | **Not** a tenant `@RequiresModule` yet: platform recovery/dispute/snapshot admin APIs use **`SuperAdminGuard`** + step-up/dual approval. When product sells recovery to non-ENTERPRISE orgs, add slug to constructor + guards on any new tenant-facing recovery routes. |

## PDFs (111, 121)

| Document | Generator | Note |
|----------|-----------|------|
| Platform subscription invoice | `BillingPlatformService.buildSubscriptionInvoicePdfBuffer` | Customer-facing breakdown by organization / VÖEN; disclaimer: not a fiscal tax invoice. |
| Payment order receipt | `BillingPaymentOrdersService.buildInvoicePdfBuffer` | Confirmation of amount paid + module snapshot; not a fiscal invoice. |

## Trial and tiers (122–123)

New organizations: **demo through end of UTC calendar month** (`computeNewOrganizationDemoPeriodEndsAt`); `auth.service.ts` sets `isTrial: true` and `expiresAt` on registration / add-org. First post-paid `SubscriptionInvoice` run is the monthly job on the **1st** (previous UTC month); orgs whose demo ended on the last day of that month are excluded until `expiresAt` is extended by payment.

## OCR quota (119)

`OcrService.createJob` calls `QuotaService.assertOcrJobsPerMonth`:

- **ENTERPRISE**: unlimited (no assert).
- Others: count `OcrJob` rows for org in **UTC calendar month**; limit from `SystemConfig` key **`quota.ocr_jobs_per_org_month_v1`** (positive number); default **200** if missing.

## Explicit backlog (112–114, 117, 120, 124–125)

BI/CSV exports, VAT regression automation, refund one-click, native recurring mandate at provider, WhatsApp metering — **out of scope** for this document; track in product backlog.

## Upgrade / pro-rata (126)

| Path | Code |
|------|------|
| Tier upgrade checkout | `PaymentProviderService.createOrder` + `BillingService.calculateUpgradePrice` |
| Per-module toggle with pro-rata | `createModuleToggleOrder` + `monthsApplied: 0` metadata; `finalizePaidOrder` enables module via `OrganizationModuleService` |

---

**Regression discipline:** after changing billing math, run `platform:billing-reconcile` for a known period and extend `apps/api/test/billing/**` if behaviour is non-obvious.
