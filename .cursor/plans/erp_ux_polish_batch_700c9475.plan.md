---
name: ERP UX polish batch
overview: Пакет UI/UX правок по пунктам 1–31 плюс ответы на продуктовые вопросы по PRD/TZ; в конце — синхронизация PRD.md и TZ.md. Реализация после вашего подтверждения плана.
todos:
  - id: cash-kassa-ux
    content: "Banking/cash: PageHeader month leading; Hesabdar button+modal only; advance AZN note vs scope doc"
    status: completed
  - id: crm-catalog-sales-forms
    content: Counterparties modal (VÖEN width, empty legalForm/role); catalog + invoice VAT default empty; invoice modal scroll; sales invoices API pager
    status: completed
  - id: lists-pagination-batch
    content: "API+UI pagination: purchases, inventory (+movements,balances,transfers,adjustments,receipts,audits), employees, psa/projects, hr/positions"
    status: completed
  - id: inventory-modals-scroll
    content: "Scrollable bodies: transfer modal, receipts qty modal, invoice lines pattern shared"
    status: completed
  - id: inventory-ux-copy
    content: Transfers vs movements copy; empty placeholders transfers/adjustments; physical/audits modal flows per PRD
    status: completed
  - id: inventory-settings-fifo
    content: "Settings: show org inventoryValuation FIFO/AVCO; PRD note org vs per-warehouse"
    status: completed
  - id: manufacturing-nav-hub
    content: Replace redirect-only hub or fix Sidebar; DESIGN pass manufacturing pages
    status: completed
  - id: hr-fixed-reporting
    content: Timesheet+analytics month like banking; fix hr analytics 500; positions table+modal dept+; structure width
    status: completed
  - id: reporting-tax-holding
    content: Reporting toolbars; holding 500 fix; receivables/aging period semantics; cash-flow report clarify; tax-export layout (+extension scope after user confirm)
    status: completed
  - id: accounting-fa-prepaid
    content: Mapping breadcrumb strip; IFRS help; fixed-assets width+month+depreciation copy; prepaid menu+table width
    status: completed
  - id: direct-banking-admin-nav
    content: Wire DirectBankingSection into settings; Sidebar Admin vs Super-Admin groups
    status: completed
  - id: prd-tz-sync
    content: Update PRD.md and TZ.md for navigation, APIs pagination, reporting periods, bank settings location
    status: completed
isProject: false
---

# Пакет доработок ERP + ответы на вопросы

Ниже сначала **ответы** (без правок кода). Затем **план работ** по файлам и API.

---

## Ответы на вопросы (продукт / PRD / текущий код)

### 1) Kassa — Avans hesabatı и валюта
- По текущей модели в коде/ТЗ авансовый отчёт и проводки завязаны на **AZN-логику** (отдельная фича «валюта расхода в авансе» = миграция + проводки по валютным 244 и т.д.). Касса при этом может вести **несколько валют** по счетам, но **документ авансового отчёта** сейчас не предполагает выбор валюты расхода как полноценного поля.
- В UI уже уместна подсказка «учёт в AZN»; полноценный выбор валюты — только если зафиксируете это в PRD как scope.

### 10) `/inventory/movements` vs `/inventory/transfers`
- **Movements** — общий журнал **`StockMovement`** (все типы/причины: приход, расход, трансфер, корректировка и т.д.), фильтр по складу, `take` до 500.
- **Transfers** — тот же API, но выборка **только внутренних перемещений**: пары `TRANSFER_OUT` / `TRANSFER_IN` и сопоставление по **`transferBatchId`** (куда уехал груз). Это не дубликат бизнес-смысла, но UX должен это явно подписать (подзаголовок + ссылка «все движения»).

### 12) FIFO / AVCO — на организацию или на склад?
- В [PRD.md](PRD.md) **§4.10.1**: настройка **`inventoryValuation` (`FIFO` / `AVCO`) на уровне организации**; COGS и списания используют этот метод. **Отдельной настройки на каждый склад** в PRD не зафиксировано — если нужна per-warehouse, это изменение продукта (PRD + схема + сервисы).

### 13) `/inventory/physical`
- По PRD это **акты физической инвентаризации / корректировки количества** (`InventoryAdjustment`: излишек/недостача), проводки **731/201** и **201/631**, оценка недостачи по **FIFO** — см. PRD **§4.10** (подраздел про `InventoryAdjustment` и UI **`/inventory/physical`**). Страница должна вести пользователя через создание документа и проведение, а не быть «пустой формой без контекста».

### 14) `/inventory/audits` — пустая модалка «Yeni inventarizasiya»
- По PRD это **сличительная ведомость** **`InventoryAudit`**: жизненный цикл **DRAFT → COUNTING → REVIEW → COMPLETED**, блокировка склада на этапах, классификация расхождений — PRD **§4.10** / строка про **Inventory Reconciliation** в таблице roadmap. Модалка должна как минимум: выбор склада, комментарий, создание черновика (`POST` согласно [TZ.md](TZ.md) §10.1), редирект на карточку/шаг мастера — сейчас это **пробел реализации**, не «намеренно пусто».

### 15) İstehsalat (сырое меню, редирект, PRD)
- PRD **§4.10A**: отдельный раздел **`/manufacturing/*`**, хаб **`/manufacturing`** сейчас в коде **редиректит на `/manufacturing/recipes`** ([`apps/web/app/manufacturing/page.tsx`](apps/web/app/manufacturing/page.tsx)) — отсюда ощущение «первый пункт тупой».
- «Как пользоваться»: BOM/рецепты → выпуск (**release**) → складские движения (списание компонентов / приход ГП) — PRD **§4.10A** и **§4.10.1** (выпуск по `recipeId`).

### 22–24, 26) Периоды в отчётах (2 date picker vs месяц; receivables/aging; cash-flow)
- **Сводный P&L холдинга** и агрегаты по интервалу в PRD завязаны на **интервал дат** и политику **Monthly Slices** (PRD **§1.1**, **§4.12**).
- **Дебиторка / aging** по смыслу — **срез на дату / накопленная задолженность**; отдельный «календарный период продаж» часто **не обязателен**, но «as of date» или «по состоянию на» нужен в UX/контракте API — зафиксировать в PRD/TZ для каждого экрана.
- **`/reports/cash-flow`** — уточнить, тот же ли контур, что **`/treasury/cash-flow`** (прогноз) или отчёт из GL; в плане: прочитать страницу и API, выровнять формулировку периода в PRD.

### 22) «Dövrü bağла» и OSV/P&L на азербайджанском
- **Закрытие периода** — продуктовая функция из PRD **§4.x Period close** (чеклист); кнопка уместна, если отчётный модуль ведёт **закрытые периоды** — иначе перенос в настройки отчётности.
- **OSV / P&L**: в PRD допускаются **локализованные названия отчётов** в UI (как для PDF AZ/RU); в i18n завести **AZ лейблы** (например «Cədvəl balansı», «Mənfəət və zərər») и не смешивать сырой латиницей в заголовках.

### 25) Tax-export и «виджет браузера»
- Нужно уточнение: имеется в виду **браузерное расширение** (отдельный пакет `apps/extension`) для DVX/ƏMAS или **встроенный iframe**? В плане заложить: вынос периода влево / кнопок вправо по вашему ТЗ; виджет расширения — только после уточнения.

### 27–28) Ошибки 500 и амортизация ОС
- **500** на `/hr/analytics` и `/reporting/holding`: в плане — **воспроизвести**, смотреть ответ API (`/api/hr/absences`, `/api/hr/employees`, `/api/holdings/.../consolidated-pnl`) и логи Nest; частая причина — **пустой/неверный JSON**, отсутствие прав, или ошибка сервиса при пустом холдинге.
- **Метод амортизации ОС**: по PRD **§5.D** метод задаётся **на каждом объекте `FixedAsset`** (`depreciationMethod`: STRAIGHT_LINE, REDUCING_BALANCE, UNITS_OF_PRODUCTION…), а не «один раз на компанию»; линейный движок уже описан per-asset.

### 29–30) Mapping vs IFRS mapping
- Кратко: **`/accounting/mapping`** — соответствия/правила в пространстве **NAS** (и связь с операционным учётом); **`/accounting/ifrs-mapping`** — правила **зеркала NAS → IFRS** для автоматических IFRS-проводок (PRD **§4.1** маршруты чарта). В PRD/TZ добавить **1 экран «как читать»** (блок подсказки без лишних внешних ссылок — см. п.29 про удаление строки ссылок).

### 31) Prepaid в меню «Hesablar planı»
- В PRD **уже есть** контур **PrepaidExpense** и UI **`/finance/prepaid-expenses`** (поиск по PRD: «PrepaidExpense»). Меню — вопрос **IA навигации**: логичнее **«Maliyyə» / расходы будущих периодов»**, а не внутрь плана счетов; это правка PRD §навигация + Sidebar.

### XXX) Настройки API банков (ABB, Pasha, Kapital)
- Компонент **[`DirectBankingSection`](apps/web/app/settings/subscription/direct-banking-section.tsx)** вызывает **`GET/PATCH /api/banking/direct-settings`**, но **нигде не импортируется** (поиск по репо — только сам файл). То есть **UI настроек сейчас не выведен на экран**; нужно встроить в **[`apps/web/app/settings/subscription/page.tsx`](apps/web/app/settings/subscription/page.tsx)** (для Owner / при активном banking) или отдельную страницу «Банк / интеграции» с ссылкой из Treasury — и описать в TZ §банк.

### XXX) Разделить Admin и Super-Admin в меню
- Сейчас Super-Admin живёт под **`/super-admin/*`** с гейтом `isSuperAdmin`. План: в [`Sidebar.tsx`](apps/web/components/layout/Sidebar.tsx) две **визуальные группы** (разделитель + подписи i18n): **Tenant admin** (`/settings/...`, и т.д.) и **Platform** (только если `user.isSuperAdmin`). Точный список пунктов — сверка с текущими ссылками в сайдбаре.

---

## План реализации (после утверждения)

### A. Banking / Kassa ([`apps/web/app/(app)/banking/cash/page.tsx`](apps/web/app/(app)/banking/cash/page.tsx))
- Месяц: **`PageHeader`** с **`leading`** + `TOOLBAR_MONTH_INPUT_CLASS` — как на [`/banking`](apps/web/app/banking/page.tsx).
- **Avans**: оставить AZN-подсказку или завести задачу на валюту (PRD).
- **Hesabdar şəxslər**: убрать встроенный блок; кнопка в `PageHeader.actions` (предпоследняя); модалка со списком (существующий overlay-паттерн).

### B. CRM контрагенты
- Найти модалку «Yeni kontragent» (скорее [`apps/web`](apps/web) под `counterparties`): VÖEN — `max-w`/`grid` колонку расширить; **legalForm** и **role** — `<select>` с пустым первым `<option value="">` и состоянием `""` по умолчанию (не отправлять дефолт с сервера до выбора).

### C. Каталог продуктов/услуг + Sales invoice modal
- Модалки товара/услуги/счёта: поле **ƏDV (VAT)** — controlled `value=""` до выбора; валидация submit.
- **Invoice modal**: оболочка `max-h` + **`overflow-y-auto`** на теле строк; таблица строк в scroll-region (как для transfer/receipt модалок).
- **Список счетов** [`/sales/invoices`](apps/web/app/sales/invoices): серверная пагинация — проверить `GET` API; добавить `page`/`pageSize`/`total` при необходимости в Nest + стандартный футер (как [`banking/page.tsx`](apps/web/app/banking/page.tsx)).

### D. Purchases, Inventory hub, movements, balances, transfers, adjustments, receipts, audits, employees
- Единый паттерн футера: `flex justify-between`, `common.pagination*` ([`packages/i18n/src/resources.ts`](packages/i18n/src/resources.ts)), `MODAL_INPUT_CLASS` / `SECONDARY_BUTTON_CLASS`.
- Для каждого списка: если API только `take` — расширить контроллеры **`page`/`pageSize`/`count`** (Nest + Prisma `skip/take`) по аналогии с [`banking.service` listLines](apps/api/src/banking/banking.service.ts).
- **Плейсхолдер пустой таблицы**: `EmptyState` + `CARD_CONTAINER_CLASS` на transfers/adjustments.
- **Модалки** с динамическими строками (invoice lines, internal transfer, receipts): общий wrapper класс из design-system или локально `min-h-0 max-h-[85vh] flex flex-col` + scroll на средней части.

### E. Inventory settings + physical + audits modal
- **FIFO/AVCO**: показать текущее значение из org settings; если в БД только org-level — отобразить так в UI; опционально roadmap per-warehouse в PRD.
- **Physical / audits**: подписи и мастер создания согласно PRD §4.10 / §7.10; модалка аудита — форма создания + вызов существующего API.

### F. İstehsalat
- Заменить голый редирект на **мини-хаб** (карточки: Рецепты, Выпуск, Overhead) в духе DESIGN или оставить редирект, но **убрать дублирующий первый пункт** в Sidebar (первый пункт = хаб без редиректа на второй).
- Пройти формы `/manufacturing/*`: `PageHeader`, `CARD_CONTAINER_CLASS`, `MODAL_FIELD_LABEL_CLASS`, кнопки.

### G. HR: timesheet, analytics, positions, structure
- **Timesheet + hr analytics**: `PageHeader` + **`leading`** с month input **как banking** ([`PageHeader`](apps/web/components/layout/page-header.tsx) + [`TOOLBAR_MONTH_INPUT_CLASS`](apps/web/lib/form-styles.ts)).
- **Analytics 500**: починить API или парсинг ответа `employees` (проверить [`parseHrEmployeesResponse`](apps/web/lib/hr-employees-list.ts) vs фактический JSON).
- **Positions**: `w-full` на viewport таблицы; пагинация; модалка «ştat» — кнопка **+** у «Bölmə» открывает быстрый create department (модалка или ссылка с returnUrl).
- **Structure**: растянуть таблицу (`w-full` / убрать `max-w` родителя).

### H. PSA projects ([`/psa/projects`](apps/web/app/psa/projects))
- Привести к `PageHeader` + карточка списка; форму создания — в **`Dialog`/модалку**; пагинация списка (API + UI).

### I. Reporting + reports/cash-flow + holding 500
- Выровнять тулбары (период слева, действия справа); тексты периодов — зафиксировать в PRD (интервал vs as-of) по каждому отчёту.
- **Holding 500**: исправить backend `HoldingsReportingService` или guard на пустой `holdingId`.
- **OSV/P&L AZ**: ключи i18n.

### J. Fixed assets
- Таблица на всю ширину; month picker как banking; подсказка в UI: метод **per asset** (из PRD §5.D).

### K. Accounting mapping / ifrs-mapping
- Удалить строку хлебных ссылок из контента; добавить короткий **context help** (i18n) по смыслу экрана.

### L. Finance prepaid
- PRD: уточнить размещение в меню; Sidebar: перенести пункт в финансы; таблица `w-full`.

### M. Direct banking visibility + Admin split
- Подключить **`DirectBankingSection`** к настройкам (и/или отдельная страница).
- Sidebar: две секции Admin / Super-Admin.

### N. Документация
- Обновить **[PRD.md](PRD.md)** и **[TZ.md](TZ.md)**: навигация (prepaid, direct banking UI), контракты пагинации для перечисленных списков, разъяснение movements vs transfers, physical vs audits, reporting periods, меню Super-Admin.

---

## Зависимости и риски
- Массовое добавление **server-side pagination** затронет много **API** — лучше единый утилитарный паттерн (DTO `page`/`pageSize`, upper bound 100–200).
- **i18n**: новые строки → `packages/i18n/src/resources.ts` + `npm run i18n:catalog` при изменениях каталога для Super-Admin.
