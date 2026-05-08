---
name: generic saas waves
overview: Описать 3 волны Generic SaaS Strengthening в PRD и TZ, затем итеративно реализовать эпики Wave 1 и Wave 2 в порядке риск/польза, переиспользуя уже существующий контур уведомлений и RBAC. Wave 3 — только зафиксировать в roadmap.
todos:
  - id: docs-waves
    content: "PRD §5.E + TZ §12.8: описать Waves 1-3 с эпиками, продуктовыми критериями приёмки, ссылками; добавить точечные стабы в TZ §3, §9, §10, §7"
    status: completed
  - id: e1-virtual-stock
    content: "E1 Virtual stock: GET /api/manufacturing/recipes/:id/available-output + computeAvailableOutput + UI карточка + spec; PRD §5.E.1 [x] COMPLETED"
    status: completed
  - id: e2-activity-stream
    content: "E2 Activity Stream/Chatter: Prisma EntityActivity/EntityComment/Mention; модуль activity-stream + ActivityStreamEmitter; ActivityPanel в ключевые экраны; @mention -> NotificationService; spec; PRD §5.E.2 [x] COMPLETED"
    status: completed
  - id: e3-approval
    content: "E3 Approval Workflow: Prisma ApprovalPolicy/Request/Step (CHECK на reject comment); модуль approvals; интеграция в purchase/cashorder/payroll/bank manual entry; страница /inbox/approvals; spec; PRD §5.E.3 [x] COMPLETED"
    status: completed
  - id: e4-director
    content: "E4 Director роль: добавить UserRole.DIRECTOR в enum + миграция; обновить assertMayViewOrgPnL и Roles на отчётах; spec; TZ §2 + PRD §3.2; PRD §5.E.4 [x] COMPLETED"
    status: completed
  - id: e5-prepaid
    content: "E5 РБП: PrepaidExpense + PrepaidExpenseSchedule; сервис помесячного проведения с учётом closedPeriods; cron/manual post-month; реестр /finance/prepaid-expenses; spec; PRD §5.E.5 [x] COMPLETED"
    status: completed
  - id: e6-overhead
    content: "E6 Cost Allocation: OverheadDriver/Pool/Allocation; allocate endpoint; UI /manufacturing/overhead; idempotent allocate; spec; PRD §5.E.6 [x] COMPLETED"
    status: completed
  - id: e7-psa
    content: "E7 PSA mini: Employee.userId; Project/ProjectTask/TimeEntry; generate-invoice; profitability; UI /psa; spec; PRD §5.E.7 [x] COMPLETED"
    status: completed
isProject: false
---

## Generic SaaS Strengthening (Waves 1–3)

### 1. Документация (PRD + TZ): зафиксировать все 3 волны

PRD: новый раздел `§5.E. Generic SaaS Strengthening (Waves 1–3)` в [PRD.md](PRD.md) после `§5.D Fixed Assets v2` (~стр. 525). Содержит:

- Сводная таблица волн (W1/W2/W3) и эпиков, с ссылками на детальные §-разделы.
- Wave 1: Activity Stream/Chatter (`§5.E.2`), Approval Workflow + лимиты (`§5.E.3`), Director роль (`§5.E.4`).
- Wave 2: Virtual stock (`§5.E.1` — quick win), Prepaid Expenses/РБП (`§5.E.5`), Cost Allocation (`§5.E.6`), PSA mini (`§5.E.7`).
- Wave 3 (только roadmap, без реализации): CRM Pipeline/Deals, User-defined Custom Fields, Disassembly, Resource Calendar (PSA-следствие), Mobile WMS scan.
- Для каждого эпика — продуктовые критерии приёмки.

TZ: новый раздел `§12.8. Generic SaaS Strengthening (Waves 1–3)` в [TZ.md](TZ.md) после `§12.7 Migration Wizard` (~стр. 1326). Содержит архитектурный контур каждого эпика (модели Prisma, REST контракты, RBAC, миграции, BullMQ jobs где нужно).

Точечные подзаголовки добавлю по месту:

- TZ §3 (Ledger) — стаб для РБП.
- TZ §9 (Audit/AuditMutationInterceptor) — стаб для Activity Stream (опираемся на `Notification`, не дублируем audit).
- TZ §10 (Inventory) — стаб для Virtual stock.
- TZ §10.2.x (Manufacturing) — стаб для Cost Allocation.
- TZ §7 (HR) или новый §7A — стаб для PSA + явная связь `Employee.userId`.

### 2. Эпики (interleave)

Каждый эпик закрываем по контуру: Prisma migration → API (DTO + service + controller + spec) → Web UI + i18n (`apps/web/lib/i18n/resources.ts`, затем `npm run i18n:catalog` + `db:sync-i18n` по правилам) → markdown-обновление PRD/TZ с `[x] COMPLETED` и датой ревизии.

#### E1. Virtual stock (quick win, Wave 2)

Read-only расчёт «сколько единиц ГП можно выпустить сейчас».

- API: `GET /api/manufacturing/recipes/:id/available-output?warehouseId=` — для каждой строки BOM из `ProductRecipe.lines` берёт `quantityPerUnit * (1 + wasteFactor)`, делит остаток компонента (`StockItem.quantity` на складе) на потребность; результат = min по строкам, плюс bottleneck-список «какого компонента не хватает». Логику класть в новый метод [apps/api/src/manufacturing/manufacturing.service.ts](apps/api/src/manufacturing/manufacturing.service.ts) `computeAvailableOutput(...)`.
- Без миграций.
- Web: новая колонка/виджет на `/manufacturing/recipes/[id]` и кнопка «Запустить выпуск» с предзаполненным `quantity`; компонент `available-output-card.tsx`.
- DoD: Jest-spec на 3 кейса (хватает / 1 узкое место / нулевые остатки) + i18n.

#### E2. Activity Stream / Chatter (Wave 1)

Доменные сущности: `EntityActivity` (системные события), `EntityComment` (текст пользователя), `Mention` (FK на Comment + userId).

- Prisma: 3 новые модели + индексы `(organizationId, entityType, entityId, createdAt DESC)`. Миграция в [packages/database/prisma/migrations/](packages/database/prisma/migrations/).
- API: новый модуль `apps/api/src/activity-stream/`:
  - `GET /api/activity/:entityType/:entityId` — таймлайн (события + комменты, объединённый порядок).
  - `POST /api/activity/:entityType/:entityId/comments` — создать комментарий, парсить `@username` → `Mention[]` → `NotificationService.createNotification` со ссылкой на entity.
  - `PATCH /api/activity/comments/:id`, `DELETE /api/activity/comments/:id`.
- Эмиттеры событий: тонкий `ActivityStreamEmitter` сервис, вызывается из [apps/api/src/audit/audit-mutation.interceptor.ts](apps/api/src/audit/audit-mutation.interceptor.ts) — рядом с `AuditService.write`, без дублирования. Маппинг URL → `entityType/entityId` (для start таблиц: invoices, counterparties, purchases, inventory_audits, payroll_slips).
- Web: `ActivityPanel` компонент в правую колонку модалок/страниц (`ViewInvoiceModal`, `/crm/counterparties/[id]`, `/inventory/audits/[id]`, и т.д.), переиспользует существующий `NotificationBell` для unread-сигнала.
- DoD: timeline сортировка стабильна; @mention создаёт Notification; RBAC — комментировать может любой авторизованный member организации; soft-delete; spec на 4 кейса (post, mention, edit, delete) + e2e на одной сущности.

#### E3. Approval Workflow + лимиты (Wave 1)

Универсальный движок согласования для документов закупки (`Purchase`/`PurchaseInvoice`), `CashOrder` (KMO/KXO), `BankStatementLine.MANUAL_BANK_ENTRY`, и `PayrollRun` PAID-перевода.

- Prisma: `ApprovalPolicy` (organizationId, documentType, amountFrom, amountTo, currency, approverRoles[], requireOwner, requireDirector), `ApprovalRequest` (entityType/entityId, status `PENDING|APPROVED|REJECTED`, requestedBy, currentStep, totalSteps, finalDecisionAt), `ApprovalStep` (requestId, stepNo, approverRole, approverUserId?, decidedAt?, decision, comment, requiredComment).
- Шаг с `decision = REJECTED` обязательно с непустым `comment` (валидация на DTO + DB CHECK).
- API: новый модуль `apps/api/src/approvals/`:
  - `POST /api/approvals/:entityType/:entityId/submit` — переводит документ в `PENDING_APPROVAL` (если матчится policy).
  - `POST /api/approvals/:requestId/steps/:stepNo/approve|reject`.
  - `GET /api/approvals/inbox?role=` — мои согласования.
- Бизнес-блокировки: `assertMayPostAccounting` / соответствующие сервисы (`payroll.service`, `cash.service`, `banking.service`) перед `prisma.$transaction` проверяют `ApprovalRequest.status === APPROVED`.
- Уведомления через `NotificationService.createNotification` — каждому approver на его шаге.
- Web: страница `/inbox/approvals` (список запросов с фильтром «моих»), модалка детали с кнопками Approve/Reject + обязательным комментарием при Reject; индикатор статуса в карточке документа.
- DoD: e2e — закупка > лимита блокируется до approve; Reject без комментария → 400; spec на 6 кейсов (одношаговая/двухшаговая, реквиз. owner, лимит, валюта).

#### E4. Director роль (Wave 1)

Роль «Директор юр.лица» (уже отражена концептуально в TZ §2.0 как промежуточная между OWNER и операторами).

- Prisma: добавить `UserRole.DIRECTOR` в enum в [schema.prisma](packages/database/prisma/schema.prisma) (строки 2235–2246).
- AccessControl: `assertMayViewOrgPnL(role)` — `OWNER | ADMIN | ACCOUNTANT | DIRECTOR`. Право Approve в лимитах — через `ApprovalPolicy.approverRoles` (включает `DIRECTOR`).
- Holding-scope: убедиться что DIRECTOR — это `OrganizationMembership.role`, а не `HoldingMembership`; видимость P&L и Cash Flow ограничивается одной организацией.
- API: эндпоинты отчётности (P&L, Cash Flow, Balance Sheet, Receivables) добавить `DIRECTOR` в `@Roles` где сейчас `ACCOUNTANT`.
- Web: показать роль в списке `OrganizationMembership` (страница членства) и в Super-Admin.
- DoD: миграция enum + smoke на 3 endpoints + RBAC spec; обновлены [TZ.md](TZ.md) §2 «Система ролей» и [PRD.md](PRD.md) §3.2.

#### E5. Prepaid Expenses / РБП (Wave 2)

Помесячная амортизация предоплаченных расходов (страховки, IT-подписки, аренда уплачено вперёд).

- Prisma: `PrepaidExpense` (id, organizationId, counterpartyId?, sourceTransactionId? — закупка услуги, totalAmount, currency, startDate, endDate, monthlyAmount, status `ACTIVE|FULLY_AMORTIZED|CANCELLED`, expenseAccountCode default `731`/`72x`, prepaidAccountCode default `133` или по политике), `PrepaidExpenseSchedule` (id, prepaidExpenseId, period — `YYYY-MM`, amount, status `PENDING|POSTED|SKIPPED_CLOSED`, postedTransactionId?).
- Сервис: при создании генерируется график (равные доли + хвост). BullMQ cron (раз в месяц после закрытия) или ручной `POST /api/prepaid-expenses/:id/post-month` — создаёт проводку **Дт expenseAccount — Кт prepaidAccount** в `prisma.$transaction`; уважает `closedPeriods`.
- При проведении `serviceLines` в закупке (TZ §10.2.2) — опциональное предложение «Создать график РБП» в UI.
- API: CRUD + `post-month`, `cancel`.
- Web: `/finance/prepaid-expenses` реестр + модалка создания.
- DoD: spec на проводки помесячно; на хвостовое распределение; на блокировку при закрытом периоде.

#### E6. Cost Allocation в Manufacturing (Wave 2)

Распределение косвенных расходов (электричество, аренда цеха, ФОТ охраны) на себестоимость release.

- Prisma: `OverheadDriver` (organizationId, name, type `VOLUME|TIME|MATERIAL_COST`), `OverheadPool` (period `YYYY-MM`, totalAmount, sourceAccountCode, driverId), `OverheadAllocation` (poolId, releaseId, amount, releaseTransactionId).
- Сервис: после закрытия месяца — `POST /api/manufacturing/overhead/allocate?period=YYYY-MM`; собирает все release за период, считает доли по driver, создаёт проводки **Дт 202/204 — Кт 26x** на каждый release (отдельной транзакцией с reference `OH-ALLOC-{releaseId}-{period}`).
- Web: `/manufacturing/overhead` (пулы и драйверы) + кнопка «Распределить» с предпросмотром.
- DoD: spec на 3 типа драйвера; на повторный allocate (idempotent). Уважает закрытый период.

#### E7. PSA mini (Wave 2 — последний, самый объёмный)

Мини-проектный учёт: проекты, задачи, time entries, маржинальность, billable invoice.

- Prisma:
  - Сначала — связь `Employee.userId` (FK) в [schema.prisma](packages/database/prisma/schema.prisma) (где сейчас её нет) — чтобы привязать time entry к юзеру и сотруднику одновременно. Миграция: backfill для тестовых данных не делается, поле nullable.
  - `Project` (organizationId, code, name, counterpartyId, status `ACTIVE|COMPLETED|CANCELLED`, billingMode `FIXED|HOURLY`, hourlyRate?, currency, departmentId?).
  - `ProjectTask` (projectId, name, status, estimatedHours?).
  - `TimeEntry` (projectId, taskId?, employeeId, date, hours, billable, hourlyRateSnapshot, status `DRAFT|SUBMITTED|APPROVED|INVOICED`).
- API: CRUD проектов/задач/time entries; `POST /api/psa/projects/:id/generate-invoice?from=&to=` — создаёт черновик `Invoice` с строками по APPROVED + не-INVOICED time entries (`billable=true`); автоматически проставляет `Product.isService=true` через служебный «Часовой» продукт-услугу (создаётся при первом запуске).
- Маржинальность: `GET /api/psa/projects/:id/profitability` — доход (выставленные инвойсы по проекту) минус ФОТ (allocation: time entries × средняя ставка `payroll_slips`).
- Web: модуль `/psa` (список, карточка проекта, табель задач, time entries, кнопка «Сформировать счёт»).
- DoD: spec на расчёт billable hours; на attempt to generate без APPROVED → пусто; на retry idempotency (не дублировать выставленные часы).

### 3. Cross-cutting

- i18n: каждый эпик добавляет ключи в [apps/web/lib/i18n/resources.ts](apps/web/lib/i18n/resources.ts), затем `npm run i18n:catalog` + commit `apps/api/src/admin/i18n-default-catalog-data.json`, затем `npm run db:sync-i18n` (по правилу `dayday-local-dev.mdc`).
- Audit: все мутации новых эндпоинтов проходят `AuditMutationInterceptor` (TZ §9).
- Tenancy: на каждой новой модели — `organizationId` + индекс; в `$queryRaw` — явный `WHERE organization_id = ...` (TZ §2, §16).
- Acceptance criteria для каждого эпика фиксируются по месту в PRD и помечаются `[x] COMPLETED` после прохождения acceptance + миграции в проде (`prisma migrate deploy`) + `npm run build`.