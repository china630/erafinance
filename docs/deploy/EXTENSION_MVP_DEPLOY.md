# ERA Finance Assistant MVP Deploy Checklist

Release scope: DVX (`e-taxes`) + ƏMAS + **e-customs** connectors; `tax_pro`, `hr_full`, and **`trade_pro`** monetization where applicable; ERP install CTA.

Use this checklist for both Staging and Production.

## 1) Environment Variables

Add or verify these variables in your secrets manager (Vault) and runtime `.env`.

### API / Extension session

- `EXT_REFRESH_SECRET` (recommended explicit secret for extension refresh cookie; fallback is `JWT_SECRET` if missing)
- `EXT_REFRESH_EXPIRES` (example: `1d`)
- `ERP_WEB_ORIGINS` (comma-separated ERP web origins allowed to bootstrap extension session)
- `CORS_EXTENSION_ORIGINS` (comma-separated `chrome-extension://...` / `moz-extension://...` origins for published extension IDs)

### Web / marketing CTA

- `NEXT_PUBLIC_EXTENSION_INSTALL_URL`
  - Staging default can be `/docs/extension` or internal install instruction page
  - Production should point to the Chrome Web Store listing URL

### Extension Bulk RPA safety tuning (Phase 10)

- `BULK_RUNNER_BASE_DELAY_MS` (recommended `4000`)
- `BULK_RUNNER_JITTER_MS` (recommended `3000`)
- `BULK_RUNNER_HOURLY_CAP` (recommended `200`)

### Phase 11 OCR

- `OCR_VISION_PROVIDER` (`openai` by default, optional `gemini`)
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `OCR_MAX_FILE_MB` (default `10`)

### Shared infrastructure (same as core ERP deploy)

- Health: load balancer or synthetic checks should call **`GET /api/health`** on the API origin.
- Docker / Redis / backups / DR: see [`docs/deploy/README.md`](./README.md) and [`docs/launch/STAGE_B_INFRASTRUCTURE.md`](../launch/STAGE_B_INFRASTRUCTURE.md).

### Existing required variables (must still be present)

- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `DATABASE_URL`
- `REDIS_URL`

## 2) Database Step (pricing catalog rows)

For environments where `pricing_modules` was initialized before `tax_pro` was introduced, run:

```bash
npm run db:ensure-tax-pro-pricing -w @erafinance/database
```

For **`trade_pro`** (Customs / e-customs widget), run:

```bash
npm run db:ensure-trade-pro-pricing
```

(or `npm run db:ensure-trade-pro-pricing -w @erafinance/database`). Both commands are idempotent.

## 3) Build + Deploy Sequence

1. Pull release commit.
2. Install dependencies (if needed) and run build checks:
   - `npm run i18n:audit`
   - `npm run build:ext`
   - `npm run build`
3. Run DB migration/deploy routine as applicable:
   - `npm run db:migrate:deploy` (or your standard prod migration script)
4. Run `db:ensure-tax-pro-pricing` and `db:ensure-trade-pro-pricing` (section 2) as needed for the target DB.
5. Deploy API + Web artifacts.
6. Verify environment variables are loaded in running services.

## 4) QA Smoke Test

### A. Billing / monetization (`tax_pro`)

1. Sign in as Owner in ERP.
2. Open Subscription settings.
3. Confirm `tax_pro` module is visible in module list (Tax Pro row).
4. Enable `tax_pro`.
5. Call `GET /api/subscription/me` in the active org context and verify:
   - `modules.taxPro === true`

### B. Marketing CTA (ERP UI)

1. Open `sales/invoices` page:
   - Verify install banner is visible when `taxPro` is **off**.
   - Verify banner can be dismissed.
2. Open `admin/integrations/health` page:
   - Verify install card is visible.
3. Click CTA in both locations and verify it opens `NEXT_PUBLIC_EXTENSION_INSTALL_URL`.

### C. Invoice prefill API correctness

1. Pick an AZN invoice with valid counterparty and line items.
2. Call `GET /api/invoices/:id/prefill` with valid auth and org context header.
3. Verify response:
   - `currency === "AZN"`
   - counterparty fields are present
   - `totals.netAzn`, `totals.vatAzn`, `totals.grossAzn` are populated
   - exempt VAT lines are normalized as:
     - `vatExempt === true`
     - `vatRatePct === 0`
4. For a non-AZN invoice, verify API returns `INVOICE_NOT_AZN`.

### D. Extension flow sanity (DVX)

1. On `new.e-taxes.gov.az` or `login.e-taxes.gov.az`, ensure widget appears.
2. Ensure VÖEN cross-check blocks autofill on mismatch.
3. With matching context and `tax_pro` enabled, verify prefill request succeeds and fields are filled.
4. Bulk RPA sanity:
   - run 5-10 items in bulk mode;
   - verify progress counters, pause/resume/cancel controls;
   - verify API receives `bulk-sync-result` and ERP statuses update for processed entities.

### E. Phase 11 smoke

1. Create invoice with `isInternational=true`; verify invoice list shows `Xarici` chip.
2. Build/preview invoice PDF; verify Commercial Invoice header is used.
3. In `purchases`, upload PDF/IMG via "Распознать через AI"; wait for OCR `DONE` and modal prefill open.
4. Open `/customs`, create BGD draft and attach to purchase transaction; verify posting created.

### F. Phase 12 — Customs (`trade_pro`) + Excel

1. Run DB migration including **`IntegrationPortal.CUSTOMS`** enum value; run **`npm run db:ensure-trade-pro-pricing`** on older DBs.
2. Enable **`trade_pro`** for a test org (`GET /api/subscription/me` → `modules.tradePro === true`).
3. **Widget:** on `e-customs.gov.az` (or stub page with debug selectors), open Assistant → capture BGD → verify **`POST /api/customs/declarations/prefill-capture`** returns `{ id, bgdNumber, deduplicated }` and row appears on **`/customs`**; second capture with same `bgdNumber` returns **`deduplicated: true`**.
4. **Paywall:** org **without** `trade_pro` receives **403** on `prefill-capture`; ERP **`/customs`** shows upsell when using widget CTA.
5. **Excel (free):** on **`/customs`**, download template, import sample row, export list — round-trip without `trade_pro`.

## 5) Rollback Notes

- If critical issue is found in extension CTA only, temporarily point `NEXT_PUBLIC_EXTENSION_INSTALL_URL` to an internal docs page.
- If `tax_pro` catalog entry causes issues, temporarily disable module toggling in billing UI/API while keeping the DB row.
- Keep `EXT_REFRESH_*` and CORS origins unchanged unless extension auth issues are confirmed.
