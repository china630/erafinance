---
name: Audit Hub Phase 2+3 unified
overview: "Single delivery track combining Advanced Audit Hub (Phase 2) and External auditor / cross-tenant access (Phase 3). Phase 2 ships analytics on existing org data; Phase 3 adds explicit invitations, scoped ACL, and billing/legal alignment after product sign-off."
isProject: false
---

# Audit Hub — Unified Phase 2 + 3 Plan

This document is the **single source of truth** for Phase 2 and Phase 3 scope. Use the **checkbox lists** below for PR scope and backlog tracking.

**How to read progress:** sections **2.x / 3.x** describe product scope; the block **«Execution log / TODO»** at the **end** is the operational checklist (what is done in repo vs what remains).

## Goals (summary)

| Track | Scope | Success criteria |
|-------|--------|------------------|
| **P2 — Advanced (single tenant)** | NAS/IFRS signals, risk detectors, calculation rationale, optional audit engagements | Documented REST under `/api/audit-hub/*`, usable UI on `/audit-hub/*`, TZ/PRD aligned |
| **P3 — External auditor** | Time-bound access to **another** `organizationId` via invitation; same **`AUDIT_NOTE`** as internal `AUDITOR`; **client org** pays `audit_hub` | No `skipTenantFilter` shortcuts; full `AuditLog` trail; consent + decline + revocation in product |

---

## Phase 2 — Checklist (single-tenant org)

Legend: `[x]` done · `[~]` partial / MVP only · `[ ]` not started

### 2.1 NAS / IFRS reconciliation

- [x] API `GET /api/audit-hub/reconciliation/nas-ifrs` — asymmetry (final `Transaction` with journal lines only on NAS **or** only on IFRS)
- [x] Query flag `includeTotalsMismatch` — both ledgers present, **sum of `debit` NAS ≠ sum of `debit` IFRS** (heuristic v2)
- [x] DTO validation + bounded `take` + date window
- [~] UI `/audit-hub/reconciliation` — фильтры + **карточки / таблицы / экспорт CSV+XLSX** + ссылка на `journal_posting`; drill-down вне Audit Hub — по мере появления стабильных маршрутов
- [ ] Optional: account-level / mapping-aware diff (beyond current transaction-level heuristics)

### 2.2 Risk dashboard

- [x] API `GET /api/audit-hub/risk` — detector **duplicate posted `CashOrder`**
- [x] Detector: duplicate **`InvoicePayment`** patterns (same-window heuristic)
- [x] Detector: counterparty **z-score** on `InvoicePayment` totals (`|z|≥2`, cohort mean/std)
- [x] Detector: **expense account spikes** (by GL account / period, configurable `expenseMinDebit`)
- [x] Detector: **counterparty payment concentration** (load share heuristic)
- [x] UI `/audit-hub/risk` — карточки счётчиков, таблицы по детекторам, ссылки на инвойсы/контрагентов, CSV + multi-sheet XLSX, опциональный сырой JSON
- [x] Throttle on `GET /api/audit-hub/risk` (Nest `@Throttle`, see controller)

### 2.3 Calculation rationale (“explain” postings)

- [x] API `GET /api/audit-hub/calculation/:type/:id` — whitelist `type`, `schemaVersion` in JSON
- [x] Types: **`journal_posting`**, **`invoice`**, **`fx_snapshot`** (глобальный **`CbarOfficialRate`**), **`fixed_asset_depreciation`** (**`FixedAssetDepreciationMonth`**), **`payroll_accrual`** (**`PayrollRun`** + агрегаты slips) — ответ **`schemaVersion: 1`**, **`summary.implemented: true`** где применимо
- [x] UI `/audit-hub/calculation` — типы, загрузка, **`?type=&id=`** из URL (deep link с NAS/IFRS)

### 2.4 Audit engagements (named reviews)

- [x] Prisma model **`AuditEngagement`** (+ invites model as part of P3)
- [x] API list/create/update status + **`GET engagements/:id`**
- [x] UI list + detail (`/audit-hub/engagements`, `/audit-hub/engagements/[id]`)

### 2.5 Phase 2 — Documentation & quality bar

- [x] PRD §4.8.1 / TZ §9.A updated for shipped endpoints (extend when stubs go live)
- [x] Service tests (mock Prisma **`$queryRaw`**) для NAS/IFRS и risk; Jest для **`AuditHubCalculationService`** (fx + payroll)
- [x] Performance / index guidance — **TZ §9.A** (существующие индексы + `EXPLAIN` при росте данных)

---

## Phase 3 — Checklist (cross-org external auditor)

Legend: `[x]` done · `[~]` partial · `[ ]` not started

### 3.1 Product & legal

- [~] Consent copy in UI (`/audit-invitations`) + i18n RU/AZ; **formal legal review** of text TBD
- [x] Export / `bulk-export` rules for **guest** sessions (stricter `maxFiles` than internal)

### 3.2 Data model & invitations

- [x] Model **`AuditEngagementInvite`**: target org, token hash, expiry, revoke, permissions JSON
- [x] Accept / **decline** flow; idempotent accept where applicable
- [ ] Optional: invite without pre-existing ERA user (email signup path) — **product decision / future**

### 3.3 Auth & tenancy (critical)

- [x] Guest context: validated **invite id + token** headers → request carries **audited `organizationId`** (see `RequestWithAuditEngagement`, TZ §9.A)
- [x] Query paths use explicit **client org** id from engagement context (not guest home org)
- [x] `AuditorMutationGuard` / activity-stream: **`AUDIT_NOTE`** on client org when engagement active
- [x] No new `skipTenantFilter` for this feature

### 3.4 Billing (agreed baseline)

- [x] **Client org** keeps `audit_hub`; guest org does **not** need paid module for agreed read + notes
- [x] Enforce at API: target org must have **`audit_hub`** for engagement flows (as implemented in services/guards)

### 3.5 UI

- [x] Inbox + accept + decline + session start: **`/audit-invitations`**
- [x] Banner / session UX (see app shell + `useAuditEngagementSession`)
- [x] Navigation: dedicated Audit Hub routes under guest session

### 3.6 Observability & tests

- [x] `AuditLog` chain entries for guest **mutations** (interceptor on non-GET)
- [~] E2E: invite → accept → read → note → revoke — **unit/integration** pieces exist; full E2E pipeline TBD

### 3.7 Documentation

- [x] PRD §4.8.1 + TZ §9.A — Phase 2–3 contracts and tenancy (this iteration)
- [x] `erafinance-module-map.mdc` — audit-hub + guest / `audit-invitations` paths and files

---

## NAS/IFRS delivery notes

- **v1:** asymmetry list (default response `items`).
- **v2:** `includeTotalsMismatch=true` adds `totalsMismatchItems`; may stay **off in UI** until v1 is validated in production (stakeholder decision).

## Dependencies & risks

- **Performance:** keep `take`, date windows, indexes on `journal_entries`, `cash_orders`.
- **False positives:** label NAS/IFRS and risk hits as **review**, not fraud.
- **PII:** join counterparty display names only via existing patterns.

## Stakeholder decisions (2026-05-11)

| Topic | Decision |
|-------|-----------|
| Phase 3 timing | **After** Phase 2 is stable in production |
| External auditor notes | **Yes** — same `EntityComment` / `AUDIT_NOTE` as internal `AUDITOR` |
| Billing for guest access | **Client org** holds `audit_hub`; guest org does not need the add-on for agreed access |
| NAS/IFRS v2 flag | Ships in codebase with v1; product may hide UI toggle until v1 is validated |

## Open questions (remaining)

- Formal legal sign-off on cross-org consent text (RU/AZ copy is product placeholder)
- Optional: email-based invite for users without a ERA account

## Documentation (ongoing)

- При смене контрактов calculation / risk / reconciliation — синхронизировать **PRD §4.8.1** и **TZ §9.A**
- **`erafinance-module-map.mdc`** — подраздел **Audit Hub — внешний аудитор (guest session)** синхронизирован с репо (2026-05-11)

---

## Execution log / TODO

Use this list to see **repo status** at a glance (last reviewed: **2026-05-11**).

### Done (shipped in codebase this track)

- [x] Phase 2: NAS/IFRS API; **reconciliation + risk** UI (карточки, таблицы, ссылки, CSV/XLSX); **calculation** для всех whitelist-типов (в т.ч. CBAR / ОС / payroll run)
- [x] Phase 2: Risk API — детекторы + throttle (без изменений контракта)
- [x] Phase 2: `AuditEngagement` CRUD/list/detail API + web pages
- [x] Phase 3: Invites (create, outbox, revoke), accept, **decline**, inbox `GET /api/audit-hub/me/audit-invites/inbox`
- [x] Phase 3: Guest session headers + middleware; guest **bulk-export** cap; guest mutation **AuditLog** interceptor
- [x] Web: `/audit-invitations` — consent checkbox, accept, decline, session storage flow
- [x] i18n RU/AZ for invitations / engagements (`packages/i18n/src/resources.ts`)
- [x] Tests (Jest): `audit-hub-nas-ifrs.service`, `audit-hub-risk.service`, `audit-hub-calculation.service`, `audit-engagement-invite-decline`, `roles-guard-audit-engagement`
- [x] `npx nest build` (API) green for this tree
- [x] `npm run i18n:audit` green
- [x] `erafinance-module-map.mdc` — подраздел Audit Hub guest + правка строки таблицы

### Short backlog (cleared 2026-05-11)

Бывшие пункты «next PR» закрыты в коде: **rich UI** risk/reconciliation (карточки, таблицы, ссылки, CSV + XLSX), **calculation** для FX/ОС/payroll через Prisma, **Jest**-спеки на сервисы, **TZ** про индексы/производительность, **`npm run i18n:catalog`**.

- [x] Rich risk / reconciliation UI + export
- [x] Calculation: `fx_snapshot`, `fixed_asset_depreciation`, `payroll_accrual` wired to data
- [x] Jest: `audit-hub-nas-ifrs`, `audit-hub-risk`, `audit-hub-calculation` (+ существующие invite/guard)
- [x] TZ performance note (§9.A)
- [x] i18n catalog refresh

**Parked (не блокирует прод):** полный **Playwright** E2E по invite (ручной/отдельный nightly при желании).

### Release hygiene

- [x] **CI (`.github/workflows/ci.yml`):** после `jest src/` добавлен шаг **`npm run test:integration`** (`test/*.spec.ts`, без `*.e2e-spec.ts`); `timeout-minutes` **45**
- [x] **RBAC scanner:** `AuditHubMeController` — класс **`@UseGuards(JwtAuthGuard)`** (accept/decline проходят `rbac-scanner.spec.ts`)
- [x] Локально: `npm run test:integration -w @erafinance/api`, `npx jest --testPathPattern=src/ -w @erafinance/api`, `npm run i18n:audit`, `npm run build` (перед выкладкой)
