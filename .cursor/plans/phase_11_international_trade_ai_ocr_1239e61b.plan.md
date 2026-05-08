---
name: Phase 11 International Trade AI OCR
overview: Phase 11 introduces an International Trade module (export invoices without local e-qaime, Commercial Invoice PDF, multi-language) and an AI-Vision OCR pipeline for foreign supplier invoices that prefills the Alis Fakturasi form. It also adds a CustomsDeclaration (BGD) entity used for import cost basis and import VAT mechanics.
todos:
  - id: p11-export-flag
    content: Add Invoice.isInternational + Counterparty.country to Prisma + migration; update create DTO and contracts
    status: completed
  - id: p11-export-pdf
    content: Render Commercial Invoice variant in invoice-pdf pipeline when isInternational=true
    status: completed
  - id: p11-export-web
    content: Add export toggle + country control in CreateInvoiceModal; chip on invoices list
    status: completed
  - id: p11-extension-guard
    content: Filter international invoices out of DVX bulk-prefill on both extension UI and server
    status: completed
  - id: p11-ocr-schema
    content: Add ForeignInvoicePrefillSchema in @dayday/api-contracts
    status: completed
  - id: p11-ocr-module
    content: Create apps/api/src/ocr module (controller + service + queue + worker + provider interface)
    status: completed
  - id: p11-ocr-providers
    content: Implement OpenAI (default) and Gemini providers behind OcrVisionProvider; env-driven selection
    status: completed
  - id: p11-ocr-job-model
    content: Add OcrJob model + migration; persist status, resultJson, errorJson
    status: completed
  - id: p11-ocr-ui
    content: Add Recognize via AI button + upload/poll/prefill flow in purchases page and PurchaseModal
    status: completed
  - id: p11-customs-model
    content: Add CustomsDeclaration model + migration
    status: completed
  - id: p11-customs-api
    content: Implement CustomsModule (CRUD + attach with cost-basis JE in Prisma transaction)
    status: completed
  - id: p11-customs-ui
    content: Build /customs page (list + create/edit/attach UI)
    status: completed
  - id: p11-i18n
    content: Add trade.export.*, trade.import.*, customs.* keys (RU/AZ); run i18n:audit and i18n:catalog
    status: completed
  - id: p11-tests
    content: Add unit tests for OCR service, CustomsService cost-basis posting, and international invoice rules
    status: completed
  - id: p11-docs
    content: Update TZ.md (new Phase 11 section), PRD.md cross-link, apps/extension/README.md, dayday-module-map.mdc, env.example, deploy docs
    status: completed
  - id: p11-verify
    content: npm run build, build:ext, focused jest specs; manual smoke (upload PDF, prefill, attach BGD, export PDF)
    status: completed
isProject: false
---

# Phase 11: International Trade & AI-OCR

Two product surfaces, one cohesive release:

- **Track A (Export / Ixrac):** invoices marked as international skip e-qaime requirements; PDF rendered as Commercial Invoice (multi-language).
- **Track B (Import / Idxal):** AI-Vision OCR pipeline + CustomsDeclaration (BGD) entity for cost basis and import VAT.

## High-level architecture

```mermaid
flowchart LR
  subgraph Web[ERP Web]
    SalesNew[CreateInvoiceModal export toggle]
    PurchasesNew[PurchaseModal recognize via AI]
    BgdUI[CustomsDeclaration UI]
  end
  subgraph API[NestJS API]
    InvoicesCtrl[Invoices export flag + Commercial PDF]
    OcrCtrl[OCR upload and status]
    OcrQueue[OCR queue]
    OcrWorker[OCR worker]
    CustomsCtrl[CustomsDeclaration]
  end
  subgraph Storage[Object Storage]
    Bucket[orgs/{org}/ocr/...]
  end
  subgraph LLM[Vision LLM]
    Provider[OpenAI or Gemini]
  end
  subgraph DB[Prisma DB]
    Inv[Invoice +isInternational]
    OcrJob[OcrJob]
    Cust[CustomsDeclaration]
    Tx[Transaction]
  end

  SalesNew --> InvoicesCtrl --> Inv
  PurchasesNew --> OcrCtrl --> Bucket
  OcrCtrl --> OcrQueue --> OcrWorker --> Provider
  OcrWorker --> Bucket
  OcrWorker --> OcrJob
  PurchasesNew -->|"poll resultJson"| OcrCtrl
  PurchasesNew --> Tx
  BgdUI --> CustomsCtrl --> Cust
  CustomsCtrl --> Tx
```

## Track A: International (export) invoices

### A1. DB / contract changes

- Extend `[packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma)`:
  - `Invoice.isInternational Boolean @default(false) @map("is_international")`
  - `Counterparty.country String? @map("country")` (ISO 3166-1 alpha-2; nullable for legacy rows; foreign supplier marker).
- Generate migration `20260507xxxxxx_phase11_export_flag`.

### A2. API

- `apps/api/src/invoices/invoices.service.ts`:
  - Accept `isInternational` and `counterparty.country` in `CreateInvoiceDto`.
  - When `isInternational=true`:
    - allow currency != AZN without warning;
    - skip any e-qaime nudges in audit / UI hints;
    - `getExtensionPrefill` returns `INVOICE_NOT_INTERNATIONAL_PREFILL` (do not block, but extension-side guard hides DVX bulk for international).
  - Update `[apps/api/src/invoices/invoices.controller.ts](apps/api/src/invoices/invoices.controller.ts)` to expose new field via DTO.
- `apps/api/src/invoices/invoice-pdf.build.ts` + `invoice-pdf.render.ts`:
  - When `isInternational=true`, render Commercial Invoice template with English/Azerbaijani fallback strings (no domestic legal blocks like e-qaime QR).
  - Reuse existing PDFKit pipeline; switch by template variant.
- Contract: extend `[packages/api-contracts/src/invoices.ts](packages/api-contracts/src/invoices.ts)` with optional `isInternational` in create/get DTOs.

### A3. Web UI

- `[apps/web/components/sales/modals/CreateInvoiceModal.tsx](apps/web/components/sales/modals/CreateInvoiceModal.tsx)`:
  - Add `isInternational` toggle (default off) and `country` autocomplete in counterparty inline create.
  - When ON: hide AZN-only e-qaime hints; allow any currency.
- `[apps/web/app/sales/invoices/page.tsx](apps/web/app/sales/invoices/page.tsx)`:
  - Tag column / chip "Xarici" near number for `isInternational` rows.

### A4. Extension guard

- `[apps/extension/src/connectors/etaxes/index.ts](apps/extension/src/connectors/etaxes/index.ts)` and bulk widget: filter out invoices where `isInternational=true` from `bulk-prefill` selection (server-side rejects too).

## Track B: Import (AI-OCR + BGD)

### B1. AI-Vision OCR pipeline

- New module `apps/api/src/ocr/`:
  - `ocr-vision.interface.ts` (`OcrVisionProvider`).
  - `openai-ocr.provider.ts` (default; uses `openai` SDK + Structured Outputs against Zod-derived JSON schema).
  - `gemini-ocr.provider.ts` (alt; `@google/generative-ai` SDK).
  - `ocr.controller.ts`:
    - `POST /api/ocr/invoices/upload` (multer: `application/pdf`, `image/*`; size limit 10 MB).
    - `GET /api/ocr/invoices/:id` (status + resultJson when DONE).
  - `ocr.queue.ts`, `ocr.worker.ts` mirroring `invoice-pdf.queue.ts` / `invoice-pdf.worker.ts`.
  - `prompts/foreign-invoice.system.ts` system prompt + JSON schema generated from `ForeignInvoicePrefillSchema`.
- Provider selection via env `OCR_VISION_PROVIDER=openai|gemini` (default `openai`).
- File saved to `StorageService` under `orgs/{org}/ocr/{ocrJobId}.{ext}`; raw payload never logged.
- New Prisma model:
  - `OcrJob { id, organizationId, status (PENDING|RUNNING|DONE|ERROR), provider, fileKey, fileMime, resultJson Json?, errorJson Json?, attemptCount, createdAt, updatedAt, triggeredByUserId }` and migration.
- New Zod schema in `[packages/api-contracts/src/invoices.ts](packages/api-contracts/src/invoices.ts)`:
  - `ForeignInvoicePrefillSchema` superset of `InvoicePrefillSchema`: drops `currency: literal("AZN")`, adds `supplier { name, taxId?, country, address? }`, `currency string` (ISO 4217), `lines[].vatRatePct?` optional.

### B2. CustomsDeclaration (BGD)

- Prisma:
  - `CustomsDeclaration` model: `id`, `organizationId`, `bgdNumber`, `bgdDate`, `currency`, `customsValueAzn`, `customsDutyAzn`, `customsVatAzn`, `feesAzn`, `attachmentKey?`, `linkedPurchaseTransactionId?`, `notes?`.
  - Migration `20260507xxxxxx_phase11_customs_declaration`.
- API: new module `apps/api/src/customs/`:
  - `customs.controller.ts`: CRUD `POST/GET/PATCH/DELETE /api/customs/declarations`, plus `POST /api/customs/declarations/:id/attach { purchaseTransactionId }`.
  - `customs.service.ts`: when attaching to a posted purchase Transaction, append cost-basis JE in a Prisma `$transaction`:
    - Dt 201 (`INVENTORY_GOODS_ACCOUNT_CODE`) on `customsDutyAzn + feesAzn`
    - Dt 241 (`VAT_INPUT_ACCOUNT_CODE`) on `customsVatAzn`
    - Cr 531 (`PAYABLE_SUPPLIERS_ACCOUNT_CODE`) on the sum (BGD reference noted)
    - reuses `[apps/api/src/accounting/...](apps/api/src/accounting/)` `postJournalInTransaction`.

### B3. Web UI

- `[apps/web/app/purchases/page.tsx](apps/web/app/purchases/page.tsx)`:
  - Add "Распознать через AI" secondary button → opens upload dialog → POST upload → poll status → on `DONE` open `PurchaseModal` prefilled.
- `apps/web/components/purchases/PurchaseModal.tsx` (existing; verify path):
  - Accept `prefill` prop with `ForeignInvoicePrefill`-shaped data; user reviews and edits before save.
- `apps/web/app/customs/page.tsx` (new):
  - List of CustomsDeclaration; create/edit modal; attach to a posted purchase Transaction.
- i18n: new namespaces in `[packages/i18n/src/resources.ts](packages/i18n/src/resources.ts)`:
  - `trade.export.*` (chip, modal toggle), `trade.import.*` (OCR button, upload, statuses), `customs.*` (BGD UI).

### B4. Verification & quality gates

- Unit tests:
  - `ocr.service.spec.ts` — provider abstraction returns parsed schema; Zod failure triggers retry.
  - `customs.service.spec.ts` — attaching BGD posts the additional JE in a single `$transaction`.
  - `invoices.service.spec.ts` — `isInternational=true` skips AZN-only block; international rejected for DVX prefill.
- E2E manual checklist (added to `[docs/deploy/EXTENSION_MVP_DEPLOY.md](docs/deploy/EXTENSION_MVP_DEPLOY.md)` or new `docs/deploy/PHASE_11_DEPLOY.md`).
- New env vars (added to `.env.example`):
  - `OCR_VISION_PROVIDER=openai`
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`
  - `OCR_MAX_FILE_MB=10`

## Documentation

- `[PRD.md](PRD.md) §4.4.2`: cross-link to TZ §X for BGD posting; note Phase 11 done flags after merge.
- `[TZ.md](TZ.md)`: new section "Phase 11 — International Trade & AI-OCR" with:
  - export semantics (no e-qaime), Commercial PDF;
  - OCR pipeline contract (queue, model, provider abstraction, prompt schema);
  - CustomsDeclaration model + posting rules.
- `[apps/extension/README.md](apps/extension/README.md)`: note that international invoices are filtered out of DVX bulk and prefill.
- `[.cursor/rules/dayday-module-map.mdc](.cursor/rules/dayday-module-map.mdc)`: add `apps/api/src/ocr/**` and `apps/api/src/customs/**` rows; update Web row with `customs/`.

## Out of scope (Phase 11.1+ candidates)

- Multi-BGD-per-purchase (M:N) and per-line cost allocation (CIF, freight components).
- Direct submission to Customs Service API.
- Export documents beyond Commercial Invoice (Packing List, CMR) — to be added later.