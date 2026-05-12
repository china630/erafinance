# ERA Finance Assistant (browser extension)

WXT + React + Manifest V3. Targets **ƏMAS** (`emas.sosial.gov.az`), **e-taxes** (`*.e-taxes.gov.az`), and **e-customs** (`e-customs.gov.az`, `*.customs.gov.az`) for BGD capture (Phase 12).

## Prerequisites

- Root `.env` with `JWT_*`, `DATABASE_URL`, and extension-related vars (see root [`.env.example`](../../.env.example)): `EXT_REFRESH_EXPIRES`, optional `EXT_REFRESH_SECRET`, production `ERP_WEB_ORIGINS`, `CORS_EXTENSION_ORIGINS`.
- ERP web running (e.g. `npm run dev:web`) and API (`npm run dev:api`) so Magic Auth can complete.
- For existing DBs where `pricing_modules` was seeded before `tax_pro` existed, run once: `npm run db:ensure-tax-pro-pricing -w @erafinance/database`.

## Dev

```bash
# from repo root
npm run dev:ext
```

WXT writes to `apps/extension/.output/chrome-mv3-dev` (dev) or `.output/chrome-mv3` (build).

### Load unpacked (Chrome)

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `apps/extension/.output/chrome-mv3` after `npm run build:ext`, or the `chrome-mv3-dev` folder while `npm run dev:ext` is running.

### Stable dev extension id

Chrome assigns an id from the unpacked path unless you add a manifest `key` (RSA public key). For production, use Web Store / AMO ids and list them in `CORS_EXTENSION_ORIGINS` and `ERP_WEB_ORIGINS` as documented in **TZ §13.6**.

## Public env (WXT)

Set in root `.env` (loaded via `dotenv-cli`):

| Variable | Purpose |
|----------|---------|
| `WXT_PUBLIC_API_URL` | Nest API base, default `http://127.0.0.1:4000` |
| `WXT_PUBLIC_ERP_ORIGIN` | ERP web origin for credentialed `POST .../api/auth/extension/refresh`, default `http://localhost:3000` |

**Host permissions (MV3):** `e-taxes`, `emas`, **e-customs** (`https://e-customs.gov.az/*`, `https://*.customs.gov.az/*`) — see `wxt.config.ts`.

### Install URL (ERP CTA)

ERP UI banner/card for plugin promotion uses `NEXT_PUBLIC_EXTENSION_INSTALL_URL` from root `.env`.

- Default: `/docs/extension`
- Production: set to Chrome Web Store listing URL

## Architecture (short)

- **Background** (`entrypoints/background.ts`): `chrome.runtime` message hub; session in `chrome.storage.session`.
- **ERP bridge** (`entrypoints/erp-bridge.content.ts`): on ERP tab, relays `postMessage` to `ExtensionBridge` in Next.js for bootstrap refresh.
- **ƏMAS** (`entrypoints/emas.content.tsx`): closed Shadow DOM + `FloatingWidget` (`flow="emuqavile"`).
- **DVX / e-taxes** (`entrypoints/etaxes.content.tsx`): closed Shadow DOM + `FloatingWidget` (`flow="eqaime"`).
- **e-customs / BGD** (`entrypoints/customs.content.tsx`): closed Shadow DOM + `FloatingWidget` (`flow="customs"`) and action-bar button injection (`src/connectors/customs/injection.ts`) — **Trade Pro** + `MSG.PORTAL_PREFILL` with `flow: "customs"` posts capture to API.
- **Popup**: Hub vs portal context from active tab URL (`src/connectors/registry.ts`).
- **Safety gate (VÖEN cross-check):** before autofill, widget compares ERP active organization `taxId` with the active portal VÖEN detected by connector. On mismatch (or missing portal VÖEN while authenticated), autofill is blocked until context is aligned.

### Debug badge for portal pilot

To show a small debug panel inside the widget (auth state + ERP/portal VÖEN + cross-check status), enable one of these in portal tab:

- DevTools Console: `localStorage.setItem("erafinanceAssistantDebug", "1")`
- URL query: `?erafinanceAssistantDebug=1`

Disable with: `localStorage.removeItem("erafinanceAssistantDebug")`.

## API surface used

- `POST /api/auth/extension/refresh` — bootstrap or silent (see TZ §13.6).
- `POST /api/auth/extension/logout` — clear `refresh_token_ext`.
- `GET /api/auth/me`, `POST /api/auth/switch`, `GET /api/subscription/me`, `GET /api/hr/employees/:id/prefill`, `GET /api/invoices/:id/prefill`, `POST /api/customs/declarations/prefill-capture` (**`trade_pro`**).
- Bulk RPA (premium): `POST /api/hr/employees/bulk-prefill`, `POST /api/invoices/bulk-prefill`, `POST /api/hr/employees/bulk-sync-result`, `POST /api/invoices/bulk-sync-result`.
- `GET /api/invoices/:id/prefill` is AZN-only (`INVOICE_NOT_AZN` for non-AZN invoices); exempt VAT lines are normalized with `vatExempt=true` and `vatRatePct=0`.
- International invoices are excluded from DVX prefill (`INVOICE_NOT_INTERNATIONAL_PREFILL`) and should be exported as Commercial Invoice from ERP instead.

## Portal prefill protocol

`MSG.PORTAL_PREFILL` uses flow-dispatch payload:

- HR ƏMAS: `{ type: MSG.PORTAL_PREFILL, flow: "emuqavile", employeeId }`
- DVX e-qaimə: `{ type: MSG.PORTAL_PREFILL, flow: "eqaime", invoiceId }`
- **e-customs BGD → ERP:** `{ type: MSG.PORTAL_PREFILL, flow: "customs", capture }` where `capture` matches `CustomsDeclarationFullPrefillCaptureSchema` (legacy-flat compatible) from `@erafinance/api-contracts`.

Bulk protocol:

- `MSG.PORTAL_BULK_PREFILL`
  - ƏMAS: `{ type, flow: "emuqavile", employeeIds: string[] }`
  - DVX: `{ type, flow: "eqaime", invoiceIds: string[] }`
- `MSG.PORTAL_BULK_RESULT`
  - posts per-item status (`SYNCED`/`ERROR`) back to API to persist sync columns in ERP.

## i18n

Extension strings live under `extension.*` in `@erafinance/i18n` (`packages/i18n/src/extension.ts`). Root `npm run i18n:audit` scans `apps/extension/src/**`.
