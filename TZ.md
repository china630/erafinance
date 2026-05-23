# Техническое задание (Т/З): ERA Finance

Единый документ для разработки: объединяет ядро Core MVP, расширения v2, интеграции v3 и слой монетизации v4. Сводные продуктовые решения — **[PRD.md](./PRD.md)** (§12 и др.). Детализация REST — **§0.0** ниже и Swagger API.

**Оглавление (верхний уровень):** **§0.0** — реестр ключевых REST; §0 — статус синхронизации; §1 — инфраструктура (**§1.4** — локальность данных AZ); §2–§10 — модули **1–9**; **§6.0** — Treasury + касса/банк; **§7.0** — HR, табель, payroll, ЦФО; §11 — паттерн разработки (**§11.1** — web: `PageHeader`, сайдбар-only); §12–§14 — дорожные карты; **§13.6** — Browser Extension RPA (ERA Finance Assistant); §15 — Super-Admin; §16–§17 — hardening; **§21** — Dispute & Recovery (платформа); **§22** — Risk & Compliance (ERM); **§23** — Zero-Knowledge encryption & State Identity Escrow (**`FEAT-SEC-CRYPTO-001`**, PLANNED); **§24** — Hybrid limits tier + premium trial gate (**`FEAT-BIL-POSTPAID-001`**, PARTIAL).

**Стандарт статусов (глобально для PRD/TZ):**
- [x] **COMPLETED (scope):** задача реализована и зафиксирована.
- [~] **PARTIAL (scope):** реализована часть объёма; остальное в roadmap.
- [ ] **PLANNED (scope):** запланировано, но ещё не реализовано.

---

### 0.0. Реестр ключевых эндпоинтов (выжимка)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/admin/chart-template` | Глобальный каталог NAS (`ChartOfAccountsEntry`), чтение (super-admin) |
| POST | `/api/admin/chart-template` | Upsert строки каталога NAS (super-admin) |
| PATCH | `/api/admin/chart-template/:id` | Частичное обновление строки NAS (поля `kind`/`code` неизменны) |
| GET | `/api/admin/system-config` | Платформенный whitelist `SystemConfig` (super-admin Data hub) |
| PUT | `/api/admin/system-config/:key` | Upsert значения ключа из whitelist |
| POST | `/api/admin/system-config/:key/reset` | Удалить строку из БД → действует встроенный дефолт |
| GET / POST / PATCH | `/api/admin/currencies` | Мастер валют; мутации без hard-delete (`PATCH isActive`) |
| GET / POST / PATCH | `/api/admin/units-of-measure` | Каталог UoM |
| GET / POST / PATCH | `/api/admin/tax-rates` | Ставки налогов |
| GET / POST / PATCH | `/api/admin/template-accounts` | Глобальные NAS template accounts |
| GET | `/api/admin/mdm/companies` | `GlobalCompanyDirectory` (read-only, пагинация) |
| GET | `/api/admin/mdm/counterparties` | `GlobalCounterparty` (read-only, пагинация) |
| GET | `/api/admin/reference/snapshot` | Снимок enum / контрактных whitelist для прозрачности |
| PATCH | `/api/admin/translations/:id` | Текст и/или `isActive` у `TranslationOverride` (soft-disable вместо DELETE) |
| GET | `/api/admin/customs-tariff-rates` | Таможенные ставки; `?includeInactive=1` — вместе с `deletedAt` |
| POST | `/api/admin/customs-tariff-rates` | Upsert строки тарифа (ключ **`hsCode` + `effectiveFrom`**) — см. §20.2 |
| POST | `/api/admin/customs-tariff-rates/:id/deactivate` | Soft-delete (`deletedAt`) |
| POST | `/api/admin/customs-tariff-rates/:id/restore` | Снять soft-delete |
| GET | `/api/accounts/templates` | Глобальный NAS (`TemplateAccount`): счета, которых ещё нет в плане текущей организации; query `search`, опционально **`kind`** (`COMMERCIAL`\|`BUDGET`\|`NGO`, по умолчанию = **`organizations.kind`** активной org), `locale` |
| POST | `/api/accounts/import-from-template` | Импорт NAS-счёта из шаблона: body `{ templateAccountId }`; роли OWNER/ADMIN/ACCOUNTANT |
| POST | `/api/organizations` | Создание организации (JWT), эквивалент `POST /api/auth/organizations`; body: **`legalForm`** (`CounterpartyLegalForm`) |
| GET | `/api/system/currencies` | Активные валюты (`Currency`) для UI |
| GET | `/api/system/invoice-vat-rates` | Допустимые ставки ƏDV для строк счёта/номенклатуры (`tax_rates`, VAT) |
| GET | `/api/system/team-assignable-roles` | Роли, доступные для приглашения в организацию |
| GET | `/api/system/inventory-movement-enums` | Списки `StockMovementType` и `StockMovementReason` (как в Prisma) для складских фильтров и согласованности UI |
| GET/POST/* | `/api/billing/*` | Контур биллинга организации: доступ **только** для роли `OWNER` (не-owner роли получают `403`) |
| POST | `/api/billing/webhooks/:provider` | Webhook платёжного провайдера (`mock`, `pasha`, `pasha_bank`), публичный маршрут |
| GET / POST | `/api/integrations/drakaris/v1/client/:id`, `/payments` | Drakaris/yığım inbound API: Basic Auth, конверт `{status,description,data}`, status-коды 200/401/402/404/405/406/407/408 (см. §14.8.14) |
| GET / PATCH | `/api/users/me` | Self-service профиль текущего пользователя: PII (cipher), `phone` (E.164 +994), `locale` (`AZ`\|`RU`), смена пароля (см. §2.2) |
| GET | `/api/reports/cash-flow` | ДДС прямой метод (`CashFlowService.getDirectCashFlow`), query: `dateFrom`, `dateTo`, опц. `cashDeskId`, `bankName` |
| GET / PATCH | `/api/banking/direct-settings` | Просмотр (masked) и обновление REST/Open Banking direct sync в `Organization.settings.bankingDirect`; веб-UI — блок **`DirectBankingPanel`** на **`/settings/bank-accounts`** (модуль **`cash_bank_pro`**; см. **§6.0**). |
| GET | `/api/hr/payroll/jobs/:jobId` | Статус фоновой задачи расчёта ЗП (BullMQ) |
| GET | `/api/notifications` | Список in-app уведомлений текущего пользователя: пагинация (`page`, `pageSize`), фильтр `unreadOnly` |
| GET | `/api/notifications/unread-count` | Количество непрочитанных (бейдж в шапке) |
| PATCH | `/api/notifications/read-all` | Пометить все уведомления пользователя прочитанными |
| PATCH | `/api/notifications/:id/read` | Пометить одно уведомление прочитанным |
| POST | `/api/admin/platform/step-up/otp/request` | Super-admin: email OTP для step-up (`purpose`, см. §21) |
| POST | `/api/admin/platform/step-up/otp/verify` | Super-admin: проверка OTP → краткоживущий `X-StepUp-Token` |
| POST | `/api/admin/platform/dual-approval` | Super-admin: создать `DualApprovalRequest` |
| POST | `/api/admin/platform/dual-approval/:id/approve` | Super-admin: второй approver → `APPROVED` |
| POST | `/api/public/disputes/:id/counter-claim` | Публично: контр-заявление по JWT из ссылки (§21.4) |
| GET | `/api/public/pricing` | Публичный read-only снимок прайс-листа (Foundation, модули, пакеты, квоты tier, годовая скидка, unit pricing, OCR); без JWT — см. **§15.3.1** |
| GET | `/api/public/landing-modules` | Публичные карточки маркетингового лендинга (AZ/RU JSON); без JWT — см. **§15.3.2** |
| GET | `/api/admin/landing-modules` | Super-admin: список `LandingModuleMarketing` |
| PATCH | `/api/admin/landing-modules/:moduleSlug` | Super-admin: обновление текстов карточки (audit на PATCH) |
| GET | `/api/compliance/risk-summary` | ERM: сводка posture + счётчики **PENDING** (`compliance_pro` / ENTERPRISE) — см. **§22** |
| GET | `/api/compliance/risk-audits` | ERM: список **`RiskAudit`** (фильтры `status`/`type`, пагинация) |
| PATCH | `/api/compliance/risk-audits/:id` | ERM: смена статуса **MITIGATED** / **IGNORED** + опционально `mitigationNote` |

Полный перечень — OpenAPI `/api`. См. также `/api/treasury/*`, `POST /api/banking/manual-entry`, `POST /api/banking/transfers`, `POST /api/banking/conversions`, `POST /api/banking/cash-deposits`, `GET /api/holdings/:id/consolidated-pnl`, `GET /api/reporting/pl?departmentId=…`.

#### 0.0.1. In-app уведомления (`Notification`)

**Модель (Prisma, `packages/database/prisma/schema.prisma`):**

| Поле | Тип | Назначение |
|------|-----|------------|
| `id` | UUID, PK | Идентификатор записи |
| `userId` | FK → `User` | Получатель |
| `organizationId` | FK → `Organization`, nullable | Контекст тенанта; `null` зарезервировано под платформенные сообщения (MVP — обычно заполнено) |
| `title` | String | Короткий заголовок |
| `message` | Text | Текст уведомления |
| `severity` | Enum `INFO` \| `WARNING` \| `CRITICAL` | Уровень важности (UI и приоритизация) |
| `link` | String, optional | Относительный URL для перехода по клику (например `/payroll?registryId=…`) |
| `isRead` | Boolean, default false | Прочитано |
| `createdAt` | DateTime, default now | Время создания |

**`NotificationService` (`apps/api/src/notifications/notification.service.ts`):** не экспонирует отдельный публичный «create»-REST для произвольных клиентов; запись уведомлений выполняется **только на сервере** — метод **`createNotification(...)`** (один получатель) и вспомогательные сценарии (например **`notifyFinanceUsers`** для ролей OWNER/ACCOUNTANT). Вызывается из **cron** (например напоминание биллинга **§14.8.9**), **BullMQ workers** по завершении/ошибке задачи и **доменных сервисов** (например payroll после **PAID** реестра). Пользовательский контур — только чтение и пометка прочитанным через **`NotificationController`** (`/api/notifications`).

---

## 0. Синхронизация с PRD

Таблица **§0.0** отражает актуальные контракты **v25.2** (добавлены tenant-эндпоинты **`/api/compliance/*`** для ERM). Расширенное описание модулей — разделы **§2–§10**, **§6.0**, **§7.0**; продуктовые формулировки — **PRD §4.12**, **§4.13**, **§5.1**.

---

## 1. Инфраструктура и стек (MVP)

| Компонент | Решение |
|-----------|---------|
| **Хостинг** | Один VPS; оркестрация — **Docker Compose** |
| **БД** | PostgreSQL + расширение `uuid-ossp` |
| **Кэш / очереди** | **Redis** + **BullMQ**: расчёт ЗП, импорт выписок, прочие долгие задачи — **вне** HTTP-запроса API |
| **Файлы (PDF, логотипы)** | **`STORAGE_SERVICE`**: в **production** ожидается **`STORAGE_DRIVER=s3`** и переменные **`S3_*`**; локально — **`STORAGE_DRIVER=local`** + `STORAGE_LOCAL_ROOT` (см. PRD §11.0) |
| **Почта** | **Nodemailer (SMTP)** — счета, сброс пароля |
| **Monorepo** | `apps/web` (Next.js), `apps/api` (NestJS), `packages/database` (Prisma и общие типы при необходимости) |
| **Локаль** | БД: **UTC**; UI: **i18next** (**RU** и **AZ**); при неопределённом коде языка — **`az`**; форматирование дат и **AZN** — по правилам продукта (часто локаль Азербайджана); детали — §17 |
| **Локальная инфра (Windows)** | Тома Docker, загрузки API, **npm-кэш**, **TEMP/TMP** — только **D:** (`D:\DockerData\erafinance_erp`); корневой `.npmrc`. Образы Docker — **Disk image location** на D в Docker Desktop |

**Production HTTPS requirement (hardening):**

- Production environment **must use HTTPS** for the web origin.
- Rationale: parts of the frontend rely on **WebCrypto** capabilities that may be restricted in insecure contexts (plain HTTP), and browsers can degrade/disable APIs and increase fetch instability under mixed/insecure conditions.
- Development exception: `http://localhost` is allowed.

### 1.1. Архитектура холдинга: консолидация валют (Reporting Aggregator)

**Maintenance mode (admin runbook) — before Prisma deploy migrations (PRD §10.0 / TZ §1):**

Цель: перед `prisma migrate deploy` временно отключить UI (и при необходимости API) понятной заглушкой, чтобы пользователи не работали в полусостоянии во время деплоя.

- **Caddy / app-level (рекомендуется для типового Compose-деплоя)**
  - В `.env`: `MAINTENANCE_MODE=1`
  - Применить: `docker compose -f docker-compose.prod.yml up -d web`
  - Выключить: убрать/обнулить `MAINTENANCE_MODE`, затем снова `up -d web`.

- **Nginx (UI boundary, альтернативный вариант)**
  - Положить страницу: `docs/maintenance.html` → `/var/www/html/maintenance.html`
  - Подключить сниппет: `docs/nginx-maintenance.conf` (возвращает **503** если существует `/var/www/html/maintenance.enable`)
  - Включить режим обслуживания:

    ```bash
    sudo touch /var/www/html/maintenance.enable
    sudo nginx -t && sudo systemctl reload nginx
    ```

  - Выключить режим обслуживания:

    ```bash
    sudo rm -f /var/www/html/maintenance.enable
    sudo nginx -t && sudo systemctl reload nginx
    ```

- **Deploy flow (recommended)**
  - Enable maintenance (см. выше)
  - Apply DB migrations:

    ```bash
    docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
    ```

  - Optional platform init:

    ```bash
    docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
    ```

  - Disable maintenance

**Сводный P&L по холдингу за период** (`HoldingsReportingService.consolidatedProfitAndLoss`): реализовано **помесячной нарезкой периода** (UTC, `accrualMonthSlices` в `reporting-period.util.ts`). Для каждого фрагмента вызывается `ReportingService.profitAndLoss(org, from, to)`, затем **`CurrencyConverterService.convert(netProfit, orgCurrency, holdingBase, fxAsOf)`** с **`fxAsOf` = последний день фрагмента**. Результаты по фрагментам **суммируются**. Это и есть продуктовый стандарт **Monthly Slices** (PRD §1.1).


**`CurrencyConverterService.convert`** — точечная конвертация на дату `asOf` (кросс через AZN); для «историчности» по длинному периоду используется **внешний** цикл по фрагментам (см. выше), а не один вызов на `dateTo`.

**Дашборд cash/bank** по холдингу (`getHoldingSummary`): конвертация остатков на **одну** дату `asOf` — отдельно от политики P&L.

**Holding balances aggregator (v2026.04.11):** `HoldingsReportingService.getHoldingBalancesSummary(holdingId)` собирает последние банковские остатки по всем организациям холдинга (через слой синхронизации провайдеров) и конвертирует суммы в базовую валюту холдинга через `CurrencyConverterService`.

**Holding dashboard UI (v2026.04.11):** `/holding/[id]/dashboard` отображает:
- `Cash & Bank across Holding` (pie by organization + total in base currency),
- `Tax Risk Monitor` по контрагентам с флагом `isRiskyTaxpayer`,
- ручной trigger `POST /api/holdings/:id/sync-bank-balances` для постановки BullMQ задачи `sync-bank-balances`.

**Источник курсов:** `cbar_official_rates`, `CbarFxService`.

### 1.4. Локальность данных (Азербайджан) — статус и комплаенс

**Статус (product / ops):** production-развёртывание **по умолчанию** ориентировано на **хостинг в юрисдикции, согласованной с заказчиком**; для типового B2B SMB в Азербайджане — **AZ-first**: вычислительные узлы (API, web, workers), **PostgreSQL** и **Redis** в регионе **EU/Frankfurt** или **EU/Amsterdam** (DigitalOcean / аналог) с **VPC-only** доступом БД/кэша (см. **§1.6**), объекты в **S3-совместимом** хранилище с **Object Lock** для evidence (PRD §7.13, §10.0).

**Данные клиента (tenant):** первичное хранение **в выбранном регионе**; резервные копии и cross-region replication — только по **явной** политике заказчика и договору (RPO/RTO — §21.2.1). Персональные/налоговые идентификаторы (**VÖEN**, PII) — **at-rest encryption** + blind index (TZ §2, §16).

**Регуляторные ожидания:** продукт **не заменяет** юридическую квалификацию хранения персональных данных; при требовании **100% AZ-only** инфраструктуры — отдельный **deployment profile** (выделенные VM/DB в AZ DC, без EU egress для primary OLTP) фиксируется в **приложении к договору** и runbook деплоя.

### 1.5. Очереди и Background Jobs

- **Обязательный стандарт:** BullMQ + Redis для всех тяжёлых и массовых задач (Payroll, bulk-операции по инвойсам, пересчёты COGS, импорты/синхронизации).
- **Ролевая архитектура узлов:** инстансы разделяются на:
  - **API-nodes** — принимают HTTP/WebSocket, валидируют вход, ставят задачи в очередь, возвращают `jobId`.
  - **Worker-nodes** — исполняют фоновые задачи из очередей, не обрабатывают пользовательские HTTP-запросы.
- **SLO Async-First:** операции с ожидаемой CPU-нагрузкой >500 мс не выполняются синхронно в request/response контуре.
- **Массовый импорт холдингов:** загрузка Excel/JSON дампов (в т.ч. 1С-маппинг) должна поддерживать пакетный запуск миграций для 20–30 компаний одновременно через BullMQ (partition by organization/import session).
- **IBAN validation pipeline:** при импорте и ручном вводе реквизитов действует проверка формата AZ и алгоритм контрольной суммы **MOD-97**; невалидные строки уходят в reject-отчёт импорта.

### 1.6. Сетевой регламент (DigitalOcean VPC)

- Внутренний трафик между App/API/Workers, Redis и PostgreSQL должен проходить **только через Private Networking** (VPC/private interface).
- Публичный ingress допускается только для edge-слоя (reverse proxy / web entrypoint); Redis и PostgreSQL не публикуются во внешний интернет.
- Для production-топологии обязателен контроль security group/firewall правил, исключающий доступ к Redis/DB с public IP.

### 1.7. Режим «Thundering Herd»

- Для очередей задач использовать **Managed Redis** (или эквивалент managed deployment) с политикой памяти **`noeviction`**.
- Запрещены eviction-политики, способные удалять ключи очередей/lock-ключи BullMQ при пиковых нагрузках.
- При приближении к лимитам памяти — горизонтальное масштабирование Redis и/или ограничение producer-rate до восстановления нормального headroom.
- Для внешних интеграций (Pasha/ABB/Birbank/IBAN/e-taxes) действует **Circuit Breaker**: при `>3` подряд `5xx` цепь размыкается на `5 минут`, после чего разрешается повторный probe.
- Для write-операций интеграций обязателен **Idempotency Key** (manual sync, payment drafts), чтобы повторный одинаковый запрос не создавал дубликаты.
- Retry-политика должна использовать **Exponential Backoff** для transient-сбоев (`429/5xx` и сетевые ошибки) с ограничением числа попыток.
- Integration Health API `GET /api/integrations/health` (Owner-only) обязан отдавать по провайдеру: `lastSync`, `latencyMs`, `currentStatus`, `providerSuccessRate`, `cacheHitRate`; UI-маршрут `/admin/integrations/health` остаётся скрытым из стандартной навигации.

#### 1.7.1. AI Portal Monitoring (PLANNED, v-next)

**Статус:** только roadmap.

**Идея:** после аутентификации через **ASAN İmza** на порталах **e-taxes**, **ƏMAS**, **DGX** выполнять **периодический снимок DOM/layout** и сравнение (например через **Gemini**) для раннего обнаружения изменений вёрстки, влияющих на RPA/браузерное расширение. Реализация вне текущего обязательного скоупа API; см. [PRD.md](./PRD.md) §7.6.3.

---

## 2. Модуль 1: Identity & Access Management (IAM) & Multi-tenancy

### Цель

Создать безопасную среду, где данные разных компаний никогда не пересекаются.

### Модель тенанта

- **1 tenant = 1 юрлицо (один VÖEN).** Пользователь с несколькими компаниями состоит в нескольких организациях (связь **many-to-many** через membership).
- **Premium / RPA entrypoints** (`tax_pro`, `trade_pro` и др. по матрице продукта): перед запуском сценариев, завязанных на VÖEN и внешние порталы, API **обязан** убедиться, что у организации заполнен **`taxIdBlindIndex`** (уникальный guard на БД), что расшифрованный VÖEN проходит **валидацию формата и контрольной суммы** (10 цифр, правила как в `stdnum.az.voen`), что нет **открытого high-severity** сигнала в **`risk_audits`** (`PENDING` + `HIGH` для типов **FRAUD** / **COMPLIANCE**); при нарушении — **403** с локализованным телом (`message` + `messageAz` + `messageRu`, выбор основного `message` по `Accept-Language`) — **`VoenIntegrityGuard`**.
- В сущности **Organization** сразу завести поле **`subscriptionPlan`**; лимиты тарифов в MVP **не хардкодить** (детализация подписок — §14).

### 2.1. Рефакторинг на Many-to-Many (схема и auth)

**Prisma**

- **User:** без `organizationId` на уровне пользователя; профиль: `fullName`, `avatarUrl` (и т.п.). Дополнительные поля self-service профиля (см. **§2.2**): **`phone`** (`String?`, формат **E.164 +994XXXXXXXXX**, валидируется в DTO) и **`locale`** (**enum `UserLocale` ∈ { `AZ`, `RU` }**, default **`AZ`**) — определяют язык бандла Next.js при следующем входе/`refreshSession`. PII имени остаётся в `firstNameCipher` / `lastNameCipher`.
- **OrganizationMembership:** связь `{ userId, organizationId, role, joinedAt }`, составной PK `(userId, organizationId)`.
- **AccessRequest:** запрос на вступление в существующую организацию по VÖEN (статусы ожидания / принят / отклонён).
- **OrganizationInvite:** приглашение по email в организацию (в т.ч. для пользователя, который ещё не зарегистрирован — доставка письмом; если пользователь уже есть — видит приглашение в кабинете).

**Бизнес-логика и API**

1. **`POST /api/auth/login`** — в ответе **accessToken** (контекст первой/выбранной организации в JWT) и **список доступных организаций** (`organizations`).
2. **`POST /api/auth/switch`** — тело `{ organizationId }`; выдаётся новая пара токенов, в access JWT «вшит» выбранный `organizationId` при валидном membership.
3. **Guards:** из JWT читаются `organizationId` и роль; перед обработкой запроса проверяется наличие строки в **OrganizationMembership**.
4. **Join по VÖEN:** если организация найдена, создаётся **AccessRequest**; владелец/админ одобряет или отклоняет, при одобрении назначается роль.
5. **Register anti-duplication:** `POST /api/auth/register` перед созданием tenant проверяет отсутствие организации с тем же VÖEN через `tax_id_blind_index`, нормализуя вход (`trim`). На уровне БД действует `UNIQUE`-индекс `organizations_tax_id_blind_index_key`; при гонке Prisma `P2002` конвертируется в `409 Conflict` с сообщением `VÖEN already registered`.
6. **Encryption-at-rest (stage 1):** для организаций используется cipher/blind схема (`tax_id_cipher`, `tax_id_blind_index`), plaintext-колонка `organizations.tax_id` удалена после cutover wave-6c. Чтение/выгрузки VÖEN в API выполняются через decrypt `tax_id_cipher`.
7. **Encryption-at-rest (stage 2):** для VÖEN организаций включён DB-level unique guard `organizations_tax_id_blind_index_key` (`UNIQUE WHERE tax_id_blind_index IS NOT NULL`), ошибки `P2002` по этому индексу маппятся в `409 Conflict: VÖEN already registered`.
8. **Encryption-at-rest (stage 3):** добавлены encrypted/blind поля для PII в `employees` (`fin_code_*`, `voen_*`, `first_name_cipher`, `last_name_cipher`), `counterparties` (`tax_id_*`, `name_cipher`) и `users` (`first_name_cipher`, `last_name_cipher`, `full_name_cipher`). В create/update flow (`EmployeesService`, `CounterpartiesController`/`CounterpartiesService`, `AuthService`) plaintext-колонки заполняются только детерминированными `__enc__*` placeholders, а реальные значения пишутся в cipher/index. Для uniqueness подключены DB guards `employees_org_fin_blind_uidx` и `counterparties_org_tax_blind_uidx`; backfill: `npm run db:migrate:pii-stage3`.
9. **Encryption-at-rest (stage 4 / auth & dedupe cutover):** в lookup/auth-потоках (`register`, `createOrganizationForExistingUser`, `requestJoinByTaxId`) поиск организации по VÖEN выполняется только по `tax_id_blind_index` (без fallback на plaintext `tax_id`). В контрагентах проверка дублей при create/update и attach-flow тоже переведена на `tax_id_blind_index`; partial-поиск в UI остаётся смешанным до отдельного фронтового cutover шага.
10. **Cutover readiness audit:** добавлен контроль `npm run db:audit:pii-cutover`, который проверяет отсутствие NULL в encrypted/blind колонках по `organizations`, `employees`, `counterparties`, `users` и блокирует завершение cutover при незаполненных данных.
11. **PII read fallback (pre-drop safety):** в Prisma добавлено расширение `prismaPiiReadFallbackExtension`, которое при чтении (`find*`, `create/update/upsert` с return) восстанавливает plaintext-поля из cipher-полей (`taxId`, `firstName`, `lastName`, `fullName`, `finCode`, `voen`, `name`) если plaintext пустой/null; `fullName` дополнительно собирается из `firstName + lastName` для обратной совместимости API-контрактов. Это позволяет поэтапно убирать plaintext-колонки без мгновенного рефакторинга всех read-path.
12. **Plaintext nullify (phase 1):** добавлен скрипт `npm run db:nullify:pii-plaintext:phase1` как исторический pre-drop этап для nullable plaintext-полей с подтверждённым cipher mirror (на текущем этапе users/employee nullable plaintext уже удалены в последующих wave).
13. **Plaintext nullify (phase 2):** для non-null plaintext колонок применена санитизация в non-PII placeholders (`__enc__*`) при наличии cipher/index mirror: `employees.fin_code/first_name/last_name`, `counterparties.tax_id/name` (organization plaintext удалён в wave-6c).
14. **Plaintext remaining audit:** отчёт `npm run db:audit:pii-plaintext` считает **risk-plaintext** по оставшимся legacy plaintext-колонкам сотрудников (`employees.fin_code/first_name/last_name`).
15. **Pre-drop guard:** добавлен обязательный gate `npm run db:assert:pii-plaintext-zero`, который завершает процесс с ошибкой при любом `risk-plaintext > 0`. Используется как блокирующий шаг перед drop-миграциями plaintext колонок.
16. **DB placeholder guards (transitional):** SQL `CHECK`-ограничения применялись на legacy plaintext-колонки во время cutover; после drop-waves (`users`, `counterparties`, `organizations.tax_id`) соответствующие ограничения сняты вместе с колонками.
17. **Drop wave 1 (indexes/constraints):** удалены legacy DB-зависимости от plaintext-поиска (`employees.organization_id + fin_code` unique, `counterparties.organization_id + tax_id` index). Для dedupe/lookup остаются blind-index ограничения (`employees_org_fin_blind_uidx`, `counterparties_org_tax_blind_uidx`).
18. **Drop wave 2 (column):** удалена plaintext-колонка `users.full_name`; запись больше не ведётся, а обратная совместимость ответа API поддерживается вычислением `fullName` из расшифрованных name-cipher полей.
19. **Drop wave 3 (columns):** удалены plaintext-колонки `users.first_name` и `users.last_name`; runtime читает ФИО только из `first_name_cipher` / `last_name_cipher` (с вычислением `fullName` в API-ответах).
20. **Drop wave 4 (column):** удалена plaintext-колонка `employees.voen`; для CONTRACTOR используется только `voen_cipher` / `voen_blind_index`, экспорт и API-чтение берут значение через дешифрование cipher-поля.
16. **Invite lifecycle (v95+):** `inviteUser(email, role)` создаёт запись приглашения, генерирует invite token и отправляет email со ссылкой принятия; `accept` создаёт membership по токену/идентификатору инвайта; `revoke` переводит pending-invite в отклонённый статус и блокирует дальнейшее принятие. **Безопасность (M1):** просроченный JWT приглашения отклоняется отдельным сообщением от «невалидного» токена; принятие инвайта **атомарно** резервирует строку (`UPDATE … WHERE status=PENDING`), повторное использование ссылки даёт **`409 Conflict`**; дубликат membership (`P2002`) трактуется как конфликт («уже участник организации»), в т.ч. при гонках между несколькими организациями/сессиями.

### 2.2. Self-service профиль пользователя (`/api/users/me`, v2026.06)

- **`GET /api/users/me`** дополнительно возвращает **`emailVerifiedAt: string | null`** (ISO-8601) — время подтверждения e-mail (**`users.email_verified_at`**); `null` — смена e-mail разрешена.
- **`PATCH /api/users/me`:** если у пользователя **`emailVerifiedAt != null`** и в теле передан **`email`**, отличный от текущего (после нормализации), ответ **`409 Conflict`** с телом **`{ code: "EMAIL_VERIFIED_LOCKED", message: "..." }`** — самообслуживание не меняет подтверждённый адрес.

Контур редактирования собственных данных пользователя — отдельный от настроек организации (см. PRD §4.1). Размещается в **`AuthModule`**: контроллер **`apps/api/src/auth/users.controller.ts`**, сервисный метод **`AuthService.updateMe(userId, dto)`**. Все мутации — внутри одной **`prisma.$transaction`**; глобальный **`AuditMutationInterceptor`** покрывает `PATCH` автоматически.

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/users/me` | Возвращает текущий профиль: `id`, `email`, `emailVerifiedAt` (ISO или `null`), расшифрованные `firstName` / `lastName` / `fullName`, `avatarUrl`, `phone`, `locale`. Используется фронтом в `refreshSession`. |
| PATCH | `/api/users/me` | Частичное обновление профиля; глобальный `Throttle` (по умолчанию `30 / 60s`). При **`emailVerifiedAt != null`** смена **`email`** → **`409 Conflict`**, код **`EMAIL_VERIFIED_LOCKED`**. |

**`UpdateMeDto`** (`apps/api/src/auth/dto/update-me.dto.ts`):

- `firstName?: string` (`@IsString @MaxLength(80)`); нормализация и `encryptText` через существующие хелперы из `auth.service.ts` (PII-cipher).
- `lastName?: string` — аналогично.
- `email?: string` (`@IsEmail`) — при изменении проверяется уникальность; конфликт → **`409 Conflict`**. Если **`emailVerifiedAt`** у пользователя задан — смена e-mail через PATCH запрещена (**`EMAIL_VERIFIED_LOCKED`**).
- `phone?: string | null` (`@IsString @MaxLength(20)`); при `null` / пустой строке поле очищается; формат **E.164 `+994XXXXXXXXX`** (валидация на сервере; `Compliance` AZ).
- `locale?: UserLocale` (`@IsEnum`); допустимы только `AZ` и `RU`; влияет на бандл Next.js при следующем входе/`refreshSession`.
- `passwordChange?: { currentPassword, newPassword (MinLength 8) }` (`@ValidateNested`): сервер делает `bcrypt.compare(currentPassword, user.passwordHash)`; на ок — `bcrypt.hash(newPassword, 10)`. Неверный текущий пароль → **`400 Bad Request`** с кодом **`INVALID_CURRENT_PASSWORD`** без подсказок (anti-enumeration).

**Контракт ответа `auth/me`:** функции `toPublicUser` / `toPublicUserNoOrg` в `auth.service.ts` дополнены полями `phone` и `locale`, чтобы **`GET /api/auth/me`** (используется веб-клиентом для `refreshSession`) возвращал актуальный профиль без отдельного раунд-трипа.

**Web (`apps/web/app/settings/profile/page.tsx`):** отдельная страница «Профиль» на боковой навигации; **две карточки** `CARD_CONTAINER_CLASS` (персональные данные и смена пароля); инпуты по DESIGN.md. На submit — `apiFetch('/api/users/me', PATCH)`; на успех — `useAuth().refreshSession()` + при изменении локали `i18n.changeLanguage(newLocale)`. Тип `AuthUser` в `apps/web/lib/auth-context.tsx` дополнен опциональными `phone?` и `locale?`.

### Система ролей (RBAC)

| Роль | Права |
|------|--------|
| **OWNER** | Полный доступ, управление подпиской |
| **ADMIN** | Управление пользователями и настройками |
| **ACCOUNTANT** | Доступ к финансам и отчётам |
| **DIRECTOR** | Директор юрлица: чтение ключевой финотчётности (P&L, ДДС, баланс, дебиторка) в рамках одной организации; участие в согласованиях по политике; без владения подпиской |
| **USER** | Ограниченный доступ (только свои документы) |
| **PROCUREMENT** | Создание закупочных документов, операции склада, создание черновиков оплат (KXO/Bank Draft) **без права Post/Approve** |
| **AUDITOR** | Глобальный Read-Only: просмотр Ledger, Payroll, AuditLog и отчётов без права создавать/изменять данные |
| **WAREHOUSE_KEEPER** | Доступ только к M9 (Inventory) и M9.1 (Manufacturing); без доступа к финансам и зарплатам |
| **HR_OFFICER** | Доступ к карточкам сотрудников и табелю; без доступа к главной книге (Ledger) и финансовым проводкам |
| **HR_MANAGER** | Кадровый контур (сотрудники, absences, timesheet) без доступа к денежным payroll-endpoints, реестрам выплат и tax financial data |
| **DEPARTMENT_HEAD** | Row-level доступ к absences/timesheet только по сотрудникам своего департамента; approve табеля в рамках department scope |

**Разграничение PROCUREMENT vs ACCOUNTANT (Post/Approve policy):**

- `PROCUREMENT` может подготавливать первичные документы и черновики оплат, но не имеет права `Post/Approve` финансовые операции.
- `ACCOUNTANT` сохраняет исключительное право на `Post/Approve` и фиксацию проводок в Ledger.

### 2.0. RBAC enforcement updates (Bridge Sprint P1/P2)

- **Inventory reconciliation:** любые мутации (`POST`, `PATCH`) по **`/api/inventory/reconciliations/*`** и **`/api/inventory/audits/*`** разрешены только **`OWNER`**, **`ADMIN`**, **`ACCOUNTANT`**; роль **`PROCUREMENT`** и ниже получают **`403`**. Чтение списка и карточки (`GET`) — у любого авторизованного пользователя организации (отдельный `RolesGuard` на эти маршруты не навешан).
- **AUDITOR Read-Only:** роль `AUDITOR` имеет доступ к чтению (включая `AuditLog`), но любые HTTP-мутации (`POST`, `PATCH`, `PUT`, `DELETE`) глобально блокируются через `AuditorMutationGuard` с ответом `403`.

### Безопасность

- **Middleware (NestJS):** инъекция `organizationId` из JWT в каждый запрос.
- **Глобальный фильтр в Prisma:** все запросы `findMany`, `findUnique` должны включать `where: { organizationId }`.
- **Auth:** Access Token (JWT), срок жизни по умолчанию **12h** (`JWT_ACCESS_EXPIRES` в корневом `.env`); Refresh Token — в **HttpOnly Cookie** (`JWT_REFRESH_EXPIRES`, по умолчанию 7d).

### Validation Strict Mode (v5.8) — синхронно с §17

- Глобальный `ValidationPipe` в `main.ts`: `whitelist: true`, **`forbidNonWhitelisted: true`**, `transform: true` (см. **§17** — та же формулировка для RC). Поля тела запроса, не описанные в DTO (`class-validator`), приводят к ответу **400 Bad Request** (а не молчаливому отбрасыванию).

### Policy Guard (v5.8, CASL-like)

- Для детализации ролей **Accountant** и **User** в финансовых документах используются явные проверки политик (например модуль `auth/policies`): мутации инвойсов в статусе **PAID** и ручные проводки журнала недоступны роли **User**, где это зафиксировано в [PRD.md](./PRD.md) §7.9; критичные эндпоинты дополнительно защищаются **RolesGuard** / `@Roles(...)`.

### Сырой SQL и изоляция тенанта

- При использовании **`$queryRaw`** / **`$executeRaw`** в запросах к данным организации вручную добавлять условие по **`organizationId`** (или параметризованный эквивалент), чтобы исключить пересечение тенантов.
- **Реализация (v23.0):** в API доступен **`TenantPrismaRawService`** (`$queryRaw` / `$executeRaw` / `*Tx`) — **обязательный аргумент `organizationId`** на уровне вызова; SQL собирается через `Prisma.sql` и должен связывать этот идентификатор. DDL и платформенный SQL без тенанта — только через **`executePlatformRawUnsafe`** в пакете `@erafinance/database` (скрипты вроде `prod-init.ts`), не через tenant-обёртку.

**Неизменяемый журнал аудита (продуктовый модуль 8)** — требования к `AuditMutationInterceptor`, полям `AuditLog` и архиву: **§9**.

---

## 3. Модуль 2: Ledger & Finance Core

### Цель

Обеспечить математическую точность учёта (финансовый движок double-entry).

### План счетов (Chart of Accounts / Accounts)

- Иерархическая структура — дерево счетов (self-relation в БД).
- Типы: Asset, Liability, Equity, Revenue, Expense.
- **Многоязычные наименования (v2026.04.22):** у **`Account`**, **`ChartOfAccountsEntry`** и **`TemplateAccount`** хранятся **`name_az`**, **`name_ru`**, **`name_en`**; отображаемое имя — по локали (`GET /api/accounts?locale=…`, **`Accept-Language`**).
- **Архитектура «Global → Local»:** эталонный NAS платформы — таблица **`TemplateAccount`** с полем **`kind: OrganizationKind`** и **`@@unique([kind, code])`** (коды могут совпадать между видами плана с разным смыслом). В организацию при онбординге копируются строки с тем же **`kind`**, что у **`organizations.kind`**. Локальные счета — **`Account`**; опциональная связь **`templateAccountId`**.
- **Legacy:** **`ChartOfAccountsEntry`** + super-admin UI остаются; при **пустом** наборе **`template_accounts`** для данного **`kind`** онбординг использует **`syncChartForOrganization`** (загрузка JSON каталога + сид каталога в БД при необходимости).
- **Seeding:** `prisma db seed` вызывает **`upsertGlobalNasTemplateAccounts`**; отдельно: **`npm run db:seed:nas-templates --workspace=@erafinance/database`** (`prisma/scripts/seed-nas-accounts.ts`). Канон — **`loadChartJson(kind)`** и JSON **`prisma/catalog/national/chart-of-accounts-{commercial|budget|ngo}.json`**.
- **Smart Seeding (vClean ERP):** `prisma/seed.ts` использует модульный раннер `packages/database/prisma/seeds/_engine/runner.ts` с флагами `--layers`, `--skip`, `--only`, `--dry-run`, `--region` (`SEED_REGION`, default `AZ`).
- **Layer scripts:** `db:seed:core`, `db:seed:national`, `db:seed:hr`, `db:seed:bank`, `db:seed:trade`, `db:seed:geo`, `db:seed:placeholders`.
- **Currency/UoM hardening:** currency columns переведены на FK к `currencies(code)`; UoM поля нормализованы в `unit_of_measure_code` (FK к `units_of_measure(code)`), включая `customs_declaration_items`.
- **PSA placeholders:** `PsaService` провижинит placeholder-продукты из `system_product_templates` в tenant `products` при первом использовании (вместо локально захардкоженного одиночного SKU).
- **Онбординг API:** публичный ввод — поле **`legalForm`** (`CounterpartyLegalForm`), а **`kind`** вычисляется сервером: `STATE_AGENCY -> BUDGET`, `NGO -> NGO`, иначе `COMMERCIAL`. В **`settings.templateGroup`** для payroll пишется **`COMMERCIAL`** или **`GOVERNMENT`** (маппинг: **`BUDGET` → GOVERNMENT**, иначе **COMMERCIAL**).
- **Ручное расширение плана:** **`GET /api/accounts/templates`**, **`POST /api/accounts/import-from-template`**; UI **`/accounting/chart`** (редирект с устаревшего **`/settings/chart`**).

### Транзакции (Transaction) и проводки (Journal Entry)

| Требование | Описание |
|------------|----------|
| **Валидация** | Функция `validateBalance()` проверяет, что **Σ Debit = Σ Credit** перед сохранением |
| **Атомарность** | `Prisma.$transaction`: при ошибке одной проводки откатывается вся транзакция |
| **Блокировка** | Невозможность удаления/изменения проводок в «закрытых» периодах; закрытие периода — только **Owner** или **Admin** |
| **Журнал (MVP)** | Правки проводок **допускаются**, каждое изменение — в **`AuditLog`**; неизменяемый журнал / только сторно — позже |

**Стаб §5.E (РБП / prepaid):** помесячное признание предоплаченных расходов — отдельные сущности **`PrepaidExpense`** / **`PrepaidExpenseSchedule`** и проводки через **`AccountingService.postJournalInTransaction`** с теми же ограничениями закрытого периода, что и для прочих ручных операций. Детали — **§12.8.5**.

**Дополнение (alış fakturası → склад):** у модели **`Transaction`** поле **`purchase_snapshot`** (`Json?`, колонка `purchase_snapshot`). После успешного **`AccountingService.postJournalInTransaction`** при проведении закупки (**`InventoryService.recordGoodsPurchase`**, **`recordDualPurchaseInvoice`**, **`recordServicePurchase`**) в той же **`prisma.$transaction`** выполняется **`transaction.update`**: в JSON сохраняется **`{ version: 1, lines: [{ kind, productId, quantity, productName, sku }] }`** (товары и услуги с признаком `kind`). Складские **`StockMovement`** из проведения закупки **не создаются**; физический приход — **`POST /api/inventory/receipts`** (см. §10.2.5). Документы без снимка (до миграции) отдают пустой **`lines`** в **`GET /api/inventory/purchase-invoices/:id`**.

**Дополнение (Satış fakturası → склад):** поле **`sales_snapshot`** (`Json?`, `sales_snapshot`) — снимок **товарных** строк после проведения выручки (**`applyRevenueRecognitionWithSalesSnapshot`**); физическое списание — **`POST /api/inventory/shipments`** (§10.2.6). См. также **`invoices.revenue_posted_transaction_id`**.

### 3.1. Optimistic Locking для массовых параллельных расчётов

- Для сущностей, обновляемых конкурентно в тяжёлых сценариях (массовые начисления, пакетные пересчёты), предусматривается версионность строк (`version`-поле в Prisma-моделях) и обновление по схеме compare-and-set.
- При конфликте версий операция должна завершаться контролируемой ошибкой конкурентного обновления с повторной попыткой по политике сервиса/воркера.
- Внедрение optimistic locking не отменяет инвариантов §3 (Σ Debit = Σ Credit, ACID-транзакции) и применяется как слой защиты от deadlock/last-write-wins в высоком параллелизме.

### 3.2. Stateless Workers

- Все фоновые воркеры выполняются в модели **stateless**: состояние задачи хранится в Redis/БД, а не в памяти процесса.
- Любой свободный воркер должен уметь обработать любую задачу из очереди без локального session-state.
- Повторяемость/идемпотентность шагов обязательна для безопасного retry при падениях/переездах задач между инстансами.

### 3.3. Дополнение: взаимозачёт (Netting)

Оформление **взаимозачёта** (схлопывание встречных требований) по одному контрагенту: уменьшение **кредиторки 531** и **дебиторки 211** одной проводкой.

#### Сервис `FinanceService` (фасад)

| Метод | Назначение |
|--------|------------|
| `getNettingCandidate(counterpartyId)` | Возвращает оценки **дебиторки** (как в отчёте по неоплаченным инвойсам с выручкой), **кредиторки 531** (обороты по счёту 531 с `transaction.counterpartyId`), **suggestedAmount = min(оба)**, флаг **`canNet`** (истина, если min > 0). Книга: query `ledgerType` (**NAS** / **IFRS**) для счёта 531. |
| `executeNetting(counterpartyId, amount)` | Валидация `amount ≤ min(...)`; в **одной БД-транзакции**: проводки **Дт 531 — Кт 211** на `amount` (`counterpartyId` на транзакции); затем **распределение** суммы по неоплаченным инвойсам контрагента (FIFO по `dueDate`, строки `InvoicePayment` с `transactionId` = транзакция зачёта, **без** второй пары проводок). Обновление статусов инвойсов (PAID / PARTIALLY_PAID и т.д.). **Аудит ручной правки:** тело `POST /api/reporting/netting` может содержать **`previewSuggestedAmount`** (= `suggestedAmount` из preview); если оно передано и отличается от `amount`, **`NettingService`** пишет **server `log`** с `organizationId`, `counterpartyId`, `userId` и обеими суммами. |

**REST (реализация):** `GET /api/reporting/netting/preview`, `POST /api/reporting/netting` (см. Swagger).

#### Согласованность отчётов

После зачёта **дебиторка** (`accountsReceivable`) и **старение** остаются согласованными с ГК по 211, т.к. уменьшение долга по инвойсу отражено записями оплат, привязанными к той же финансовой транзакции, что и Кт 211.

#### UI (модуль 7 / отчёты)

- **Акт сверки (Üzləşmə aktı):** `GET /api/reports/reconciliation/:counterpartyId` (`startDate`, `endDate`, опционально `currency`, `ledgerType`; алиасы `dateFrom`/`dateTo`); экспорт **`/pdf`**, **`/xlsx`**; **`POST …/email`** — PDF на `counterparty.email` при настроенном SMTP. Вкладка **«Акт сверки»** в UI редактирования контрагента (**модальное окно** на странице списка **`/crm/counterparties`**; отдельный маршрут карточки — **`/crm/counterparties/[id]/reconciliation`**). Устаревший JSON-эндпоинт **`GET /api/reporting/reconciliation?counterpartyId=…`** сохранён для совместимости.
- **Встречные требования / взаимозачёт** (`GET /api/reporting/netting/preview`, UI отчётов): блок остатков **211 / 531** и лимит зачёта; кнопка **«Оплатить зачётом / Pay by netting»** на странице `/reporting/reconciliation` доступна только при `canNet`.
- **Карточка инвойса:** при непогашенном остатке и `canNet` — действие **«Оплатить зачётом»** (сумма по умолчанию ≤ min(остаток инвойса, suggestedAmount)).

---

## 4. Модуль 3: CRM & Counterparties

### Цель

Централизованное управление базой клиентов и поставщиков.

### Карточка контрагента

- **Юр./физ. (`kind`):** в БД хранится для учёта и **обновляется из `legalForm`** (например, `INDIVIDUAL` → физлицо); в модалках создания/редактирования **отдельный выбор «тип» не показывается**, чтобы не дублировать ОПФ. В учёте взаимодействий — **роль** Клиент / Поставщик и т.д.
- **Обязательные поля (модалка create/edit):** Name, VÖEN (10 цифр), **`legalForm`**, **роль (`role`)**; адрес и e-mail — по мере необходимости; **плательщик НДС (`isVatPayer`)** — булев признак (по умолчанию `false`), задаётся пользователем и/или подсказывается lookup по VÖEN.
- **Банковские счета:** хранятся в **`CounterpartyBankAccount`** (связь **1:N**); не задаются в той же форме, что карточка — управление через **`CounterpartyBankAccountsModal`** (меню строки реестра) и REST ниже.
- **Merge дубликатов (v95+):** API `POST /api/counterparties/merge` принимает `{ sourceId, targetId }` и переносит связи (`Invoice`, `Transaction`, `CashOrder`) с `source` на `target` в одной БД-транзакции; **строки `CounterpartyBankAccount`** сливаются в `target` (по уникальному IBAN), затем `source` удаляется после успешного переноса.
- **Проверка целостности после merge (M3/M4):** сразу после коммита транзакции merge сервис выполняет **`scanMergeIntegrity`**: параллельный `count` по тем же моделям (`invoice`, `transaction`, `cash_orders`) с фильтром `counterpartyId = <удалённый sourceId>`. Ожидаемое значение **0** по каждой таблице; при ненулевом счётчике пишется **error-log** (инцидент рассинхронизации / пропущенная связь при расширении схемы). Ответ `POST …/merge` включает поле **`integrity: { ok, counts }`** для диагностики клиентом и мониторинга.

### Взаиморасчёты

- Счёт **211** (дебиторская задолженность) — для клиентов.
- Счёт **531** (кредиторская задолженность) — для поставщиков.
- Автоматическое обновление баланса контрагента при каждой финансовой проводке.

---

## 5. Модуль 4: Sales & Invoicing

### Цель

Автоматизация выставления документов и признания выручки.

### UI (реализация vX.Y): создание и обновление через модальные компоненты

- Клиент (`apps/web`) для операций **create/update** по REST вызывает **модальные компоненты** с формами на страницах списков (паттерн «таблица + модалка»), а не отдельные полноэкранные страницы форм.
- Примеры: **CreateInvoiceModal** / **ViewInvoiceModal** (просмотр счёта только в модалке на **`/sales/invoices`**, маршрут **`/sales/invoices/[id]`** → редирект с **`?invoice=`**); **акты сверки** — реестр **`/sales/reconciliation`**; **CreateCounterpartyModal** и форма редактирования на **`/crm/counterparties`**; **каталог** — **`/catalog/products`**: над таблицей — текстовый поиск по **наименованию** и **SKU**; кнопка добавления — **выпадающее меню** «+ Yeni məhsul» / «+ Yeni xidmət» (RU: новый товар / новая услуга); **`ProductModal`** (товар: **Ad, SKU, ƏDV, Qiymət**, `isService: false`) и **`CreateServiceModal`** / режим услуги (только **Ad, ƏDV, Qiymət**, `isService: true`, без SKU в UI); **сличительная ведомость** — **`InventoryAuditCreateFlow`** и страницы **`/inventory/audits`**, **`/inventory/audits/[id]`**; с клиента мутации идут на канонический **`/api/inventory/reconciliations/*`** (снимок, REVIEW, **`complete`**); **`/api/inventory/audits`** — только совместимость (**`POST /`**, **`PATCH …/lines`**); **`approve`** / **`sync-system`** у **`/audits`** не использовать (**§10.1**); основные средства — **`FixedAssetModal`** на **`/fixed-assets`**; **закупки** — реестр **`/purchases`** + **`PurchaseModal`**; перемещения — **`/inventory/transfers`** + **`TransferModal`**; корректировки — **`/inventory/adjustments`** + **`AdjustmentsModal`**; настройки склада — **`/inventory/settings`** (**`NewWarehouseModal`**).
- Устаревшие маршруты (**редиректы** на реестр; **исключение:** query **`?invoice=`** на **`/sales/invoices`** открывает **ViewInvoiceModal** после редиректа с **`/sales/invoices/[id]`**):
  - `/invoices/new` → `/sales/invoices`
  - `/invoices`, `/invoices/*` → `/sales/invoices`, `/sales/invoices/*`
  - `/counterparties`, `/counterparties/*` → `/crm/counterparties`, `/crm/counterparties/*`
  - `/products` → `/catalog/products`
  - `/reporting/reconciliation` → `/sales/reconciliation`
  - `/inventory/purchase` → `/purchases`
  - `/inventory/warehouses/new` → `/inventory/settings`
  - `/inventory/transfer` → `/inventory/transfers`
  - `/inventory/audit/new` → `/inventory/audits`
  - `/fixed-assets/new` → `/fixed-assets`
  - `/manufacturing/recipe` → `/manufacturing/recipes`; `/manufacturing/release` → `/manufacturing/releases`
  - `/payroll/absences/new` → `/payroll`
- **Сличительная ведомость:** редирект **`/inventory/audit/new` → `/inventory/audits`** касается только UI. Для REST интеграций и новых клиентов канон — **`/api/inventory/reconciliations/*`**; **`GET /api/inventory/reconciliations`** и **`GET …/:id`** дают те же документы, что видит веб на **`/inventory/audits`**. Детали и исключения **`/api/inventory/audits`** — **§10.1**.

#### Иерархия левого меню и каталог `apps/web/app` (v2026.05.01, 1C/SAP-стиль)

| Раздел меню | Базовые маршруты (`apps/web/app/…`) |
|-------------|-------------------------------------|
| **Kataloq və CRM** | `crm/counterparties/*`, `catalog/products/*` (**выше «Продаж» в сайдбаре**) |
| **Satış** | `sales/invoices/*`, `sales/reconciliation` |
| **Satınalma** | `purchases` |
| **Anbar** | `inventory/*` (кроме закупок; `purchase` удалён); сличительная ведомость — **`inventory/audits`** + REST **`/api/inventory/reconciliations/*`** (**§10.1**) |
| **İstehsalat** | `manufacturing` → редирект на `manufacturing/recipes`; `manufacturing/releases` |

### Контрагенты (VÖEN / MDM lookup) — UI/REST

- **Реестр `/crm/counterparties`:** над таблицей — фильтры по **`role`** и **`legalForm`** (клиентская фильтрация загруженного списка; строка поиска по имени/VÖEN в той же панели).
- Валидация: VÖEN (`taxId`) — **строго 10 цифр**.
- **Организационно-правовая форма:** в модалках **создания** и **редактирования** контрагента (`CreateCounterpartyModal`, `EditCounterpartyModal`) — обязательный выпадающий список **`legalForm`** (значения enum в БД: `INDIVIDUAL`, `LLC`, `CJSC`, `OJSC`, `PUBLIC_LEGAL_ENTITY`, `STATE_AGENCY`, `NGO`, `BRANCH`, `HOA`; бизнес-расшифровки F/Ş, MMC, QSC и т.д. — в [PRD.md](./PRD.md) §4.3).
- **Плательщик НДС:** в тех же модалках — чекбокс **`isVatPayer`** (подписи UI: AZ «ƏDV ödəyicisidir», RU «Плательщик НДС»); значение сохраняется в `POST /api/counterparties` и `PATCH /api/counterparties/:id` и используется в налоговых сценариях (в т.ч. e-qaimə, взаимозачёт).
- Автозаполнение (MDM / directory): при вводе 10 цифр UI выполняет цепочку запросов (в т.ч. `GET /api/organization/directory/by-voen/:taxId`, `GET /api/counterparties/global/by-voen/:taxId`) и при успешном ответе подставляет **имя**, **адрес** (если есть) и **признак плательщика НДС** там, где источник это отдаёт.
- **Auto-lookup (create/edit):** при наборе 10 цифр VÖEN автоматически запускается проверка; при необходимости допускается fallback `GET /api/tax/taxpayer-info?voen=...`. Поле **`name` (Наименование / Ad)** **не блокируется** (`disabled` не используется): пользователь **всегда** может ввести или исправить наименование вручную, в том числе если lookup завершился ошибкой или вернул неполные данные.
- **Ошибка поиска по VÖEN (UI):** при сбое цепочки lookup или ответе без пригодного наименования UI показывает **Toast** (локализованный ключ, AZ: «VÖEN üzrə məlumat tapılmadı») и **не подставляет** в поле имени технические сообщения, HTML или текст защитных заглушек (Cloudflare и т.п.).
- Ручная проверка: кнопка «Yoxla» повторно запускает ту же цепочку lookup.
- **Банковские счета (REST):** `GET /api/counterparties/:id/bank-accounts` — список; `POST /api/counterparties/:id/bank-accounts` — добавление (тело: `bankName`, `iban`, опционально `swift`, `currency`, `isPrimary`); `DELETE /api/counterparties/:id/bank-accounts/:accountId` — удаление. Маршрут **`GET …/global/by-voen/:taxId`** регистрируется **до** динамического **`GET …/:id`**, чтобы не перехватываться как `id = "global"`.
- **UI:** в таблице **`/crm/counterparties`** в меню действий строки — пункт **«Bank hesabları» / «Банковские счета»** (иконка карты/счёта), открывающий **`CounterpartyBankAccountsModal`** (список счетов, форма добавления, удаление).

### Invoice

- Генерация уникального номера по маске (например, `INV-2026-001`).
- Расчёт НДС (ƏDV / EDV) на MVP: **только** 0%, 18% и «освобождён».
- **UI создания счёта (`CreateInvoiceModal`):** первая строка таблицы при открытии формы инициализируется **пустой** (номенклатура «Seçin…» / плейсхолдер, без автоподстановки первого товара из каталога). **Новая строка** (кнопка добавления и сброс формы): **количество по умолчанию 0**, ставка НДС **пустая** (плейсхолдер «—»), пока пользователь не выберет значение или пока не выбрана номенклатура (тогда подставляется ƏDV из карточки). Выпадающий список номенклатуры включает **все** активные позиции (товары и услуги); для услуг (`isService === true`) в подписи опции добавляется суффикс **`(Xidmət)`**. Селектор **«ставка НДС документа»** в шапке **удалён**; в шапке остаётся только чекбокс **`vatInclusive`** («Qiymətlər ƏDV daxil (brüt)»), ставка НДС — **отдельный select в каждой строке**. Итоги **Net / VAT / Gross** на фронте пересчитываются **в реальном времени** (`react-hook-form` **`useWatch`** по массиву строк + флаг `vatInclusive`), суммированием построчных разбиений. Кнопка **«Сохранить»** (`common.save` / «Yadda saxla») в футере модалки **не блокируется** предварительной проверкой «форма полная» — она **активна** для показа валидации и **отключается только на время сабмита** (`busy` / отправка запроса).
- Каталог товаров и услуг; акты приёмки-передачи (**Handover Acts**).
- Статусы оплаты: Draft, Sent, Paid, Overdue, Cancelled.
- **UI просмотра (`ViewInvoiceModal`, `apps/web/components/sales/modals/ViewInvoiceModal.tsx`):** действие **«Baxış»** на **`/sales/invoices`** открывает модалку с `invoiceId`; **`SalesModalShell`** поддерживает слот **`headerActions`**: в шапке справа (до крестика) — при **`LOCKED_BY_SIGNATURE`** зелёный **`Badge` `success`** с текстом **`formatInvoiceStatus(t, inv.status)`** («İmzalanıb» / «Подписан»), иначе без этого бейджа; кнопка **`invoiceView.signWithEi`** («İmzalamaq (Eİ)» / «Подписать (ЭЦП)»), затем **`Linki paylaş`**. При **`LOCKED_BY_SIGNATURE`** кнопка подписания **не** рендерится. **`Linki paylaş`:** в буфер — **`/sales/invoices?invoice=<id>`** без домена; успех — **`toast.success`** (**`sonner`**), без встроенного текста уведомления в теле модалки. Статусы в таблице и в блоке реквизитов — **`formatInvoiceStatus`** / **`invoiceStatus.*`** в **`resources.ts`** (без сырого enum).

### НДС и услуги (UI)

- `vatInclusive`: чекбокс «Qiymətlər ƏDV daxil (brüt)» — если включён, `unitPrice` в UI трактуется как **брутто**, backend рассчитывает нетто.
- **Построчный НДС:** в каждой строке — свой **`vatRate`** (**0%**, **18%**, **освобождение** `-1`); при выборе номенклатуры подставляется ставка из карточки товара/услуги (можно изменить вручную). Глобального селекта ставки НДС в шапке документа **нет**.
- **Товары и услуги в одном инвойсе:** глобальный чекбокс **«Xidmət»** в шапке формы создания счёта **не используется**; пользователь выбирает номенклатуру в каждой строке. Если у выбранного **`Product`** установлено **`isService === true`**, для этой строки **не требуется** склад при проведении выручки и **не создаётся** складское списание; для **`isService === false`** при признании выручки сохраняется **`sales_snapshot`**, а физическое списание и **701/201** выполняются отдельным документом **`POST /api/inventory/shipments`** (**Anbar məxarici**, §10.2.6). В PDF тип строки берётся из номенклатуры (**Məhsul** / **Xidmət**).

### Бизнес-логика (триггеры)

**При смене статуса инвойса на Paid:**

1. Создать `Transaction`.
2. Проводка: **Дт 101/221** (Касса/Банк) — **Кт 211** (дебиторка).

### 5.2. Экспорт для e-taxes.gov.az

- **Назначение:** экспорт налоговой декларации для e-taxes.gov.az с управляемым жизненным циклом статусов.
- **Модель данных:** `TaxDeclarationExport` (`organizationId`, `taxType`, `period`, `generatedFileUrl`, `receiptFileUrl`, `status`).
- **State-machine:** `GENERATED` (файл создан) -> `UPLOADED` (файл скачан бухгалтером) -> `CONFIRMED_BY_TAX` (загружен `Elektron Bildiriş` в PDF).
- **Источник данных:** агрегирование `JournalEntry` за выбранный период; в v2 поддержан `SIMPLIFIED_TAX` (Sadələşdirilmiş vergi) с расчётным блоком и выгрузкой XML/XLSX.
- **Хранилище артефактов:** generated/receipt файлы сохраняются через `StorageService` с ключами в tenant-префиксе `orgs/{organizationId}/tax-exports/...`.
- **UI workflow (Reports -> e-Taxes):**
  1. Выбор периода/налога + `Generate file`.
  2. Скачивание декларации (автопереход в `UPLOADED`).
  3. Загрузка PDF-квитанции `Elektron Bildiriş` (переход в `CONFIRMED_BY_TAX`).

### Печатные формы

- Генерация PDF на **AZ / RU / EN**.

---

## 6. Модуль 5: Cash Management

### Цель

Контроль за движением реальных денег.

### 6.0. Treasury, касса (`/api/banking/cash`), банк (`/api/banking`) — REST, DTO, проведение, миграция БД

*В нумерации продукта это **модуль 5 (Cash)**; в данном Т/З он оформлен как **§6**. Технический блок «5.0» из обсуждения = этот подраздел **§6.0**.*

**External IBAN Validation API:**

- [x] **COMPLETED (IBAN Deep Check API):** `IbanValidationService` интегрирован с `https://www.iban.com/validation-api` с использованием `IBAN_COM_API_KEY`.
- [x] **COMPLETED (IBAN Deep Check Payload):** результат deep-check возвращает `bankName`, `bic`, `country`, `accountExists` и исходный provider payload.
- [x] **COMPLETED (IBAN Deep Check Cache):** успешные deep-check ответы кешируются в Redis на 24 часа по ключу `organizationId + iban`.

**Общие правила HTTP**

- Глобальный префикс Nest: **`/api`** (итоговые пути: `/api/treasury/...`, `/api/banking/...`).
- Аутентификация: **Bearer JWT**; контекст организации — из токена (декоратор `@OrganizationId()`).
- **Treasury** — отдельный контроллер **без** `SubscriptionGuard` (доступ при валидном членстве в организации); мутации защищены **`RolesGuard`**.
- **Банк** — контроллер `banking` с **`SubscriptionGuard`** и **`@RequiresModule(BANKING_PRO)`** (см. `ModuleEntitlement`).
- **Касса** — контроллер `banking/cash` с **`SubscriptionGuard`** и **`@RequiresModule(KASSA_PRO)`**.

**Терминология (азербайджанский бухучёт, стандарты АР) — UI и печать**
- Для пользователя (веб-i18n, заголовок вкладки браузера, **H1** печатной формы кассового ордера) основной текст — **официальные** формулировки, а не «cash order report»:
  - **Приход в кассу** (income, поступление наличных): **Kassa Mədaxil Orderi**, аббревиатура **KMO** (приход — *mədaxil*, касса — *kassa*).
  - **Расход из кассы** (expense, выдача наличных): **Kassa Məxaric Orderi**, **KXO** (расход — *məxaric*).
- **Legacy / backwards compatibility:** в существующих данных и части кода/маршрутов может встречаться старое именование **MKO/MXO**. В рамках миграции UX и API применяется переименование **MKO → KMO**, **MXO → KXO** (без изменения бизнес-смысла); legacy-алиасы допускаются на переходный период.
- См. также `apps/web/lib/i18n/resources.ts` (`banking.cash.*`) и печать ордера (web print + server HTML, в зависимости от реализации) в `apps/api/src/kassa/cash-order.service.ts`.

**Web UI `/banking` (модуль «Банк», v2026.05.01):**

- Импорт выписок (**dropzone**, `POST /api/banking/import`) вынесен в отдельное модальное окно; кнопка открытия импорта — в **`PageHeader.actions`** (вместе с синхронизацией и фильтром месяца).
- Из шапки страницы удалены нецелевые кнопки и legacy-текст (пояснения в духе OSV/NAS в теле страницы, произвольные ссылки на отчёты вне паттерна `PageHeader`).
- Кнопка **«Добавить счёт»** открывает только модальное окно создания банковского счёта (**`OrganizationBankAccountModal`**, `GET/POST /api/banking/bank-accounts`), без редиректа в IFRS/Mapping.

**Web UI `/banking` (обновление v2026.05.02):**

- Вкладки UI (**«Выписки / исходящие»**) и **ручная форма** исходящего платежа (IBAN списания/получателя и т.д.) **удалены**.
- Фильтр периода: **`input type="month"`**; строки выписок запрашиваются с **`bankOnly=true`**, **`valueDateFrom` / `valueDateTo`** по границам выбранного месяца (`GET /api/banking/lines?…`). Ответ реестра: **`{ items, total, page, pageSize }`** (пагинация серверная; фильтры те же, что и у прежнего списка строк).
- **Гибридная таблица:** сверху блок **«На отправку»** — все **`BankPaymentDraft`** со статусом **`PENDING`** (`GET /api/banking/payment-drafts?status=PENDING`); ниже **«История»** — строки **`BankStatementLine`** за выбранный месяц.
- **Синхронизация:** кнопка выполняет **push** — `POST /api/banking/payment-drafts/send-all` (тело: опционально `fromAccountIban`, иначе первый IBAN из **`organization_bank_accounts`**), затем **pull** — `POST /api/banking/sync`.

**Web UI `/banking` (обновление v2026.05.03):**

- Спецификация UI обновлена: удалены пояснительные **legacy**-тексты (в т.ч. в духе OSV под заголовком счетов), фильтр **MonthPicker** и кнопки **синхронизации / импорта** перенесены в глобальный **`PageHeader`**. Статус последней синхронизации выводится **компактным текстом** (мелкий шрифт, выравнивание вправо) **над гибридной таблицей** операций.

**Web UI `/banking/cash` (обновление v2026.05.03):**

- UI обновлён: внедрён фильтр по месяцу (**MonthPicker**) для журнала ордеров (запрос **`GET /api/banking/cash/orders?dateFrom=…&dateTo=…`** по границам выбранного месяца). Кнопки создания документов (**KMO**, **KXO**, авансовый отчёт, быстрый расход) перенесены в глобальный тулбар **`PageHeader`**; ссылка возврата (**Geri**) из контентной области удалена.

---

#### Шаг 1. Справочник статей ДДС (`CashFlowItem`)

| Метод и путь | Роли | Тело / ответ |
|--------------|------|----------------|
| `GET /api/treasury/cash-flow-items` | JWT (роли не навешаны на метод) | Массив записей `{ id, organizationId, code, name, createdAt, updatedAt }`. Если у организации **0** строк — в той же логике запроса выполняется **транзакция** с созданием типового набора из **5** кодов: `CF-OPS`, `CF-SUP`, `CF-SAL`, `CF-TAX`, `CF-OTH` (названия по умолчанию на AZ), затем возвращается полный список. |
| `POST /api/treasury/cash-flow-items` | **Owner, Admin, Accountant** | **DTO `CreateCashFlowItemDto`:** `code` — string, 1…64; `name` — string, 1…255. Ответ: созданная сущность. Ошибка **400**, если `code`/`name` после `trim` пустые. Уникальность **`(organizationId, code)`** на уровне БД (`@@unique`). |

---

#### Шаг 2. Справочник физических касс (`CashDesk`)

| Метод и путь | Роли | Тело / ответ |
|--------------|------|----------------|
| `GET /api/treasury/cash-desks` | JWT | Список **`isActive: true`**, сортировка по `name`. **Include:** `employee { id, firstName, lastName, finCode }` при наличии `employeeId`. |
| `POST /api/treasury/cash-desks` | **Owner, Admin, Accountant** | **DTO `CreateCashDeskDto`:** `name` — string, 1…255 (обязательно); `employeeId` — optional UUID; `currencies` — optional `string[]` (ISO коды; если не передан или пустой — сохраняется **`[]`**). Ответ: созданная касса с тем же `include` по сотруднику. **400**, если `name` пустой после `trim`. |
| `GET /api/treasury/cashflow-projection?days=30` | JWT | Платёжный календарь (liquidity forecast) по дням. Источники: текущий баланс по активным `OrganizationBankAccount` (через NAS account balances) + неоплаченные инвойсы с `dueDate` в горизонте (`DRAFT/SENT/PARTIALLY_PAID`): входящий поток для customer, исходящий для supplier. Ответ: `{ currency, horizonDays, openingBalance, points[] }`, где `points[] = { date, inflow, outflow, projectedBalance }`. |

**Сервисные проверки (используются кассой/банком):**

- `assertCashFlowItem(organizationId, id)` — строка существует в организации; иначе **400** `cashFlowItemId not found for organization`.
- `assertCashDesk(organizationId, id)` — строка существует, **`isActive: true`**; иначе **400** `cashDeskId not found for organization`.

---

#### Шаг 3. Кассовые ордера (`CashDeskController`, базовый путь `/api/banking/cash`; в БД/Prisma — `KMO` / `KXO`; legacy: `MKO` / `MXO`)

| Метод и путь | Роли | Назначение |
|--------------|------|------------|
| `GET /api/banking/cash/balances` | JWT | Остатки по счетам **101\*** по валютам; query `ledgerType` — как в остальных отчётах (`parseLedgerTypeQuery`). |
| `GET /api/banking/cash/orders` | JWT | Журнал ордеров организации; опционально **`dateFrom`** / **`dateTo`** (`YYYY-MM-DD`) — только ордера с полем **`date`** в этом интервале (включительно). Без параметров — полный журнал (обратная совместимость). |
| `POST /api/banking/cash/orders/kmo` | **Owner, Admin, Accountant** | Черновик **KMO**; тело **`CreatePkoDraftDto`**. |
| `POST /api/banking/cash/orders/kxo` | те же | Черновик **KXO**; тело **`CreateRkoDraftDto`**. |
| `POST /api/banking/cash/orders/:id/post` | те же | **Проведение** черновика → проводка в ГК + статус **POSTED**. |
| `GET /api/banking/cash/orders/:id/print` | JWT | HTML бланк для печати. |
| `GET /api/banking/cash/accountable` | JWT | Подотчётные (сальдо **244**). |
| `POST /api/banking/cash/advance-reports` / `…/:id/post` | **Owner, Admin, Accountant** | Авансовый отчёт (без изменений в рамках §6.0). |

**KO-1 print form (форма № KO-1)**

- For **KMO** (incoming cash order), UI provides an additional print view **KO-1** with a strict grid layout (per the accountant audit template).
- The print view includes the field **“Məbləğ yazı ilə”** rendered in **AZ** and **RU** (amount-to-words).
- UI entry point: button **“Çap et”** in the cash order view modal (web print).

**DTO черновика MKO — `CreatePkoDraftDto`**

| Поле | Тип / ограничения | Обяз. |
|------|-------------------|--------|
| `date` | `YYYY-MM-DD` (`@IsDateString`) | да |
| `pkoSubtype` | enum **Prisma** `CashOrderPkoSubtype`: `INCOME_FROM_CUSTOMER`, `RETURN_FROM_ACCOUNTABLE`, `WITHDRAWAL_FROM_BANK`, `OTHER` | да |
| `amount` | number, `@Type(() => Number)`, finite, max 4 знака после запятой, **≥ 0.01** | да |
| `currency` | string, optional (по умолчанию при сохранении **`AZN`**) | нет |
| `purpose` | string | да |
| `cashAccountCode` | string, optional — иначе подстановка **101\*** по валюте (`resolveCashAccountCodeForCurrency`) | нет |
| `offsetAccountCode` | string, optional — **обязателен** для подтипов `OTHER`, `RETURN_FROM_ACCOUNTABLE`; для остальных может выводиться автоматически (601, 221 и т.д. по логике `resolvePkoOffset`) | нет |
| `counterpartyId`, `employeeId` | UUID, optional | нет |
| `notes` | string, optional | нет |
| **`cashFlowItemId`** | UUID | **да** (валидация `@IsUUID`); при создании черновика проверяется через `assertCashFlowItem`. |
| **`cashDeskId`** | UUID, optional; если задан — `assertCashDesk`. | нет |

**DTO черновика MXO — `CreateRkoDraftDto`**

Те же базовые поля, что у MKO по смыслу: `date`, `rkoSubtype` (**`CashOrderRkoSubtype`**: `SALARY`, `SUPPLIER_PAYMENT`, `ACCOUNTABLE_ISSUE`, `BANK_DEPOSIT`, `OTHER`), `amount`, `currency`, `purpose`, `cashAccountCode`, `offsetAccountCode`, `counterpartyId`, `employeeId`, `notes`, **`cashFlowItemId`** (обяз.), **`cashDeskId`** (optional).

Дополнительно:

| Поле | Описание |
|------|-----------|
| **`withholdingTaxAmount`** | optional number, ≥ 0, finite, до 4 знаков; если > 0 — сохраняется в ордере. **Только для MXO** (см. проведение). |

**Проведение `POST …/orders/:id/post` (`CashOrderService.postOrder`)**

1. Ордер существует в организации, статус **`DRAFT`**; иначе **404** / **409**.
2. Если **`skipJournalPosting`** — только смена статуса на **POSTED**, привязка `postedTransactionId` к уже существующей `linkedTransactionId` (без новой проводки).
3. Иначе: обязателен **`cashFlowItemId`** на записи; повторная проверка `assertCashFlowItem`; при **`cashDeskId`** — `assertCashDesk`.
4. Обязателен непустой **`offsetAccountCode`**; **`cashAccountCode`** должен проходить **`assertValidCashDeskAccountCode`** (касса **101\***).
5. **Удержание налога у источника:** если `withholdingTaxAmount` > 0 — только для **`MXO`**; сумма **`amount`** трактуется как **нетто** (выдано из кассы), **валовая** = `amount + withholdingTaxAmount`. Проводки в одной транзакции: **Дт** второй счёт (`offset`) на **gross**, **Кт** касса на **amount**, **Кт** счёт **`521`** (`PAYROLL_TAX_PAYABLE_ACCOUNT_CODE`) на **withholdingTaxAmount**. Если удержание 0 — классическая пара Дт/Кт по кассе и второму счёту на сумму `amount`.
6. MKO: **Дт** касса, **Кт** второй счёт на `amount`.
7. После успеха — `postedTransactionId` на созданную финансовую транзакцию, статус **POSTED**.

*Черновики, созданные до появления поля ДДС в UI, могут не иметь `cashFlowItemId` в БД — такие ордера **не проведутся**, пока не будут пересозданы или не выполнен backfill.*

#### §6.0.1. Validation Logic: закрытые периоды и «заднее число» (`CashOrderService`)

**Закрытые периоды:** проведение ордера вызывает `AccountingService.postJournalInTransaction`, где уже проверяется вхождение `monthKeyUtc(order.date)` в `settings.reporting.closedPeriods` — **дополнительно** UI не должен предлагать проведение в закрытом месяце (синхронизация с PRD §4.5.2).

**Backdating (расход из кассы, `MXO`):** если `order.date` **раньше** текущей календарной даты (UTC) и вид операции **уменьшает** остаток на счёте кассы **101\***, перед проведением выполняется проверка «кассового разрыва»:

Для каждого календарного дня \(t\) от `order.date` до **сегодня** (включитель, UTC) вычисляется нетто **Дт − Кт** по счёту кассы на конец дня \(t\) **без** новой проводки; затем из нетто вычитается сумма расхода \(A\). Если для **любого** \(t\) результат \(< 0\) — выброс **`ForbiddenException`** с текстом:

> Операция невозможна: возникнет кассовый разрыв на \[Date\]

где `[Date]` — **YYYY-MM-DD** в UTC. Ограничение глубины backdating (например, не более **400** дней) допускается для защиты API от злоупотреблений.

**MKO** (приход в кассу): отдельная проверка «разрыва» не требуется (остаток не уменьшается).

---

#### Шаг 4. Ручная банковская операция (`POST /api/banking/manual-entry`)

- Модуль: **`BANKING_PRO`**; роли: **Owner, Admin, Accountant**.
- **DTO `ManualBankEntryDto`:**

| Поле | Описание |
|------|-----------|
| `type` | enum **`BankStatementLineType`**: `INFLOW` \| `OUTFLOW` |
| `amount` | > 0, finite, до 4 десятичных |
| `bankAccountCode` | строка; после trim должна удовлетворять **`isBankLedgerAccountCode`** — счета **221\*, 222\*, 223\*, 224\*** |
| `offsetAccountCode` | второй счёт проводки (строка, не пустая) |
| `date` | `YYYY-MM-DD` |
| **`cashFlowItemId`** | UUID; проверка `treasury.assertCashFlowItem` |
| `description` | optional; в проводке/выписке по умолчанию текст **`Manual bank entry`** |

**Поведение сервиса (`BankingService.manualBankEntry`)** — одна **`Prisma.$transaction`**:

1. Формирование пар проводок: при **INFLOW** — **Дт** банк, **Кт** offset; при **OUTFLOW** — **Дт** offset, **Кт** банк.
2. `accounting.postJournalInTransaction` с `reference: "BANK-MANUAL"`, `isFinal: true`.
3. Создание **`BankStatement`** с `bankName: "MANUAL_BANK"`, `channel: BANK`, `date`, `totalAmount = amount`.
4. Создание **`BankStatementLine`** с `origin: MANUAL_BANK_ENTRY`, `type` из DTO, `valueDate`, `isMatched: true`, **`cashFlowItemId`** из DTO.

Ответ: `{ ok: true, bankStatementId }`.

#### Шаг 4.1. Внутренние переводы и конвертации (`/api/banking/transfers`, `/api/banking/conversions`)

- Модуль: **`BANKING_PRO`**; роли: **Owner, Admin, Accountant**.

**`POST /api/banking/transfers`** (внутренний перевод):

| Поле | Описание |
|------|----------|
| `sourceBankAccountId` | UUID счёта списания (`organization_bank_accounts.id`, только текущая организация, `isArchived=false`, `isFrozen=false`) |
| `targetBankAccountId` | UUID счёта зачисления (аналогично) |
| `amount` | > 0, до 4 знаков |
| `date` | `YYYY-MM-DD` |
| `commissionAmount` | optional, >= 0 |

Проведение (одна `prisma.$transaction`):

1. **Дт 231 — Кт source (на `amount + commission`)**.
2. Если есть комиссия: **Дт 731 — Кт 231** (на `commission`).
3. **Дт target — Кт 231** (на `amount`).
4. Проверка баланса: **ΣDebit = ΣCredit** перед `postJournalInTransaction`.

**`POST /api/banking/conversions`** (конвертация):

| Поле | Описание |
|------|----------|
| `sourceBankAccountId` | UUID счёта списания (`isFrozen=false`) |
| `targetBankAccountId` | UUID счёта зачисления |
| `sourceAmount` | сумма списания (>0) |
| `targetAmount` | сумма зачисления в целевой валюте (>0) |
| `date` | `YYYY-MM-DD` |
| `commissionAmount` | optional, >= 0 |

Логика расчёта и проводок:

1. На дату `date` берутся официальные курсы из `cbar_official_rates` (AZN=1, для прочих валют — по таблице).
2. `targetAmount` конвертируется в валюту источника по cross-rate ЦБА.
3. Курсовая разница = `sourceAmount - officialTargetInSource`.
4. Проводки:
   - база: **Дт target — Кт source**;
   - если разница > 0: **Дт 762** (loss);
   - если разница < 0: **Кт 662** (gain);
   - комиссия (если есть): **Дт 731 — Кт source**.
5. Запись проходит атомарно через `prisma.$transaction`, с обязательной проверкой **ΣDebit = ΣCredit**.

**`POST /api/banking/cash-deposits`** (взнос наличных):

| Поле | Описание |
|------|----------|
| `targetBankAccountId` | UUID счёта зачисления (`organization_bank_accounts.id`) |
| `amount` | > 0 |
| `source` | enum: `KASSA` (Кт 251) \| `FOUNDER` (Кт 545) |
| `date` | `YYYY-MM-DD` |
| `description` | optional |

Проведение:

1. Источник определяется по `source`: `KASSA -> 251`, `FOUNDER -> 545`.
2. Проводка: **Дт targetBankAccount.ledgerAccountCode — Кт sourceAccountCode**.
3. Операция выполняется в одной `prisma.$transaction`; контроль баланса обязателен.

**Разделение потоков Bank vs Cash (реестры операций):**

- Эндпоинт реестра: `GET /api/banking/lines` (ответ **`{ items, total, page, pageSize }`**, query **`page`**, **`pageSize`** — см. также описание UI `/banking` выше).
- Для страницы **Bank** (`/banking`) UI обязан запрашивать только банковские операции:  
  `GET /api/banking/lines?channel=BANK&bankOnly=true`
- При `bankOnly=true` сервер выполняет **жёсткий фильтр** по `origin`, исключая кассовые и системные источники, и возвращает **только**:
  - `MANUAL_BANK_ENTRY`
  - `FILE_IMPORT`
  - `DIRECT_SYNC`

---

#### Шаг 5. Схема миграции БД (эквивалент применённых изменений Prisma)

В репозитории миграции могут храниться вне рабочей копии; ниже — **логический порядок** изменений схемы, согласованный с `packages/database/prisma/schema.prisma` и кодом API.

1. **Таблица `cash_flow_items`**  
   - Колонки: `id` UUID PK, `organization_id` UUID FK → `organizations` ON DELETE CASCADE, `code` text, `name` text, `created_at`, `updated_at`.  
   - **UNIQUE** `(organization_id, code)`. Индекс по `organization_id`.

2. **Таблица `cash_desks`**  
   - `id` UUID PK, `organization_id` FK CASCADE, `name`, `employee_id` UUID NULL FK → `employees` ON DELETE SET NULL, `currencies` массив text (Postgres `text[]`), `is_active` boolean default true, timestamps.  
   - Индексы: `organization_id`, `employee_id`.

3. **Таблица `cash_orders`** — новые/изменённые поля  
   - `cash_flow_item_id` UUID NULL FK → `cash_flow_items` ON DELETE SET NULL, индекс.  
   - `cash_desk_id` UUID NULL FK → `cash_desks` ON DELETE SET NULL, индекс.  
   - `withholding_tax_amount` `NUMERIC(19,4)` NULL — удержание на РКО.

4. **Enum `BankStatementLineOrigin`** (Postgres `ENUM` или текст + маппинг — как сгенерировал Prisma)  
   - Значение **`MANUAL_BANK_ENTRY`** (ручная банковская операция). Остальные значения enum: `FILE_IMPORT`, `DIRECT_SYNC`, `WEBHOOK`, `INVOICE_PAYMENT_SYSTEM`, `MANUAL_CASH_OUT`.

5. **Таблица `bank_statement_lines`**  
   - Колонка **`origin`** с default **`FILE_IMPORT`**.  
   - Колонка **`cash_flow_item_id`** UUID NULL FK → `cash_flow_items` ON DELETE SET NULL, индекс.

6. **Связи в `Organization`** (Prisma): коллекции `cashFlowItems`, `cashDesks`; у **`CashFlowItem`** / **`CashDesk`** — обратные связи на `CashOrder` и `BankStatementLine` где задано в схеме.

**Применение в среде:** `npm run db:migrate` из корня монорепо — это **`prisma migrate deploy`** (применить уже добавленные в репозиторий миграции; в CI — то же). Сгенерировать новую миграцию из `schema.prisma`: **`npm run db:migrate:dev`**. Для уже существующих черновиков ордеров без `cash_flow_item_id` — миграция данных или пересоздание документов перед проведением.

---

### Банковские и кассовые счета (не путать с Chart of Accounts)

- Поддержка мультивалютности (AZN, USD, EUR).
- **Курсы:** автозагрузка из **XML/API ЦБА (cbar.az)**; ежедневное обновление **в 00:01** (задача в BullMQ/cron).
- **Переоценка** валютных остатков — **регламентная операция на конец месяца** (не «каждый день пересчитывать остатки» как бизнес-правило по умолчанию).

### Reconciliation (сверка)

- Загрузка выписки: MVP — **CSV / Excel**; импорт тяжёлых файлов — через **очередь**. Прямые API банков (Pasha, ABB и др.) — дорожная карта (см. §13).
- **Настройки Direct Banking (REST):** для владельца/админа — **`GET` / `PATCH /api/banking/direct-settings`** (masked просмотр, обновление URL/токенов по банкам); веб-блок **`DirectBankingPanel`** на странице **`/settings/bank-accounts`** (в составе реестра банковских счетов организации; модуль **`cash_bank_pro`**).
- Инструмент **Match (Invoicing match):** сопоставление строки выписки с существующим инвойсом или создание новой транзакции расхода (например, аренда или налоги).

### Подраздел Kassa (касса, v8.2)

Полноценный подмодуль **наличных денежных средств** в разделе казначейства (соответствие требованиям **МФ АР** к первичке и кассовому учёту).

**Интерфейс**

- Отдельная страница **`/banking/cash`**: под **`PageHeader`** — остатки кассы (**101\***), затем таблица **кассового журнала** за выбранный **месяц** (ордера KMO/KXO — см. терминологию **§6.0**); действия (**KMO**, **KXO**, **Avans hesabatı**, быстрый расход) — в **`PageHeader.actions`**; блок **подотчётных** (сальдо **244**) и форма авансового отчёта — ниже журнала (модалки для создания документов).
- Печать: HTML-бланк ордера для печати на **A4/A5** (чистый шаблон под браузерную печать).

**Функционал**

| Функция | Описание |
|---------|----------|
| **MKO / MXO** | Создание черновиков, проведение с проводкой на счета **101** и корреспондирующие счета (601, 244, 221 и т.д. по типу операции). |
| **Avans hesabatı** | Форма списания долга сотрудника перед кассой (**счёт 244**) через строки расходов по чекам; проведение **Дт 731 / Кт 244** (см. сервис `AdvanceReport`). |
| **Инкассация** | Специальный тип **MXO** (**`BANK_DEPOSIT`**): выдача наличных из кассы в банк (**221** как второй счёт проводки). |
| **Быстрый расход из кассы** | UI «как cashOut»: создаётся **MXO** с типом **OTHER** и счётом расходов **731** (аналог ручного списания без отдельной проводки вне журнала ордеров). |
| **Авто-касса** | Оплата **Nəqd** в продажах/закупках → **черновик** ордера в журнале кассы (связь с оплатой инвойса). |

**Gating (v8.2)**

- API кассы (`/api/banking/cash/*`) и банковский контур — единый коммерческий slug **`cash_bank_pro`** в `pricing_modules` / `activeModules` (legacy **`kassa_pro`**, **`banking_pro`**, **`kassa`** нормализуются миграцией и `normalizeCashBankActiveModules`). **ENTERPRISE** — полный доступ.
- **`cash_bank_pro`** входит в trial bundle и стандартные пакеты; для отдельных клиентов (напр. **TiVi Media**) — **ENTERPRISE** или явный список модулей.

---

## 7. Модуль 6: HR & Payroll (кадры и зарплата АР)

### Цель

Расчёт выплат сотрудникам согласно законодательству АР.

### 7.0 RBAC / IAM изоляция HR vs Payroll (v2026.04.26)

- **Payroll financial isolation:** endpoints `PayrollRun`, tax-linked payroll calculations, payout registry и Payroll-to-Bank preparation доступны только ролям **`OWNER`** и **`ACCOUNTANT`**; роли **`HR_MANAGER`** и **`DEPARTMENT_HEAD`** получают **`403 Forbidden`** на денежных маршрутах.
- **BankingGatewayService hard gate:** подготовка salary registry (`prepareSalaryRegistry`) выполняется только после явной проверки роли (`OWNER|ACCOUNTANT`) внутри gateway/policy слоя.
- **Department row-level scope:** для роли **`DEPARTMENT_HEAD`** в `AbsencesController` и `TimesheetController` применяется фильтр по `departmentId`:
  - чтение списков/карточек только по сотрудникам своего подразделения;
  - создание/изменение отсутствий и batch-операции табеля только в пределах своего подразделения;
  - approve табеля разрешён только в scope собственного департамента;
  - массовое подтверждение табеля (`POST /api/hr/timesheets/:id/approve-mass`) принимает список `employeeIds` и отклоняется при попытке подтвердить сотрудников вне RLS-scope.
- **Role enum:** `UserRole` расширен значениями **`HR_MANAGER`** и **`DEPARTMENT_HEAD`**.
- **M6/M7 integration (v2026.04.29):** финальное бухгалтерское проведение payroll выполняется на шаге `SalaryRegistry.status = PAID`; проводки формируются по группам `departmentId` сотрудников (ЦФО) с записью аналитики через `Transaction.departmentId`.

**Стаб §5.E.7 (PSA):** проектный учёт (**`Project`**, **`ProjectTask`**, **`TimeEntry`**) и связь сотрудника с логином (**опциональный** `Employee.userId` → `User`) — для billable hours и выставления счетов по проекту. Не смешивать с месячным **`Timesheet`** для payroll. Детали — **§12.8.7**.

### 7.0. Справочник `AbsenceType` и логика отсутствий (ТК AР; məzuniyyət növləri)

**Источник требований:** практика бухучёта АР (в т.ч. разбор по **muhasib.az** — «Məzuniyyət haqqı hesablanması»), согласование с заказчиком (отпуска/больничные/без оплаты).

#### Схема БД (Prisma)

| Модель / enum | Назначение |
|---------------|------------|
| **`AbsencePayFormula`** | `LABOR_LEAVE_304` — orta aylıq (12 ay) ÷ **30.4** × təqvim günləri; `SICK_LEAVE_STAJ` — ilk **14** gün işəgötürən (staj %), sonrası DSMF (ERP-dən kənar); `UNPAID_RECORD` — yalnız tabellə, ə/h artımı yoxdur. |
| **`AbsenceType`** | `id`, `organizationId`, `code` (unikal `{org, code}`), `nameAz`, `isPaid`, **`description`** (AZ izah), `formula`, `maxCalendarDays` (məs. ödənişsiz üçün **30**), timestamps. |
| **`Absence`** | `employeeId`, **`absenceTypeId`** FK → `AbsenceType`, `startDate`, `endDate`, `note`, `approved`. (Колонка `type` enum удалена; при первом запросе справочника старые коды **LABOR_MAIN** / **LABOR_ADD** / **SOCIAL** / **UNPAID** / **EDU_CREATIVE** / **SICK** автоматически приводятся к каноническим кодам ниже.) |

**Автосид** при первом `GET /api/hr/absence-types` (и миграция кодов для существующих организаций) — **5 типов** по ТК AР / источнику Inara:

| `code` | `nameAz` (кратко) | `isPaid` | `formula` |
|--------|-------------------|----------|-----------|
| **LABOR_LEAVE** | Əmək məzuniyyəti | да | `LABOR_LEAVE_304` |
| **SOCIAL_LEAVE** | Sosial məzuniyyət (hamiləlik, uşağa qulluq) | да | `LABOR_LEAVE_304` |
| **UNPAID_LEAVE** | Ödənişsiz məzuniyyət | нет | `UNPAID_RECORD` (max **30** təqvim günü) |
| **EDUCATIONAL_LEAVE** | Təhsil məzuniyyəti | да | `LABOR_LEAVE_304` |
| **SICK_LEAVE** | Xəstəlik vərəqəsi | да (işəgötürən hissəsi) | `SICK_LEAVE_STAJ` |

#### REST

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/hr/absence-types` | Список типов (роли Owner/Admin/Accountant/**User**); пустой справочник → сид. |
| GET | `/api/hr/absences` | Список **`Absence`**; query: **`dateFrom`**, **`dateTo`** (YYYY-MM-DD, отбор по пересечению с `[startDate, endDate]`), опционально **`departmentId`**. Для **`DEPARTMENT_HEAD`** параметр `departmentId` игнорируется — действует row-level scope (только сотрудники управляемого отдела). Ответ: укороченный **`employee`** (`id`, `firstName`, `lastName`), **`absenceType`** с **`nameAz`**, **`code`**, **`formula`**, **`color`** (hex-тинт для календаря). |
| POST | `/api/hr/absences` | Тело **`CreateAbsenceDto`**: `employeeId`, **`absenceTypeId`**, `startDate`, `endDate`, `note?`. |
| POST | `/api/hr/absences/vacation-pay/calculate` | **`VacationPayCalcDto`**: + optional `absenceTypeId` (должен иметь `LABOR_LEAVE_304`). Ответ: суммы с **2** знаками, `calendarDays` — целое, `divisor304`: `30.4`. |
| POST | `/api/hr/absences/sick-pay/calculate` | **`SickPayCalcDto`**: `employeeId`, `periodStart`, `periodEnd`, `absenceTypeId?` (по умолчанию тип **SICK_LEAVE**). |

#### Табель (`TimesheetService.syncAbsences`)

- `LABOR_LEAVE_304` → ячейка **`VACATION`**.
- `SICK_LEAVE_STAJ` → **`SICK`**.
- `UNPAID_RECORD` → **`OFF`** (не входит в счётчики отпуска/больничного в ведомости).

#### `PayrollService` и черновик ведомости (`createDraftRunSync`)

- Методы **`previewLaborLeavePay`** / **`previewSickLeavePay`** делегируют в **`AbsencesService`** (калькуляторы без проведения ведомости).
- При создании черновика **с привязкой к утверждённому табелю** (`timesheetId`) для штатных (**`EmployeeKind.EMPLOYEE`**) подменяется **базовый gross** до расчёта налогов (`calculatePrivateNonOilPayroll`):
  - **Оплачиваемые отпуска (LABOR_LEAVE_304)** (`VACATION` в табеле): добавляется
    \[
    (\text{SumGross} / (N_{\text{months}} \cdot 30.4)) \times \text{календарные дни отпуска в месяце}
    \]
    где \(N_{\text{months}}\) — количество **полных** отработанных календарных месяцев с даты `hireDate` (в карточке сотрудника) до месяца, предшествующего отпуску, но не более **12**. Если число календарных месяцев с **проведёнными** `payroll_slips` в 12-месячном ретроспективном окне **меньше** \(N_{\text{months}}\) и в карточке сотрудника задано **`initial_salary_balance` > 0**, то к сумме начислений в окне добавляется этот баланс (в т.ч. когда в ERP **нет ни одной** проведённой ведомости в окне — вся база для среднего берётся из `initial_salary_balance`). Если нет ни проводок, ни положительного `initial_salary_balance` — база = **оклад** (`salary`) / 30.4.
  - **Больничный (`SICK_LEAVE_STAJ`)**: к gross месяца добавляется сумма работодателя по правилам ТК AР за **календарные дни больничного в этом месяце**, с учётом **первых 14 календарных дней каждого эпизода** (по записям `Absence` с типом формулы `SICK_LEAVE_STAJ`) и процента от стажа; дни после 14-го оплачиваются DSMF вне ERP.
  - **Без оплаты** (`UNPAID_RECORD` → `OFF` в табеле): отработанные **рабочие** дни (`WORK` + **`BUSINESS_TRIP`** на рабочих днях производственного календаря АР) дают долю оклада \(\text{оклад} \times (\text{дни} / N)\), где \(N\) — число рабочих дней в месяце; дни `OFF` на рабочих днях в эту долю не входят (удержание по табелю).
- Подрядчики (**`CONTRACTOR`**) и ведомость **без табеля** — по-прежнему gross = поле **`salary`** (старое поведение).
- **Consolidated tax engine (v2026.04.16):** `PayrollService` использует единый эталонный расчетный контур по **`settings.templateGroup`** (`COMMERCIAL` / `GOVERNMENT`; значение выводится из **`organizations.kind`** при онбординге) с общими правилами округления и edge-case валидацией.
- **Payroll-to-Bank lifecycle (v2026.04.16):** `SalaryRegistry` фиксирует состояния `DRAFT -> SENT -> PAID`; `SENT` формируется strategy-пайплайном (`ABB_XML` direct / `UNIVERSAL_XLSX` file export), `PAID` подтверждается ручной сверкой.

### Payroll Processor

Черновик ведомости и проведение при превышении порога **`PAYROLL_ENTITY_ASYNC_THRESHOLD`** (константа в `payroll.constants.ts`; в продакшене **0** — при наличии сотрудников / листов фактически **всегда** через очередь **`payroll-heavy`**, BullMQ) выполняются **асинхронно**: ответ **`{ async: true, jobId }`**, статус — **`GET /api/hr/payroll/jobs/:jobId`**. Уведомления в UI / email — по политике продукта (опционально).

| Направление | Содержание |
|-------------|------------|
| **Вход** | Gross Salary |
| **Выход (удержания)** | См. ниже |

**Удержания и взносы:**

- **Income Tax:** 14% (с учётом льготы 8000 AZN в ненефтяном секторе).
- **DSMF (соцстрах, private non‑oil):** worker: 10% до 200 AZN + 10 AZN с остатка; employer: 22% (standard) или 15% (preferential) — берётся из `Organization.settings`.
- **ITS (медстрах):** progressive (1%–2%) по текущим ставкам АР (см. реализацию tax calculator).
- **Unemployment Insurance:** 0,5%.

### Авто-проводки (ФОТ в ГК)

Финальные проводки по зарплате создаются **не** при переводе `PayrollRun` в `POSTED`, а при подтверждении выплаты: **`SalaryRegistry.status → PAID`** (`PayrollService.markSalaryRegistryPaid`). Для каждого подразделения (ЦФО) формируется **отдельная** финансовая транзакция с заполнением **`Transaction.departmentId`** (аналитика ЦФО на уровне документа ГК; строки **`JournalEntry`** наследуют привязку через `transactionId`). Содержание проводок по счетам **721** (расход ФОТ и взносы работодателя), **533** (задолженность перед персоналом), **521** (обязательства по удержаниям и взносам) — агрегировано **внутри группы** `PayrollSlip`, сгруппированных по цепочке **`Employee` → `JobPosition` → `Department`**. Сотрудники, у которых по данным позиции нет департамента, попадают в общий блок с **`departmentId = null`**. Зеркалирование IFRS по правилам маппинга выполняется для тех же `transactionId`, что и NAS-проводки.

### 7.0.1. ЦФО (`departmentId`): быстрый расход (QuickExpense) и зарплата

- **`POST /api/accounting/quick-expense`** (`QuickExpenseDto`): поле **`departmentId`** **необязательно** в контракте API. Если передано — выполняется проверка, что `Department` принадлежит организации; значение сохраняется в **`Transaction.departmentId`** и участвует в отчётах с фильтром по ЦФО (например **`GET /api/reporting/pl?departmentId=…`**). Для корректного **P&L по подразделениям** по операционным расходам, вводимым через этот эндпоинт, **`departmentId` следует передавать** всегда, когда расход относится к конкретному ЦФО (иначе проводка попадает только в организационный срез без привязки к отделу).

- **Проведение ведомости ЗП в ГК:** при **`SalaryRegistry → PAID`** все **`PayrollSlip`** связанного **`PayrollRun`** группируются по **`departmentId`** департамента штатной позиции сотрудника; для **каждой** группы (включая группу без департамента, `departmentId = null`) создаётся отдельный набор проводок внутри одной **`prisma.$transaction`** через **`AccountingService.postJournalInTransaction`**, с передачей **`departmentId`** в создаваемую запись **`Transaction`**. Переход **`PayrollRun`** в статус **`POSTED`** фиксирует утверждение расчёта **без** записи в главную книгу. Поле **`PayrollRun.transactionId`** при нескольких департаментах указывает на **первую** созданную транзакцию (для совместимости навигации); полный набор проводок периода определяется по `reference` вида `PAY-{year}-{month}-D…` и фильтрам отчётности.

### 7.0.2. Экран «Календарь отсутствий» (`/hr/analytics`)

- **Назначение:** визуальное планирование и обзор **`Absence`** в виде **таймлайна** (строки — сотрудники, столбцы — дни выбранного месяца), без горизонтальных вкладок между разделами HR (PRD §10.1).
- **Фронтенд:** `apps/web/app/hr/analytics/page.tsx`; **`PageHeader`** с фильтрами **месяц** (`type="month"`) и **подразделение** (`departmentId`; для **`DEPARTMENT_HEAD`** селект скрыт — данные уже ограничены сервером).
- **Данные:** `GET /api/hr/absences?dateFrom&dateTo[&departmentId]`, `GET /api/hr/employees?departmentId&pageSize=500`, `GET /api/hr/departments` (плоский список для фильтра).
- **Цвета:** согласованы с **`AbsencePayFormula`**: трудовой отпуск (**`LABOR_LEAVE_304`**) — светлый action-тинт; больничный (**`SICK_LEAVE_STAJ`**) — розовато-красный; без оплаты (**`UNPAID_RECORD`**) — янтарный (см. `absenceCalendarColor` в API).

### 7.0.3. Накопление дней основного отпуска (`vacationDaysBalance`)

- **Поля `Employee`:** `initialVacationDays` (перенос из миграции/мастера начальных остатков), `vacationDaysBalance` (текущий остаток, **Decimal 8,2**), `baseVacationDaysPerYear` (**Int**, default **21** — ориентир ТК АР), `employmentStatus` (**`ACTIVE` \| `TERMINATED`**, default **`ACTIVE`**). Уволенные (**`TERMINATED`**) не участвуют в ежедневном пересчёте; контроль штатных мест (**Hire-Gate**) считает только **`ACTIVE`**.
- **Формула пересчёта** (сервис **`VacationBalanceService`**, метод **`recalculateBalancesAsOf(asOf)`**):  
  `vacationDaysBalance = round2( initialVacationDays + (elapsedDays / 365) * baseVacationDaysPerYear − usedLaborLeaveDays )`,  
  где **`elapsedDays`** — число полных календарных дней UTC от **`hireDate`** до **`asOf`** (в тот же календарный день = 0), **`usedLaborLeaveDays`** — сумма **включительных** календарных дней по всем **`Absence`** с **`approved = true`** и типом **`AbsencePayFormula.LABOR_LEAVE_304`**.
- **Регламент:** **`@Cron('0 1 * * *', { timeZone: 'Asia/Baku' })`** — ежедневно в 01:00 по Баку; реализация на **Nest Schedule** (отдельная очередь BullMQ для этого шага не обязательна). Контекст HTTP/tenant для cron отсутствует: **`Prisma`** без **`organizationId`** в ALS обновляет строки по глобальному ключу **`id`** (как и другие системные cron в проекте).
- **UI:** в модалке редактирования сотрудника (**`/employees`**, штатник) отображается read-only **«Доступно дней отпуска»** (`vacationDaysBalance`).

### Организационная структура и позиции

Цель — связать кадры с **иерархией подразделений**, **штатным расписанием** и **аналитикой по ЦФО** (см. [PRD.md](./PRD.md) §4.9).

#### Схема данных (Prisma)

| Модель | Поля | Примечания |
|--------|------|------------|
| **Department** | `id`, `name`, `parentId` (self-relation, nullable для корня), `managerId` (FK → `Employee`, nullable при первичном заведении структуры), `organizationId` | Индексы: `organizationId`, `parentId`. Уникальность имён в рамках организации — по политике продукта (по `parentId` + `name` или глобально). |
| **JobPosition** | `id`, `name`, `departmentId` (FK → `Department`), `totalSlots` (Int, ≥ 1), `minSalary`, `maxSalary` (Decimal), `organizationId` | Вилка окладов — для контроля и отчётов; валидация `minSalary ≤ maxSalary`. |
| **Employee** | Обязательное **`positionId`** (FK → `JobPosition`); **`initialVacationDays`**, **`vacationDaysBalance`**, **`baseVacationDaysPerYear`** (default 21), **`employmentStatus`** (default `ACTIVE`) — см. **§7.0.3**. | **Миграция:** для legacy — backfill позиции и статуса `ACTIVE`. |

**Зависимости:** при появлении `Department.managerId` → `Employee` возможна циклическая ссылка (отдел ссылается на сотрудника, сотрудник — на позицию в отделе). На этапе миграции допускается `managerId = null`; заполнение руководителей — после создания карточек сотрудников.

#### Бизнес-логика

**Валидация штата (`EmployeeService.create` / при смене позиции):**

- Пусть `occupied = count(Employee where positionId = X AND organizationId = …)` (при необходимости исключая удалённых / уволенных — по полю статуса, если появится).
- Условие: `occupied < JobPosition.totalSlots`.
- При нарушении: HTTP **402 Payment Required**, тело с кодом **`QUOTA_EXCEEDED`** (см. **§14.8.7**); в NestJS — **`QuotaExceededException`**.
- **Защита от гонок (M6):** проверка `occupied` и запись нового сотрудника (или смена `positionId`) выполняются в одной транзакции с уровнем изоляции **`Serializable`**, чтобы параллельные API-наймы на одну и ту же `JobPosition` не могли обойти лимит `totalSlots` (устранение TOCTOU между `count` и `create`).

**Иерархия отделов (UI / API):**

- Реализовать **рекурсивный запрос** для дерева подразделений: либо **CTE** в сыром SQL (`WITH RECURSIVE` в PostgreSQL), либо обход в сервисе при ограниченной глубине; ответ API — вложенный JSON (`children[]`) или плоский список с `parentId` + сортировка для построения дерева на клиенте.

#### Аналитика (Reporting)

- **QuickExpense, зарплата (после `SalaryRegistry → PAID`) и прочие проводки с `Transaction.departmentId`:** разрезы P&L по ЦФО (**`GET /api/reporting/pl?departmentId=…`**) — по полю **`Transaction.departmentId`** в связке `JournalEntry` → `Transaction` (см. **§7.0.1**); строка «расходы на оплату труда» (**721**) в разрезе департамента включает ФОТ из детализированных зарплатных транзакций.

### §8.0 Integrations: ƏMAS (Əmək və Məşğulluq Alt Sistemi)

**ƏMAS** — целевой государственный контур кадровых уведомлений и событий (MLSA). **Поэтапная продуктовая стратегия** (файлы → Chrome extension → официальный B2B S2S **DOST RIM**) — **[PRD.md](./PRD.md) §13.0**; настоящий §8.0 в первую очередь задаёт **целевой технический контур фазы 3** (HTTP-адаптер к шлюзу, очереди). Для **фаз 1–2** допускаются отдельные компоненты (парсер Excel, генерация PDF/DOCX, расширение браузера) **без** полного S2S до прохождения юридического/договорного комплаенса с оператором; границы PII, аудита и ToS портала фиксируются при спайке.

Для модуля интеграции с **ƏMAS** на **фазе 3** требуется **отдельный адаптер** (выделенный Nest-модуль / bounded context), который:

- инкапсулирует **HTTP-клиент** к официальному API и поток **ASAN Login** (или актуальному механизму аутентификации оператора платформы);
- использует **очереди BullMQ** для **асинхронной** отправки исходящих сообщений (PUSH) и **обработки ответов / отложенных статусов от госсерверов** (в т.ч. polling callbacks, DLQ, exponential backoff, **идемпотентность** по `correlationId` / ключу министерства);
- не блокирует основной request-response поток UI при ожидании госответа; статусы отображаются по событиям воркера.

Продуктовая спецификация (режимы Full Sync / Manual / Selective, PULL-потоки, Reconciliation, **фазы 1–3**) — **[PRD.md](./PRD.md) §13** (в т.ч. **§13.0**).

---


## 8. Модуль 7: Reporting

### Цель

Визуализация состояния бизнеса.

| Отчёт | Описание |
|-------|----------|
| **Trial Balance (ОСВ)** | Сводка остатков на начало, оборотов за период и остатков на конец по всем счетам; параметр `ledgerType` (`NAS`/`IFRS`) |
| **P&L** | Доходы минус расходы (**accrual basis** — по отгрузке) + фильтр `departmentId` (для OWNER/ACCOUNTANT) + `ledgerType` (`NAS`/`IFRS`) |
| **Balance Sheet** | Активы, обязательства, капитал на дату |
| **Cash Flow** | Движение денег (**cash basis** — по факту оплаты), параметр `ledgerType` (`NAS`/`IFRS`) |

Горизонт v2 по Multi-GAAP отчётности закрыт: UI поддерживает глобальный NAS/IFRS переключатель, backend отчётов использует `ledgerType` для параллельных представлений книг.

---

## 9. Модуль 8: Неизменяемый аудит (AuditMutationInterceptor)

### §9.0 Структура таблицы `audit_logs` (Prisma: `AuditLog`)

Логические поля продукта и соответствие колонкам БД:

| Логическое поле | Колонка / Prisma | Описание |
|-----------------|------------------|----------|
| **entityName** (тип сущности) | `entity_type` / `entityType` | Например `Invoice`, `Employee`, `Product`, `JournalEntry`; для прочих мутаций — `HTTP_MUTATION`. |
| **entityId** | `entity_id` / `entityId` | Идентификатор сущности (UUID или строка до 255 символов для fallback). |
| **action** (HTTP-метод мутации) | `action` | `POST`, `PATCH`, `PUT`, `DELETE` (в UI OWNER-журнала маппится на CREATE / UPDATE / DELETE). |
| **userId** | `user_id` / `userId` | Пользователь из JWT (nullable для edge cases). |
| **oldData** | `old_values` / `oldValues` | JSON снимок до изменения (ключевые сущности). |
| **newData** | `new_values` / `newValues` | JSON снимок после изменения или ответа API. |
| **timestamp** | `created_at` / `createdAt` | UTC время записи. |

Дополнительно в той же строке: `organizationId`, `changes` (путь + тело для generic-мутаций), `clientIp`, `userAgent`, `hash` (SHA-256 целостности). Архивная копия — `audit_log_archives` с тем же набором полей плюс `archived_at`.

### Поведение

- **Глобальный перехватчик** NestJS (`AuditMutationInterceptor`): автоматически логирует **мутации** (`POST`, `PATCH`, `PUT`, `DELETE`) с привязкой к **`userId`** и **`organizationId`** (из JWT), за исключением публичных маршрутов auth (`/auth/login`, `/auth/register`, `/auth/refresh`). Запись в `audit_logs` выполняется **после** формирования HTTP-ответа **без ожидания** клиентом (fire-and-forget): снижает задержку ответа; при аварийном завершении процесса сразу после ответа теоретически возможна потеря последней audit-строки (см. PRD §10.0).
- Для сущностей **Invoice**, **Employee**, **Product** и для операций с **проводками** (например `POST /accounting/quick-expense` → снимок транзакции и строк `JournalEntry`) сохраняются **`oldValues`** и **`newValues`** (JSON); для прочих мутаций — запись типа `HTTP_MUTATION` с телом запроса в поле `changes`.
- В каждую запись записываются **`clientIp`**, **`userAgent`**, **`hash`** (SHA-256 от канонического JSON полей + секрет).
- **Проверка целостности:** `POST /api/audit/integrity-check` (Owner/Admin) — сверка хешей по организации; строки без хеша (legacy) учитываются отдельно.
- **Hash Chain Verify (v95+):** `POST /api/audit/verify-chain` проверяет цепочку `audit_logs` по порядку (`createdAt,id`), сверяет hash каждой записи (chain/legacy-совместимо) и возвращает список `compromisedIds` при нарушении целостности.
- **Архив:** BullMQ-процесс **раз в месяц** переносит записи `AuditLog` старше **1 года** в **`AuditLogArchive`** (отключается `AUDIT_ARCHIVE_DISABLED=1`).

**Стаб §5.E (Activity Stream):** пользовательская коллаборация (**`EntityActivity`**, **`EntityComment`**, **`Mention`**) — **отдельно** от `AuditLog`: не дублирует security-аудит; системные события ленты могут эмититься рядом с успешной мутацией (см. **§12.8.2**). Уведомления о @mention — через существующую модель **`Notification`** и REST **`/api/notifications`** (PRD §10.2).

Продуктовое описание — [PRD.md](./PRD.md) §4.8.

### §9.A API «Audit Hub» (платный add-on)

- Реализация: **`apps/api/src/audit-hub`**, префикс **`/api/audit-hub/*`**, глобально **`SubscriptionGuard` + `@RequiresModule("audit_hub")`**, роли: **OWNER / ADMIN / ACCOUNTANT / AUDITOR** (см. контроллер).
- **`GET /api/audit-hub/summary`** — KPI для дашборда (30 дней: audit notes, samples, audit mutations, число кандидатов backdating).
- **`GET /api/audit-hub/timeline`** — объединение **`AuditLog`** + **`EntityActivity`** при переданных `entityType` (activity slug) и `entityId`, иначе org-wide **`AuditLog`**.
- **`GET /api/audit-hub/backdating`** — расхождение календарной даты документа (**`Invoice.dueDate`**, **`Transaction.date`**) и **`createdAt`**.
- **`POST /api/audit-hub/sampling`**, **`GET /api/audit-hub/sampling/:id`** — сохранённая выборка **`AuditSample`** (`scope`, `mode`, `params`, `documentRefs` JSON, **`seed`**).
- **`POST /api/audit-hub/bulk-export`** — ZIP (manifest + файлы из object storage по ссылкам выборки).
- **`GET /api/audit-hub/reconciliation/nas-ifrs`** — финальные **`Transaction`** за период: (a) **асимметрия** — по **`JournalEntry`** есть строки только **`NAS`** или только **`IFRS`**; (b) опционально **`includeTotalsMismatch=true`** — оба слоя есть, но суммы **`debit`** по **`NAS`** и **`IFRS`** расходятся (эвристика v2, не замена формальному закрытию периода).
- **`GET /api/audit-hub/risk`** — эвристики риска (детекторы в одном JSON): дубликаты **`CashOrder`** (**`POSTED`**, окно **`windowDays`**); дубликаты **`InvoicePayment`**; **«spikes»** по дебету расходных счетов; концентрация оплат по контрагенту; **z-score** по суммам **`InvoicePayment`** на контрагента (эвристика `|z|≥2`); **`@Throttle`** на контроллере (см. код).
- **`GET /api/audit-hub/calculation/:type/:id`** — «объяснение» проводки/документа (**`schemaVersion: 1`**): **`journal_posting`**, **`invoice`**; **`fx_snapshot`** — строка **`CbarOfficialRate`** (глобальный справочник курсов, не tenant); **`fixed_asset_depreciation`** — **`FixedAssetDepreciationMonth`**; **`payroll_accrual`** — агрегаты **`PayrollRun`** + **`PayrollSlip`** (без повторного расчёта налоговой математики в HTTP).
- **Именованные задания аудита:** модель **`AuditEngagement`**, REST **`GET/POST /api/audit-hub/engagements`**, **`PATCH /api/audit-hub/engagements/:id/status`**, **`GET /api/audit-hub/engagements/:id`**; приглашения клиентской org: **`POST /api/audit-hub/engagements/invites`**, **`GET /api/audit-hub/engagements/invites/outbox`**, **`POST .../invites/:id/revoke`**.
- **Внешний аудитор (guest session):** self-service **`/api/audit-hub/me/*`** — **`GET audit-invites/inbox`**, **`POST audit-invites/:id/accept`**, **`POST audit-invites/:id/decline`** (тело с **`token`**), **`GET audit-engagement/context`**; активная сессия — заголовки **`X-Audit-Engagement-Invite-Id`** + **`X-Audit-Engagement-Token`** (валидируются middleware), **`organizationId` в JWT** временно трактуется как **организация клиента**; биллинг **`audit_hub`** обязателен у **клиентской** org; **`POST /api/audit-hub/bulk-export`** для гостя — **ужесточённый** лимит файлов в ZIP (см. сервис).
- **Наблюдаемость guest:** глобальный interceptor пишет цепочку **`AuditLog`** для мутаций вне **`GET/HEAD/OPTIONS`** при активной engagement-сессии (метаданные приглашения в payload).
- **`EntityComment.kind`:** enum **`EntityCommentKind`** (`NORMAL` \| `AUDIT_NOTE`); **AUDITOR** создаёт только **`AUDIT_NOTE`**; **`AuditorMutationGuard`** пропускает мутации только для **`POST/PATCH/DELETE /api/activity/.../comments`** в рамках согласованного контракта.
- **Производительность (NAS/IFRS + risk):** тяжёлые отчёты используют **`$queryRaw`** с фильтром **`organization_id`** и лимитом **`take`**; в схеме уже есть опорные индексы: **`transactions`** (`organizationId`, `date`, `isFinal` и др.), **`journal_entries`** (`organizationId`, `transactionId`, `ledgerType`), **`cash_orders`** (`organizationId`, `date`), **`invoice_payments`** (`organizationId`, `date`). При росте объёма данных — профилировать `EXPLAIN ANALYZE` на прод-подобной выборке; новые составные индексы добавлять только после подтверждённого плана запроса (избегать лишних индексов на запись).

---

## 10. Модуль 9: Inventory Service (склад) — обновление

### Цель

Поддержка корректировки складских остатков с немедленным отражением **отклонения себестоимости** в главной книге.

### Метод `adjustStock`

| Параметр | Описание |
|----------|----------|
| `productId` | Идентификатор номенклатуры (товара) в рамках организации |
| `quantity` | Величина корректировки в натуральных единицах (положительное число) |
| `type` | `'IN'` — оприходование (увеличение остатка); `'OUT'` — списание (уменьшение остатка) |

**Поведение:**

1. Обновить складские движения / остатки (`StockMovement` или эквивалент) в **одной БД-транзакции** с финансовой частью.
2. Создать **`Transaction`** и набор **`JournalEntry`**, отражающих **разницу стоимости** по результату корректировки (учётная себестоимость единицы × количество; метод оценки — как в действующем складском модуле — средняя / FIFO и т.д.).
3. Корреспонденции — по плану счетов и политике продукта (например ТМЦ **201**, себестоимость **701**, прочие доходы/расходы для отклонений — см. [PRD.md](./PRD.md) §4.10).
4. Контекст запроса: **`organizationId`** из JWT; валидация принадлежности `productId` организации.

**Инварианты:** `validateBalance()` для проводок; запрет мутаций в закрытом периоде (как для прочих финопераций).

**Сличительная ведомость (`InventoryAudit`):** полный контракт, блокировка склада и матрица проводок — в подразделе **§10.1** ниже; новые интеграции и фронт должны опираться на **`/api/inventory/reconciliations/*`**, а не на устаревшие **`POST /api/inventory/audits/:id/approve`** / **`sync-system`**.

**Стаб §5.E.1 (Virtual stock):** read-only расчёт доступного выпуска ГП по **`ProductRecipe`** и остаткам **`StockItem`** на выбранном складе — **`GET /api/manufacturing/recipes/:id/available-output`**, логика в **`ManufacturingService`**. См. **§12.8.1**.

### Сличительная ведомость — `InventoryAudit` / Inventory Reconciliation (синхрон с PRD §7.10)

**Назначение:** один документ на **один склад**; фиксация учётного и фактического количества по строкам, фаза пересчёта, классификация расхождений и **атомарное** проведение склада + NAS.

**Модель данных (Prisma):**

- **`InventoryAudit`**: `organizationId`, `warehouseId`, `date`, `status` (**`DRAFT` \| `COUNTING` \| `REVIEW` \| `COMPLETED` \| `CANCELLED`**), опционально `number`, `notes`, `responsibleEmployeeId`, `postedTransactionId`, таймстемпы фаз (`startedAt`, `completedAt`, `cancelledAt`), soft-delete поля при необходимости (см. миграции).
- **`InventoryAuditLine`**: `inventoryAuditId`, `productId`, `systemQty`, `factQty`, `costPrice`, **`discrepancyKind`** (`NONE` \| `SURPLUS` \| `SHORTAGE_WRITEOFF` \| `SHORTAGE_EMPLOYEE`), опционально **`accountableEmployeeId`** (обязателен для `SHORTAGE_EMPLOYEE`), `postedAmountAzn`, `reasonNote`.
- Уникальность строки в документе: `@@unique([inventoryAuditId, productId])`.
- **Инвариант БД:** не более **одной** активной ведомости в статусе **`COUNTING`** или **`REVIEW`** на пару `(organizationId, warehouse_id)` — частичный уникальный индекс в PostgreSQL (`inventory_audits_active_per_warehouse_uidx`).

**Жизненный цикл:**

1. **`DRAFT`** — документ без снимка строк (или после создания до запуска пересчёта); склад **не** блокируется только из‑за DRAFT.
2. **`POST /reconciliations/:id/start` (`startCounting`)** — создаёт строки со **снимком** `systemQty` / начальным `factQty` и `costPrice` из учёта; переводит в **`COUNTING`**; включает **блокировку склада** для новых движений.
3. **`COUNTING`** — правка `factQty` / `costPrice` по строкам (`PATCH .../lines/:lineId` или совместимый `PATCH /inventory/audits/lines/:lineId`).
4. **`POST .../submit`** — перевод в **`REVIEW`**; блокировка склада сохраняется.
5. **`REVIEW`** — классификация расхождений: `PATCH .../lines/:lineId/classification` (`discrepancyKind`, для МОЛ — `accountableEmployeeId`).
6. **`POST .../complete`** — **`COMPLETED`**: одна **`prisma.$transaction`** — `StockMovement` + проводки NAS + связь `postedTransactionId`.
7. **`POST .../cancel`** — **`CANCELLED`** из `DRAFT` / `COUNTING` / `REVIEW` (снимает блокировку после завершения операции).

**Блокировка склада:** пока по складу есть ведомость в **`COUNTING`** или **`REVIEW`**, любой код, создающий **`StockMovement`** по этому складу (закупка, перемещение, продажа, производство, акт физ. инвентаризации и т.д.), должен вызывать **`assertWarehouseNotUnderReconciliation`** — ответ **`409`** с кодом **`WAREHOUSE_LOCKED_FOR_RECONCILIATION`**.

#### §10.1 Канонический API и RBAC

**Базовый префикс:** **`/api/inventory/reconciliations`**.

| Метод | Путь | Роли (мутации) | Назначение |
|------|------|----------------|------------|
| GET | `/api/inventory/reconciliations` | авторизованный | Список ведомостей |
| GET | `/api/inventory/reconciliations/:id` | авторизованный | Карточка со строками |
| POST | `/api/inventory/reconciliations` | OWNER, ADMIN, ACCOUNTANT | Создать **DRAFT** |
| POST | `/api/inventory/reconciliations/:id/start` | OWNER, ADMIN, ACCOUNTANT | **COUNTING** + снимок + lock |
| PATCH | `/api/inventory/reconciliations/:id/lines/:lineId` | OWNER, ADMIN, ACCOUNTANT | Обновить факт/цену в **COUNTING** |
| POST | `/api/inventory/reconciliations/:id/submit` | OWNER, ADMIN, ACCOUNTANT | **COUNTING → REVIEW** |
| PATCH | `/api/inventory/reconciliations/:id/lines/:lineId/classification` | OWNER, ADMIN, ACCOUNTANT | Классификация в **REVIEW** |
| POST | `/api/inventory/reconciliations/:id/complete` | OWNER, ADMIN, ACCOUNTANT | **REVIEW → COMPLETED** (склад + ГК) |
| POST | `/api/inventory/reconciliations/:id/cancel` | OWNER, ADMIN, ACCOUNTANT | Отмена документа |

Мутации проходят **`AuditMutationInterceptor`** (см. §9). Деталь RBAC — §2.0.

**Совместимость `/api/inventory/audits`:** `POST /` создаёт тот же **DRAFT**, что и **`POST /reconciliations`** (делегирование в `createReconciliationDraft`). `PATCH .../lines/:lineId` делегирует в **`setLineFact`**. Эндпоинты **`POST .../:id/approve`** и **`POST .../:id/sync-system`** **отключены** — клиент должен использовать поток **`reconciliations`** (`complete` / снимок при `start`).

**Обратная несовместимость:** значение статуса **`APPROVED`** у `InventoryAudit` удалено из enum; исторические строки мигрированы в **`COMPLETED`**. Излишки в ГК отражаются на **631** (константа **`INVENTORY_SURPLUS_INCOME_ACCOUNT_CODE`**), не на **611**.

#### §10.1.0 `InventoryAuditService.complete` — проводки (NAS) и склад

**Note (audit sync):** Treasury cash orders were renamed **MKO/MXO → KMO/KXO**, and incoming cash orders (KMO) have an additional **KO-1** print form requirement (see §6.0).

- Выполняется в **`prisma.$transaction`**; проверка **закрытого периода** по дате документа (как для прочих проведений); повторное **`complete`** запрещено.
- Для каждой строки с ненулевым расхождением после **`REVIEW`**: \( \Delta = factQty - systemQty \); сумма оценки из **`costPrice`** и количества; `invAcc` = **201** или **204** из **`Warehouse.inventoryAccountCode`**.
- **`SURPLUS`** (\( \Delta > 0 \)): **Дт invAcc / Кт 631**, складское движение **IN**, reason **ADJUSTMENT**.
- **`SHORTAGE_WRITEOFF`** (\( \Delta < 0 \)): **Дт 731 / Кт invAcc**, движение **OUT** (списание по **`StockService.computeIssueUnitCost`** / политике учёта орг).
- **`SHORTAGE_EMPLOYEE`** (\( \Delta < 0 \)): **Дт 244 / Кт invAcc**, движение **OUT**; требуется **`accountableEmployeeId`**.
- Итоговая транзакция ГК: **`reference`** вида **`INV-RECON-{id}`**, финальная проводка с **`isFinal: true`** в рамках сервиса учёта.

**i18n (RU/AZ):** ключи **`inventory.audit*`** (в т.ч. **`auditStatusDraft`**, **`auditStatusCounting`**, **`auditStatusReview`**, **`auditStatusCompleted`**, **`auditStatusCancelled`**; устаревший **`auditStatusApproved`** может сохраняться в каталоге для совместимости) — UI **`/inventory/audits`**, **`/inventory/audits/[id]`**, **`InventoryAuditCreateFlow`** / модалки; данные для экранов приходят с **`GET /api/inventory/reconciliations`** (список) и **`GET …/:id`**; см. **`npm run i18n:audit`** (§17).

#### §10.1.1 Документы физической инвентаризации (`InventoryAdjustment`)

**Назначение:** акт пересчёта по **выбранным** позициям номенклатуры (в отличие от описи `InventoryAudit`, которая подтягивает полный снимок остатков по складу).

**Prisma:**

- **`InventoryAdjustment`**: `organizationId`, `warehouseId`, `date`, `status` (`DRAFT` \| `POSTED`), `reason`, `doc_type` (**`WRITE_OFF`** \| **`SURPLUS`**).
- **`InventoryAdjustmentLine`**: `adjustmentId`, `productId`, `expectedQuantity`, `actualQuantity`, `deltaQuantity`, `unitCost`.

**API (Nest, `InventoryController`):**

| Метод | Путь | Роли (мутации) | Назначение |
|------|------|----------------|------------|
| GET | `/api/inventory/physical-adjustments` | любой авторизованный | Список документов; опционально `?warehouseId=` |
| GET | `/api/inventory/physical-adjustments/:id` | любой авторизованный | Карточка со строками и товарами |
| POST | `/api/inventory/physical-adjustments` | OWNER, ADMIN, ACCOUNTANT | Черновик: `expectedQuantity` из `StockItem`, `delta = actual − expected` |
| POST | `/api/inventory/physical-adjustments/:id/post` | OWNER, ADMIN, ACCOUNTANT | Проведение: `InventoryService.postAdjustment` + `assertMayPostAccounting` |

**Проведение (`postAdjustment`):**

- Одна **`prisma.$transaction`**; проверка **закрытого периода** по `monthKeyUtc(date)`; повторное проведение запрещено (`status` уже `POSTED`).
- Перед движениями **пересчитываются** `expectedQuantity` и `deltaQuantity` от **текущих** `StockItem` на складе документа (факт берётся из сохранённых строк).
- **WRITE_OFF:** любая строка с `delta > 0` → **400**; **SURPLUS:** любая строка с `delta < 0` → **400**. Смешанные расхождения в одном документе — только через **сличительную ведомость** (`InventoryAudit`), не через `InventoryAdjustment`.
- Склад: **`StockMovement`** type IN/OUT, reason **ADJUSTMENT**, `documentDate` = полдень UTC по дате документа, `note = INV_PHYS:{adjustmentId}`.
- **Недостача:** `StockService.computeIssueUnitCost` (FIFO) на `|delta|`; проводки в одной транзакции — агрегат **Дт 731 — Кт invAcc** (201/204 по `Warehouse.inventoryAccountCode`).
- **Излишек:** цена единицы = `line.unitCost` если > 0, иначе `StockItem.averageCost`; агрегат **Дт invAcc — Кт 631** (прочие доходы по излишкам, как в ручной корректировке `adjustStock`).
- Итоговая проводка: reference **`INV-PHYS-{id}`**, `isFinal: true`.

**UI:** страница **`/inventory/physical`**, ключи i18n `inventory.physical*`.

#### §10.2.0 Manufacturing — BOM, WIP (целевая модель) и распределение накладных

**Task IDs:** **`MOD-MFG-001`** (BOM / `ProductRecipe`), **`MOD-MFG-002`** (атомарный выпуск), **`MOD-MFG-WIP-001`** (очередь производства / WIP — **PRD [x] COMPLETED**), **`MOD-MFG-OH-001`** (overhead allocation).

**BOM (рецепт / Bill of Materials):** каноническая модель — **`ProductRecipe`** (один готовый **`Product`** на организацию) + строки **`ProductRecipeLine`** (`quantityPerUnit`, **`wasteFactor`**, уникальность компонента в рецепте) + опционально **`ProductRecipeByproduct`**. Валидация ацикличности: готовый продукт не может входить в собственный BOM. Выпуск в текущей реализации — документ **`ManufacturingRelease`** с `batchQty` (см. **§10.2.1**).

**WIP и производственные заказы:** **`ManufacturingOrder`** + **`ManufacturingOrderLine`** (статусы `DRAFT` → `IN_PROGRESS` → `COMPLETED` | `CANCELLED`). **Старт:** списание сырья, **Dr 203 / Cr 201** (`WIP_MANUFACTURING_ACCOUNT_CODE = "203"`). **Завершение:** приход ГП, **Dr 204 / Cr 203**, связь с **`ManufacturingRelease`**. **Отмена из IN_PROGRESS:** возврат сырья, **Dr 201 / Cr 203**. REST: `GET/POST /api/manufacturing/orders`, `POST …/:id/start|complete|cancel`; UI **`/manufacturing/orders`**. **Legacy:** атомарный **`POST /api/manufacturing/release`** (Dr 204 / Cr 201 одним шагом) сохранён.

**Распределение накладных (cost allocation):** пул **`OverheadPool`** за **`calendarMonth`**, драйвер **`OverheadDriver`** (QUANTITY / MATERIAL_COST / VOLUME / TIME), распределение на выбранные проведённые **`ManufacturingRelease`** через **`POST …/manufacturing/overhead/allocate-batch`** с проводками из пула счёта затрат на **711** (детали GL — **§12.8.6**). Идемпотентность по паре (poolId, releaseId).

#### §10.2 (v14.0) Модуль Manufacturing — спецификации (ProductRecipe)

**Связь с ЦФО:** производственные и складские проводки, как и прочие операционные расходы, для P&L по подразделениям должны согласовываться с правилами **`departmentId`** в финансовых транзакциях — см. **§7.0.1** (в т.ч. быстрый расход и зарплатные проводки по ЦФО при **PAID** реестра выплат).

**Стаб §5.E.6 (Cost allocation):** распределение пула косвенных затрат за календарный месяц на проведённые **`manufacturing release`** по драйверу (**`OverheadDriver`**, **`OverheadPool`**, **`OverheadAllocation`**). Детали REST и проводок — **§12.8.6**.

#### Financial Reports (v16.1): Balance Sheet + Cash Flow

**Goal:** management reporting built on top of the Ledger (double-entry), using **Decimal** arithmetic on the API side.

**Balance Sheet mapping (GL → Management lines)**

Balance is generated **as of a date** (`asOfDate`, UTC, inclusive) using closing balances from the Ledger.

- **Assets**
  - **Cash & Bank**: **101.\*** (cash desks), **221.\*** (bank accounts), plus legacy **223.\*** if present.
  - **Receivables**: **211.\***
  - **Inventory / Stock**: **201.\*** (goods), **204.\*** (finished goods)
- **Liabilities**
  - **Payables**: **531.\***
  - **Payroll & taxes payable**: **521.\***, **523.\***
- **Executive widgets** (`GET /api/reports/executive-widgets`): ответ содержит **отдельные** суммы по **531** (кредиторка поставщиков) и по **521 + 523** (ЗП и налоги у источника и смежные обязательства); на дашборде не объединяются в одну KPI «кредиторка».
- **`StockMovement.documentDate`:** для метода оценки **FIFO** порядок слоёв при расчёте себестоимости списания — **`document_date` ASC**, при равенстве дат — **`created_at` ASC**; при создании движения задаётся бизнес-датой (например дата описи инвентаризации, `recognizedAt` / `createdAt` инвойса для отгрузки, текущий момент для закупки/перемещения/корректировки).
- **Equity**
  - **Charter capital**: **301.\*** (and related equity codes if present)
  - **Retained earnings / P&L result**: derived from equity / revenue / expense movements up to `asOfDate` (implementation detail in `FinancialReportService`)

**Cash Flow (Direct method)**

Cash Flow is generated for a period (`dateFrom`..`dateTo`, UTC inclusive). API: **`GET /api/reports/cash-flow`**.

- **Cash sources**:
  - **Bank** (221.\*): `BankStatementLine` с **`origin` ∈ {`FILE_IMPORT`, `MANUAL_BANK_ENTRY`}**, с привязкой к `CashFlowItem`; период — по **`valueDate`**, при отсутствии — по дате выписки.
  - **Cash desk** (101.\*): проведённые **KMO/KXO** (`CashOrder`), с привязкой к `CashFlowItem`.
- **Grouping**: by `CashFlowItem` (code + name). Category is inferred from item code:
  - `CF-INV*` → Investing
  - `CF-FIN*` → Financing
  - otherwise → Operating

**Performance / caching**

- If the number of underlying ledger entries / source rows exceeds **1000**, the API may cache the computed report in **Redis** for a short TTL (keyed by org + params).

**Цель:** базовый CRUD для производственных рецептов (из каких материалов/сырья состоит готовый товар), закрывающий требования модуля **Manufacturing** на уровне MVP.

**Схема данных (Prisma)**

| Модель | Поля | Примечания |
|--------|------|------------|
| **ProductRecipe** | `id` (UUID), `organizationId` (FK), `finishedProductId` (FK → `Product` — готовый товар, **уникален** в рамках org: одна рецептура на SKU) | Расширение имени/`yieldQuantity` на уровне рецепта — по дорожной карте; выпуск задаётся телом `POST /manufacturing/release` (`quantity` = партия). |
| **ProductRecipeLine** | `id` (UUID), `recipeId` (FK → `ProductRecipe`), `componentProductId` (FK → `Product` — сырьё/материал), `quantityPerUnit` (Decimal — расход на **1** единицу готовой продукции), **`wasteFactor`** (Decimal, по умолчанию **0** — доля технологических потерь; фактическое списание = `quantityPerUnit * (1 + wasteFactor)`) | Уникальность `(recipeId, componentProductId)` — одно сырьё не дублируется в рецепте. |
| **ProductRecipeByproduct** | `id` (UUID), `recipeId` (FK), `productId` (FK → `Product`), `quantityPerUnit` (Decimal), `costFactor` (Decimal 0..1) | Побочные продукты / брак: при выпуске автоматически оприходуются как `StockMovement IN` с нулевой или дисконтированной себестоимостью. |

**Бизнес-логика**

- **Валидация цикла:** `finishedProductId` **не может** совпадать ни с одним `componentProductId` внутри того же рецепта (защита от рекурсивного производства). При нарушении — HTTP **400** с кодом `RECIPE_CIRCULAR_DEPENDENCY`.
- **Принадлежность:** все `Product` (готовый и компоненты) должны принадлежать тому же `organizationId`.
- `quantityPerUnit` > 0; `wasteFactor` ≥ 0 (верхняя граница в коде, напр. **2.0**, защита от ошибочного ввода).
- Партия выпуска `batchQty` > 0 — в `ReleaseProductionDto`.

**`ManufacturingService.releaseProduction`**

- Для каждой строки рецепта: `need = quantityPerUnit * (1 + wasteFactor) * batchQty`.
- Складские движения **OUT** на сумму `need`; при необходимости последующим этапом — отдельный документ **списание отходов** / побочного продукта (PRD §4.10.1).
- Для каждой строки `byproducts`: `byQty = quantityPerUnit * batchQty`, оприходование **IN** в том же складе с ценой `byUnitCost = (totalMaterialCost * costFactor) / byQty` (по умолчанию `costFactor=0` → нулевая стоимость).

#### §10.2.1 (v2026.04.30) Dynamic Valuation + Release workflow

- **Organization settings:** добавлен параметр `inventoryValuation` (`FIFO` | `AVCO`) в профиль настроек организации; сохраняется совместимо с `valuation_method`.
- **COGS / issue unit-cost:** `StockService.computeIssueUnitCost` выбирает метод по настройке:
  - `FIFO` — слои `stock_movements` (`document_date`, затем `created_at`);
  - `AVCO` — средневзвешенная стоимость остатка (`stock_items.average_cost`) как `totalCost / totalQty`.
- **Manufacturing release API:** `POST /api/manufacturing/release` принимает `recipeId`, `quantity`, `warehouseId?`:
  1. Списание компонентов с корректировкой на `wasteFactor` (`need = quantityPerUnit * (1 + wasteFactor) * batchQty`).
  2. Оприходование готовой продукции в `StockItem`/`StockMovement`.
  3. Оприходование побочных продуктов/брака (`ProductRecipeByproduct`) с нулевой или дисконтированной стоимостью.
  4. Проводка выпуска: `Дт 204 (готовая продукция) — Кт 201 (сырьё/материалы)`.

#### §10.2.2 (v2026.05.06) WMS-light bins (адресное хранение)

- **Схема склада:** добавлена сущность `WarehouseBin` (`warehouseId`, `code`, `barcode`) с API:
  - `GET /api/inventory/bins?warehouseId=...`
  - `POST /api/inventory/bins`
- **Остатки/движения:** в `StockItem` и `StockMovement` добавлена опциональная ссылка `binId`.
- **Целостность ячейка↔склад (M9, DB):** в PostgreSQL действуют **CHECK** `stock_items_bin_same_warehouse_chk` и `stock_movements_bin_same_warehouse_chk`: при непустом `bin_id` существует строка `warehouse_bins`, у которой **`id = bin_id` и `warehouse_id` совпадает** с `warehouse_id` строки остатка/движения; до введения ограничения расхождения чинятся **`UPDATE … SET bin_id = NULL`**. Это запрещает «перелёт» товара в ячейку чужого склада на уровне БД.
- **Закупка (alış fakturası):** `POST /api/inventory/purchase` — тело **`goodsLines` / `serviceLines`** (dual-list) или legacy **`lines` + `kind`**; **`pricesIncludeVat`**, **`currency`**, **`fxRateToAzn`** — как в PRD §4.4. Проводки: **товары** — **Дт 201** (+**241** при ценах с НДС) **Кт 531**; **услуги** — **Дт 731** (+**241**) **Кт 531**; **dual** — агрегированные строки в одной транзакции. **`StockMovement` из этой мутации не создаются**; в **`Transaction.purchase_snapshot`** сохраняется JSON строк для связи с приходным ордером (§10.2.5). Поле **`warehouseId`** в DTO закупки для GL **не используется** (склад — только в **`CreateReceiptModal`**).
- **UI:** раздел «Топология склада» и настройки склада — на **`/inventory/settings`**; реестр закупок **`/purchases`** + **`PurchaseModal`** (без складских полей в проводке); приход на склад — **`/inventory/receipts`** + **`CreateReceiptModal`**.

#### §10.2.3 (v2026.05.01) Web: Anbar — подстраницы и модалки

- **`/inventory`** — только остатки (**Qalıqlar**), фильтр по складу; в API **`GET /api/inventory/stock`** возвращает строки только с **`product.isService === false`**.
- **`/inventory/movements`** — реестр движений; **`GET /api/inventory/movements`** — только по товарам (**`isService: false`**), опционально `note` / `notes` (CSV) для фильтрации по `stock_movements.note`.
- **`/inventory/transfers`** — реестр строк **`TRANSFER_OUT`** (партия `transfer_batch_id` + сопоставление со **`TRANSFER_IN`**); создание — кнопка **+ Yeni köçürmə** → **`TransferModal`** (**`CreateTransferModal`**).
- **`/inventory/adjustments`** — реестр движений с примечаниями **`INV_ADJ_IN`** / **`INV_ADJ_OUT`**; создание — **+ Yeni düzəliş** → **`AdjustmentsModal`** (**`CreateAdjustmentModal`**).
- **`/inventory/audits`**, **`/inventory/audits/[id]`** — реестр (пагинация **`ListPaginationFooter`**, 25/50/100) и карточка **сличительной ведомости**; модалка создания — **`InventoryAuditCreateFlow`** с **`compactForModal`** (склад + комментарий → `POST` + `start` → редирект на `[id]`); мутации — **`/api/inventory/reconciliations/*`**. Не полагаться на **`POST /api/inventory/audits/:id/approve`** (**§10.1**).
- **`/inventory/physical`** — реестр **`GET /api/inventory/physical-adjustments`** + **`PhysicalAdjustmentModal`**; акты **`InventoryAdjustment`** (WRITE_OFF / SURPLUS); см. **§10.1.1**.
- **`/purchases`** — реестр закупок (приходы **PURCHASE**) + кнопка **+ Yeni alış** → **`PurchaseModal`** (только по клику; query из глобальной навигации не используется). В меню строки (товарные **`goods`** / **`dual`**) — **«Mədaxil orderi yarat»**: открывает **`CreateReceiptModal`** с предзаполненным **`basisTransactionId`**.
- **`/inventory/receipts`** — реестр движений с **`reason=RECEIPT`**; кнопка нового прихода → **`CreateReceiptModal`** (`apps/web/components/inventory/create-receipt-modal.tsx`; алиас экспорта **`ReceiptModal`** из `app/inventory/receipts/receipt-modal.tsx`).

#### §10.2.4 (v2026.05.15) Web: İstehsalat (отдельный раздел навигации)

- Маршруты: **`/manufacturing`** — **дашборд** (виджеты); **`/manufacturing/recipes`**, **`/manufacturing/releases`**, **`/manufacturing/overhead`** (см. PRD **§4.10A**; старые **`/recipe`** / **`/release`** — редирект). Компоненты: `apps/web/components/manufacturing/*` (`recipe-modal`, `release-modal`, `manufacturing-dashboard-widgets`). Раздел не вложен в «Anbar» в клиентском меню.

**API (REST, префикс `/api`)**

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/manufacturing/dashboard` | Виджеты: `activeRuns` (0 + comingSoon), `recentReleases`, `inventoryAlerts` (дефицит компонентов BOM). |
| GET | `/manufacturing/recipes?page&pageSize&q` | Пагинация; поиск по `name` и `finishedProduct.name`. |
| GET | `/manufacturing/recipes/:recipeId` | Детали с `lines`, `byproducts`, UOM. |
| GET | `/manufacturing/recipes/by-product/:finishedProductId` | Рецепт по готовому продукту. |
| GET | `/manufacturing/recipes/:recipeId/available-output?warehouseId=` | Virtual stock (без изменений). |
| PUT | `/manufacturing/recipes` | Upsert (`name`, `finishedProductId`, `lines`, `byproducts`) в `prisma.$transaction`. |
| DELETE | `/manufacturing/recipes/:recipeId` | Удаление; запрет при наличии `ManufacturingRelease`. |
| GET | `/manufacturing/releases?page&pageSize&period&recipeId&warehouseId` | Журнал выпусков (`status: COMPLETED` в ответе). |
| POST | `/manufacturing/release` | Проведение выпуска (атомарно: склад + NAS + `ManufacturingRelease`). |
| GET | `/manufacturing/overhead/period-summary?period=` | Выпуски месяца, `suggestedOverheadTotal` (дебет **741**), `totalAllocated`. |
| POST | `/manufacturing/overhead/allocate-batch` | Пул + распределение на выбранные `releaseIds` (`QUANTITY` → `VOLUME`, `MATERIAL_COST`). |
| GET/POST/PATCH | `/manufacturing/overhead/drivers`, `pools`, `allocate` | Legacy power-user API (без изменений). |

**Gating:** все эндпоинты защищены `@RequiresModule('manufacturing')`; при `tier === ENTERPRISE` — доступ без ограничений.

#### §10.2.5 (v2026.05.04) Anbar mədaxil orderi: API и автозаполнение из alış

- **`POST /api/inventory/receipts`** — тело **`CreateWarehouseReceiptDto`**: `warehouseId`, `date`, опционально **`basisTransactionId`** или **`referenceId`** (синоним), массив **`lines`** или синоним **`items`** (`productId`, `quantity`, опционально `binId`). Роли: **OWNER**, **ADMIN**, **ACCOUNTANT**, **WAREHOUSE_KEEPER**. Основание валидируется как проведённая закупка с товарными строками (см. `InventoryService.recordWarehouseReceipt`).
- **`GET /api/inventory/purchase-invoices/:id`** — детали закупки для UI: `{ id, documentDate, kind, lines[] }`, где **`lines`** разбираются из **`purchase_snapshot`**; каждая строка: **`kind`** (`goods` | `services`), **`productId`**, **`quantity`**, **`productName`**, **`sku`**. Если снимка нет — **`lines: []`**.
- **Фронт (`CreateReceiptModal`):** при смене основания или при открытии с **`initialBasisTransactionId`** — запрос **`GET …/purchase-invoices/:id`**, в таблицу попадают только **`kind === "goods"`**; **`binId`** очищается; индикатор загрузки и блокировка сохранения до завершения запроса (**`useLayoutEffect`** сбрасывает форму при открытии, затем **`useEffect`** по **`basisTransactionId`**).

#### §10.2.6 (v2026.05.04) Anbar məxarici orderi: Satış, `sales_snapshot`, отгрузка

- **`Transaction.sales_snapshot`** (`Json?`, `sales_snapshot`): после **`POST` журнала Дт 211 — Кт 601** при признании выручки по счёту (`InventoryService.applyRevenueRecognitionWithSalesSnapshot`) в той же БД-транзакции выполняется **`transaction.update`** с **`{ version: 1, invoiceId, lines: [{ kind: "goods", productId, quantity, productName, sku }] }`**. Складское списание и **701/201** **не** выполняются при признании выручки; физический расход — **`POST /api/inventory/shipments`**. У **`Invoice`** поле **`revenue_posted_transaction_id`** указывает на транзакцию выручки (для UI). Услуги-only: **`inventory_settled = true`** сразу после выручки (нет товарных строк).
- **`GET /api/inventory/sales-invoices`**, **`GET /api/inventory/sales-invoices/:id`** — реестр и детали для **`CreateShipmentModal`**; **`StockMovement`** отгрузки: **`type=OUT`**, **`reason=SHIPMENT`**, **`note`** содержит **`BASIS_TX:<transactionId>`**.
- **`POST /api/inventory/shipments`** — тело **`CreateWarehouseShipmentDto`** (аналог **`CreateWarehouseReceiptDto`**): **`basisTransactionId`** обязателен; строки — точное совпадение количеств по всем товарным позициям инвойса; затем **COGS** (**Дт 701 — Кт 201**) и **`invoice.inventory_settled = true`**.
- **`GET /api/inventory/balances`** — read-only **Anbar qalığı**: агрегат по **`stock_movements`** — **`SUM(IN) − SUM(OUT)`** с группировкой **`warehouse_id`**, **`bin_id`**, **`product_id`**; **`HAVING … > 0`**; фильтры **`warehouseId`**, **`search`** (name/SKU); UI **`/inventory/balances`**.
- **`POST /api/inventory/transfers`** — **Yerdəyişmə**: тело **`CreateTransferDto`** (`date`, `lines[]` с `productId`, `quantity`, `sourceWarehouseId`, опционально `sourceBinId`, `targetWarehouseId`, опционально `targetBinId`); в одной **`prisma.$transaction`** на строку — **`StockMovement`** **OUT** (источник) и **IN** (цель), **`reason = TRANSFER`**, общий **`transfer_batch_id`** на документ; обновление **`StockItem`** по складам; проверка доступного количества по движениям в разрезе источника (**склад + ячейка**).

### 10.3. Взаимозачёт и НДС (НК АР)

Дополняет **§3.1** (базовая проводка **Дт 531 — Кт 211** и распределение по `InvoicePayment`).

**Налоговая логика:** при вызове **`NettingService.executeNetting`** (или эквивалент `POST /api/reporting/netting`), если **организация** и **контрагент** признаны плательщиками НДС (`Counterparty.isVatPayer === true` и флаг учёта НДС по организации — по мере появления поля), в **той же БД-транзакции** допускается формирование:

- проводок по счетам **241** (НДС к зачёту) и/или **541** (НДС к уплате) **пропорционально** сумме зачёта и ставке НДС (аналогично отражению по банковской выплате / e-qaimə);

или **без** проводок на первом этапе — только **флаг/задача** «создать e-qaimə» для интеграции с e-taxes (см. PRD §4.11).

**UX:** после успешного зачёта API может возвращать `{ suggestVatInvoice: true, amount, counterpartyId }` для мастера создания e-qaimə.

---

## 11. Технические инструкции для разработки

При генерации кода **для каждого модуля** использовать единый паттерн:

1. **DTO:** описать входные данные, валидация через `class-validator`.
2. **Service layer:** бизнес-логика с обработкой ошибок (`InternalServerErrorException` или `BadRequestException` где уместно).
3. **Controller:** REST-эндпоинты (GET, POST, PATCH, DELETE).
4. **Unit tests:** минимум один тест на финансовую логику (например, сходимость баланса транзакции).

### Docker Compose

- Сервисы: как минимум **api**, **web** (при контейнеризации фронта), **postgres**, **redis**.
- **PostgreSQL:** инициализация с расширением **`uuid-ossp`**.
- Тома: данные БД, **локальное файловое хранилище** до переезда на S3-compatible.

### API

- Документация: **Swagger (OpenAPI)** — см. PRD.
- **Secure payroll export storage (v2026.04.16):** универсальные зарплатные реестры сохраняются как файл через `STORAGE_SERVICE` (S3/local), а не inline `data:` payload.
- **Temporary links (TTL):** скачивание зарплатного файла доступно только по временной подписанной ссылке и только ролям `OWNER`/`ACCOUNTANT` в пределах текущего `organizationId`.
- **Early access / painted door (market validation):** тенантские эндпоинты **`POST /api/early-access/events`**, **`POST /api/early-access/signup`**, **`GET /api/early-access/me`** — фиксация кликов, времени модалки, конверсии в лист ожидания и снимка тарифа/отрасли (см. PRD §5.0.1). Высокочастотный **`POST …/events`** **исключён** из `AuditMutationInterceptor`. Супер-админ: **`GET /api/admin/early-access/summary`**, **`GET /api/admin/early-access/events`** (кросс-тенант при `skipTenantFilter` на `/api/admin/*`). Пороговые уведомления: env **`EARLY_ACCESS_THRESHOLDS`** (по умолчанию `50,100`).
- **Industry entitlements (v2026.06):** slugs **`industry_retail_ecom`**, **`industry_logistics_customs`**, **`industry_construction`**, **`industry_crm_whatsapp`** в `customConfig.modules` / `activeModules` (Super-Admin PATCH); снимок `modules.industry*` в `/subscription/me`; при включении — навигация на shell **`/industry/{vertical}`**, иначе painted-door модалка. Не включаются автоматически для ENTERPRISE.

### 11.1. Web UI: шапка страницы (`PageHeader`)

- **Назначение:** единообразная «шапка» контентной области в `apps/web` (Next.js App Router): заголовок страницы, опционально пояснение, опционально **тулбар** (фильтры слева, действия справа) — в соответствии с **PRD §10.1**.
- **Компонент:** `PageHeader` в `apps/web/components/layout/page-header.tsx` (props: `title`, `subtitle?`, `leading?`, `actions?`). Подзаголовок рендерится во вложенном `div`, допускающем несколько абзацев. При наличии **`leading`** и **`actions`** компонент выстраивает одну строку: **слева** — `leading`, **справа** — `actions` (`justify-between`), что используется на отчётных экранах (хаб **Reporting**, **Tax export**, **Holding P&L**, **Cash flow**).
- **Тулбар `actions`:** все кастомные элементы управления (инпуты, пикеры) внутри слота `actions` компонента `PageHeader` должны быть жёстко выровнены по вертикали (`flex items-center`) и соответствовать стандартной высоте кнопок тулбара (32px / `h-8`).
- **Пагинация реестров (API + web):** для списков с большим объёмом строк контракт ответа — **`{ items, total, page, pageSize }`** (верхняя граница `pageSize` на сервере); клиент — компонент **`ListPaginationFooter`** (`apps/web/components/list-pagination-footer.tsx`): опции **25 / 50 / 100**, default **25**; футер при **`!loading`** всегда (в т.ч. `total === 0`). Пустая опция нативных `<select>` — **`common.emptyValue`** («—»), хелпер **`EmptySelectOption`**. Конкретные пути — OpenAPI; ориентир по UX — банковский реестр **`GET /api/banking/lines`** (**§6.0**).
- **Навигация:** переходы между модулями — через **сайдбар**; отдельная горизонтальная полоса «хлебных» ссылок между разделами **не применяется** (исторический `ModulePageLinks` из репозитория удалён). **Audit:** сворачиваемая секция сайдбара **над** разделом **«Администрирование»** — **Audit Hub** (`/audit-hub`, роли OWNER / ADMIN / ACCOUNTANT / AUDITOR; без модуля `audit_hub` — locked) и **Приглашения аудита** (`/audit-invitations`, inbox Audit Engagement). **Журнал аудита организации** — **`/settings/audit`** (`GET /api/audit/logs`, tenant-scoped). **Журнал безопасности владельца** — **`/admin/audit-log`** (`GET /api/admin/audit-logs`, OWNER, платформенный контур).
- **Синхронизация с визуальным гайдом:** типографика и цвета заголовков/кнопок — [DESIGN.md](./DESIGN.md).
- **Прочие UX-стандарты web** (модалки Create/Edit, `max-w-screen-xl`, collapse сайдбара, контраст, empty state): таблица **PRD §10.1**.

---

## 12. Дорожная карта: v2 — расширения

**Базис:** Core MVP считается реализованным; ниже — технические направления блока v2 (этот же документ). Продуктовый контекст — [PRD.md](./PRD.md) §5.

### 12.0. Bridge Sprint (Security & RBAC Hardening) — статус выполнения

- [x] **COMPLETED (RBAC):** закрыты критичные role-gates для `Billing`, `Inventory approve` и финансовых read-endpoints.
- [x] **COMPLETED (Auditor Guard):** внедрён глобальный `AuditorMutationGuard` (мутации для `AUDITOR` блокируются на уровне APP_GUARD).
- [x] **COMPLETED (Billing Security):** `/api/billing/*` доступен только роли `OWNER` (не-owner роли получают `403`).

### 12.1. Multi-GAAP (параллельный учёт)

- **БД:** поле `ledgerType` (Enum: NAS, IFRS) в `JournalEntry` и `Account` (или эквивалентная модель).
- **Таблица** `AccountMapping`: `{ nasAccountId, ifrsAccountId, ratio }`.
- **Логика:** при сохранении проводки в режиме NAS — проверка маппинга и создание «теневой» копии для IFRS.
- **UI:** глобальный переключатель в хедере: «Режим учета: NAS / IFRS».
- **Foundation v2026.04.21 (PRD §5.C):**
  - Введена сущность `IfrsMappingRule` (`organizationId`, `sourceNasAccountCode`, `targetIfrsAccountCode`, `isActive`) для rule-based NAS→IFRS auto-mapping по кодам счетов.
  - Добавлена модель `AccountBalance` с `ledgerType` для хранения ledger-aware остатков в разрезе даты.
  - `AccountingService.postJournalInTransaction(...)` принимает `ledgerType` (по умолчанию `NAS` для backward compatibility).
  - `IfrsAutoMappingService` после успешной NAS-проводки генерирует IFRS mirror-entries на основании активных `IfrsMappingRule`.
  - Веб-контур: CRUD правил соответствия — страница **`/accounting/ifrs-mapping`** (редирект с **`/settings/finance/ifrs-mapping`**).

### 12.2. Дебиторка и акты сверки

- **Advanced AR/AP v2 (PRD §5.A, v2026.04.25):**
  - `PaymentAllocation`: `{ transactionId, invoiceId, allocatedAmount, date }` для распределения одного транша по нескольким инвойсам.
  - `Invoice.paidAmount` (кэш): сумма аллокаций/оплат; используется для статусов `PARTIALLY_PAID` / `PAID`.
  - `allocatePaymentAcrossInvoices(...)`: FIFO-распределение поступления по старшим долгам контрагента.
  - AR Aging report: корзины `0-30`, `31-60`, `61-90`, `90+` по `dueDate` на дату `asOf`.
- **Legacy compatibility:** `InvoicePayment` сохраняется как историческая детализация платежей и связь с существующими потоками bank/cash mirror.
- **Reconciliation Service:** выборка по счетам 211 / 531 для `counterpartyId`; PDF «Акт сверки взаиморасчетов» (AZ) с полями под подписи сторон; шрифт PDF — **DejaVu Sans** (`pdf-font.util.ts`), Unicode.

### 12.3. HR & Payroll — расширение

- **Оргструктура и позиции:** детальная схема Prisma, валидация штата, дерево отделов, аналитика 721/533 по департаментам — см. **§7** (модуль 6), подраздел «Организационная структура и позиции».
- **Отпуска:** справочник «Календарь отпусков»; формула отпускных: `(средняя ЗП за 12 мес / 30.4) * дни`.
- **ГПХ (`EmployeeKind.CONTRACTOR`, налог у источника 5%):**
  - **Расчёт (`calculateContractorMicroPayrollTax`):** от **gross** (сумма по договору за период ведомости, поле оклада/ставки сотрудника) начисляется **withholdingTax = round2(gross × 0.05)**. Стандартные удержания штатника **DSMF / İTS / безработица** для этого типа **не считаются** (в **`PayrollSlip`** соответствующие столбцы **0**). В **`PayrollSlip.incomeTax`** для ГПХ хранится именно **5%-е удержание** (единое поле с подоходным штатника на уровне БД). **Net = gross − incomeTax − contractorSocialWithheld**, где **`contractorSocialWithheld`** — опциональное фиксированное удержание с выплаты (AZN/мес.), если задано в карточке сотрудника.
  - **Проводки NAS при `SalaryRegistry → PAID`** (агрегация по **`Transaction.departmentId`**, как для штатников): для листков **CONTRACTOR** в той же транзакции по ЦФО: **Дт 721** (расход) **на gross** контрагента; **Кт 531** «расчёты с поставщиками» **на gross** (обязательство перед подрядчиком); **Дт 531 — Кт 521** на сумму удержаний, относящихся к бюджету/взносам с выплаты ГПХ (**5%** + при наличии **`contractorSocialWithheld`**). Чистая кредиторская на **531** после пары строк = **net** к выплате. Для **EMPLOYEE** по-прежнему **Дт 721** (в т.ч. взносы работодателя) **— Кт 533** / **Кт 521** по штатной схеме.
  - **`PayrollRun → POSTED`** проводок не создаёт; отражение в ГК только на шаге подтверждения выплаты реестра (**PAID**), см. **PRD §4.6**.

### 12.5. Fixed Assets v2 — реестр и амортизация

- **Prisma model (`FixedAsset`):**
  - `organizationId`, `name`, `inventoryNumber`, `purchaseDate` (`commissioning_date`), `purchasePrice` (`initial_cost`),
  - `salvageValue`, `usefulLifeMonths`,
  - `depreciationMethod` (**`STRAIGHT_LINE` \| `REDUCING_BALANCE` \| `UNITS_OF_PRODUCTION`**), `status` (`ACTIVE` | `DISPOSED`),
  - опционально `decliningBalanceRate` (годовая доля для **REDUCING_BALANCE**), `totalExpectedUnits` / `unitsProducedTotal` (для **UNITS_OF_PRODUCTION**),
  - кумулятивное поле `bookedDepreciation`.
- **Depreciation engine (`runMonthlyDepreciation`)**
  - вход: `organizationId`, `year`, `month`;
  - выборка `ACTIVE` по выбранному `depreciationMethod`;
  - **STRAIGHT_LINE:** `(purchasePrice - salvageValue) / usefulLifeMonths` с ограничением по остатку;
  - **REDUCING_BALANCE:** от **остаточной балансовой** стоимости × (`decliningBalanceRate`/12), floor до `salvageValue`;
  - **UNITS_OF_PRODUCTION:** начисление за месяц пропорционально **выработке за период** / `totalExpectedUnits`; таблица **`fixed_asset_monthly_usage`** (`FixedAssetMonthlyUsage`, уникальность `fixedAssetId + year + month`); UI **`/fixed-assets/usage`**, API `GET/POST …/usage/monthly`, `PUT …/:id/monthly-usage` до BullMQ/cron `runMonthlyDepreciation`;
  - проводка периода: **Дт 713 — Кт 112**;
  - пообъектная фиксация в `FixedAssetDepreciationMonth` + инкремент `bookedDepreciation`.
- **Идемпотентность:** уникальный ключ (`fixedAssetId`, `year`, `month`) + проверка существующих начислений перед вставкой.
- **API/UI:** endpoint `POST /api/fixed-assets/depreciation/run`; web **`/fixed-assets`** (реестр, метод амортизации, book value); **`/accounting/fixed-assets`** — redirect alias; **`/fixed-assets/usage`** — ввод UoP за месяц.
- **Monthly automation (v2026.06, BullMQ):** очередь **`monthly-depreciation`** в `apps/api/src/fixed-assets/monthly-depreciation.queue.ts` регистрирует повторяющийся job со схемой **`{ pattern: "0 1 1 * *" }`** (1-го числа в **01:00 UTC**, через час после биллинга, чтобы не конкурировать), `jobId = "fixed-assets-monthly-depreciation"`, `attempts: 3`, экспоненциальный backoff `60_000`. Воркер `apps/api/src/fixed-assets/monthly-depreciation.worker.ts`: вычисляет **предыдущий** UTC-месяц, выбирает все `Organization` без soft-delete (**`deletedAt: null` && `isDeleted: false`**), для каждой org вызывает `runMonthlyDepreciation(orgId, { year, month })` под **`runWithTenantContextAsync({ organizationId, skipTenantFilter: false })`** (Prisma extension). Ошибка одной org логируется + срабатывает `attachWorkerFailureAlert` (общий Slack/Telegram webhook), цикл по остальным организациям продолжается. Существующая идемпотентность по `FixedAssetDepreciationMonth (assetId, year, month)` гарантирует безопасный re-run (повторный запуск cron не дублирует проводки). Аварийный выключатель — env-флаг **`FIXED_ASSETS_MONTHLY_DISABLED=1`** (queue не регистрируется, worker не стартует). Регистрация — в `FixedAssetsModule.providers`.

### 12.4. Налоговый портал (экспорт)

- **Export Engine:** генерация файлов (например **exceljs**).
- **Шаблоны:** приложения к декларации по НДС (покупки/продажи за квартал).

### 12.5. UX/UI (Phase 2)

- Адаптивность таблиц; на мобильных — скрытие второстепенных колонок или карточки.
- **Quick Actions:** кнопка быстрого действия (создать инвойс / провести расход) на ключевых страницах.
- **AsyncCombobox (`apps/web/components/ui/async-combobox.tsx`):** глобальный переиспользуемый контрол для выбора сущностей с потенциальным объёмом **> 100** записей. Используется в формах **инвойсов**, **закупок** и **кассы (KMO/KXO)** для выбора **товаров/услуг** и **контрагентов** с запросами к API (`GET /api/products`, `GET /api/counterparties` с параметрами `search`, `limit`, при необходимости `cashParty` / `isService`). Реализован **debouncing** запросов (**300 ms** по умолчанию в продукте, параметр `debounceMs`), индикация загрузки и стили в соответствии с [DESIGN.md](./DESIGN.md).
- **Закрытые перечисления и `<Select>`:** все поля, основанные на **закрытых перечислениях** (Enums: **валюта**, **ставки НДС**, **ОПФ**, **типы кассовых операций**, счёт оплаты в инвойсе и т.п.), строго реализуются через компонент **`Select`** (`apps/web/components/ui/select.tsx`: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`; нативный `<select>` с токенами **DESIGN.md**) и вспомогательно **`CurrencySelect`** (`apps/web/lib/currencies.ts` — **AZN, USD, EUR, RUB, TRY**, по умолчанию **AZN**). **Свободный текстовый ввод** для таких полей **запрещён** (целостность данных и согласованность с DTO/Prisma).

### 12.6. v3.1 — масштабирование вычислительного контура

- Внедрение горизонтального автоскейлинга воркеров через API DigitalOcean / Kubernetes.
- Оптимизация транзакций Ledger: переход на пакетную запись итогов расчётов (**Batch Insert**) для массовых сценариев.
- Разработка маппера данных **1С → ERA NAS** для сценариев Migration Mode.
- [x] **COMPLETED:** реализация интерфейса ввода начальных остатков (**Opening Balances Wizard**) для кассы/банка, склада и зарплатных обязательств.
- [x] **COMPLETED:** контракты Migration Wizard (`POST /api/migration/opening-balances/finance`, `.../hr`, `.../inventory`) введены в эксплуатацию (детали в §12.7).

### 12.7. Opening Balances Wizard (Migration Wizard) — детальная проектная рамка

**Цель:** безопасный ввод стартовых сальдо при переходе с 1С/legacy без нарушения инвариантов Double-Entry и tenant-изоляции.

**Область v1 (MVP Wizard):**

- Шаг 1: **Cash/Bank Opening** — начальные остатки по счетам `101*` / `221*` (NAS).
- Шаг 2: **Inventory Opening** — стартовые остатки ТМЦ по складам (`warehouseId`, `productId`, `qty`, `unitCost`).
- Шаг 3: **HR Salary Debt Opening** — стартовая задолженность по зарплате и обязательствам (`521*`/связанные счета по настройке профиля).
- Шаг 4: **Preview + Post** — предпросмотр проводок, валидация, атомарное проведение.

**Проводки (каноника v1):**

- Cash/Bank opening: `Дт 101|221 — Кт 301` (капитал/источник открытия).
- Inventory opening: `Дт 201 — Кт 611` (или профильный offset по политике миграции, фиксируется параметром wizard-профиля).
- Salary debt opening: `Дт 721 — Кт 521` (или согласованный эквивалент для legacy carry-over; финальная корреспонденция фиксируется в migration profile).

**Технические требования:**

- Все шаги сохраняют черновик в отдельной сущности `opening_balance_batches` (статусы: `DRAFT`, `VALIDATED`, `POSTED`, `CANCELLED`).
- `POST` финального шага выполняется только через `prisma.$transaction` (batch header + lines + transactions + journal entries + stock movements).
- Идемпотентность: повторный `POST` по тому же `batchId` не дублирует проводки (`POSTED` -> no-op/409 policy).
- Для складского шага использовать bulk вставку и валидацию отрицательных остатков до фиксации.

**RBAC и безопасность:**

- Создание/редактирование batch: `OWNER`, `ADMIN`, `ACCOUNTANT`, `PROCUREMENT` (только подготовка данных).
- `Post/Approve` batch: только `OWNER`, `ADMIN`, `ACCOUNTANT`.
- `AUDITOR`: read-only просмотр batch, preview и журнала исполнения.
- Все мутации логируются в `AuditLog` с `entityType = OpeningBalanceBatch`.

**API-контур (draft):**

- `POST /api/migration/opening-balances/batches`
- `PATCH /api/migration/opening-balances/batches/:id`
- `GET /api/migration/opening-balances/batches/:id`
- `POST /api/migration/opening-balances/batches/:id/validate`
- `POST /api/migration/opening-balances/batches/:id/post`

**Реализованный этап Priority #1 (Finance + HR import):**

| Метод | Путь | Доступ | Контракт |
|-------|------|--------|----------|
| POST | `/api/migration/opening-balances/finance` | `OWNER`, `ACCOUNTANT` | Payload: массив `{ accountCode, amount, currency, date, description? }`. Авто-корреспонденция через техсчёт `000`: для активов/денег (`101*`, `221*`) — `Дт target / Кт 000`; для обязательств (`531*` и др. кредитных) — `Дт 000 / Кт target`. Проводки выполняются в `prisma.$transaction`, баланс проверяется через `validateBalance()`. |
| POST | `/api/migration/opening-balances/hr` | `OWNER`, `ACCOUNTANT` | Payload: массив сотрудников с обязательными полями `finCode`, `firstName`, `lastName`, `patronymic`, `positionId`, `hireDate`, `salary`; миграционные поля `initialVacationDays` (default 0), `avgMonthlySalaryLastYear` (optional), `initialSalaryBalance` (default 0). |
| POST | `/api/migration/opening-balances/inventory` | `OWNER`, `ACCOUNTANT` | Payload: массив `{ productId, warehouseId, quantity, costPrice }`. Проводки только в режиме opening: `Дт 201/204 — Кт 000` (без 611/731), плюс `StockMovement` типа `IN` (reason `ADJUSTMENT`) в той же транзакции. |

**Frontend UX / Templates (реализовано):**

- Для `client-side parsing` и генерации `XLSX templates` используется библиотека **`xlsx`** в браузере (без серверного преобразования файлов).
- На каждом шаге Wizard добавлена кнопка `Скачать шаблон / Şablonu yüklə`, формирующая XLSX-файл на лету.
- Обязательный стандарт заголовков для импорт-шаблонов:
  - **Finance:** `accountCode`, `amount`, `currency`, `date`, `description`
  - **HR:** `employeeId` (алиас) / `finCode`, `hireDate`, `initialVacationDays`, `avgMonthlySalaryLastYear`
  - **Inventory:** `productId`, `warehouseId`, `quantity`, `costPrice`
- Валидационная UX-подсказка на форме: даты в формате `YYYY-MM-DD`, числовые значения — без пробелов.
- Маппинг HR-алиаса: в HR parser значение `employeeId` автоматически используется как `finCode` (правило `employeeId -> finCode`).

**Hybrid IBAN validation (Local MOD-97 + Paid API):**

- Локальная проверка IBAN выполняется на клиенте для всех тарифов через алгоритм `MOD-97` (формат AZ: `AZ` + 26 символов) с мгновенной визуальной индикацией валидного значения.
- Глубокая проверка (`POST /api/banking/validate-iban`) использует внешний провайдер `iban.com` и доступна только для `ENTERPRISE` либо при активном модуле `banking_pro` (paywall по подписке).
- При ответах paywall (`402 Payment Required` или `403` с `code = MODULE_NOT_ENTITLED`) UI не сбрасывает форму и открывает upgrade-модалку с CTA на страницу подписки.

**Статус backend-реализации API:**

- [x] **COMPLETED:** `POST /api/migration/opening-balances/finance`
- [x] **COMPLETED:** `POST /api/migration/opening-balances/hr`
- [x] **COMPLETED:** `POST /api/migration/opening-balances/inventory`
- [x] **COMPLETED (Early Guard):** `validateBalance()` вызывается **до** любых DB-записей (`StockMovement`, `JournalPosting`) для раннего отката при математическом дисбалансе.
- [x] **COMPLETED (Inventory Integration Tests):** сценарии success, optimistic locking conflict (`409 Conflict`) и блокировка по `validateBalance()`.

**HR schema standard (migration baseline):**

- `Employee.hireDate` — обязательное поле даты выхода (baseline для M6 Absences/Timesheet).
- `Employee.initialVacationDays` — обязательное в схеме с default `0`.
- `Employee.avgMonthlySalaryLastYear` — optional поле для миграционного расчёта отпускных.
- Физическое применение в локальной PostgreSQL выполнено через Prisma schema sync (`db push`), Prisma Client пересобран (`db:generate`).

**Тестирование реализации (Priority #1):**

- Интеграционный тест сервиса `OpeningBalancesService.importFinance` подтверждает корреспонденции по счёту `000` и сходимость `debit = credit`.
- HTTP e2e тест `POST /api/migration/opening-balances/finance` покрывает:
  - `201` для роли `OWNER`,
  - `403` для ролей `USER`/`PROCUREMENT`,
  - `400` на невалидный DTO (`amount` нечислового типа).

**Acceptance (v1):**

1. Wizard не допускает `POST`, если batch не прошёл `validate`.
2. После `POST` Trial Balance сходится (`debit == credit`) на уровне созданного batch.
3. Повторный `POST` не создаёт дубликаты проводок.
4. Роль `PROCUREMENT` получает `403` на `/post`.

### 12.8. Generic SaaS Strengthening (Waves 1–3)

**Синхрон с продуктом:** [PRD.md](./PRD.md) §5.E. Ниже — техконтур по эпикам; критерии приёмки дублируются в PRD.

| Подраздел | Эпик | Ключевые артефакты |
|-----------|------|-------------------|
| §12.8.1 | Virtual stock | `ManufacturingService.computeAvailableOutput`, `GET …/recipes/:id/available-output` |
| §12.8.2 | Activity Stream | Prisma `EntityActivity`, `EntityComment`, `Mention`; модуль `activity-stream`; эмиттер из `AuditMutationInterceptor` или доменных сервисов |
| §12.8.3 | Approval Workflow | `ApprovalPolicy`, `ApprovalRequest`, `ApprovalStep`; модуль `approvals`; CHECK на `REJECT` + comment |
| §12.8.4 | Director | `UserRole.DIRECTOR`; `@Roles` на отчётах; `AccessControlService` |
| §12.8.5 | Prepaid (РБП) | `PrepaidExpense`, `PrepaidExpenseSchedule`; BullMQ или ручной post-month |
| §12.8.6 | Cost allocation | `ManufacturingOverheadService`; `GET|POST /api/manufacturing/overhead/drivers`, `PATCH …/drivers/:id`, `GET|POST /api/manufacturing/overhead/pools`, `POST …/allocate?period=` |
| §12.8.7 | PSA mini | `PsaService` / `PsaModule`; `GET|POST|PATCH /api/psa/projects`, tasks + time-entries, `POST …/generate-invoice`, `GET …/profitability` |

#### §12.8.1 Virtual stock

- **Реализовано:** `GET /api/manufacturing/recipes/:recipeId/available-output?warehouseId=` → `ManufacturingService.computeAvailableOutput`.
- Вход: `recipeId`, `warehouseId` (опционально — склад по умолчанию как в `releaseProduction`).
- Выход: `maxOutputUnits` (string), `bottlenecks[]` (`needPerFgUnit`, `available`, `maxFgFromLine`, имена компонентов).
- Без изменения остатков; tenant: `organizationId` из JWT.

#### §12.8.2 Activity Stream

- **Реализовано:** Prisma `EntityActivity`, `EntityComment`, `EntityCommentMention`; Nest **`activity-stream`** (`ActivityStreamController` / `ActivityStreamService` / `ActivityStreamEmitterService`).
- REST: `GET /api/activity/:entityType/:entityId`; `POST …/comments`, `PATCH /api/activity/comments/:id`, `DELETE …/comments/:id` — под **`AuditMutationInterceptor`**.
- `entityType` (slug): `invoice`, `counterparty`, `employee`, `product`, `inventory_audit`, `payroll_slip`, `customs_declaration`.
- Системные события: после записи **`AuditLog`** вызывается **`ActivityStreamEmitterService.emitFromAuditMutation`** (маппинг Prisma-имени сущности из аудита → slug; без дублирования содержимого аудита).
- @mention: разбор **`@email`** в теле комментария → строки `entity_comment_mentions` → **`NotificationService.createNotification`** с `link` на сущность (веб-путь по типу).

#### §12.8.3 Approval Workflow

- **Реализовано (MVP):** таблицы `approval_policies`, `approval_requests`, `approval_steps` + enum’ы `ApprovalDocumentType` / `ApprovalRequestStatus` / `ApprovalStepDecision`; Nest **`approvals`** (`ApprovalsController`, `ApprovalsService`); **CHECK** на шаге: reject только с непустым `comment`.
- **Касса:** `POST /api/approvals/cash-orders/:id/submit` создаёт цепочку шагов из `approverRoles[]`; `CashOrderService.postOrder` вызывает `assertCashOrderMayPost` (политика по сумме/валюте `CASH_ORDER`).
- **Inbox:** `GET /api/approvals/inbox`; решения: `POST /api/approvals/requests/:requestId/steps/:stepNo/approve|reject` (reject — DTO с `comment`).
- **Дальше:** те же примитивы для закупок, `BANK_MANUAL_ENTRY`, `PAYROLL_RUN` — встраивание в соответствующие сервисы проведения.

#### §12.8.4 Director

- **Реализовано:** значение enum **`UserRole.DIRECTOR`** (миграция `UserRole`); роль только в **`OrganizationMembership`**.
- Отчёты: `DIRECTOR` добавлен к guard’ам **`GET /api/reporting/pl`**, **`GET /api/reporting/receivables`**, набора **`GET /api/reports/*`** на базе `RECON_ROLES` (Cash Flow, Balance Sheet и т.д.); фильтр департамента в P&L — также для `DIRECTOR`/`ADMIN` (см. `ReportingController`).

#### §12.8.5 Prepaid (РБП)

- **Реализовано:** таблицы `prepaid_expenses`, `prepaid_expense_schedules`; Nest **`PrepaidModule`** (`PrepaidExpensesController` / `PrepaidExpensesService`).
- Создание: генерация строк графика по календарным месяцам UTC (`YYYY-MM`), остаток округления на последний месяц.
- Помесячное проведение: `POST /api/prepaid-expenses/:id/post-month?period=` → NAS-проводка через **`AccountingService`** (проверка закрытого периода внутри `postJournalInTransaction`); строка графика → `POSTED`, при отсутствии `PENDING` — статус РБП `FULLY_AMORTIZED`.
- Счета по умолчанию: **`731`** (расход) / **`133`** (предоплата), переопределение полями сущности.

#### §12.8.6 Cost allocation

- **Реализовано:** таблицы `overhead_drivers`, `overhead_pools`, `overhead_allocations`, `manufacturing_releases` (связь выпуска с `transactions` и `stock_movements` по ГП); Nest **`ManufacturingOverheadService`** + **`ManufacturingOverheadController`** (`/api/manufacturing/overhead/...`, модуль **`manufacturing`**, entitlement **`manufacturing`**).
- **Драйверы:** `VOLUME` (вес = `quantity` выпуска), `MATERIAL_COST` (вес = `material_cost`), `TIME` — равный вес на каждый release в месяце (MVP без shop-floor hours).
- **Allocate:** `POST /api/manufacturing/overhead/allocate?period=YYYY-MM` — для каждого пула периода остаток = `totalAmount − sum(existing allocations)`; новые доли только у release без строки allocation; проводка **Дт `debit_account_code` / Кт `credit_account_code`** пакетом в одной `Transaction` на пул-итерацию; повторный вызов не дублирует уже созданные пары pool+release.
- **UI v2026.05:** `GET …/period-summary` (подсказка суммы по дебету счёта **741** за месяц); `POST …/allocate-batch` — один пул на период + распределение на выбранные выпуски по ключу **QUANTITY** / **MATERIAL_COST**; экран **`/manufacturing/overhead`**.

#### §12.8.7 PSA mini

- **Реализовано:** таблицы `psa_projects`, `psa_project_tasks`, `psa_time_entries`; FK **`psa_time_entries.employee_id` → `employees`**; **`invoices.project_id` → `psa_projects`**.
- **REST:** `GET|POST /api/psa/projects`, `GET|PATCH /api/psa/projects/:id`, `GET|POST /api/psa/projects/:id/tasks`, `GET|POST /api/psa/projects/:id/time-entries`, `PATCH /api/psa/projects/:projectId/time-entries/:entryId`, `POST /api/psa/projects/:id/generate-invoice` (тело `{ dateFrom, dateTo }`, квота **`INVOICES_PER_MONTH`**), `GET /api/psa/projects/:id/profitability?dateFrom=&dateTo=`.
- **Генерация инвойса:** только `TimeEntry.status = APPROVED`, `billable = true`, `billing_invoice_id IS NULL`; после создания черновика через **`InvoicesService.create`** (`projectId`) — строки помечаются **`INVOICED`** и связываются с инвойсом; услуга-заглушка **`__PSA_HOUR__`** в каталоге продуктов организации.
- **`Employee.userId`:** опционально для self-service (поле в схеме); текущий UI — операционный ввод через `/psa/projects`.

#### §12.8.8 Wave 3

- Только продуктовый backlog в PRD §5.E.8; реализация вне текущего цикла.

---

## 13. Дорожная карта: v3 — интеграции и эксплуатация

**Цель:** встраивание в цифровую инфраструктуру АР (ЭЦП, гос. сервисы, банки, безопасность SaaS). Продуктовый контекст — [PRD.md](./PRD.md) §6.

**Базис:** функциональность v2.x считается реализованной; v3 наращивает интеграции и надёжность.

### 13.1. ASAN İmza / SİMA (Mobile ID)

- **UI:** на PDF-инвойсе и PDF акта сверки — действие «Подписать» (ASAN İmza / SİMA / иной Mobile ID по контракту).
- **Backend:** сессия подписания, получение подписанного пакета / detached-подпись, проверка цепочки — по спецификации провайдера.
- **Хранение:** подписанный PDF (или оригинал + подпись) в объектном хранилище (S3-совместимый слой), привязка к `organizationId`, типу сущности, id документа.
- **Аудит:** запись в `AuditLog` или `DocumentSignature`: пользователь, время, тип документа, id, алгоритм хеша, **хеш содержимого**, id сессии у провайдера.
- **API:** read-only история подписей для документа (роли по политике продукта).

### 13.2. e-taxes.gov.az и VÖEN

- **Продуктовая архитектура DVX (ГНС):** поэтапная стратегия интеграции с порталом **e-taxes.gov.az** — **[PRD.md](./PRD.md) §6.1.1** (по духу согласована с поэтапным подходом **ƏMAS / PRD §13.0**). **Целевой контур (фаза 3):** e-qaimə и прочие машинные поверхности — через **официальный закрытый B2B System-to-System API** (**API-ключ организации** или преемник по контракту DVX). **До полного S2S:** лицевой счёт / сверки — **PULL** с **переходным Live Session** после **ASAN İmza** и/или сценарий **фазы 2** (единое браузерное расширение — **§13.6**). **Инвариант:** **отказ от физических Android-ферм**. Технические границы адаптера (хранение сессии, ротация, аудит, PII, соответствие ToS оператора) задаются при спайке/реализации и не подменяют продуктовое решение PRD.
- **Фаза 1 — файловый обмен (XML/Excel, backend/UI):** серверный контур генерирует **XML** деклараций (где применимо) и **Excel/CSV** пакеты для массовых операций; бухгалтер выполняет **ручную** загрузку/выгрузку на **e-taxes.gov.az**; в ERP сохраняются **журнал отправок**, статусы, метки времени, корреляционные ключи, версии выгрузки; повторные попытки — с **идемпотентностью** по бизнес-ключу (конкретные поля — на этапе реализации адаптера).
- **Фаза 2 — RPA (Browser Extension):** пользовательский компонент **ERA Finance Assistant** (Chrome/Firefox, **Manifest V3**, единая кодовая база — **§13.6**) активируется **только** после **явного** действия пользователя на вкладке **e-taxes.gov.az** при уже открытой **аутентифицированной** сессии (включая **ASAN İmza**, если портал требует); расширение **предзаполняет** допустимые поля форм (в т.ч. **e-qaimə**), но кнопки **«İmzala» / Submit** нажимает **только человек**; события автозаполнения и ошибки интеграции фиксируются в **аудите** с привязкой к **`organizationId`**, выбранному в плагине (см. **§13.6** про multi-tenant gating).
- **Текущий scope фазы 2 (DVX):** connector `etaxes` с flow **e-qaimə** использует endpoint `GET /api/invoices/:id/prefill`; подробный контракт протокола `PORTAL_PREFILL` (flow-dispatch) и entitlement `tax_pro` зафиксированы в **§13.6**.
- **Исследование:** официальные API e-taxes / BTP; авторизация, форматы, лимиты, тестовый контур.
- **Реализация:** вариант A — прямая отправка из API; вариант B — очередь через BTP-клиент / агент при нестабильном API; UI — «Отправить в e-taxes» + журнал попыток.
- **VÖEN Lookup (MDM-first):** при вводе VÖEN UI сначала выполняет lookup в **глобальном реестре** `GlobalCounterparty` (MDM) и автозаполняет наименование/адрес/НДС-статус.
  - API: `GET /api/counterparties/global/by-voen/:taxId`
  - Если записи нет — допускается внешний lookup (e-taxes) с кэшированием и последующим созданием/обновлением записи в MDM.
  - Создание локального контрагента привязывает его к `globalId` (подписка организации на глобальные данные), при этом локальные данные сохраняются и не удаляются при изменении структуры холдинга.
- **Integration Service:** добавлен `TaxpayerIntegrationService` с HTTP-адаптацией к `https://new.e-taxes.gov.az/etaxes/services/taxpayer-info`; нормализует поля `name`, `isVatPayer`, `address` и флаг `isRiskyTaxpayer` (riskli vergi ödəyicisi).
- **Строгая валидация ответа VÖEN lookup (API, обязательно):** бэкенд **обязан** проверять тело ответа внешнего сервиса. Успешным считается только разбор **валидного JSON** с **допустимым наименованием организации** (без HTML-тегов, без типичных текстов защитных страниц вроде **Cloudflare** / `<noscript>` / «You need to enable JavaScript…»). Если возвращается **HTML**, не-JSON или структура без пригодного `name`, API возвращает **ошибку** (в реализации — `404 Not Found` / отказ lookup), **без** записи заглушки в Redis-кэш и **без** сохранения HTML/мусорной строки в поля наименования в БД (**строго запрещено** персистить HTML-заглушки в `GlobalCounterparty` / связанных сущностях). Клиентский UI при этом опирается на Toast и ручной ввод имени (см. §4 — контрагенты).
- [x] **COMPLETED (Production Ready, Integration cross-stack):** Birbank (Kapital Bank), Pasha Bank и ABB direct connectors are production-ready with unified mapping to `BankingProviderInterface`.
- **Статус Payroll-to-Bank (v2026.04.15):** **ABB: Direct API Salary Integration; Pasha/Kapital: Direct Balance Sync + Universal Salary Export**.
- [x] **COMPLETED (Payroll E2E):** Universal Salary Registry с выбором счёта организации, payout-strategy `ABB_XML | UNIVERSAL_XLSX`, и подготовка реестра из фактических `PayrollSlip`.

**UI холдинга (создание):** страница `/holding` содержит кнопку «Новый холдинг», открывающую модальную форму (поля: `name`, `baseCurrency`) и выполняющую `POST /api/holdings`.

**[x] COMPLETED (companies-workspace-componentization, v2026.05):** страница `/companies` переведена на компонентный подход с переиспользуемой карточкой `CompanyCard`; структура — секции по холдингам + нижний блок `Sərbəst Şirkətlər` в grid-раскладке. Контекстные действия по компании (настройки, привязка, отвязка) вынесены в `DropdownMenu` на карточке для визуальной чистоты. Контракты API (`/api/organizations/tree`, `/api/holdings`, `POST/DELETE /api/holdings/:holdingId/organizations/:organizationId`) остаются без изменений.

**[x] COMPLETED (ui-primitives-standard, v2026.05):** для нового и рефакторимого фронтенда обязательны общие примитивы из `@erafinance/ui`: `Dialog`, `DropdownMenu`, `Popover`. Локальные ad-hoc оверлеи и кастомные dropdown-реализации в продуктовых экранах не добавляются; при рефакторинге заменяются на общий пакет. Базовые требования accessibility: trap focus + `Esc` в `Dialog`, keyboard navigation (`ArrowUp/ArrowDown`, `Esc`) в `DropdownMenu`.

### 13.3. Direct Banking (Pasha Bank, ABB и др.)

- **Конфиг организации:** учётные данные / OAuth / сертификаты — только в секретах.
- **Авто-выписка:** BullMQ, целевой интервал **раз в час**; нормализация в `BankStatementLine` (или расширение модели); матчинг с инвойсами.
- **Исходящие платежи:** черновик → «На подпись директору» → формат банка (JSON/XML) → API банка → статусы (принят / на подписи / исполнен / отклонён); связь с проводкой и `InvoicePayment` при необходимости.
- **Безопасность:** раздельные права на выписки и инициацию платежей; 2FA для роли отправки (продукт или IdP).
- **Provider architecture:** введён `BankingProviderInterface` (`getBalances()`, `getStatements(from,to)`, `sendPaymentDraft()`) и каркасные адаптеры `PashaBankAdapter`, `AbbAdapter`, `BirbankAdapter` для поэтапного подключения owner-approved API contracts.
- [x] **COMPLETED (Roadmap 95+ M5 Outbound):** добавлен доменный контур `BankPaymentDraft` (`PENDING → SENT → COMPLETED | REJECTED`) с API `GET /api/banking/payment-drafts` и `POST /api/banking/payment-drafts/send`; UI страницы `/banking` расширен вкладкой «Исходящие платежи» и кнопкой «Отправить в банк».
- [x] **COMPLETED (Roadmap 95+ M5 Reconciliation E2E):** при импорте/синке банковской выписки выполняется авто-матчинг исходящих операций по сумме: `BankPaymentDraft` в статусе `SENT` переводится в `COMPLETED`, а `SalaryRegistry` в статусе `SENT` переводится в `PAID`; строка выписки помечается `isMatched=true`.
- **Birbank (Kapital) implementation:** production connector реализует OAuth2 client credentials с Redis caching по TTL, `GET /accounts` для балансов, statement polling за период и обработку ошибок `Invalid Token`/`Rate Limit`.
- **Technical note:** маппинг `BirbankAdapter` синхронизирован с Corporate API v1 (Kapital Bank): `amount/currencyCode/iban` -> `BankBalanceItem`, `transactionDate/description/amount` -> `BankStatementItem`.
- **Pasha implementation:** OAuth2 Client Credentials + Redis token cache; `GET /v1/accounts` и `GET /v1/transactions` синхронизированы с внутренними `BankBalanceItem` / `BankStatementItem`.
- **ABB implementation:** авторизация по ABB Business API v1.6 (`POST /payments/auth/token`), интеграция остатков/выписок через `GET /payments/corporate-account-info`, `GET /payments/account/balance`, `GET /payments/account/statement`; добавлена XML-совместимость Salary Payment (§5.3) для HR payroll сценариев.
- **Background sync foundation:** BullMQ задача `sync-bank-balances` выполняет периодический опрос через `BankingGatewayService`; на первом этапе пишет сервисный AuditLog-событие об успешной синхронизации по организации.
- **Sprint status:** Ecosystem Sprint успешно завершён.

### 13.4. Инфраструктура и безопасность (SaaS)

- **Подготовка к v4:** сущности `Subscription`, `Plan`, `ModuleEntitlement`, связь с `Organization`; платёжный шлюз (Stripe / локальный PSP — выбор на проектировании): webhooks, идемпотентность. В v3 допускается **MVP:** один тариф + оплата картой + флаг «организация активна»; полное ценообразование — v4.
- **Бэкапы:** PostgreSQL по расписанию в зашифрованный архив; файлы в S3 — lifecycle, репликация по возможности; алерт при пропуске; периодический тест восстановления (runbook).
- **Общее:** секреты в vault/env; аудит доступа к бэкапам; минимизация ПДн в логах.

### 13.5. v3.2+ — функционально-архитектурное расширение

**Цель v3.2+:** поддержка 10,000+ конкурентных пользователей с сохранением инвариантов double-entry и B2G/B2B-разделения учёта.

| Модуль | Техническая специфика (API/infra) |
|--------|------------------------------------|
| **M1 — B2G & Tax API** | Интеграция e-tax/e-qaimə через асинхронные воркеры (`TaxWorker`); входящие накладные материализуются в draft-поступления; идемпотентность по `externalTaxId` (unique). |
| **M2 — Inventory & B2G Limits** | Redis-кэш лимитов бюджета для pre-check закупок в GOVERNMENT; optimistic locking при параллельном резервировании остатков. |
| **M3 — Production & Costing** | Многоуровневые BOM + рекурсивные CTE для обхода дерева; финальный monthly costing в фоновой очереди (закрытие периода). |
| **M4 — Retail & POS** | Offline-first PWA (IndexedDB + очередь синхронизации); разделение быстрой регистрации чека и отложенного ledger-posting. |
| **M5 — Advanced HRMS** | [~] **PARTIAL:** ежедневный **`@Cron` (01:00 Asia/Baku)** пересчёт **`vacationDaysBalance`** (**§7.0.3**); далее — интеграции e-sosial, расширенные льготы. |
| **M6 — Budgeting & Treasury** | E-Smeta согласования с ЭЦП; смета как жёсткий gateway для GOVERNMENT-операций в M2/M5. |
| **M7 — WMS Light** | Mobile-first для ТСД; остатки по ячейкам зеркалируются в Redis (целевой ответ <100ms для scanning flow). |
| **M8 — Executive Dashboard** | Материализованные представления PostgreSQL + WebSocket push для near-real-time KPI. |

**Обязательные технические правила v3.2+:**

- Контур API/Workers остаётся stateless (см. §3.2), состояние задач — только Redis/DB.
- Все тяжёлые операции идут через Async-First pipeline (см. §1.5 и PRD §10.3).
- Финансовая запись в Ledger выполняется транзакционно и балансно (см. §3), независимо от источника задачи (HTTP/job/replay).

### 13.6. Browser Extension RPA (ERA Finance Assistant)

**Назначение:** единый клиентский слой **RPA-помощника** для сценариев **фазы 2** интеграций с государственными порталами (**ƏMAS**, **e-taxes.gov.az / DVX** и др. по мере включения в продукт), без замены юридически значимых действий пользователя на стороне оператора портала.

1. **Single Extension (единая кодовая база):** один артефакт браузерного расширения (**Manifest V3**; стек — **WXT** + React + TypeScript) с **модульными «коннекторами»** на домены порталов; запрещено плодить **отдельные** несвязанные репозитории расширений на каждый портал без архитектурного обоснования (fork допускается только как временный spike с последующей консолидацией). Исходники: `apps/extension/`; см. **`apps/extension/README.md`**.
2. **Изоляция подписок (Multi-tenant SaaS gating):** платформа — **холдинговый SaaS** (**1 биллинг-юнит = 1 `organizationId`**). Расширение **не** опирается на предположение «достаточно JWT пользователя»: **entitlement** для функций автозаполнения проверяется **в контексте выбранной организации** (см. п.3), чтобы исключить утечку платных сценариев между компаниями одного пользователя.
3. **User flow (контракт взаимодействия с API ERA):**
   - **Magic Auth / extension session:** `POST /api/auth/extension/refresh` в двух режимах: **bootstrap** — с Origin веб-приложения ERP и HttpOnly cookie стандартного `refresh_token` (как у SPA), ответ выставляет изолированную cookie **`refresh_token_ext`** (`path=/api/auth/extension`, `SameSite=None`, `Secure` в prod) и тело с **access JWT**; **silent** — с Origin `chrome-extension://…` / `moz-extension://…` и cookie `refresh_token_ext`, ротация refresh. Секрет refresh расширения: **`EXT_REFRESH_SECRET`** (fallback `JWT_SECRET`), TTL: **`EXT_REFRESH_EXPIRES`**. CORS: **`CORS_EXTENSION_ORIGINS`**, веб-Origins bootstrap: **`ERP_WEB_ORIGINS`**. Logout расширения: `POST /api/auth/extension/logout`. На вкладке ERP монтируется **`ExtensionBridge`** (`window.postMessage` ↔ content script расширения).
   - пользователь проходит **аутентификацию в расширении** (выдача **JWT** тем же доверенным контуром, что и веб-клиент; хранение access-токена в **`chrome.storage.session`**, явный logout);
   - пользователь выбирает **текущую организацию** (**Org switcher** в UI расширения; значение = активный `organizationId`);
   - расширение вызывает **`GET /api/subscription/me`** (или канонический эквивалент из веб-клиента, зафиксированный в OpenAPI на момент реализации) с передачей **`organizationId`** выбранной компании (заголовок **`X-Organization-Id`** / query — **как в основном SPA**, единообразие обязательно);
   - если для этой организации **не активен** требуемый модуль (**например** `tax_pro`, `hr_full` — точные коды **`ModuleEntitlement`** см. subscription-константы), расширение **блокирует** автозаполнение и показывает **локальный Paywall/Upsell** («Купите/активируйте модуль для **этой** компании») без обращения к полям портала;
   - **VÖEN cross-check обязателен:** перед автозаполнением connector извлекает **активный VÖEN** из текущей сессии портала и сравнивает с `taxId` активной организации в ERA Finance. При несовпадении (или при `null` VÖEN портала в явно authenticated-сессии) расширение показывает ошибку контекста и **запрещает** autofill до устранения конфликта;
   - для flow `e-qaime` (DVX) расширение запрашивает `GET /api/invoices/:id/prefill`; entitlement для доступа к flow — `tax_pro`;
   - prefill `GET /api/invoices/:id/prefill` в фазе 2 ограничен валютой **AZN** (non-AZN → `INVOICE_NOT_AZN`); для строк с освобождением от НДС (`vatRate=-1`) API нормализует ответ как `vatExempt=true`, `vatRatePct=0`;
   - протокол `MSG.PORTAL_PREFILL` унифицирован по `flow`: `emuqavile` (payload `employeeId`) и `eqaime` (payload `invoiceId`), маршрутизация выполняется в background service worker;
   - **Phase 10 / Bulk RPA (premium):** добавлены bulk-сообщения `MSG.PORTAL_BULK_PREFILL` / `MSG.PORTAL_BULK_RESULT` и API `POST /api/hr/employees/bulk-prefill`, `POST /api/invoices/bulk-prefill`, `POST /api/hr/employees/bulk-sync-result`, `POST /api/invoices/bulk-sync-result`; гейтинг обязателен по `hr_full` (ƏMAS) и `tax_pro` (DVX);
   - **Rate-limit safety для порталов:** BulkRunner работает последовательно (no parallel submit), с jitter-паузой между итерациями, backoff на ошибках и circuit-breaker при серии ошибок/дрейфе VÖEN-контекста;
   - результаты массовой синхронизации фиксируются в БД: статусы на `Invoice` / `Employee` + журнал прогона `integration_sync_runs` (portal, transport, counters, started/completed);
   - **Excel fallback (free path):** `GET /api/integrations/dvx/invoices/export.xlsx`, `POST /api/integrations/dvx/invoices/import-result`, `GET /api/integrations/emas/employees/export.xlsx`, `POST /api/integrations/emas/employees/import-result` доступны без module-gating;
   - при активном модуле расширение запрашивает у API **минимальный DTO** для предзаполнения (без массовой утечки PII в content-script; маскирование логов — **§15.0** / `DataMaskingService`). Контракты DTO (Zod) — пакет **`@erafinance/api-contracts`**; общие строки RU/AZ — **`@erafinance/i18n`** (включая ключи `extension.*`).
   - **Marketing CTA в ERP:** веб-интерфейс показывает CTA «Установите ERA Finance Assistant» в `sales/invoices` (баннер) и `admin/integrations` (карточка). Ссылка управляется env-переменной `NEXT_PUBLIC_EXTENSION_INSTALL_URL` (дефолт локали: `/docs/extension`, на проде — URL Web Store).
   - для уже существующих БД (где `pricing_modules` был инициализирован до `tax_pro`) применяется одноразовый idempotent-скрипт `npm run db:ensure-tax-pro-pricing -w @erafinance/database`.

**Нефункциональные требования:** соответствие **ToS** магазинов расширений и порталов; отсутствие «тихого» скрейпинга без explicit user gesture; запрет хранения **ASAN İmza** PIN/паролей ERA; телеметрия ошибок — без сырого HTML портала в логах.

### Критерии приёмки v3.0 (сводно)

1. Подписание PDF-инвойса и PDF акта сверки из UI с записью хеша в аудит.
2. Сценарий отправки налоговых данных в сторону e-taxes **или** задокументированный обход через BTP.
3. VÖEN lookup с автозаполнением имени и статуса НДС.
4. Фоновая синхронизация банка (≥1 пилот) и матчинг с инвойсами.
5. Черновой исходящий платёж в банк со статусами.
6. Автоматические бэкапы БД и S3; базовый billing-скелет для v4.

### Зависимости и риски v3

- Доступ к документации и sandbox: ASAN/SİMA, e-taxes, банки — внешние блокеры; этапы spike и пилоты.
- Версионирование адаптеров при смене API государства/банков.

---

## 14. Дорожная карта: v4 — подписки, gating, квоты, демо

**Цель:** коммерческий SaaS — тарифы, модульные права, квоты, демо и подготовка к биллингу (см. [PRD.md](./PRD.md) §7).

**Базис:** v2/v3 считаются реализованными; v4 наращивает **слой монетизации** без переписывания доменной логики учёта.

**Стек:** Prisma (PostgreSQL), NestJS API, Next.js (App Router) web.

### §14.0 Global Company Registry (v19.0)

**Цель:** единый справочник юрлиц по **VÖEN (10 цифр)** для подсказок при вводе контрагента и обогащения данных между организациями платформы (без нарушения изоляции тенанта: локальные записи остаются в `counterparties` с `organizationId`).

| Компонент | Описание |
|-----------|----------|
| **Таблица `global_company_directory`** | Уникальный ключ `tax_id`; поля: `name`, `legal_address`, `phone`, `director_name` (денормализация). |
| **Источники обновления** | При сохранении **профиля организации** (`PATCH /api/organization/settings`) и при **создании/обновлении контрагента** запись по VÖEN **асинхронно** upsert-ится в справочник (fire-and-forget). |
| **Связь с MDM** | Таблица `global_counterparties` остаётся для НДС/lookup; глобальный реестр компаний дополняет UX (Smart-fill). |
| **API чтения** | `GET /api/organization/directory/by-voen/:taxId` (JWT) — данные для автозаполнения формы контрагента. |
| **Профиль организации** | Поля `legal_address`, `phone`, `director_name`, `logo_url`, `valuation_method` (см. PRD §11.0); банковские счета вынесены в отдельный реестр `Settings → Bank Accounts` (`/settings/bank-accounts`) с API `GET/POST/PATCH/DELETE /api/banking/bank-accounts`. |
| **Миграция БД** | Файл в репозитории: `packages/database/prisma/migrations/20260429100000_org_profile_global_directory/migration.sql`. На стенде: `npm run db:migrate` из корня (= `migrate deploy`) с валидным `DATABASE_URL`; в CI — `prisma migrate deploy`. |

#### §14.0.1 Реестр банковских счетов организации (Smart Aliases)

- **Prisma (`organization_bank_accounts`)**: `id`, `organizationId`, `iban`, `bankName`, `swift?`, `currency` (default `AZN`), `ledgerAccountCode`, `accountType` (`MAIN`/`SALARY`/`CARD`/`TENDER`/`CREDIT`/`VAT_DEPOSIT`), `isPrimary`, `isFrozen`, `isArchived`, `bankBranchId?` (FK → `bank_branches.id`, `ON DELETE SET NULL`), `createdAt`, `updatedAt`.
- **Smart Alias**: обязательная связь `IBAN ↔ ledgerAccountCode` (NAS субсчет `221*..225*`, например `222.01.01`) для безопасного выбора счета в Treasury и payroll payout.
- **API**:  
  - `GET /api/banking/bank-accounts` — активный список реестра;  
  - `POST /api/banking/bank-accounts` — создание; поля `bankBranchId` **или** `ledgerAccountCode` (взаимозаменяемы): при наличии `bankBranchId` и пустом `ledgerAccountCode` сервис вызывает **`BankSubaccountService`** и автогенерирует субсчет `221.<bankCode>.<seq>` (см. §14.0.2);  
  - `PATCH /api/banking/bank-accounts/:id` — редактирование; впервые установленный `bankBranchId` без явного `ledgerAccountCode` так же запускает автогенерацию;  
  - `DELETE /api/banking/bank-accounts/:id` — удаление или архивирование при наличии ссылок в `salary_registries`.

#### §14.0.2 Системный справочник банков и автогенерация субсчёта `221.<BankCode>.<Seq>`

- **Источник правды (заголовки)** — таблица **`bank_glossary`** (без `organizationId`, общая для платформы): `id`, `nameAz`, `voen` (UNIQUE, 10 цифр), `code` (`CHAR(2)` UNIQUE, `01`–`22`), `correspondentIban` (UNIQUE, IBAN банка в ЦБА), `swift`, `headPhones` (`text[]`), `headAddress`, `isActive`, `createdAt`, `updatedAt`.
- **Филиалы** — таблица **`bank_branches`**: `id`, `bankId` (FK → `bank_glossary.id`, `ON DELETE CASCADE`), `branchCode` (6-значный МФО), `name`, `swift?`, `address?`, `phones` (`text[]`), `isHeadOffice` (`bool`, head-office флаг), `isActive`. UNIQUE `(bank_id, branch_code)`, индекс `(bank_id, is_head_office)`. Для каждой `OrganizationBankAccount` хранится опциональная `bankBranchId` (FK → `bank_branches.id`).
- **Авторитетный список 22 банков (TZ §14.0.2)** — фиксируется в `packages/database/prisma/lib/bank/bank-glossary-seed.ts` (тип `BankGlossarySeedRow` несёт `code`, `nameAz`, `voen`, `correspondentIban`, `swift`, `headBranchCode`, `headPhones`, `headAddress`):

  | code | Bank (Az) | VÖEN | SWIFT |
  |---|---|---|---|
  | 01 | Melli İran Bankı Bakı filialı | 1300036291 | MELIAZ22 |
  | 02 | Expressbank ASC | 1500031691 | AZENAZ22 |
  | 03 | Bank Respublika ASC | 9900001901 | BRESAZ22 |
  | 04 | UNİBANK KB ASC | 1300017201 | UBAZAZ22 |
  | 05 | Azərbaycan Sənaye Bankı ASC | 9900007981 | CAPNAZ22 |
  | 06 | Rabitəbank ASC | 9900001061 | RBTAAZ22 |
  | 07 | Bank BTB ASC | 1302164881 | BBTBAZ22 |
  | 08 | Yapı Kredi Bank Azərbaycan QSC | 9900009021 | KABAAZ22 |
  | 09 | BANK VTB (AZƏRBAYCAN) ASC | 1400117231 | VTBAAZ22 |
  | 10 | Bank of Baku ASC | 1700038881 | JBBKAZ22 |
  | 11 | TURANBANK ASC | 1300016391 | TURAAZ22 |
  | 12 | Premium Bank ASC | 9900006241 | AZALAZ22 |
  | 13 | Azər-Türk Bank ASC | 9900006111 | AZRTAZ22 |
  | 14 | ACCESSBANK QSC | 1400057421 | ACABAZ22 |
  | 15 | ASC XALQ Bankı | 2000296061 | HAJCAZ22 |
  | 16 | Paşa Bank ASC | 1700767721 | PAHAAZ22 |
  | 17 | Bank Avrasiya ASC | 1700792251 | AVRAAZ22 |
  | 18 | AFB BANK ASC | 1301703781 | AZFIAZ22 |
  | 19 | Azərbaycan Beynəlxalq Bankı ASC (ABB) | 9900001881 | IBAZAZ2X |
  | 20 | Kapital Bank ASC | 9900003611 | AIIBAZ2X |
  | 21 | Ziraat Bank Azərbaycan ASC | 1303953611 | TCZBAZ22 |
  | 22 | Yelo Bank ASC | 9900014901 | NICBAZ22 |
- **Seed-функция `seedBankGlossary(prisma)`** идемпотентна и устойчива к перетасовке `voen` между `code`: внутри одной транзакции выполняется двухфазный upsert (placeholder VÖEN → реальный VÖEN), благодаря чему UNIQUE на `voen` не нарушается даже при swap'ах. Заодно создаётся head-office запись в `bank_branches` (`isHeadOffice=true`, `branchCode=headBranchCode`, `name="Baş ofis"`).
- **Импорт / сид филиалов** — таблица-источник в репозитории: `packages/database/prisma/catalog/bank/banks-table.md` (входит в пакет `@erafinance/database`). Снимок для рантайма: `packages/database/prisma/catalog/bank/bank-branches.generated.ts` (регенерация: `npm run db:gen:banks-branches-seed`). Отдельный CLI для ручного прогона markdown: `npm run db:import-banks-md` (apply) и `npm run db:import-banks-md:dry` (только отчёт). Логика: `parseBanksMd()` (`packages/database/prisma/lib/bank/banks-md-parser.ts`) → `importBanksMd()` (`packages/database/prisma/lib/bank/banks-md-importer.ts`) → upsert в `bank_glossary` + `bank_branches`. Маппинг `head row → BankGlossary.code` идёт **по VÖEN** (а не по позиции в файле). Несовпавшие VÖEN попадают в `unmatchedHeadVoens` и пропускаются. На контрольном прогоне 2026-05-07 матчатся все 22 банка, апсёртятся 22 записи в `bank_glossary` и 647 в `bank_branches` (22 head-office + 625 филиалов).
- **Маска NAS-субсчёта**: `221.<BankCode>.<Sequence>` — `BankCode` берётся из `bank_glossary.code`, `Sequence` — двузначный (`01`–`99`) счётчик внутри **(organizationId × bankCode)** на основе уже существующих записей в `accounts` (NAS).
- **Хук в модуле бухгалтерии**: **`apps/api/src/accounting/bank-subaccount.service.ts`** → `BankSubaccountService`, методы:
  - `nextSubaccountCode(organizationId, bankCode, db)` — следующий двузначный `Sequence`, валидация маски, защита от переполнения (`> 99` → `BadRequestException`);
  - `ensureSubaccountForBranch(organizationId, bankBranchId, opts, db)` — атомарно создаёт NAS-счёт `221.<bankCode>.<seq>` (тип `ASSET`, родитель — локальный `221`); идемпотентен по `(organizationId, bankBranchId, currency)`. Все операции выполняются внутри `prisma.$transaction` через `BankingService.createOrganizationBankAccount` / `updateOrganizationBankAccount`.
- **Миграции БД**:
  - `packages/database/prisma/migrations/20260508160000_bank_glossary_branches/migration.sql` — создаёт `bank_glossary`, `bank_branches`, добавляет `organization_bank_accounts.bank_branch_id` + индекс + FK `ON DELETE SET NULL`.
  - `packages/database/prisma/migrations/20260509100000_bank_glossary_branches_enrich/migration.sql` — расширяет схему под полный импорт таблицы банков/филиалов: `bank_glossary.correspondent_iban` (UNIQUE), `swift`, `head_phones text[]`, `head_address`; `bank_branches.phones text[]`, `is_head_office bool`. Идемпотентна (`ADD COLUMN IF NOT EXISTS`).

#### Customer Portal Security (гостевая ссылка на счёт)

| Аспект | Требование |
|--------|------------|
| **Токен** | Не перечисляемый идентификатор: **UUID v4** + **"."** + **HMAC-SHA256** (секрет среды `INVOICE_PORTAL_TOKEN_SECRET`, иначе fallback на `JWT_SECRET`) по строке `{invoiceId}:{uuid}`; кодировка подписи **base64url**. Значение хранится в `invoices.public_token` (уникальный индекс). |
| **Подбор** | Перебор пространства токенов практически исключён; на `GET /api/public/invoices/:token` и PDF — **rate limiting** (`@nestjs/throttler`, лимит на IP). |
| **Транспорт** | Ссылка только по **HTTPS** в проде; в ответе портала не раскрывать внутренние UUID организации сверх необходимого публичного JSON. |
| **Язык** | Опционально `counterparties.portal_locale` ∈ {`az`,`ru`,`en`}; иначе язык UI портала по **Accept-Language** браузера. |

### 14.1. Схема Prisma

**Enum `SubscriptionTier`**

```prisma
enum SubscriptionTier {
  STARTER
  BUSINESS
  ENTERPRISE
}
```

**Смысл в продукте (v10.0+, согласовано с PRD §7.1):** три значения — это **единственные именованные тарифы по квотам** («quota tier»). Они задают **включённые потолки** лимитов до докупки единицами (`billing.quota_unit_pricing_v1`). Отдельного параллельного списка «тарифов для квот» нет. Дополнительно: при **`tier === ENTERPRISE`** действует правило **полного модульного доступа** без перечисления slug (см. ниже).

**Модель `OrganizationSubscription` (1:1 с `Organization`)**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID / cuid | PK |
| `organizationId` | String | `@unique` |
| `tier` | `SubscriptionTier` | **Тариф квот:** STARTER / BUSINESS / ENTERPRISE — сидовые потолки квот (см. §14.5); не цена «коробки» продукта |
| `expiresAt` | DateTime? | Конец оплаченного периода |
| `activeModules` | Массив slug | Устаревший/параллельный реестр подключённых модулей (например `production`, `ifrs`) |
| `customConfig` | JSON? | **v8.1 — конструктор тарифа** (см. ниже) |
| `isTrial` | Boolean | Пробный период |

**`customConfig` (JSON) — структура v8.1 (рекомендуемая)**

```json
{
  "preset": "full_access_constructor",
  "modules": [
    "banking_pro",
    "manufacturing",
    "fixed_assets",
    "ifrs_mapping",
    "hr_full",
    "kassa"
  ],
  "quotas": {
    "maxEmployees": 500,
    "maxInvoicesPerMonth": 2000,
    "storageGb": 50
  }
}
```

| Поле | Назначение |
|------|------------|
| `modules` | Массив **slug** купленных модулей. Если массив **непустой**, **гейтинг v2.0** в первую очередь проверяет принадлежность slug этому списку (с алиасами: `production` → manufacturing, `ifrs` ↔ `ifrs_mapping`, `kassa` → доступ к кассе как к части banking). |
| `preset` | Имя шаблона (для поддержки и Super-Admin), не обязателен для API. |
| `quotas` | Переопределения итоговых лимитов поверх **`tier`** (и trial-override); при отсутствии полей — эффективные лимиты из **`tier`** + политика Foundation |

**Правило `tier: ENTERPRISE`:** доступ ко **всем** модулям **без** перечисления `modules` (полный доступ по умолчанию).

**Миграция:** обратимая; для существующих организаций — `customConfig` может быть `null` (эффективные лимиты и модули определяются по **`tier`**, `activeModules` и правилам доступа ниже).

### 14.2. API: `@RequiresModule` и Guard

- Декоратор `@RequiresModule(moduleSlug)` + **SubscriptionGuard**: после auth загрузка подписки; проверка модуля: **1)** при `tier === ENTERPRISE` — разрешено; **2)** при непустом `customConfig.modules` — slug в списке (с алиасами); **3)** иначе — `activeModules` + `tier` (fallback для старых данных).
- Ответ при отсутствии модуля: HTTP **403** с телом, например `code: "MODULE_NOT_ENTITLED"`, поле `module`. (Смысл «нужна оплата» — через этот код в UI; стандарт **402** в отрасли редок; зафиксирован **403 + machine-readable code**.)

**Эндпоинт `GET /api/subscription/me`:** возвращает `customConfig`, `modules` (объект флагов для UI), `activeModules`, `tier`, `isTrial`, `expiresAt`, `billingStatus`, агрегированный объект **`quotas`**: снимки **сотрудников / инвойсов за UTC-месяц / хранилища**, и **`whatsappOutbound`** (`balance` — `Organization.whatsappOutboundMessagesBalance`, `atLimit`).

- **Add-on `audit_hub`:** платный модуль **Audit Hub**; ключ **`pricing_modules.key = audit_hub`**, включается через **`POST /api/billing/toggle-module`** и **`OrganizationSubscription.activeModules`** (патч `audit_hub` в **`SubscriptionAccessService.updateModuleAddons`**); фронтенд: флаг **`modules.auditHub`**; Web **`/audit-hub`**.

### 14.3. Демо (релиз продукта 4.1)

При создании организации: `OrganizationSubscription` с `isTrial: true`, **`tier: BUSINESS`** (тариф квот по умолчанию для триала). Резолвер trial-пакета — **`apps/api/src/subscription/trial-package.util.ts`** (`resolveNewOrganizationTrialSubscription`, вызывается из `AuthService` при регистрации):

1. Предпочтение пакета с **`PricingBundle.slug === 'TRIAL_3_MONTHS'`**, иначе **`isTrialDefault: true`**, иначе константы.
2. **`expiresAt`** — **`computeTrialExpiresAtBaku(Organization.createdAt, 3)`**: +3 календарных месяца в **Asia/Baku**, конец календарного дня Baku → UTC; fallback — `trialDurationDays` (90).
3. **`moduleKeys`** — whitelist операционных модулей; фильтр исключений: **`tax_pro`**, **`trade_pro`**, **`compliance_pro`**.
4. В **`customConfig`**: `trialPackageId`, **`trialPlanSlug: 'TRIAL_3_MONTHS'`**, копия квот (`trialQuotas`) для enforcement.

Сид: один пакет с `slug`, `isTrialDefault`, `trialDurationDays: 90` — `packages/database/prisma/lib/core/trial-bundle-seed.ts`.

**Баннер на дашборде** при активном демо (`isTrial === true`, срок не истёк): тексты AZ/RU из PRD; ссылка на `/settings/subscription` или аналог — **на все дни** trial, не только при остатке ≤ 5 дней.

**Шапка приложения:** рядом с названием компании — **тариф квот (tier)** и **фактические квоты** (инвойсы за месяц, сотрудники), переход к подписке (см. PRD §7.3.1).

**Главная страница:** курсы ЦБА; блок **закрытия месяца** показывается только если `GET /api/reporting/close-period-prompt` возвращает незакрытый **прошедший** UTC-месяц (самый ранний из долга); блок размещается **над** курсами; отдельная страница не обязательна. Краткие **P&L / баланс / ДДС (упрощ.)** — `GET /api/reporting/dashboard-mini` (текущий UTC-месяц, см. PRD §7.3.1).

**После истечения demo:** организация переводится в post-paid (`isTrial=false`) без автоматического READ_ONLY; ограничения применяются только через billing enforcement (`SOFT_BLOCK`/`HARD_BLOCK`) при наличии неоплаченного счёта после cron-цикла. Модули, не оплаченные после trial, **снимаются** с whitelist (gating по `activeModules` / toggle-module).

### 14.4. Feature gating в UI (Next.js)

- Guard layout / client для сегментов маршрутов: данные прав с API или контекста после логина.
- Без модуля — **Paywall** (описание, CTA на подписку).
- **AppShell:** скрывать пункты сайдбара для недоступных модулей; при прямом URL — paywall.

### 14.5. Квоты

- **Тариф квот:** `OrganizationSubscription.tier` ∈ {`STARTER`, `BUSINESS`, `ENTERPRISE`} — базовые потолки до **`customConfig.quotas`**, **`trialQuotas`** (trial) и докупки по **`billing.quota_unit_pricing_v1`**. В **`SystemConfig`** для каждого тира хранится JSON **`billing.quotas.<TIER>`** только с полями **`maxEmployees`**, **`maxInvoicesPerMonth`**, **`maxStorageGb`** (значение **`null`** = безлимит по оси). Поля **`maxOrganizations`** и любые лимиты «сколько организаций у одного пользователя» **не используются**.
- **Дефолты и merge:** `apps/api/src/constants/quotas.ts` + `SystemConfigService.getTierQuotas` / `setTierQuotas`; trial-merge в **`QuotaService.mergeTrialQuotasInto`** (подмножество ключей tier-квот).
- **Foundation:** один сидовый пользователь на организацию (PRD §7.1); дополнительные пользователи — через квоты и докупку.
- **Оси enforcement (код):**
  - сотрудники — `maxEmployees` (guard `QuotaResource.USERS` → фактически штат);
  - инвойсы за **UTC-календарный месяц** — `maxInvoicesPerMonth`;
  - объектное хранилище — `maxStorageGb` + `Organization.storageUsedBytes` (частично вне `QuotaGuard`, см. §14.8.7);
  - **OCR** — лимит записей **`OcrJob`** на орг/месяц из **`quota.ocr_jobs_per_org_month_v1`**; при **`tier === ENTERPRISE`** проверка **пропускается**;
  - **WhatsApp outbound** — предоплаченный остаток **`Organization.whatsappOutboundMessagesBalance`**, проверка перед отправкой через **`QuotaService.assertWhatsappOutboundMessagesRemaining`** (см. PRD §6.8).
- Перед `create` в сервисах — проверка счётчиков организации vs эффективные лимиты.
- Превышение: **`QuotaExceededException`**, HTTP **402 Payment Required** с `code: "QUOTA_EXCEEDED"` и полями `quota`, `limit`, `current` (см. §14.8.7; vs **403** для «нет модуля» / READ_ONLY).

### 14.6. Billing Engine (v8.8 — Dynamic Billing Constructor; ориентиры v10.0 Hybrid LEGO)

**Таблица `PricingModule` (каталог модулей)** — источник правды по ценам; начальное наполнение может соответствовать PRD §7.1 (ориентиры AZN/мес.: **Kassa Pro 15**, **Banking Pro 19**, **Warehouse 25**, **Manufacturing 39**, **HR 19**, **IFRS 29**).

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | PK |
| `key` | String, unique | Slug модуля (`cash_bank_pro`, `inventory`, `tax_pro`, …) |
| `is_premium` | Boolean | **Premium add-on** (Super-Admin): trial shield, `activate-premium`; витрина `/pricing` и marketplace читают флаг из БД |
| `name` | String | Отображаемое имя |
| `pricePerMonth` | Decimal | Цена в AZN за месяц |

**Таблица `PricingBundle` (именованные пакеты)**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | PK |
| `slug` | String, unique, optional | Стабильный идентификатор пакета (например **`TRIAL_3_MONTHS`**) |
| `name` | String | Название пакета (например «Retail Bundle») |
| `discountPercent` | Decimal | Скидка на сумму базы+модулей пакета, % |
| `moduleKeys` | JSON (массив строк) | Ключи модулей, входящих в пакет |
| `isTrialDefault` | Boolean | Trial-пакет по умолчанию (только один `true` в сиде) |
| `trialDurationDays` | Int, optional | Fallback длительности trial в днях |

**SystemConfig (база и квоты, не модули):**

| Ключ | Назначение |
|------|------------|
| `billing.foundation_monthly_azn` | Базовая цена Foundation (AZN/мес.) |
| `billing.yearly_discount_percent` | Скидка при оплате за год (по умолчанию 20) |
| `billing.quota_unit_pricing_v1` | JSON: размер блока сотрудников, цена за блок, размер пакета документов, цена за пакет |
| `billing.price.STARTER` / `BUSINESS` / `ENTERPRISE` | **Не** источник правды по выручке для новых клиентов; опционально в API для совместимости/миграций (PRD §7.1). Месячное начисление — Foundation + модули + overlimit квот. |

**Расчёт (ориентир для UI и будущего checkout):**

\[
\text{TotalPrice} = \text{BasePrice} + \sum(\text{SelectedModules}) + (\text{ExtraQuotas} \times \text{UnitPrice})
\]

- **Скидка пакета:** итог после выбора модулей умножается на \((1 - \text{bundleDiscount}/100)\), если применён именованный пакет.
- **Годовая скидка:** при периоде «год» к месячному эквиваленту применяется \((1 - \text{yearlyDiscount}/100)\) к сумме за 12 месяцев (или эквивалентная логика в одной строке — зафиксировать в коде биллинга).

**API (Super-Admin):** `GET /admin/config/billing` возвращает в т.ч. **опциональные** исторические `prices` (`billing.price.*`), `quotas`/`quotaPricing`, `foundationMonthlyAzn`, `yearlyDiscountPercent`, `pricingModules[]`, `pricingBundles[]`. Обновление: **`PATCH /admin/config/billing/pricing-catalog`** (Foundation + все модули, транзакция), **`PATCH /admin/config/billing/global-limits`** (годовая скидка, OCR, unit pricing, три legacy tier price, транзакция); по отдельности при необходимости — `PATCH` foundation, yearly-discount, quota-pricing; `PATCH /admin/pricing-modules/:id` (legacy); CRUD `/admin/pricing-bundles` с опциональным **`trial`** в теле обновления пакета.

### 14.7. Emergency Access Override (v8.9)

**Hardcoded bypass (только этап разработки / согласованный аккаунт):** для пользователя с email **`shirinov.chingiz@gmail.com`** метод **`SubscriptionAccessService.assertModuleAccess`** на бэкенде **безусловно разрешает** доступ ко всем модулям (не выбрасывает 403 `MODULE_NOT_ENTITLED`). Реализация: `SubscriptionGuard` передаёт `user.email` в `assertModuleAccess`; константа `EMERGENCY_MODULE_ACCESS_EMAIL` в `subscription-access.service.ts`.

**Фронтенд:** в `subscription-context` тот же email получает **снимок ENTERPRISE** через `effectiveSnapshot` (без блокировок UI). Продакшен: убрать или заменить на конфиг из env.

### 14.8. Владелец организации, схема биллинга и API (PRD §7.12, Billing v10.0)

**Цель:** зафиксировать целевую модель данных и контракты API для **биллинга платформы** (подписка ERA Finance), не смешивая их с **инвойсами продаж** (`Invoice` в домене учёта).

**Доступ к Billing (UI и API):** только пользователь с ролью **`OWNER`** в соответствующей организации; **Admin / Accountant / User** биллинг не видят (см. PRD §7.12.1). Маршруты привязки карты и истории платежей — те же правила.

#### 14.8.1. Терминология

| Термин | Значение |
|--------|----------|
| **Owner (роль)** | `UserRole.OWNER` в `OrganizationMembership`; единственная роль с доступом к подписке, оплате и истории по организации. |
| **ownerId** | FK `organizations.owner_id → users.id` — владелец для **агрегированного счёта** и **Change Owner**; при корректных данных совпадает с пользователем, у которого в этой org роль **OWNER**. |
| **Счёт платформы** | Таблицы **`billing_invoices`** / **`billing_invoice_items`** (Prisma: `BillingInvoice`, `BillingInvoiceItem`), не `invoices` |
| **Единый месячный счёт** | Один документ `billing_invoices` на `ownerUserId` за период, с строками по **нескольким** `organizationId` (PRD §7.12.4). |
| **Тариф квот (`tier`)** | Поле `OrganizationSubscription.tier` ∈ {`STARTER`, `BUSINESS`, `ENTERPRISE`} — **включённые потолки квот**; не дублируется другими маркетинговыми именами. См. PRD §7.1; механизм лимитов — **§14.5** ниже. |

#### 14.8.2. Расширение таблицы `organizations`

| Поле | Тип | Описание |
|------|-----|----------|
| `ownerId` | UUID FK → `users.id` | Владелец; при создании org = создатель; смена — только через **Transfer** (14.8.5) |
| `billingStatus` | Enum | `ACTIVE` \| `SOFT_BLOCK` \| `HARD_BLOCK`; технический статус post-paid жизненного цикла задолженности |
| `status` | Enum (целевой) | `ACTIVE` \| `TRIAL` \| `SUSPENDED` — жизненный цикл доступа к org (согласовано с `OrganizationSubscription.isTrial` / `isBlocked`) |
| `drakarisClientId` | `String?` `@unique` | Внешний идентификатор клиента в провайдере **Drakaris/yığım** (см. **§14.8.14**); используется для резолва организации по `GET /v1/client/{id}` без раскрытия внутреннего UUID. Может совпадать с VÖEN или быть назначен при подключении к yığım. Колонка добавлена миграцией `20260510140000_add_user_locale_phone_drakaris_org`. |
| `whatsappOutboundMessagesBalance` | `Int` @default(0) | Остаток **предоплаченных** успешных исходящих отправок **WhatsApp Business API** по организации (PRD §6.8); отображение в **`GET /api/subscription/me`** → `quotas.whatsappOutbound`. |

**Миграция:** для существующих строк `ownerId` заполняется из первого пользователя с ролью `OWNER` в `OrganizationMembership` (скрипт бэкапа перед миграцией обязателен).

#### 14.8.3. Таблица `organization_modules` (нормализация модулей)

Связь **M:N** с атрибутами по организации:

| Поле | Описание |
|------|----------|
| `organizationId`, `moduleKey` | Составной PK или уникальный индекс |
| `priceSnapshot` | Цена модуля (AZN/мес.), зафиксированная при включении |
| `activatedAt` | Момент включения модуля (для аудита и помесячного post-paid начисления) |
| `pendingDeactivation` | Флаг отложенного отключения: `true` после disable, фактическое выключение выполняется после monthly billing |

До внедрения строки модулей могут дублироваться из `OrganizationSubscription.activeModules` / `customConfig.modules` — при внедрении — **одна** точка правды (политика: синхронизировать в транзакции при `toggle-module`).

#### 14.8.3a. Таблица `organization_bundles` (пакеты модулей)

| Поле | Описание |
|------|----------|
| `organizationId`, `bundleId` | Составной PK → `pricing_bundles.id` |
| `priceSnapshot` | Скидочная цена пакета (AZN/мес.) на момент включения |
| `activatedAt`, `pendingDeactivation`, `cancelledAt`, `accessUntil` | Та же политика отложенного отключения, что у `organization_modules` |

**Дедупликация биллинга:** `BillingEntitlementService.allocateBillableEntitlements` — каждый `moduleKey` не более одного раза: сначала пакеты по `activatedAt`, в пакете только slug, ещё не занятые; оставшиеся — à la carte из `organization_modules`. При **`toggle-bundle` enabled** строки `organization_modules` для slug пакета **удаляются**. Миграция: `20260527120000_organization_bundles`.

#### 14.8.4. Счета платформы (не Sales)

**`billing_invoices`**

| Поле | Описание |
|------|----------|
| `id` | PK |
| `ownerUserId` | FK → пользователь (плательщик, владелец организаций) |
| `totalAmount` | Итог |
| `status` | Enum: `DRAFT`, `ISSUED`, `PAID`, `OVERDUE`, … |
| `periodStart`, `periodEnd` | Месячный (или иной) расчётный период |
| `billingPeriod` | Технический период `YYYY-MM` (например, `2026-04`) для дедупликации monthly job |
| `pdfLink` | URL объекта в S3-хранилище |

**`billing_invoice_items`**

| Поле | Описание |
|------|----------|
| `invoiceId` | FK → `billing_invoices` |
| `organizationId` | FK → `organizations` — разбивка по VÖEN |
| `description` | Текст строки (модуль, квота, база) |
| `amount` | Сумма строки (AZN) |

Существующая **`PaymentOrder`** может оставаться для оплаты через шлюз; связь `PaymentOrder` ↔ `BillingInvoice` добавляется при реализации (FK опционально).

#### 14.8.5. API (префикс `/api`, JWT)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/billing/summary` | Организации, где текущий пользователь — **`OWNER`** и согласованно **`ownerId`** (портфель для биллинга); помесячные агрегаты по каждой org: база, модули, квоты; итог **`estimatedNextPayment`** на следующий цикл (сумма по портфелю). |
| GET | `/billing/invoices` | **Billing History:** список счетов платформы (`billing_invoices`) для `currentUser` как владельца — дата, период, сумма, статус, ссылка на **PDF** (`pdfLink`); пагинация. |
| GET | `/billing/invoices/:id/pdf` | Опционально: отдача PDF по id счёта (если не используется прямой URL из `pdfLink`). |
| GET | `/billing/upgrade-preview?newTier=ENTERPRISE` | Превью стоимости апгрейда тарифа: `amountToPay`, `daysRemaining`, `currentTier` до перехода к оплате. |
| GET | `/billing/marketplace` | Каталог модулей и пакетов (без trial-default bundle), состояние org, `allocation` (дедуп), `monthlyTotalAzn`, premium flags. **Guard:** OWNER. |
| POST | `/billing/toggle-module` | Тело: `{ moduleKey, enabled }`. **Guard:** OWNER; **`MODULE_IN_ACTIVE_BUNDLE`** если slug уже в активном пакете; premium — `assertNotTrialLockedPremium` / `activate-premium`. Post-paid, без мгновенной оплаты. |
| POST | `/billing/toggle-bundle` | Тело: `{ bundleId, enabled }`. Включение пакета → `organization_bundles` + `activeModules`; удаление à la carte строк для slug пакета. |
| POST | `/billing/activate-premium` | Тело: `{ modules[], confirmCommercialStatus }`. Разблокировка premium в trial / на TIER_0+. |
| GET | `/billing/module-states` | Состояние `organization_modules` (`pendingDeactivation` badge). |
| POST | `/billing/transfer` | Смена владельца: **double opt-in**; в одной `prisma.$transaction`: `organizations.ownerId`, роли membership. |

Ответы **403** при отсутствии роли **OWNER** или попытке доступа к чужой организации; **404** для чужой `organizationId`.

#### 14.8.6. Платёжный цикл Post-paid

- **Месячный цикл:** `@Cron('0 0 1 * *')` формирует неоплаченные `SubscriptionInvoice` за **прошедший** месяц.
- **База расчёта (модули/пакеты):** `BillingEntitlementService.computeInvoiceModuleLines` — строки пакетов (скидка на незанятые slug) + à la carte модули **без пересечения**; Foundation, metered usage, premium — отдельные строки (§24.3). Без pro-rata в момент toggle.
- **Free first month:** модуль с `activatedAt` внутри выставляемого месяца в счёт не включается (первый календарный месяц бесплатный).
- **Идемпотентность:** один счёт на owner+`billingPeriod` (`YYYY-MM`) за месяц; повторный запуск cron не создаёт дубль.
- **Billing status:** после генерации счёта организация переводится в `billingStatus = SOFT_BLOCK`.
- **Отключение модуля:** при disable выставляется `pendingDeactivation=true`, доступ сохраняется до конца месяца; после выставления счёта pending-модули физически отключаются.

#### 14.8.9. Напоминания перед биллингом

- `@Cron('0 10 25 * *')` (25-е число, 10:00 UTC) обходит организации с активными платными модулями.
- Для каждой организации создаётся in-app запись уведомления через `NotificationService` с текстом:  
  **"Внимание! 1-го числа будет сформирован счет. Пожалуйста, проверьте активные модули и отключите неиспользуемые."**
- Идемпотентность на день: повторный запуск в тот же день не дублирует уведомление для одной организации.

#### 14.8.10. Marketplace Consent UX (Post-paid)

- При включении модуля (`enabled=true`) фронтенд обязан показать **Consent Modal** до API-вызова:
  - "Стоимость: X AZN/мес. Использование до конца текущего месяца — бесплатно. Первый счёт — 1-го числа следующего месяца. Модель: Post-paid."
- При отключении (`enabled=false`) фронтенд показывает отдельную модалку:
  - "Модуль доступен до конца текущего месяца; 1-го числа формируется последний счёт и модуль отключается."
- При подтверждении отключения backend не удаляет модуль сразу, а переводит строку в состояние `pendingDeactivation=true`.
- В карточке модуля Marketplace при `pendingDeactivation=true` показывается badge: **"Отключится 1-го числа"**.

#### 14.8.11. Billing Enforcement: SOFT/HARD block

- Глобальный `BillingAccessGuard` применён как `APP_GUARD`:
  - при `billingStatus = SOFT_BLOCK` блокируются экспортные маршруты (`/export`, PDF/XLSX, XML декларации) с ответом **402 Payment Required**;
  - при `billingStatus = HARD_BLOCK` система переводится в read-only: разрешены только `GET/HEAD/OPTIONS`, мутации блокируются **402**;
  - исключение для `HARD_BLOCK`: разрешены платежные billing endpoints (`POST /api/billing/checkout`, webhook routes) для погашения задолженности.
- `@Cron('0 0 6 * *')`: эскалирует `SOFT_BLOCK → HARD_BLOCK` для организаций, у которых счёт за прошлый `billingPeriod` остаётся `status != PAID`.
- После успешной оплаты биллинга `billingStatus` организации возвращается в `ACTIVE`.

#### 14.8.7. QuotaGuard и перехват на фронте

**Декоратор `@CheckQuota(resource)`** (Nest): метаданные для ресурса (`USERS` → фактически лимит **сотрудников**, `INVOICES_PER_MONTH`, `STORAGE` — квота хранилища дополняется проверками в сервисах загрузки файлов / PDF). Guard вызывает **`QuotaService`** до мутации; при превышении — **`QuotaExceededException` → HTTP 402** с телом `QUOTA_EXCEEDED`.

**Поле `quota` в теле ошибки** (тип **`QuotaKind`** в коде): `maxEmployees` \| `maxInvoicesPerMonth` \| `maxStorageGb` \| `maxOcrJobsPerMonth` \| `whatsappOutboundMessages`.

**Фронтенд:** глобальный перехват в `apiFetch` для `402` + `code === "QUOTA_EXCEEDED"` — событие **`erafinance:quota-upgrade`** и отображение модалки апгрейда (тот же UX-паттерн, что и `SUBSCRIPTION_READ_ONLY`).

#### 14.8.8. Вебхуки платёжных систем (v23.0)

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/billing/webhooks/:provider` | Приём уведомления шлюза (`mock`, `pasha`, `pasha_bank`). **Публичный** маршрут (`@Public()`): без JWT. |

- **Подпись:** тело `{ orderId, status, signature, externalId? }`; проверка HMAC как у PAŞA Bank mock/реального шлюза (`PashaBankPaymentProvider.verifyWebhookSignature`). Неверная подпись → **401**.
- **Идемпотентность:** перевод `PaymentOrder` из `PENDING` в `PAID` через **`updateMany`** с условием `status = PENDING`; повторный вебхук не продлевает подписку повторно. Запись **`SubscriptionInvoice`** — с защитой от дубликата по `paymentOrderId`.
- **Побочные эффекты при успехе:** обновление **`OrganizationSubscription`** (продление `expiresAt` / синхронизация модулей по metadata заказа), запись в **`audit_logs`** с `organizationId = null`, `entityType = platform.billing.payment_applied` (глобальный аудит платформы).
- **Legacy:** `POST /api/public/billing/webhook` сохраняется для совместимости; новые заказы используют callback URL на **`/api/billing/webhooks/pasha_bank`**.
- **Auto-Resume (SRE/QA):** добавлен публичный маршрут `POST /api/public/billing/webhook/:provider` (поддержка `mock`, `pasha`, `pasha_bank`, `stripe`) и payload с `subscriptionInvoiceId`; при `status=success` система:
  1) переводит соответствующий `SubscriptionInvoice` в `PAID`,
  2) находит связанные организации по invoice items,
  3) автоматически снимает ограничения доступа (`billingStatus -> ACTIVE`) даже из состояния `HARD_BLOCK`.

#### 14.8.12. Сверка биллинга (anti-freerider)

- Скрипт **`npm run platform:billing-reconcile`** (`scripts/billing-reconciliation.ts`): для организаций с подпиской **не `ENTERPRISE`**, **`isTrial = false`**, считается ожидаемая сумма по активным строкам **`organization_modules`** и ценам **`pricing_modules`** (логика активации совпадает с **`BillingMonthlyService`** — первый месяц после `activatedAt` бесплатен и т.д.) и сравнивается с суммой строк **`billing_invoice_items`** за выбранный **`billing_period`** (`subscription_invoices` в статусах ISSUED / PAID / OVERDUE). Расхождение **> 0.02 AZN** или **ожидание > 0 при нулевых строках** → предупреждение в stdout и **код выхода 1**. Период: аргумент **`--period=YYYY-MM`**, по умолчанию — **предыдущий календарный месяц (UTC)**.

#### 14.8.13. DR drill (автоматизированная проверка после restore)

- **`npm run platform:dr-validate`** — `COUNT(*)` по таблицам `users`, `organizations`, `accounts`, `journal_entries`, `transactions`, `products`, `stock_items`, `counterparties`; опционально **`--baseline=*.json`** для поэлементного сравнения; несовпадение или нулевые `users`/`organizations` после restore → **exit 1**.
- **`bash scripts/dr-drill.sh`** — последний архив **`backups/db/*.sql.gz`** → временный контейнер **PostgreSQL 16** → `psql` restore → `platform:dr-validate` → удаление контейнера (см. **`docs/deploy/DR_RUNBOOK.md` §8**).

#### 14.8.14. Drakaris (yığım) — второй платёжный провайдер подписки (v2026.06)

**Семантика:** Drakaris/yığım — внешний агрегатор оплаты, который **сам обращается** к публичному API ERA (Basic Auth), запрашивает у клиента сумму и инициирует пополнение — в отличие от PAŞA Bank, где ERA редиректит пользователя на платёжку и принимает HMAC-вебхук. Поэтому status-коды spec (`200 / 401 / 402 / 404 / 405 / 406 / 407 / 408`) реализованы как ответы **нашего REST-эндпоинта**, не как обработка чужих кодов.

**Модуль:** `apps/api/src/integrations/payment-providers/drakaris/`

| Файл | Назначение |
|------|-----------|
| `drakaris.controller.ts` | `@Controller('integrations/drakaris/v1')`, **`@Public()`**, **`@Throttle`**; маршруты `GET 'client/:id'` и `POST 'client/:id/payments'`; HTTP всегда **`200`** (признак ошибки — поле `status` в теле). |
| `drakaris.service.ts` | Доменная логика: `checkClient(id)` и `topUpBalance(id, body)`. |
| `drakaris-status.ts` | Константа `DrakarisStatus` (`OK=200`, `INVALID_CLIENT_ID=401`, `PAYMENTS_DISABLED=402`, `NOT_AVAILABLE_FOR_CLIENT=404`, `INTERNAL_ERROR=405`, `DUPLICATE_TRANSACTION=406`, `CURRENCY_MISMATCH=407`, `VALIDATION_ERROR=408`) + `DRAKARIS_STATUS_DESCRIPTIONS` и тип `DrakarisEnvelope = { status, description, data }`. |
| `drakaris-payment.provider.ts` | Совместимость с `PaymentProviderService.createOrder({ provider: "drakaris" })`: возвращает payment session с `paymentUrl: null` и инструкциями для UI «оплатите в yığım по этому ID». |
| `drakaris.module.ts` | Nest-модуль; импортируется в `app.module.ts`; реэкспорт `DrakarisPaymentProvider` для `BillingModule`. |

**Auth:** контроллер встроенно сравнивает `Authorization: Basic <base64>` через `timingSafeEqual` с `DRAKARIS_BASIC_USER` / `DRAKARIS_BASIC_PASS` из `ConfigService`. На неуспех — конверт **`401`** (`Unauthorized`).

**Резолв клиента:** `Organization` ищется по **`drakarisClientId`** (см. **§14.8.2**); глобальный фиче-флаг `DRAKARIS_ENABLED=1` обязателен (иначе **`402`**); проверяется доступность yığım для конкретной организации — иначе **`404`**.

**`POST /v1/client/:id/payments` (top-up):**
- валидация валюты (только **AZN**) → иначе **`407`**;
- валидация полей (`amount`, `transaction-id`, …) → иначе **`408`**;
- идемпотентность: `PaymentOrder` создаётся **upsert по `idempotencyKey = transaction-id`** (ровно тот же ключ, что прислал yığım); повторный запрос для уже существующего `transaction-id` → **`406`** (без второго проведения и без второго продления подписки);
- создание заказа: `PaymentOrder { provider: "drakaris", providerTxnId: transactionId, idempotencyKey: transactionId, amountAzn: amountCoins / 100 }`; затем приватный аналог `PaymentProviderService.finalizePaidOrder` обновляет `OrganizationSubscription` и пишет аудит **`platform.billing.payment_applied`**;
- любая внутренняя ошибка маппится в **`405`**.

**Биллинг-интеграция:**
- `PaymentOrder.provider` — это **строка** (default `"pasha_bank"`), миграция схемы не нужна; для нового провайдера используется значение `"drakaris"`.
- `PaymentProviderService.createOrder` поддерживает выбор провайдера через `dto.provider` (`"pasha_bank" | "drakaris"`); для Drakaris — `paymentUrl: null` + инструкции UI.
- `apps/api/src/billing/billing-webhooks.controller.ts` — список `SUPPORTED_PROVIDERS` дополнен `"drakaris"` на случай если yığım вместо REST вызовет webhook; HMAC-проверка PAŞA не применяется, в `payment-provider.service.ts` ветка `if (provider === 'drakaris')` делегирует обработку в `DrakarisService.topUpBalance`.
- `apps/api/src/audit/audit-mutation.interceptor.ts` — `pathRaw.includes('/integrations/drakaris/')` добавлен в исключения (yığım не имеет нашего user/org контекста); аудит платежа продолжает идти через `auditService.logPlatformBillingPaymentApplied`.

**Env (корневой `.env.example`):**

| Ключ | Назначение |
|------|------------|
| `DRAKARIS_ENABLED` | Глобальный фиче-флаг (`0` / `1`); `0` → endpoint всегда отвечает `402`. |
| `DRAKARIS_ENV` | `test` \| `live` (для исходящих вызовов и логов). |
| `DRAKARIS_BASIC_USER` / `DRAKARIS_BASIC_PASS` | Креды Basic Auth, выданные провайдером для `Authorization: Basic …`. |
| `DRAKARIS_TEST_BASE_URL` / `DRAKARIS_LIVE_BASE_URL` | Базовые URL агрегатора (для будущих outbound-вызовов сверки). |

**Тесты:** `drakaris.service.spec.ts` (jest, без сети) с моками `PrismaService` / `PaymentProviderService` покрывает: `200`, `401` (нет org), `402` (`DRAKARIS_ENABLED!=1`), `404` (модуль yığım не подключён к организации), `406` (duplicate `transaction-id`), `407` (currency mismatch), `408` (валидация amount/transaction-id), `405` (исключение в `finalize`).

---

### 14.9. Referral & Partner Program

**Модели (Prisma):** `Partner` (код, `displayName`, `ownerUserId?`, `isCorporate`, `fixedRatePercent?`), `Referral` (`partnerId`, `organizationId` @unique, `signupAt`, `windowEndsAt` = signupAt + 12 months, `isActive`, `source`), `ReferralCommission` (помесячное начисление, `status` ACCRUED/PAID/CANCELLED, уникальность по `(referralId, periodYear, periodMonth)`).

**Правила комиссии:** tier-лесенка **10% / 15% / 20%** по количеству активных привлечённых организаций партнёра; `fixedRatePercent` у **Corporate partner** переопределяет tier.

**REST (канон):**
- Публичная регистрация: `POST /api/auth/register` принимает опциональный `referralCode`; при валидном коде создаётся строка `Referral` в той же транзакции, что и `Organization`.
- Партнёр: `GET /api/partner/dashboard` (JWT, роль **PARTNER** в membership **или** привязка `Partner.ownerUserId`).
- Super-Admin: `GET|POST|PATCH /api/admin/referrals/partners`, `GET /api/admin/referrals/partners/:id/qr.png` (PNG QR на URL регистрации с `?ref=`).

**BullMQ:** очередь **`referral-monthly`** с `repeat.pattern: "0 5 1 * *"` (UTC 05:00 1-го числа, после основного биллинга в 00:00) — деактивация `Referral.isActive` для `windowEndsAt < now`; начисление комиссий — из `BillingMonthlyService` после формирования платформенных счетов (см. код).

---

### Критерии приёмки v4.0 (сводно)

1. `SubscriptionTier` и `OrganizationSubscription` 1:1; миграция без потери данных.
2. API платных модулей отклоняет запросы без slug в `activeModules` с документированным JSON.
3. UI скрывает меню и показывает paywall при прямом заходе без права.
4. Создание сотрудника/инвойса блокируется при превышении квоты с предсказуемым кодом.
5. Лимиты централизованы в `quotas.ts`, без «магических чисел» в сервисах.
6. Демо: регистрация → trial BUSINESS с **Trial-пакетом** (по умолчанию **90 дней** UTC от `organizations.created_at`); баннер на дашборде; после окончания — `isTrial=false` и post-paid gating без вечного READ_ONLY «без оплаты».

### Зависимости и риски v4

- Синхронизация slug между Prisma, Guard, Next.js и маркетингом.
- Кэш подписки на запрос (короткий TTL) при частых проверках.
- Следующий этап: платёжный шлюз, webhooks, обновление `expiresAt` / `activeModules` — см. PRD, биллинг MVP.

---

## 15. Платформа: Admin Panel (Super-Back-office)

> В [PRD.md](./PRD.md) соответствующий блок — **§7.6**. Ниже — архитектура **платформенной** админки (не путать с **модулем 6** HR в §7 этого документа).

### §15.0 Security / Audit — PII and Secret redaction in integration logs

- **Цель:** не сохранять и не писать в application logs незамаскированные **PII** и **секреты** из ответов/ошибок внешних API (банки, IBAN.com, налоговые пробы и т.п.).
- **Реализация:** сервис **`DataMaskingService`** рекурсивно обходит JSON (включая массивы и строки с JSON-объектом) и подменяет значения по нормализованным ключам (`password`, `token`, `accessToken`, `fin`, `pin`, `iban`, `balance`, `api_key`, …) на литерал **`***MASKED***`**.
- **AuditLog / `logOrganizationSystemEvent`:** поля вроде `rawResponse`, `payload`, `newValues` / `oldValues` проходят маскирование **до** персистенции в БД.
- **Банковские адаптеры:** при логировании тела ошибок HTTP используется тот же сервис (укороченная строка для stdout), чтобы токены и реквизиты не утекали в консольные логи.

### 15.1. Архитектура Супер-админа

**Безопасность**

- Роль **SUPER_ADMIN** (флаг в профиле): не привязана к конкретной организации в смысле доступа к данным — эндпоинты супер-админа **обходят** фильтрацию по `organizationId` и отдают данные по всей системе.
- **Guard:** `SuperAdminGuard` — проверка `isSuperAdmin` в JWT/профиле.

**Схема данных (расширение)**

- **`SystemConfig`:** ключ–значение (JSON): цены тарифов, квоты, системные сообщения.
- **`TranslationOverride`:** переопределения строк i18n поверх статических файлов (`resources.ts` на web). После **`npm run db:deploy`** / **`db:sync-i18n(:prune)`** для локалей **ru** и **az** в таблице хранится полный набор ключей из `resources.ts` (upsert значений из кода); Super-Admin может менять отдельные значения до следующего деплой-синка. В бандле дублируются краткие строки **`paymentHistory.*`** (страница истории) и **`subscriptionSettings.paymentHistory.*`** (тот же смысл в блоке подписки); при оверрайдах из БД не использовать родительский ключ вместо вложенных полей.

**Эндпоинты (REST, префикс `/api`)**

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/admin/stats` | Сводка: выручка (сумма оплаченных заказов), новые пользователи за 24 ч, число организаций, активные триалы. |
| GET | `/admin/organizations` | Список компаний с пагинацией и поиском по VÖEN/названию. |
| PATCH | `/admin/organizations/:id/subscription` | Принудительное продление, блокировка, смена тарифа. |
| GET/PATCH | `/admin/config/billing` | Чтение цен, квот, Foundation, каталога `PricingModules`, `PricingBundles` (через `SystemConfig` + Prisma). |
| PATCH | `/admin/config/billing/foundation`, `/yearly-discount`, `/quota-pricing` | База, годовая скидка, единицы квот (по отдельности при необходимости). |
| PATCH | `/admin/config/billing/pricing-catalog` | **Атомарно:** Foundation + для **каждого** модуля `pricePerMonth` и **`isPremium`** (`prisma.$transaction`). Кэш premium-slugs в `PricingService` обновляется после save. |
| PATCH | `/admin/config/billing/global-limits` | **Атомарно:** `billing.yearly_discount_percent`, `quota.ocr_jobs_per_org_month_v1`, `billing.quota_unit_pricing_v1`, legacy **`billing.price.*`** для трёх tier (`prisma.$transaction`). |
| PATCH | `/admin/pricing-modules/:id` | Цена одного модуля (legacy; предпочтительно bulk **`pricing-catalog`**). |
| POST/PATCH/DELETE | `/admin/pricing-bundles`, `/admin/pricing-bundles/:id` | Пакеты (Paket yaradıcısı). |
| GET/POST/DELETE | `/admin/translations` | Редактор переводов; `POST /admin/translations/sync` — инкремент версии кэша для клиентов. |
| GET | `/public/translations?locale=` | Публичная выдача переопределений для слияния на клиенте. |
| GET | `/public/pricing` | То же, что **`GET /api/public/pricing`** (см. **§15.3.1**): публичный read-only снимок прайс-листа для лендинга. |
| GET | `/public/landing-modules` | То же, что **`GET /api/public/landing-modules`** (см. **§15.3.2**): карточки маркетингового лендинга AZ/RU. |
| GET | `/admin/landing-modules` | Список **`LandingModuleMarketing`** для Super-Admin. |
| PATCH | `/admin/landing-modules/:moduleSlug` | Редактирование текстов карточки лендинга (`names`, `descriptions`, `tasks`, `sortOrder`); audit на PATCH. |
| GET | `/admin/audit-logs` | Глобальный просмотр `AuditLog` с фильтром по `organizationId`. |
| POST | `/admin/impersonate/:userId` | Выдача токенов от имени пользователя (поддержка). |

**Биллинг:** `GET /billing/plans` и поле `tier` в `POST /billing/checkout` — **не** смешивать с «коробочной» ценой: `tier` выбирает **тариф квот**; денежные суммы строк счёта — из Foundation, каталога модулей и `quota_unit_pricing` (значения в `SystemConfig` / снимках, не из захардкоженных констант в коде).

**UI (маркетинг):** маршрут **`/super-admin`**, вкладка **«Лендинг»** — таблица карточек `LandingModuleMarketing` и модалка редактирования AZ/RU (`LandingModulesEditor`); см. **§15.3.2** и PRD §7.6.4.

### 15.2. Tarif Konstruktoru (конструктор тарифов, v8.1+; UI v8.8)

**Цель:** в Super-Admin задать **цены конструктора** и **именованные пакеты** (см. PRD §7.1).

| Элемент | Описание |
|---------|----------|
| **Прайс-лист** | Маршрут **`/super-admin/billing/pricing`**: **(1) ERA Core / Foundation**, **(2) основные модули** (`is_premium = false`), **(3) premium-модули** (`is_premium = true`, badge Premium); переключатель Premium в таблице основных модулей переносит строку между секциями. Сохранение — **`PATCH /admin/config/billing/pricing-catalog`** (Foundation + `pricePerMonth` + `isPremium` для всех slug). Каталог: единый slug **`cash_bank_pro`** (вместо legacy `kassa_pro` + `banking_pro`). Подписи: **`pricingModule.<key>`** + fallback **`name`**. |
| **Квоты** | Маршрут **`/super-admin/billing/quotas`**: **без** блока Foundation (Foundation только на **Прайс-листе**). Карточки по tier с заголовками **`STARTER` / `BUSINESS` / `ENTERPRISE`** (литералы enum, **не** i18n); модалка **редактирования** tier (legacy **`billing.price.*`** + **`maxEmployees`**, **`maxInvoicesPerMonth`**, **`maxStorageGb`**). Глобальные лимиты (OCR, unit pricing, годовая скидка, три legacy tier price) — **`PATCH /admin/config/billing/global-limits`** в одной транзакции. Квоты tier — по-прежнему **`PATCH /admin/config/billing/quotas`** (или расширение bulk позже). |
| **Paket yaradıcısı** | Маршрут **`/super-admin/billing/packages`**: список пакетов; создание и редактирование — **модалка** (модули switch с подписями **`pricingModule.<key>`** / fallback на **`name`**, имя пакета, скидка %, предпросмотр). **Trial-пакет:** `isTrialDefault`, `trialDurationDays`, `trialQuotas` — в **той же** модалке; сохранение через **`PATCH /admin/pricing-bundles/:id`** с опциональным телом **`trial`** (атомарно с полями пакета в **`$transaction`**) и/или существующий контракт trial-config, объединённый в сервисе. Визуально: **badge/рамка** для пакета с `isTrialDefault`. |
| **Стиль** | Карточки: `CARD_CONTAINER_CLASS`, палитра **#34495E** / **#2980B9** (см. DESIGN.md). |
| **Связь с БД** | Модули и пакеты — таблицы **`pricing_modules`**, **`pricing_bundles`**; Foundation, единицы докупки квот и годовая скидка — `SystemConfig`. Подписка организации — `OrganizationSubscription.customConfig` + **`tier` (тариф квот)**. |

Ключи **`billing.price.*`**, если присутствуют, **не** задают продуктовую цену для новых клиентов (PRD §7.1); основной UX — конструктор (Foundation + модули + overlimit), а не «три карточки коробок».

### 15.3. Публичные маркетинговые API (read-only)

#### 15.3.1. Публичный прайс-лист (`GET /api/public/pricing`, read-only)

**Назначение:** единый read-only снимок для **гостей** и **внешнего маркетингового сайта** без JWT и без данных организаций. Продуктовая связь — [PRD.md](./PRD.md) §7.1 (ссылка на витрину), §7.6.4 (таблица полей и веб **`/pricing`**).

| Аспект | Реализация |
|--------|------------|
| **HTTP** | **`GET /api/public/pricing`** (префикс приложения Nest: **`/api`**). Класс **`PublicPricingController`** (`apps/api/src/admin/public-pricing.controller.ts`), декоратор **`@Public()`**, **`@SkipThrottle()`**; глобальные guards пропускают маршрут по **`IS_PUBLIC_KEY`** (см. `JwtAuthGuard`, `SubscriptionReadOnlyGuard`). |
| **Источник данных** | **`AdminService.getPublicPricingSnapshot()`** — внутри используется тот же снимок, что и для **`GET /admin/config/billing`**, с **санитизацией**: из модулей убраны UUID; из пакетов убраны **`id`** и JSON **`trialQuotas`** (остаются **`isTrialDefault`**, **`trialDurationDays`** для маркетинга trial). |
| **Тело ответа (JSON)** | **`currency`**: `"AZN"`; **`foundationMonthlyAzn`**, **`yearlyDiscountPercent`**; **`pricingModules[]`**: `{ key, name, pricePerMonth, sortOrder }`; **`pricingBundles[]`**: `{ name, discountPercent, moduleKeys, isTrialDefault, trialDurationDays }` (без UUID); **`meterUnitPricing`**; **`tierSpendCeilings`**; обогащение **`standardModules`**, **`bundles`** (list/discounted), **`tiers[]`**, **`premiumModules`**, **`ocrJobsPerOrgMonth`**. При ошибке — **`unavailable: true`**. |
| **CORS (внешний лендинг)** | В **production** браузерный `fetch` с другого Origin требует, чтобы Origin был в **`CORS_ORIGINS`** API (переменная окружения, см. **`apps/api/src/main.ts`**, **`.env.example`**). |
| **Веб (монорепо)** | **`/pricing`** — `apps/web/app/pricing/page.tsx` → **`PricingPageView`** (`apps/web/components/pricing/*`): публичный маршрут в **`middleware.ts`**; **`layout.tsx`** — **`publicPath`** / **`barePublicLayout`** (без `AppShell`). **Маркетинговая витрина (v2026.05):** статический copy **`@erafinance/i18n/pricing-postpaid-copy`** (shim `apps/web/lib/i18n/pricing-postpaid-copy.ts`), Light Tech Canvas **`bg-[#EBEDF0]`**, секции **`pricing-core-suite-banner`**, **`pricing-resource-matrix`**, **`pricing-premium-panel`** — см. **§15.3.3**. **`publicApiFetch("/api/public/pricing")`** — опционально для merge цен; тип **`PublicPricingResponse`** — `apps/web/lib/public-pricing-types.ts`. |
| **i18n** | Витрина: **`pricing-postpaid-copy.ts`** (RU/AZ, subpath `@erafinance/i18n`). ERP/Settings: **`pricingPage.*`**, **`pricingModule.*`** (подписи по **`pricing_modules.key`**, fallback **`name`**), **`auth.viewPricing`** в **`resources.ts`**; каталог Super-Admin: **`npm run i18n:catalog`**. |

Таблица **§15.1** также содержит краткую строку для **`/public/pricing`** (канонический путь относительно префикса **`/api`** на балансировщике — **`/api/public/pricing`**).

#### 15.3.2. Landing modules (`GET /api/public/landing-modules`)

| Аспект | Реализация |
|--------|------------|
| **HTTP** | **`GET /api/public/landing-modules`** — `PublicLandingController` (`apps/api/src/admin/public-landing.controller.ts`), **`@Public()`**, **`@SkipThrottle()`**. |
| **Данные** | Prisma **`LandingModuleMarketing`** (`landing_module_marketing`): `moduleSlug`, `sortOrder`, `names`, `descriptions`, `tasks` (JSON AZ/RU). Сид/upsert — `seedLandingModuleMarketing` из `packages/database/prisma/lib/config/landing-modules.ts`. |
| **Admin** | **`GET /api/admin/landing-modules`**, **`PATCH /api/admin/landing-modules/:moduleSlug`** — Super-Admin + `AuditMutationInterceptor` на PATCH; DTO `PatchLandingModuleMarketingDto`. |
| **Веб `/`** | `apps/web/app/page.tsx` (RSC) → **`LandingPageView`** (client): locale cookie `erafinance_i18n_lang` → **`az`**; маркетинговый copy — **`packages/i18n/src/landing-copy.ts`** (`getLandingMarketingCopy`). API **`landing-modules`** — для редактируемых карточек экосистемы (server fetch / fallback `apps/web/lib/config/landing-modules.ts` при необходимости). UX-полировка — **§15.3.3**. |
| **Маршруты web** | **`/`** — лендинг; **`/home`** — дашборд; **`middleware.ts`**: `/` и `/home` public; с токеном **`/`** → redirect **`/home`**; `layout.tsx` — `/` в `barePublicLayout`. |

**Prisma:** модель `LandingModuleMarketing`; миграция `20260522120000_landing_module_marketing` (идемпотентный SQL).

#### 15.3.3. Маркетинговый UX: лендинг и витрина `/pricing` (v2026.05)

**Статус:** [x] **COMPLETED (web scope)**. Продуктовые таблицы — [PRD.md](./PRD.md) **§7.6.5**; биллинг Phase 16 (API, cron, shield) — **§24**.

**Общий layout:** `LandingPageShell` / `PricingPageShell` — `bg-[#EBEDF0]`; hover — `apps/web/lib/landing-motion.ts` (`PRICING_CARD_HOVER_CLASS`).

##### Лендинг (`apps/web/components/landing/`)

| Компонент | Назначение |
|-----------|------------|
| `landing-page-view.tsx` | Сборка секций, locale toggle |
| `landing-hero.tsx` | `<h1>`, усиленный subtitle, CTA + `ctaMicrocopy` |
| `landing-ecosystem-grid.tsx` | Модули: `<h2>` + карточки `<h3>` |
| `landing-legacy-compare.tsx` | Head-to-Head vs 1C: шапка брендов, 8 строк (вкл. ƏMAS), `text-slate-300` / ❌ |
| `landing-zero-knowledge.tsx` | Список `claims[]` (3 тезиса) |
| `landing-bottom-cta.tsx` | CTA + контрастная кнопка входа `bg-slate-900` |

**Copy:** `packages/i18n/src/landing-copy.ts` — типы `LandingMarketingCopy`, экспорт `getLandingMarketingCopy(locale)`.

##### Витрина тарифов (`apps/web/components/pricing/`)

| Компонент | Назначение |
|-----------|------------|
| `pricing-page-view.tsx` | Header, login `bg-white border-slate-300`, compose sections |
| `pricing-core-suite-banner.tsx` | `<h1>`, ERA Core **0 AZN** × 3 мес., bullets MMUS/FIFO/HR/203 |
| `pricing-resource-matrix.tsx` | **5-column** matrix (`grid-cols-5`): metric + **Tier 0–3**; rows users/invoices/**storage**/WhatsApp/OCR; CTA → `/register-org?tier=TIER_*` |
| `pricing-premium-panel.tsx` | Grid + **frosted lock** overlay, visible **+29/+49/+59 AZN**, CTA Tier 1+ |
| `pricing-module-catalog-section.tsx` | Сетка **`pricingModules`** с **`pricePerMonth`** (à la carte); RU/AZ через `pricingModule.*` |

**Copy:** `packages/i18n/src/pricing-postpaid-copy.ts` — `catalogModulesTitle`, `matrixTiers[]`, `premiumLockedTitle`.

**Glass / hover:** `PRICING_GLASS_CARD_CLASS`, `PRICING_CARD_HOVER_CLASS` in `apps/web/lib/landing-motion.ts`.

**Снято с витрины:** компонент **`pricing-trust-ladder.tsx`** (три вертикальные «коробки» + баннеры «Əməliyyat nüvəsi» / «Trial Shield»).

##### Трекинг задач (синхрон с PRD §7.6.5)

| ID | Задача | Статус |
|----|--------|--------|
| L1–L8 | Лендинг: SEO, Hero, CTA 3 мес., Arena 1C, ZK, login contrast | [x] COMPLETED |
| P1–P6 | Pricing: light theme, без баннеров-заглушек, ERA Core, premium grid, hover | [x] COMPLETED |
| P7–P10 | **5-col matrix**, Tier 0, storage row, checkout CTA, premium frosted lock | [x] COMPLETED |

---

## 16. Платформа (v5.6): изоляция тенантов и асинхронность

### Prisma Extension (Strict Multi-tenancy)

- **`PrismaService`** строится с **`$extends`**: перехват операций `find*`, `update*`, `delete*`, `create*`, `count`, `aggregate` (по моделям с полем `organizationId`) для **принудительного** слияния условия `organizationId` с контекстом текущего запроса.
- **Сырой SQL:** см. **§2** — `TenantPrismaRawService` + `executePlatformRawUnsafe` для не-тенантного DDL.
- **Контекст:** `AsyncLocalStorage` (или эквивалент), заполняется HTTP-interceptor’ом из JWT (`organizationId`); для маршрутов **`/api/admin`** при `isSuperAdmin` — режим без фильтра по тенанту (только для платформенных эндпоинтов).
- **Исключения:** модели без тенанта (`User`, `Organization`, `SystemConfig`, `TranslationOverride` и т.д.) не подмешивают `organizationId`.
- **Audit Hub (§9.A):** таблица **`audit_samples`**, записи **`EntityComment`** с **`kind = AUDIT_NOTE`**, а также все выборки в **`/api/audit-hub/*`** — в рамках **`organizationId`**, переданного в запросе: обычно из JWT активной org, либо **подменённого** контекстом **guest engagement** (см. §9.A); сырой SQL — с явным предикатом по этому **`organizationId`**.
- **Воркеры BullMQ:** в начале обработки job выставляют тот же контекст (`organizationId` из payload) либо `skipTenantFilter` для глобальных задач (например архив аудита).

### Async Processing (BullMQ)

- Операции с **настраиваемым порогом** по числу затронутых сущностей (например тяжёлые импорты) выполняются **асинхронно** через BullMQ: API возвращает **`jobId`**, клиент опрашивает статус / отображает прогресс (конкретные пороги — в коде соответствующих сервисов).
- **Зарплата:** очередь **`payroll-heavy`**; порог **`PAYROLL_ENTITY_ASYNC_THRESHOLD`** (см. **§7** — при **0** черновик и проведение ставятся в очередь при ненулевом числе сотрудников / листов). Статус: **`GET /api/hr/payroll/jobs/:jobId`**.

### Квоты и продукт

- Лимиты по тиру (**`TierQuotas`**: сотрудники, инвойсы в месяц, хранилище) и глобальные настройки (OCR/мес., unit pricing) редактируются в **Super-Admin → `/super-admin/billing/quotas`**; отдельного лимита «число организаций на пользователя» **нет** (удалён как продуктово избыточный).

### 16.1. Soft Delete (архивация сущностей)

**Цель:** не разрушать целостность при удалении; соответствие PRD §12.

| Модель (этап внедрения) | Поведение |
|-------------------------|-----------|
| **`Organization`**, **`Holding`** (в коде v1; **`Transaction`** — целевое расширение с фильтрацией в отчётах / журнале) | Вместо физического `delete`: установить **`isDeleted: true`**, **`deletedAt = now()`** (или только `deletedAt`). |
| **Чтение** | Расширение Prisma **`$extends`**: для **Organization** / **Holding** — `findMany` / `findFirst` / агрегаты с фильтром **`isDeleted: false`**; `delete` перенаправляется в **`update`**. |

**Миграции:** добавление колонок и бэкфилл `false`/`null` — отдельной миграцией; до внедрения **hard delete** на критичных таблицах запрещён политикой код-ревью.

### 16.2. SaaS Hardening v1 (Batch 1): RBAC + Ledger Period Lock

- **RBAC policy enforcement (M1):** ключевые мутирующие маршруты финансов и настроек закреплены role-политиками; policy-тесты проверяют отказ (`403 Forbidden`) для роли `USER` на создании проводок и изменении настроек/Period Lock.
- **Hidden routes hardening:** интеграционный health-контур остаётся `owner-only` (`/api/integrations/health`), платформенный `/api/admin/*` остаётся под `SuperAdminGuard`.
- **Period Lock (M2):** в `Organization.settings.ledger.lockedPeriodUntil` фиксируется дата блокировки; любые проводки с `entryDate <= lockedPeriodUntil` в `AccountingService` отклоняются ошибкой `423 Locked` (`Период закрыт для изменений`).
- **UI (M2, веб):** операционные поля **даты документа / проводки** — компонент **`DatePicker`**: дни **≤** `lockedPeriodUntil` отображаются как недоступные (серые), чтобы не расходиться с серверной проверкой; поле настройки самой даты lock **не** блокирует выбор по lock. Суммы/цены/количества — **`NumericAmountInput`**: отображение с разделителем тысяч (пробел), в API — plain numeric string без пробелов, выравнивание вправо (см. PRD §10.1).
- **Period Close Checklist (M2, v95+):** `GET /api/accounting/period-close/checklist?month=YYYY-MM` проверяет перед lock-date:
  1) отсутствие `Invoice.status = DRAFT` за месяц,
  2) отсутствие отрицательных остатков по складу (`stock_items.quantity < 0`) и денежным счетам (101*/221-224 по нетто обороту),
  3) факт начисления амортизации за месяц при наличии активных ОС (`fixed_assets.status = ACTIVE`).
  UI страницы настроек организации блокирует сохранение `lockedPeriodUntil`, если checklist не пройден.
- **Reports export bundle (M7, v95+):** добавлены выгрузки PDF/XLSX:
  - `GET /api/reporting/trial-balance/export?format=pdf|xlsx`
  - `GET /api/reporting/pl/export?format=pdf|xlsx`
  - `GET /api/reports/cash-flow/export?format=pdf|xlsx`
  с генерацией файлов через `exceljs` и серверный PDF-рендер (**PDFKit** + **DejaVu Sans** из `dejavu-fonts-ttf`, `apps/api/src/reporting/pdf-font.util.ts` — `registerUnicodeFonts`, без Helvetica/WinAnsi для Unicode).
- **Atomicity tests (M2):** double-entry posting подтверждён тестами на сценарий сбоя второй записи в рамках `Prisma.$transaction` (без допуска частичных односторонних проводок).

### 16.3. SaaS Hardening v1 (Batch 2): RBAC Auto-Scanner + Public Perimeter + CRM Degraded

- **RBAC mutation auto-scanner (M1):** reflection-based тест `rbac-scanner.spec.ts` обходит все контроллеры `apps/api/src/**/*.controller.ts`, проверяет наличие guard/role metadata на всех `POST|PUT|PATCH|DELETE` (с исключением `@Public`) и печатает coverage-таблицу в консоль CI.
- **Public Invoice perimeter (M4):** публичные маршруты `GET /api/public/invoices/:token` и `GET /api/public/invoices/:token/pdf` ограничены rate-limiting; дополнительно введена строгая валидация формата токена (`UUIDv4 + HMAC`) для отсечения угадываемых/слабых идентификаторов.
- **CRM fallback & degraded mode (M3):** при недоступности MDM-кэша VÖEN lookup переключается на внешний e-taxes API с последующим cache hydration; при ошибке интеграции создание контрагента не блокируется (manual create), а переход в degraded mode фиксируется в `AuditLog`.

### 16.4. SaaS Hardening v1 (Batch 3): Reporting Integrity + Inventory COGS + FX/VAT Rounding

- **Strict posting filtering for reports (M7):** отчётные выборки `Trial Balance`, `P&L` и cash-flow расчёты в `ReportingService` используют только проведённые проводки (`transaction.isFinal = true`), исключая draft leakage.
- **Golden coverage for Trial Balance:** добавлены эталонные тесты на смешанный набор draft/posted, подтверждающие, что контрольная сходимость `Дт = Кт` считается только по posted-проводкам.
- **Inventory hardening (M9):** операции `Sales`, `Release` и `Transfer` используют жёсткий запрет отрицательных остатков (negative inventory guard), независимо от пользовательских fallback-настроек.
- **COGS FIFO regression tests:** добавлены интеграционные/сервисные тесты цепочки `закупки разными слоями -> частичная реализация`, с проверкой корректной суммы COGS и проводок `Дт 701 — Кт 201`.
- **Multi-currency VAT rounding handler (M4):** регрессионные тесты фиксируют VAT-математику по мультивалютным счетам и обработку копеечных расхождений через счета курсовых разниц (`662/562`) в Ledger.

### 16.5. Reporting Optimization (M7 Heavy Load)

- Для ускорения тяжелых выборок добавлены композитные индексы:
  - `transactions(organization_id, is_final, date)` — фильтрация периода и posted-only.
  - `journal_entries(organization_id, ledger_type, transaction_id)` — быстрый отбор по org+book+периоду.
  - `journal_entries(account_id)` — ускорение точечных агрегатов по счетам (эквивалент индексирования journal lines).
- В `ReportingService.trialBalance` внедрен snapshot-first расчет:
  - используется снимок из `account_balances` на конец последнего закрытого месяца `< dateFrom`;
  - к снимку добавляются только обороты открытого периода;
  - при отсутствии снимка по счету включается fallback-агрегация.
- При `closePeriod` автоматически материализуется снимок сальдо на конец закрытого месяца в `account_balances` (по `accountId + ledgerType`).
- **Cross-validation (M2/M7 QA):** в отчётном контуре включена автоматическая сверка `P&L.netProfit` c proxy-значением из `TrialBalance` за тот же период; результат возвращается как `crossValidation.ok/delta` для раннего обнаружения расхождений.
- **Performance budget:** trial balance и P&L профилированы на массивах **10,000+** движений/строк; в ответах фиксируются метаданные производительности (`elapsedMs`, `rowsProcessed/accountRows`) для SRE-мониторинга.

### 16.6. DevOps & Monitoring Hardening

- **Automated DB Backups:** скрипт `scripts/db-backup.sh` выполняет `pg_dump` с gzip-архивацией и ротацией (удаление бэкапов старше 7 дней, configurable `RETENTION_DAYS`).
- **DR Runbook:** документ `docs/deploy/DR_RUNBOOK.md` фиксирует пошаговое восстановление БД из `*.sql.gz`, валидацию и rollback-порядок.
- **Audit Daily Check:** `@Cron('0 2 * * *')` запускает `AuditService.verifyChain()`; при разрывах цепочки пишется `error` лог с compromised IDs.
- **External Critical Alerting (M8):** при `compromisedIds.length > 0` cron дополнительно отправляет критическое внешнее уведомление на `AUDIT_ALERT_WEBHOOK_URL` (Slack/Telegram-compatible webhook) с текстом:
  `"[CRITICAL] ERA Finance: Обнаружено нарушение целостности Audit Log. Возможна ручная манипуляция в БД. Скомпрометированные ID: ..."`  
  При отсутствии webhook-конфига событие обязательно остаётся в error-логе.
- **Banking Circuit Breaker:** в `BankingGatewayService` реализован fail-fast:
  - 3 подряд ошибки провайдера переводят circuit в `OPEN` на 5 минут;
  - в `OPEN` новые запросы отклоняются локально (`ServiceUnavailable`, code `BANK_CIRCUIT_OPEN`);
  - успешный вызов закрывает circuit и сбрасывает счетчик.
- **M5 SLA metrics:** в `BankingGatewayService` накапливаются `attempts/success/failed/successRatePct` по провайдерам для потока bank failover и автосверки.
- **Jest benchmark:** добавлен stress-тест на **100+** конкурентных запросов к банковским адаптерам с проверкой, что после порога ошибок circuit breaker шорт-схемит обращения (без повторных внешних вызовов).

---

## 17. Платформа (v5.7): консистентность данных и UX

### VÖEN Integrity Guard (Phase 3.2) — синхронно с PRD §3.2

- [x] **COMPLETED:** реализация в коде — `apps/api/src/auth/guards/voen-integrity.guard.ts`, утилита **`VoenValidator`** — `apps/api/src/common/utils/voen-validator.ts`; охват премиум-маршрутов: **`/api/customs/*`**, **`/api/ocr/*`**, **`/api/tax/*`**, **`/api/tax-reports/*`**, а также **`/api/reporting/vat-appendix-xlsx`**, **`/api/reporting/etaxes-vat-declaration`**, **`/api/reporting/tax-declarations*`** (включая submit/download/receipt).

### Validation Layer (Strict Sync с §2)

- Глобальный **`ValidationPipe`** в `main.ts`: **`whitelist: true`**, **`forbidNonWhitelisted: true`**, **`transform: true`**. Неизвестные поля в теле запроса **не отбрасываются молча** — клиент получает **400 Bad Request**; описанные в DTO поля проходят в `class-validator` / `class-transformer`.
- DTO (`*.dto.ts`): без **`any`**; идентификаторы — **`@IsUUID()`**; числа — **`@IsNumber()`** / **`@Min()`**; даты — **`@IsDateString()`** / ISO; перечисления — **`@IsIn()`** / **`@IsEnum()`**.

### Transaction Pattern (Finance / Inventory / HR)

- Операции, затрагивающие **более одной записи** или **проводки + доменные сущности**, оформляются как **`this.prisma.$transaction(async (tx) => { ... })`**, с передачей **`tx`** в **`AccountingService.postJournalInTransaction`** при необходимости.
- **Примеры:** проведение зарплаты (проводки + обновление `PayrollRun`); закупка/списание/корректировка склада; инвойсы (смена статуса с выручкой/COGS/оплатой) — в рамках существующего кода.
- **Early access:** `EarlyAccessSignup` — идемпотентный upsert по **`(moduleKey, organizationId)`** в одной транзакции с записью события **`SURVEY_SUBMIT`**; таблицы **`early_access_events`**, **`early_access_signups`**, **`early_access_threshold_alerts`** имеют **`organizationId`** (tenant extension на записях из JWT); агрегации для супер-админа — только через **`/api/admin/*`**.

### UI (web)

- Таблицы без строк: компонент **Empty State**; мутации с ошибкой **4xx/5xx** — **toast** (Sonner); кнопки подтверждения — **disabled** и состояние загрузки на время запроса.

### Локализация (i18n): источники правды, каталог API и деплой

| Артефакт | Назначение |
|-----------|------------|
| **`apps/web/lib/i18n/resources.ts`** | Канонические строки **RU/AZ** для бандла Next.js; вложенная структура (`translation.nav.home`, …). Любой новый ключ `t("…")` в **`apps/web/app`**, **`apps/web/components`** или **`apps/web/lib`** (см. `scripts/i18n-audit.ts`) должен быть добавлен сюда для **обеих** локалей. |
| **`apps/api/src/admin/i18n-default-catalog-data.json`** | Плоский снимок тех же строк (`nav.home`, …), **автогенерация** из `resources.ts` скриптом `apps/api/scripts/gen-i18n-defaults.ts`. Читает API при работе с **`TranslationOverride`** и в ответах, где нужны «дефолты» рядом с оверрайдами. **Не редактировать вручную** — только через регенерацию. |
| **`TranslationOverride` (БД)** | Патчи поверх бандла; выдача клиенту через **`GET /public/translations?locale=ru|az`** с последующим merge на фронте (`apply-db-overrides.ts`). Ошибки после деплоя чаще всего из-за «коротких» ключей, затирающих целые ветви, или пустых значений — см. фильтры в `apply-db-overrides.ts`. |

| **`apps/web/lib/i18n/ui-lang.ts`** | Единая нормализация UI-языка: **`uiLangRuAz`** (только явный `ru`, иначе **`az`**), **`intlLocaleRuAz`** (`ru-RU` / `az-AZ` для `Intl` / `toLocaleString`). Используется в страницах, `client-i18n.ts`, `apply-db-overrides.ts`, `account-display-name.ts` и т.д., чтобы не дублировать ветвления `startsWith("az") ? … : ru`. |

**Поведение клиента (кратко):** `i18n.init` — `supportedLngs: ["ru","az"]`, **`fallbackLng: "az"`** (`client-i18n.ts`). Загрузка оверрайдов — **`applyTranslationOverrides(i18n)`**: локаль запроса и целевой бандл берутся из **`i18n.language`** → `loc ∈ {ru, az}` через **`uiLangRuAz`**; после **`processTranslationOverridesFlat`** вызывается **`addResourceBundle(loc, "translation", nested, true, true)`** (глубокое слияние с **перезаписью** листьев, иначе правки из БД не видны на ключах, уже существующих в `resources.ts`). Ремап ключей ОПФ в плоской карте: **`counterparties.legalForm.<ENUM>`** → **`counterparties.legalForm_<ENUM>`**; оставшиеся «ядовитые» **`counterparties.legalForm.<x>`** (неизвестный суффикс) удаляются **`dropCounterpartyLegalFormPoisonDottedKeys`**, иначе при `flatOverridesToNested` ветка **`counterparties`** ломается. Подпись поля ОПФ в **`resources.ts`** — **`counterparties.legalFormField`** (не **`legalForm`**), чтобы не конфликтовать с ошибочной вложенностью из БД. Аудит таблицы в БД: **`packages/database/prisma/audit-translation-overrides.ts`** — тот же пайплайн **`processTranslationOverridesFlat`** и сопоставление строк по **`effectiveTranslationOverrideLookupKey`**, чтобы dry-run / `--fix` совпадали с рантаймом.

**Команды (корень монорепо):**

- **`npm run i18n:audit`** — обязателен в CI перед сборкой: сверка `t("…")` с `resources.ts` для **RU** и **AZ**.
- **`npm run i18n:catalog`** — пересборка `i18n-default-catalog-data.json` из `resources.ts`; выполнять **в том же PR**, что и правки переводов, и коммитить обновлённый JSON, иначе Super-Admin / сравнение дефолтов на сервере увидят устаревший снимок.
- **`npm run db:deploy`** — рекомендуемый шаг **после** `prisma migrate deploy` на проде: `migrate deploy` + **`db:sync-i18n:prune`** — полный upsert всех плоских ключей **ru/az** из `resources.ts` в **`translation_overrides`**, удаление строк с ключами, которых больше нет в `resources.ts`, инкремент **`i18n.cacheVersion`** (клиенты перезагрузят оверрайды). DDL миграции **не** содержат текстов переводов (см. миграцию `20260502180000_i18n_deploy_post_migrate_note`).
- **`npm run db:sync-i18n`** — только upsert + bump кэша (**без** удаления устаревших ключей; удобно для локальных экспериментов).
- **`npm run db:sync-i18n:prune`** — то же + удаление «лишних» **ru/az** строк в БД относительно текущего `resources.ts`.
- **`npm run db:audit-i18n-overrides -w @erafinance/database`** — dry-run по таблице **`translation_overrides`**: сравнение с **`processTranslationOverridesFlat`** (из корня: `npx dotenv-cli -e .env -- npm run db:audit-i18n-overrides -w @erafinance/database`). С **`--fix`** — удаление строк, которые клиент всё равно отбросит, + bump **`i18n.cacheVersion`**.

**Вне репозитория / не для прод:** произвольные файлы вида `_i18n-default-catalog-data.new.json` в корне **не** подключаются к Nest и **не** заменяют `i18n-default-catalog-data.json`; хранить их в git не следует — это источник путаницы и рассинхрона с п.2.

### i18n CI (v14.0)

- CI pipeline **обязан** включать шаг **`npm run i18n:audit`**, гарантирующий полноту ключей локализации для **RU** и **AZ** локалей. Сборка должна **завершаться ошибкой** при обнаружении пропущенных ключей. Скрипт сканирует **`apps/web/app`**, **`apps/web/components`** и **`apps/web/lib`** на предмет литеральных ключей в **`t("…")`** / **`Trans i18nKey="…"`** и сверяет с **`resources.ts`**. EN в виде отдельного языка UI не используется; трёхъязычные поля сущностей — вне этого аудита.
- Практика мержа: при изменении `resources.ts` в одном PR выполнять также **`npm run i18n:catalog`** и включать дифф **`i18n-default-catalog-data.json`** (см. выше).

---

## 18. Регламент регистрации (`OrganizationKind`) и история версий документа ТЗ

### 18.1. Обязательный выбор `kind` при регистрации организации

- Для регистрации новой организации обязательным шагом является выбор **ОПФ (`legalForm`)**; `OrganizationKind` определяется на сервере.
- Выбранный **`kind`** передаётся в онбординг и используется для фильтрации **`template_accounts`** / **`ChartOfAccountsEntry`** при создании tenant-данных организации в рамках одной транзакции.

### 18.2. Ограничение смены типа организации после начала учёта

- Смена **`organizations.kind`** должна быть **заблокирована** после появления первой финансовой транзакции организации (`transactions` / `journal_entries`), чтобы сохранять целостность Ledger и неизменность исторических проводок.
- До первой транзакции смена допускается только в рамках административного сценария и с повторной валидацией шаблона счетов.

### 18.3. История версий документа ТЗ

| Версия документа | Статус | Что зафиксировано |
|------------------|--------|-------------------|
| **2026.04.0 (Baseline)** | Старт синхронного ведения | Консолидированы технические изменения прошлых циклов: модули §1–§17, B2G/templateGroup, billing, Audit/Validation hardening, масштабирование и v3.2+ расширения. |
| **2026.04.1** | Архив | Унифицирован формат истории версий с PRD, очищены смешанные release-треки, закреплён регламент синхронного инкремента версий документов. |
| **2026.04.2** | Архив | Bridge Sprint P1/P2: owner-only `Billing`, глобальный `AuditorMutationGuard`, расширенный enum ролей (`PROCUREMENT`, `AUDITOR`, `WAREHOUSE_KEEPER`, `HR_OFFICER`), уточнение RBAC-изоляции в отчётности и инвентаризации. |
| **2026.04.3** | Архив | Consistency pass формулировок RBAC (`OWNER/ADMIN/ACCOUNTANT/USER`, `Post/Approve`) и добавлена детальная проектная рамка `Opening Balances Wizard` (API, RBAC, транзакционность, acceptance v1). |
| **2026.04.4** | Архив | Migration Wizard Priority #1 реализован: физическая синхронизация HR-схемы в БД, finance opening endpoint прошёл интеграционные и HTTP e2e тесты, добавлен inventory opening endpoint (`Дт 201/204 — Кт 000`). |
| **2026.04.5** | Архив | Завершение Backend API для Migration Wizard (Finance, HR, Inventory) + Optimistic Locking; формально зафиксирован ранний `validateBalance()` до DB write и интеграционное покрытие inventory endpoint, включая `409 Conflict`. |
| **2026.04.6** | Архив | Migration Wizard UX: добавлены динамические шаблоны (XLSX), подсказки формата и поддержка алиасов в HR-парсере. |
| **2026.04.7** | Архив | Ecosystem Integration: Banking Gateway, Pro-rata Upgrade logic, VÖEN auto-lookup. |
| **2026.04.8** | Архив | Billing Upgrade Preview, FIN validator, Background Bank Sync foundation. |
| **2026.04.9** | Архив | Birbank Direct Integration, OAuth2 Caching, FIN Validation, Pro-rata Upgrade UI. |
| **2026.04.10** | Архив | Birbank Corporate API v1 mapping refinement, detailed bank sync audit payload, Ecosystem Sprint completion. |
| **2026.04.11** | Архив | Holding Dashboard: consolidated balances, tax risk monitor, and manual bank sync trigger. |
| **2026.04.12** | Архив | Full Banking API Integration: Birbank, Pasha, ABB implemented. Global Banking Gateway finalized. |
| **2026.04.13** | Архив | Full Integration Suite Completed: 3 Banks + External IBAN Validation. System is Production Ready for Azerbaijan Market. |
| **2026.04.14** | Архив | Go-Live Hardening: Circuit Breaker, Idempotency, and Integration Health Dashboard. |
| **2026.04.15** | Архив | Payroll-to-Bank Gateway: Multi-account selector, ABB XML direct integration, Universal Export for other banks, and Template-based Tax Logic. |
| **2026.04.16** | Архив | SaaS Go-Live Hardening Priority 0: Secure Storage for Payroll, Tax Engine consolidation, Absence guard payload & tests. |
| **2026.04.17** | Архив | SaaS Hardening v1 (Batch 1): RBAC policy enforcement, Ledger Period Lock, and atomic transaction tests. |
| **2026.04.18** | Архив | SaaS Hardening v1 (Batch 2): RBAC auto-scanner, Public Invoice rate-limiting, and CRM fallback modes. |
| **2026.04.20** | Архив | SaaS Hardening v1 (Batch 3): Reporting draft leakage prevention, Inventory COGS/FIFO strict calculations, and VAT rounding math. |
| **2026.04.21** | Архив | Multi-GAAP Foundation: Parallel NAS/IFRS ledgers, automated mapping engine, and ledger-aware reporting. |
| **2026.04.22** | Архив | NAS Chart of Accounts: i18n support, Commercial/Small template profiles (`TemplateAccount` + `coaTemplate`), and manual account import (`/api/accounts/templates`, `import-from-template`, `/accounting/chart`). |
| **2026.04.23** | Архив | SaaS Hardening v1 (M8): Integration raw payload masking and PII protection. |
| **2026.04.24** | Архив | Finance Core Enhancement: Reconciliation Act generation and Counterparty ledger export. |
| **2026.04.25** | Архив | Inventory Core: Physical count adjustments, write-offs, and surplus financial postings — §10.1.1 (`InventoryAdjustment` / API `physical-adjustments` / UI `/inventory/physical`). |
| **2026.04.26** | Архив | HR/Payroll RBAC Hardening: Strict separation of HR duties, payroll financial isolation, and department-level timesheet visibility. |
| **2026.04.27** | Архив | Advanced AR/AP v2: Partial payments, tranche allocation engine, and Aging report. |
| **2026.04.28** | Архив | e-Taxes Export v2: Tax declaration generation, Elektron Bildiriş receipt attachment, and compliance status workflow. |
| **2026.04.29** | Архив | M6/M7 Integration: Payroll department-level cost allocation and P&L departmental filtering. |
| **2026.04.30** | Архив | M9 Completion: Dynamic FIFO/AVCO valuation toggle and Manufacturing Release workflow with automated ledger postings. |
| **2026.05.01** | Текущая | v2 Completion: Full IFRS parallel reporting views (Trial Balance, P&L) and global NAS/IFRS UI toggle. |
| **2026.05.02** | Текущая | Roadmap 95+ (M3/M4): Counterparty merge engine, strict VÖEN lookup, and UX for Netting payments. |
| **2026.05.03** | Текущая | Roadmap 95+ (M1/M6): Staffing limit hard-stop, Timesheet mass-approve, and Organization Invite lifecycle. |
| **2026.05.04** | Текущая | Roadmap 95+ (M2/M7/M8): Period close auto-checks, Reports PDF/XLSX export, and Audit hash chain verification. |
| **2026.05.05** | Текущая | Roadmap 95+ (M5): Direct Banking outbound payment drafts and end-to-end bank statement reconciliation. |
| **2026.05.06** | Текущая | Roadmap 95+ (M9): WMS-light bin locations and Manufacturing byproducts/defects handling. |
| **2026.05.07** | Текущая | Roadmap 95+ (Billing Pivot): Transitioned to Post-Paid model, zero-friction module activation, and 1st-of-month invoice generation. |
| **2026.05.08** | Текущая | Billing Refinement: Free first month logic, end-of-month pending deactivation, and 25th-day reminders. |
| **2026.05.09** | Текущая | Marketplace UX: Post-paid consent modals and pending deactivation state visualization. |
| **2026.05.10** | Текущая | Billing Enforcement: Soft block (Export ban) and Hard block (Read-only) with automated 6th-day cron. |
| **2026.05.11** | Текущая | Reporting Optimization: Composite indexes and closed-period financial snapshots for heavy reports. |
| **2026.05.12** | Текущая | DevOps & Monitoring: Automated pg_dump backups, DR Runbook, Audit cron, and Bank API Circuit Breaker. |
| **2026.05.13** | Текущая | **§14 / §15.2:** `SubscriptionTier` = единственные **тарифы квот**; `billing.price.*` опционально, вне продуктового UX для новых клиентов; согласование с PRD §7.1 / §7.12. |
| **2026.05.14** | Текущая | SRE & QA (Platform/M8): Automated payment reconciliation webhook (auto-resume to ACTIVE) and external alerting for audit chain breaches. |
| **2026.05.15** | Текущая | SRE & QA (M2/M5/M7): Banking failover stress-tests and 10k+ report performance optimization. |
| **2026.05.16** | Архив | QA & SRE (M1/M6): Invite security edge-cases and Hire-gate concurrency protection. |
| **2026.05.17** | Архив | QA & SRE (M3/M4/M9): CRM integrity checks and Manufacturing batch release stress-tests. |
| **2026.05.18** | Текущая | Final QA (Platform): Billing reconciliation and automated DR validation. Horizons v1/v2 reached 100%. |
| **2026.05.19** | Текущая | Web UI: зафиксирован `PageHeader`, сайдбар-only навигация (без горизонтальных межмодульных ссылок); добавлены §11.1, строка истории в PRD §14; перекрёстные ссылки на PRD §10.1 и DESIGN.md. |
| **2026.05.20** | Текущая | i18n: таблица источников правды и деплой в §17 (`resources.ts` → `i18n-default-catalog-data.json` → БД); команда **`npm run i18n:catalog`**; PRD §7.6.1; уточнён охват `i18n:audit`. |
| **2026.05.21** | Текущая | i18n: **`npm run db:deploy`**, **`db:sync-i18n:prune`**, prune в `sync-translation-overrides-from-resources.ts`, миграция `20260502180000_i18n_deploy_post_migrate_note`; `db:prod-init` / `db:dev-bootstrap` переведены на prune-синк. |
| **2026.05.22** | Текущая | **`v1.0.0-RC1` (Release Candidate 1)** — синхронизация ТЗ с этапом: **UI/UX** — модальные окна на реестрах, **`PageHeader`**, сайдбар-only layout (**§11.1**); **Склад** и **Производство** разведены по разделам/маршрутам; **закупки товаров vs услуг** (поля вида закупки, склад, проводки); **VÖEN** — строгая валидация ответа интеграции (**§13.2**), в CRM — **`legalForm`** (ОПФ) и **`isVatPayer`** (**§4**); перекрёстные ссылки на [PRD.md](./PRD.md) §4.3. |
| **2026.05.23** | Текущая | **i18n (web):** §17 — политика **RU/AZ** с дефолтом **`az`**, таблица **`ui-lang.ts`**, расширен охват **`i18n:audit`** на **`apps/web/lib`**, описаны merge оверрайдов (**`overwrite: true`**), **`processTranslationOverridesFlat`**, ремап ОПФ, аудит **`audit-translation-overrides.ts`**; строка «Локаль» в §1; синхронизация с PRD §7.6.1 / §12. |
| **2026.05.24** | Текущая | **i18n:** в §17 зафиксированы **`dropCounterpartyLegalFormPoisonDottedKeys`**, ключ **`counterparties.legalFormField`**; команда **`db:audit-i18n-overrides`** в списке; в [docs/deploy/deploy.ru.md](../docs/deploy/deploy.ru.md) добавлен §**7.4** (локальный **`db:deploy`** + dry-run аудита). |
| **2026.05.25** | Текущая | **Web / маршруты:** модуль **«План счетов» (Hesablar planı)** — **`/accounting/chart`**, **`/accounting/mapping`**, **`/accounting/ifrs-mapping`**; пункты вынесены из сайдбара «Администрирование» в отдельную секцию. Удалены канонические пути **`/settings/chart`**, **`/settings/mapping`**, **`/settings/finance/ifrs-mapping`** (постоянные **301** редиректы в **`next.config.ts`** приложения **`apps/web`**). |
| **2026.05.26** | Текущая | **§8.0 Integrations (ƏMAS):** отдельный адаптер + **BullMQ** для исходящих запросов и обработки ответов госсерверов; перекрёстная ссылка на [PRD.md](./PRD.md) §13. |
| **2026.05.27** | Текущая | **§13.2 DVX:** перекрёстная ссылка на гибридную архитектуру ГНС — [PRD.md](./PRD.md) §6.1.1; первый буллет про продуктовый контур vs техдетали реализации. |
| **2026.05.28** | Текущая | **§8.0 ƏMAS:** зафиксирована поэтапная стратегия (ссылка на [PRD.md](./PRD.md) §13.0); уточнено, что BullMQ/HTTP-адаптер — **фаза 3**; фазы 1–2 — отдельные компоненты до S2S. |
| **2026.05.29** | Текущая | **§14.5 Квоты:** roadmap-пункт **WhatsApp** — пакеты сообщений, ссылка на [PRD.md](./PRD.md) §6.8 / §7.12.3. |
| **2026.05.33** | Текущая | **Painted door / early access:** PRD §5.0.1; API и модель в §11 (REST) и §17 (транзакции + `early_access_*`); UI — секция сайдбара Industry Solutions, модалка воронки, вкладка Super-Admin «Отраслевые модули (waitlist)». |
| **2026.05.31** | Текущая | Отражена поэтапная стратегия интеграции с DVX (включая Chrome RPA) и зафиксирована архитектура единого браузерного расширения с проверкой подписки на уровне выбранной организации (Multi-tenant RPA Gating). |
| **2026.05.32** | Текущая | **NAS по виду организации:** единый **`OrganizationKind`** (`COMMERCIAL` / `BUDGET` / `NGO`), колонки **`organizations.kind`**, **`template_accounts.kind`**, **`chart_of_accounts_entries.kind`**; три JSON-каталога; онбординг и super-admin chart-template с **`kind`**; §18 и таблица API §0 обновлены. |
| **2026.06.04** | Текущая | **Profile / Billing providers / FA monthly:** добавлены §**2.2** (`/api/users/me`, `User.phone`, `User.locale = AZ \| RU`, смена пароля с `INVALID_CURRENT_PASSWORD`), §**14.8.2** (`Organization.drakarisClientId @unique`), §**14.8.14** (Drakaris/yığım — Basic Auth, REST `/api/integrations/drakaris/v1/...`, `DrakarisStatus` 200/401/402/404/405/406/407/408, идемпотентность по `transaction-id` → `PaymentOrder.idempotencyKey`, env `DRAKARIS_*`), §**12.5** (BullMQ-воркер `monthly-depreciation`, cron `0 1 1 * *`, env `FIXED_ASSETS_MONTHLY_DISABLED`); миграция `20260510140000_add_user_locale_phone_drakaris_org`. Ссылка из PRD §4.1 / §5.D / §7.12.4. |
| **2026.06.05** | Текущая | **§20.2 HS / AZ customs tariff curation:** платформенное версионирование `customs_tariff_rates` по `(hs_code, effective_from)`, dedupe на дату в `loadActiveRates`, парсер акта MD → `prisma/catalog/trade/customs-tariff-rates.json` (`parse-az-customs-act-md.mjs`), импорт JSON (`import-customs-tariff-from-json.ts`), шаблон CSV и маппинг кодов ЕИ в `prisma/catalog/trade/`; см. PRD §7.6.2. |
| **2026.06.06** | Текущая | **§14.5 / §14.8.2 / §14.8.7 / §15.2:** квоты без **`maxOrganizations`**; колонка **`whatsapp_outbound_messages_balance`**, **`GET /api/subscription/me`** → `quotas.whatsappOutbound`; перечень **`QuotaKind`**; вкладка Super-Admin **«Квоты»** (Foundation, глобальные лимиты, tier JSON с `null`); синхронизация с PRD §7.6 / §7.12. |
| **2026.06.10** | Текущая | **§15.1–15.2 / §16:** Super-Admin биллинг — UI **`/super-admin/billing/*`**; **`PATCH .../pricing-catalog`**, **`PATCH .../global-limits`** (`$transaction`); tier-имена в UI — литералы; Trial в модалке пакета; см. PRD §7.6. |
| **2026.06.13** | Текущая | **§0.0 / §15.3:** публичный read-only **`GET /api/public/pricing`** (`PublicPricingController`, `getPublicPricingSnapshot`), веб **`/pricing`** (middleware + root layout publicPath); CORS **`CORS_ORIGINS`** для внешнего лендинга; версия реестра **v25.1**; см. PRD §7.6.4. |
| **2026.06.14** | Текущая | **§11.1 / §15.2–15.3:** подписи **`pricing_modules`** в вебе — **`pricingModule.<key>`** + fallback на **`name`**; Foundation в UI — **ERA Core**; **Audit Hub** в корне сайдбара над «Администрирование»; **`/audit-invitations`** — inbox приглашений в Audit Engagement (см. PRD §4.8.1). |
| **2026.06.15** | Текущая | **§11.1:** сайдбар — секция **Audit** (`/audit-hub`, `/audit-invitations`); разграничение **`/settings/audit`** vs **`/admin/audit-log`**; **`/settings/organization`** — банки только через **`/settings/bank-accounts`**; см. PRD §4.8.1, §14. |
| **2026.06.19** | Текущая | **§23 Zero-Knowledge (PLANNED):** DEK/KEK envelope, `UserOrganizationKey`, Tier 1–3 recovery, ASAN/SİMA state escrow contract; Task **`FEAT-SEC-CRYPTO-001`**; PRD §15. |
| **2026.06.22** | Текущая | **Pricing v2 + TIER_0:** 5-col matrix, storage GB, checkout CTA, premium frosted pricing; Prisma enum/migration **`20260526120000_tariff_tier_0`**; **`PREMIUM_TIER0_LOCKED`** — **§15.3.3**, **§24.1–24.8**; PRD **§16.2**. |
| **2026.05.28** | Текущая | **Marketplace + dedup:** `organization_bundles` (**§14.8.3a**), `GET/POST /billing/marketplace|toggle-bundle|activate-premium`; month-start lines via **`BillingEntitlementService`**; web subscription + **`pricing-module-catalog-section`** — **§24.7**; PRD **§16.9**. |
| **2026.06.21** | Текущая | **Маркетинговый UX:** лендинг (SEO h1–h3, CTA 3 мес., Arena 1C + ƏMAS, ZK тезисы) и витрина **`/pricing`** (Light Tech Canvas, LEGO tier matrix, ERA Core, premium Lock) — **§15.3.3**, PRD **§7.6.5**; **§24.8** расширен. |
| **2026.06.18** | Текущая | **Лендинг / trial / маршруты:** **`GET /api/public/landing-modules`**, admin PATCH landing; веб **`/`** (RSC) и **`/home`** (дашборд); **`TRIAL_3_MONTHS`**, `computeTrialExpiresAtBaku`, исключение **`compliance_pro`** — **§14.3**, **§15.3.2**; Prisma `LandingModuleMarketing`, `PricingBundle.slug`; см. PRD §7.3, §7.6.4. |
| **2026.06.17** | Текущая | **Док-синхронизация ERM / roadmap:** PRD **§14.2** task IDs; TZ **§1.4** (локальность данных AZ/EU), **§10.2.0** (manufacturing BOM / WIP target vs release / overhead), **§21.2.1** (SLA Customs / Tax / Treasury), **§22.0**; реестр **§0.0** — **`/api/compliance/*`** (v25.2); **нумерация §1:** добавлен новый **§1.4** (локальность), прежние **§1.4–§1.6** сдвинуты на **§1.5–§1.7** (очереди/BullMQ — **§1.5**). |
| **2026.06.16** | Текущая | **§22 Risk & Compliance (ERM):** Prisma **`RiskAudit`** / таблица **`risk_audits`**, tenant API **`/api/compliance/*`** с **`@RequiresModule('compliance_pro')`**, **`ComplianceService`** и rule-based сканеры, очередь **`compliance-risk-scan`** (cron UTC, env **`COMPLIANCE_RISK_SCAN_DISABLED`**), веб **`/compliance`** и индикатор posture в шапке; миграция **`20260210120000_risk_audits_erm`**; см. [PRD.md](./PRD.md) §14–§14.1. |

### Принцип ведения истории (дальше)

- PRD и TZ используют общий формат версии: `YYYY.MM.patch`.
- Любой новый пакет изменений фиксируется в обоих документах с одинаковым `YYYY.MM` и повышением `patch`.
- История документа содержит только факт изменения спецификации; продуктовые release-метки (`v3`, `v14.3`, `v25.1`) указываются в тексте соответствующих разделов, а не как версия самого документа.

### 18.4. Интерфейс выбора плана NAS (Frontend)

- **Компонент:** `apps/web/app/register-org/page.tsx` (форма регистрации организации).
- **UI-элемент:** radio/cards с обязательным выбором **`kind`**.
- **Варианты:**
  - **`COMMERCIAL`** — коммерческий план (каталог `chart-of-accounts-commercial.json`; ERA: касса **`101`**, банк **`221.*`** и т.д.).
  - **`BUDGET`** — бюджетный план (NAS-GOV, `chart-of-accounts-budget.json`).
  - **`NGO`** — некоммерческие организации (`chart-of-accounts-ngo.json`).
- **Локализация:** ключи **`auth.organizationTypeCommercial` / `Budget` / `Nco`** и описания **`auth.organizationType*Desc`**; для списка компаний — **`companiesPage.organizationKind*`**; super-admin колонка **`superAdmin.chartColKind`**.

### 18.5. Атомарность и валидация (Backend)

- **API-контракты:** `POST /api/auth/register`, **`POST /api/auth/organizations`** и **`POST /api/organizations`** принимают опционально **`kind`** (`OrganizationKind`, по умолчанию **`COMMERCIAL`**).
- **Валидация входа:** невалидный **`kind`** → **`400 Bad Request`** до транзакции.
- **Транзакционная гарантия:** в одной **`prisma.$transaction`** создаются **`Organization`** (в т.ч. **`kind`**, **`settings.templateGroup`** для payroll), подписка/членство и **`provisionChartOfAccountsFromTemplate`** (копирование NAS + bootstrap Multi-GAAP).

Актуальная спецификация — **этот `TZ.md`**; при изменениях править только его.

### 19. Phase 11 — International Trade & AI-OCR

- Export flow: `Invoice.isInternational=true` marks export invoices, excludes DVX prefill, and renders Commercial Invoice PDF variant.
- OCR flow: new `/api/ocr/invoices/upload` + `/api/ocr/invoices/:id` with queue-worker processing and `OcrJob` lifecycle (`PENDING|RUNNING|DONE|ERROR`).
- Customs flow: `CustomsDeclaration` CRUD + attach endpoint creates cost-basis postings in one DB transaction (Dr `201`, Dr `241`, Cr `531`).

### 20. Phase 12 — Customs widget RPA & Excel fallback

- **Premium path (`trade_pro`):** browser extension connector `customs` on `e-customs.gov.az` / `*.customs.gov.az` (`apps/extension/src/connectors/customs/**`, entrypoint `customs.content.tsx`). User-triggered **BGD capture** posts to **`POST /api/customs/declarations/prefill-capture`** (Zod: `CustomsDeclarationPrefillCaptureSchema` in `@erafinance/api-contracts`). Gating: **`SubscriptionGuard` + `@RequiresModule(trade_pro)`** (slug `trade_pro` in `OrganizationSubscription.activeModules` / constructor). Idempotency: unique `(organizationId, bgdNumber)` — duplicate returns `{ deduplicated: true }` without second insert.
- **Sync logging:** `IntegrationSyncRun` with **`IntegrationPortal.CUSTOMS`**, flows `bgd-capture` (transport `RPA_WIDGET`) and `bgd-import` / `bgd-export` (transport `EXCEL_IMPORT`). Capture path wraps **insert + sync run start/complete** in one **`prisma.$transaction`** (same `TransactionClient` passed into `IntegrationSyncRunService.start/complete`).
- **Safety:** reuse **VÖEN cross-check** in `FloatingWidget` (ERP active org `taxId` vs portal-detected VÖEN) before calling capture; extension does **not** auto-submit portal forms.
- **Free path (no module gate):** **`GET /api/integrations/customs/declarations/export.xlsx`** (optional `?ids=`), **`POST /api/integrations/customs/declarations/import-excel`** (multipart), **`GET /api/integrations/customs/declarations/template.xlsx`** (blank `bgd-blank.xlsx` under `apps/api/src/integrations/templates/customs/`).
- **Pricing catalog:** `trade_pro` row in `pricing_modules` — idempotent **`npm run db:ensure-trade-pro-pricing`** (`packages/database/scripts/ensure-trade-pro-pricing.ts`).

### 20.1 Phase 12.1 — Full BGD capture (items + GATT pre-calc)

- `POST /api/customs/declarations/prefill-capture` now supports both legacy flat capture and full capture (`CustomsDeclarationFullPrefillCaptureSchema`) with sender/receiver, currency rate and line items.
- Extension customs flow keeps floating widget and additionally injects **"ERA Capture"** button into portal action bars (`apps/extension/src/connectors/customs/injection.ts`) via MutationObserver.
- `CustomsDeclaration` upgraded with `status` (`DRAFT|CAPTURED|ATTACHED|ARCHIVED`), sender/receiver fields and calc totals; line positions stored in new `customs_declaration_items`.
- New tariff table `customs_tariff_rates` + seed script `npm run db:seed-customs-tariffs` + super-admin API `/api/admin/customs-tariff-rates` (upsert + list + `POST …/deactivate` / `POST …/restore`, без hard DELETE).
- GATT pre-calc implemented server-side: longest-prefix HS match; duty/excise on statistical value; VAT on (value + duty + excise). Calculated values are persisted for portal-vs-ERP reconciliation.
- Draft engine auto-links/creates counterparties by VÖEN where provided and always stores new captures as `DRAFT`.
- Added `GET /api/customs/declarations/:id` to return declaration with items and mismatch percentages for web detail view `/customs/[id]`.
- Existing customs Excel import/export remains backward-compatible and imports new rows as `DRAFT`.

### 20.2 HS codes & AZ customs tariff reference data (platform)

**Scope:** глобальная таблица **`customs_tariff_rates`** (не tenant-scoped). Ставки подставляются в предрасчёт строк BGD на дату декларации (`CustomsTaxCalculatorService`), см. §20.1.

**Legal source & audit trail**

- Юридический первоисточник — приложения к актам КМ / таможенной политики AZ (публикация на **e-qanun.az** и др.). Конкретная редакция фиксируется в поле **`notes`** произвольным текстом (рекомендуемый шаблон: `act=<id или короткое имя>; effective=<YYYY-MM-DD>; url=<опционально>`). Поля **`effective_from`** / **`effective_to`** задают окно действия строки импорта.
- **`effective_from`** обязателен для каждой строки; идемпотентный upsert по **`(hs_code, effective_from)`** — см. миграцию **`20260510190000_customs_tariff_rates_versioning`**.

**Annex coverage**

- Национальная номенклатура HS для AZ содержит **97 групп (глав)** (не путать с устаревшей оговоркой «95» в обсуждениях). Конверт приложения в Markdown (`docs/tmp/az-customs-act.md` после нормализации таблиц) содержит **полную подпозиционную сетку** в четырёхколоночных таблицах + отдельный блок кодов ЕИ в начале файла.

**Нормализация `hs_code`**

- В БД хранится **только строка цифр** без пробелов и знаков препинания: из текста позиции берутся все цифры подряд (`0101 21 000 0` → `0101210000`). Допустимы префиксы переменной длины (глава `01` … полная позиция); алгоритм матчинга — **longest-prefix** по множеству префиксов.

**Выбор строки тарифа на дату**

1. `CustomsTariffRatesService.loadActiveRates(asOf)` выбирает строки с `effective_from <= asOf` и попадающие в окно `effective_to`, затем **`pickLatestTariffRatePerHsCode`** оставляет одну строку на каждый **`hs_code`** — с максимальной **`effective_from`** среди отфильтрованных.
2. `findBestMatchFromRows` выполняет longest-prefix по нормализованным цифрам HS товара; строка с кодом **`00`** — fallback по умолчанию; если её нет — дефолтные проценты из кода сервиса.

**Super-admin API**

- **`POST /api/admin/customs-tariff-rates`** — upsert по паре **`hsCode` + `effectiveFrom`** (тело: см. `UpsertCustomsTariffRateDto`). Новая дата для того же префикса создаёт **новую** версию строки, а не перезапись чужой редакции.

**Конвейер данных (репозиторий)**

| Артефакт | Назначение |
|----------|------------|
| `packages/database/prisma/catalog/trade/customs-tariff-import.template.csv` | Шаблон ручного / полуавтоматического CSV для импорта |
| `packages/database/prisma/catalog/trade/customs-law-uom-mapping.json` | Соответствие кодов ЕИ из приложения закона (`796`, `166`, …) кодам **`units_of_measure.code`** (`pcs`, `kg`, …) |
| `packages/database/scripts/parse-az-customs-act-md.mjs` | Парсинг нормализованного MD акта → JSON строк тарифа |
| `packages/database/scripts/import-customs-tariff-from-json.ts` | Батч-upsert JSON → `customs_tariff_rates` с валидацией |
| `packages/database/prisma/catalog/trade/customs-tariff-rates.json` | Канон таможенных ставок для trade-слоя сида; парсер MD по умолчанию перезаписывает этот файл |

**Парсер MD:** пропускает строки с ~~зачёркиванием~~, строки заголовков таблиц (`XİF MN`), строки без числового HS в первой колонке (иерархические заголовки). Колонка тарифа: для адвалорной ставки извлекается первое число процента; смешанные форматы («USD / ед.») получают **`dutyRatePercent: 0`** при сохранении сырого текста в **`notes`**.

## 21. Dispute & Recovery (платформа)

**[~] PARTIAL:** домен `apps/api/src/platform-recovery/` — step-up email-OTP (`X-StepUp-Token`), dual approval (`DualApprovalRequest`), `OwnershipDispute` + `OrganizationSecurityState`, freeze-guard по `SecurityMode`, логические snapshots (`OrganizationDataSnapshot`), rollback MVP (`TenantRollbackRecord`), ежедневная проверка цепочки `AuditLog` + `HARD_BLOCK_PLATFORM` при разрыве.

### 21.1. Процедура (краткая диаграмма состояний)

`EVIDENCE_REQUIRED → … → APPROVED → (dual approval + step-up) → EXECUTED` с обязательным **pre_transfer** snapshot и PDF-сертификатом в S3 (`evidence/…`, Object Lock по §storage).

### 21.2. SLA (ориентиры)

| Шаг | Ориентир |
|-----|----------|
| Открытие спора + уведомление incumbent | ≤ 1 рабочего дня (платформа) |
| Cooldown / review | по регламенту Super-Admin (конфиг) |
| Исполнение transfer после APPROVED | только при ≥2 approvers + валидный step-up |
| Snapshot (MVP metadata / full worker) | best-effort < 5 мин для среднего тенанта (полный COPY — R3) |

### 21.2.1. Целевые SLA по ключевым продуктовым модулям (операционные KPI)

Ориентиры для **SRE / Customer Success** и договорных приложений; измеряются на **production** за скользящее **30 дней** (p95, кроме оговоренных batch).

| Контур | Метрика | Цель (p95) | Примечание |
|--------|---------|------------|------------|
| **Customs / Trade Pro** (`trade_pro`, BGD capture + Excel) | Успешный **prefill-capture** без retry пользователя | **≤ 90 с** для типового BGD (≤ 40 строк) при зелёном circuit breaker интеграций | При деградации портала — fallback **Excel import** без нарушения целостности проводок (TZ §20). |
| **Tax / DVX** (`tax_pro`, RPA + файловый контур) | End-to-end **submit journal** (запись в журнал отправок) после «Send» в UI | **≤ 120 с** для одиночной декларации | Phase 3 S2S — пересмотр после контрактного SLA с провайдером. |
| **Treasury / Direct Banking** (sync statement + match) | Инкрементальная синхронизация выписки (типичный месяц, ≤ 500 строк) | **≤ 60 с** | Не включает ручную разметку пользователем; при **open** circuit breaker — ответ **503** вместо зависания (§1.7). |

### 21.3. Retention

Согласовано с **S3 Object Lock** (`invoices/pdf`, `evidence`, `attachments`, `snapshots`) — см. `apps/api/src/storage/storage.constants.ts` и PRD §7.13.

### 21.4. Публичный контр-claim

`GET /api/public/disputes/:id/meta?t=<JWT>` и `POST /api/public/disputes/:id/counter-claim` — JWT `typ=dispute_counter_claim`, без сессии пользователя.

### 21.5. DR drill

`npm run platform:dr-tenant-rollback` (скрипт-заглушка контракта) + `npm run platform:dr-validate` для smoke-проверки таблиц после восстановления.

### 21.6. Метрики и алерты

Счётчики событий (dispute opened, transfer executed, snapshot duration, rollback duration, audit gap) — интеграция с Prometheus/Sentry по мере внедрения SRE-контура; критичные разрывы цепочки аудита — webhook `AUDIT_ALERT_WEBHOOK_URL` + email super-admin.

---

## 22. Risk & Compliance (ERM) — архитектура и правила

### 22.0. Phase 14.1 и идентификаторы задач (синхрон с PRD)

Продуктовая фаза **Phase 14.1 — Risk & Compliance (ERM)** зафиксирована в **[PRD.md](./PRD.md) §14.1–§14.2** (платный модуль **`compliance_pro`**, ENTERPRISE по правилам полного пакета). Таблица **Task ID** в PRD — единый реестр для **`docs/modules-roadmap.html`** и **`docs/modules-roadmap-facts.html`**: **`MOD-ERM-001`**, **`MOD-ERM-002`**, **`FEAT-ERM-TAX-001`**, **`FEAT-ERM-VOEN-001`**, **`FEAT-ERM-FRAUD-001`**, **`FEAT-ERM-UX-001`** (все **[x] COMPLETED** в PRD); **`FEAT-ERM-AI-001`** — **[ ] PLANNED**; **`FEAT-SEC-CRYPTO-001`** — **[ ] PLANNED** (Phase 15 — **§23**).

**Назначение:** модуль **`compliance_pro`** даёт организации дашборд **рисков** и журнал **системных сигналов** (`RiskAudit`), формируемых **периодическими** rule-based сканерами (BullMQ). **Гейтинг:** все tenant API модуля и веб-дашборд только при активном **`compliance_pro`** или при **ENTERPRISE** (полный пакет модулей по правилам §14.2). **ENTERPRISE** получает `compliancePro: true` в снимке подписки.

### 22.1. Данные и транзакционность

- Таблица **`risk_audits`**: см. Prisma-модель **`RiskAudit`** — `organizationId`, `type` (**TAX** | **FRAUD** | **COMPLIANCE**), `severity`, `status` (**PENDING** | **MITIGATED** | **IGNORED**), `description`, `metadata` (JSON), **`dedupeKey`** (уникален в паре с `organizationId`).
- Любая **смена статуса** (минимизация / игнор) выполняется в **`prisma.$transaction`**: одно обновление строки; запись в **`AuditLog`** для самого HTTP-запроса идёт через **`AuditMutationInterceptor`** как для прочих мутаций.
- Идемпотентность сканеров: **upsert** по `(organizationId, dedupeKey)` внутри транзакции (create или update severity/description/metadata при повторном срабатывании).

### 22.2. REST (tenant, префикс `/api/compliance`)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/risk-audits` | Список сигналов (фильтры: `status`, `type`, пагинация `page`/`pageSize`) |
| GET | `/risk-summary` | Сводка для UI и индикатора в шапке: уровень **posture** (`green` / `yellow` / `red`), счётчики по **PENDING** |
| GET | `/vat-threshold-monitor` | Снимок YTD оборота AZN vs порог 200k, полоса/зона для виджета (см. §22.3) |
| PATCH | `/risk-audits/:id` | `status` = **MITIGATED** \| **IGNORED**, опционально `mitigationNote` |

Все маршруты за **`JwtAuthGuard`**, **`SubscriptionGuard`**, метаданными **`@RequiresModule('compliance_pro')`** (или константа `ModuleEntitlement.COMPLIANCE_PRO`).

### 22.3. Оборот и порог НДС (Tax Limit Monitor)

- **Календарный год Asia/Baku (UTC+4, без DST):** `year = getBakuCalendarYear(ref)`; границы UTC для instant-полей: **`start = Date.UTC(year, 0, 1) − 4h`**, **`end = Date.UTC(year + 1, 0, 1) − 4h − 1ms`**; для **`@db.Date`** (`CashOrder.date`, `BankStatementLine.valueDate` / `BankStatement.date`) — инклюзивно **1 янв … 31 дек** года Баку (`TaxLimitService.getBakuCalendarYearBoundsUtc` / `getBakuCalendarYearDateRange`).
- **Оборот YTD (cash method, не по `Invoice.status`):**
  1. **Связанные платежи:** сумма **`CashOrder.amount`** — **`kind = KMO`**, **`status = POSTED`**, **`currency = AZN`**, **`source_invoice_id` IS NOT NULL** (учитывает **PARTIALLY_PAID** и **PAID** через фактические оплаты); **плюс** сумма **`BankStatementLine.amount`** — **`type = INFLOW`**, **`is_matched = true`**, **`matched_invoice_id` IS NOT NULL**, дата строки в году Баку; **исключить** строки **`origin = INVOICE_PAYMENT_SYSTEM`** и **`BankStatement.channel = CASH`** (зеркало кассовой оплаты счёта — иначе двойной учёт с KMO).
  2. **Несвязанные поступления:** **`CashOrder` KMO** **`POSTED`**, AZN, **`source_invoice_id` IS NULL** и **`source_invoice_payment_id` IS NULL**; **плюс** **`BankStatementLine` INFLOW** с **`matched_invoice_id` IS NULL** (прямая выручка / несопоставленные приходы).
- **Итог:** `totalAzn = linkedPaymentsAzn + unlinkedPaymentsAzn`; в API снимка — поля **`linkedPaymentsAzn`**, **`unlinkedPaymentsAzn`** (алиасы **`invoiceTotalAzn`** / **`cashStandaloneAzn`** сохранены для совместимости UI).
- Константы в **`apps/api/src/compliance/compliance.constants.ts`**: **`VAT_REGISTRATION_THRESHOLD_AZN = 200_000`**, **`VAT_TURNOVER_WARN_AZN = 160_000`** (80%), **`VAT_TURNOVER_CRITICAL_AZN = 190_000`** (95%).
- **RiskAudit:** при превышении **160k** — **`MEDIUM`**, при превышении **190k** — **`HIGH`**, тип **TAX**, **`dedupeKey`:** `tax_vat_threshold_ytd_${year}`; upsert по паре `(organizationId, dedupeKey)` как в §22.1.
- **Уведомления и аудит:** при **создании** записи или **смене** `severity` (например MEDIUM→HIGH) — **`NotificationService.notifyFinanceUsers`** (OWNER/ACCOUNTANT) + **`AuditLog`** с `entityType = compliance.tax_limit_monitor`, `action = THRESHOLD_HIT`.
- **UI:** виджет **`TaxLimitWidget`** на **`/compliance`** (модуль **`compliance_pro`**): шкала **rounded-lg**, корпус **rounded-2xl**, подписи **`text-[13px]`**; цвет полосы: зелёный **<80%** порога, жёлтый **80–95%**, красный **>95%**. API: **`GET /api/compliance/vat-threshold-monitor`**.

### 22.4. VÖEN / контрагенты (сканер Compliance)

- Детектор **без внешнего API** в phase 1: неверная длина **VÖEN** (не 10 цифр при расшифровке слоя приложения или blind index пуст/невалиден там, где используется формат); контрагент **`deletedAt != null`**, но есть **живые** инвойсы/проводки после даты удаления; крупные суммы по контрагенту с **`isVatPayer = false`** (порог в константах). По каждому правилу — свой **`dedupeKey`** (например `voen_invalid_${counterpartyId}`).

### 22.5. Fraud-паттерны (сканер Fraud, rule-based)

- Окно анализа **72 часа**. Условие-пример: **≥ 3** записей **`AuditLog`** с **`entityType = HTTP_MUTATION`**, **`action = PATCH`**, путь содержит `/users/me`, один и тот же **`userId`**, и в том же окне есть **проведённый** **`CashOrder`** с **`kind = KXO`**, **`status = POSTED`**, **`amount ≥ FRAUD_CASH_WITHDRAWAL_THRESHOLD_AZN`** (константа, напр. 10 000).
- **`dedupeKey`:** `fraud_password_then_cash_${userId}_${bucket}` (bucket по дате UTC-дня) для ограничения частоты.
- Расширенные **ML/AI**-сканы не входят в phase 1.

### 22.6. BullMQ

- Очередь **`compliance-risk-scan`**, env **`COMPLIANCE_RISK_SCAN_DISABLED=1`** — не регистрировать repeat-задания и не стартовать worker.
- **`compliance_risk_daily`** (например **`0 2 * * *`** UTC): для организаций с **`compliance_pro`** — **`runScansForOrganization`** (VÖEN + fraud; **без** налогового порога).
- **`check-tax-limits`** (например **`0 3 * * *`** UTC): для всех организаций с **`billingStatus = ACTIVE`** и не удалённых — **`runTaxLimitScanForOrganization`** (расчёт оборота, upsert **RiskAudit**, уведомление при новом/эскалации).
- Обработчик: ошибка по одной организации не отменяет остальные.

### 22.7. Web

- UI по **[DESIGN.md](../DESIGN.md):** панели дашборда **`rounded-2xl`**, список оповещений компактно **`rounded-lg`**, детальный текст **`text-[13px]`**.
- Paywall и сообщения — i18n **RU/AZ** (`packages/i18n`).
- **Council Chamber:** **`/compliance/council/[verdictId]`** — три карточки Elder, итог RU/AZ, polling при **`QUEUED`/`RUNNING`**, кнопка «Смягчить» → **`PATCH /api/compliance/risk-audits/:id`** с **`suggestedAction`**.

### 22.8. Council of Elders (multi-agent)

**Модель:** `CouncilVerdict` (`council_verdicts`), статусы **`QUEUED` → `RUNNING` → `COMPLETED` | `FAILED`**, опциональная связь **`riskAuditId`**, **`dedupeKey`** уникален в паре с **`organizationId`** (NULL допускается для ручных запусков).

**Консенсус:** `finalSeverity = HIGH`, если **любой** Elder `score > 80`; иначе `MEDIUM`, если любой `> 60`; иначе `LOW`. **`finalScore`** — **max** из трёх оценок (аудируемо). При завершении можно обновить связанный **`RiskAudit`** (**PENDING**), не трогая **`MITIGATED`/`IGNORED`**.

**PII:** перед вызовом Gemini — `CouncilSnapshotBuilder` + `council-pii.util` (маски VÖEN, email, phone, имена; контрагенты — токены `CP_n`, организация — `ORG_A`). Сырой snapshot **не логировать**.

**Gemini:** 4 вызова на deliberation (3 Elder + Synthesizer); env **`GEMINI_API_KEY`**, **`GEMINI_COUNCIL_MODEL`** (default `gemini-2.0-flash`); **`COUNCIL_DELIBERATION_DISABLED=1`** — без worker/repeat jobs.

**Очередь `council-analysis`:** job `council_deliberate`, **`jobId`** `council:{organizationId}:{dedupeKey}` или `council:{organizationId}:manual:{verdictId}`. Repeat: **`council_weekly_scan`** `0 22 * * 0`, **`council_pre_tax_scan`** `0 22 15 * *` — только org с **`compliance_pro`**.

**Триггеры:** `TAX_LIMIT_HIT` (эскалация Tax Limit Monitor), `HIGH_VALUE_TRANSACTION` (Invoice **PAID** AZN или standalone **KMO** ≥ **`COUNCIL_LARGE_TRANSACTION_AZN`**, default 50000), `MANUAL` (квота **`COUNCIL_MONTHLY_MANUAL_QUOTA`**, default 5/календарный месяц UTC), `WEEKLY_CRON`, `PRE_TAX_CRON`; `VOEN_RISKY_COUNTERPARTY` — enum placeholder.

**REST** (гейтинг **`compliance_pro`**, JWT):

| Method | Path | Назначение |
|--------|------|------------|
| `POST` | `/api/compliance/council/deliberate` | Ручной запуск; body `{ riskAuditId? }` или `{ targetEntityType, targetEntityId? }` |
| `GET` | `/api/compliance/council/verdicts/:id` | Verdict для Chamber |
| `GET` | `/api/compliance/council/verdicts` | Список (`riskAuditId?`, pagination) |

**JSON (контракты Zod — `packages/api-contracts/src/council.ts`):**

`ElderVerdict`: `{ score: 0–100, stance: "clear"|"watch"|"high_risk", findings: string[], reasoning: string }`.

`elderVerdicts`: `{ tax, forensic, strategist }` каждый — `ElderVerdict` (+ опционально усечённый `rawThoughts` в metadata worker).

`CouncilSynthesizerOutput`: `{ summaryAz, summaryRu, suggestedAction }`.

`CouncilSnapshot` (user message Elder): анонимизированный JSON контекста (цель, суммы, даты, типы; без PII).

---

## 23. Zero-Knowledge Multi-tenant Encryption & State Identity Escrow (Phase 15)

### 23.0. Статус, Task ID и связь с PRD

| Поле | Значение |
|------|----------|
| **Статус** | [ ] **PLANNED (scope)** — спецификация для фаз реализации после текущего production scope |
| **Task ID** | **`FEAT-SEC-CRYPTO-001`** (реестр PRD §14.2, roadmap `docs/modules-roadmap*.html`) |
| **PRD** | **[PRD.md](./PRD.md) §15** — продуктовые цели, Tier 1–3 recovery, «дилемма бухгалтера» |
| **Связь** | ASAN İmza / SİMA для **подписи документов** — существующий контур (PRD §6.2, `MOD-V3-SIGN-001`); §23 добавляет **state-backed crypto escrow** для **восстановления OMRK**, не смешивая с PDF signing API |

**Инвариант платформы:** HTTP API и PostgreSQL **не** являются доверенной зоной для plaintext финансовых payload. Workers BullMQ **не** расшифровывают tenant ciphertext без явного **opt-in** server-side processing (вне scope Phase 15 — отчёты остаются client-decrypt или отдельный «compliance export» с ключом в сессии).

### 23.1. Криптографический профиль (нормативный)

| Примитив | Параметры |
|----------|-----------|
| **Симметричное шифрование данных** | **AES-256-GCM**; уникальный **96-bit nonce** на операцию encrypt; AAD = `{ organizationId, entityType, fieldName, schemaVersion }` (канонический JSON, UTF-8) |
| **Обёртка ключей (wrap)** | **AES-256-GCM**; KEK / OMRK / state-derived key как wrapping key |
| **KDF (KEK из пароля)** | Целевой: **Argon2id** (`m`, `t`, `p` в профиле `UserCryptoProfile`); минимальный fallback: **PBKDF2-HMAC-SHA256** ≥ 310_000 итераций (параметр версионируется) |
| **Seed** | **BIP-39** (английский wordlist, 128 bit entropy → 12 слов) → **BIP-39 seed** → HKDF → root → KEK (конкретная derivation зафиксируется в `apps/web/lib/crypto/derivation.ts` при реализации) |
| **OMRK** | 256-bit CSPRNG; формат отображения: grouped Base32 или QR для offline backup |
| **State escrow** | Асимметричная обёртка OMRK: **X25519** или **RSA-OAEP-3072** публичным ключом, выданным **state identity provider** (ASAN/SİMA); точный OID/alg — по контракту шлюза на момент интеграции |

**Запрещено на wire и в логах:** `dekPlaintext`, `kekPlaintext`, `omrkPlaintext`, `mnemonic`, `masterPassword`.

### 23.2. Модель данных (целевая Prisma, PLANNED)

| Модель / таблица | Назначение |
|-------------------|------------|
| **`OrganizationCryptoProfile`** | `organizationId` (PK/FK), `dekWrappedByOmrk` (bytes), `stateEscrowBlob` (bytes, nullable), `stateEscrowCertId`, `cryptoSchemaVersion`, `zkEnabledAt` |
| **`UserCryptoProfile`** | `userId` (PK/FK), `kdfAlgorithm`, `kdfSalt` (bytes), `kdfParams` (JSON), `wrapVersion` |
| **`UserOrganizationKey`** | **Уникальный** `(userId, organizationId)`; `wrappedDek` (bytes), `wrapNonce`, `wrapVersion`, `createdAt`, `rotatedAt` |
| **Ciphertext columns** | На чувствительных сущностях: `encryptedPayload` (bytes) + `payloadMeta` (JSON: nonce, version) **или** отдельная таблица `EncryptedFieldBlob` (`organizationId`, `entityType`, `entityId`, `fieldKey`, `ciphertext`, `nonce`) |

**Поля в scope ciphertext (v1 spec):** контрагенты (legal name, tax id blob), строки инвойсов (описания, суммы вне агрегатов — продуктовое уточнение), проводки/journal line memos, складские серийные/партийные атрибуты. **Не** шифровать в v1: UUID, `organizationId`, статусы enum, даты, foreign keys — для индексов и tenant filter.

**Миграция:** включение ZK — **opt-in** per organization; legacy plaintext → background re-encrypt job (клиент-driven).

### 23.3. Клиентский модуль (web)

**Расположение (план):** `apps/web/lib/crypto/` — `dek.ts`, `kek.ts`, `wrap.ts`, `session-vault.ts`, `bip39-recovery.ts`.

| Компонент | Ответственность |
|-----------|----------------|
| **`session-vault`** | In-memory (или `sessionStorage` только для **wrapped** DEK session handle, **не** KEK) хранение разблокированного DEK до timeout/lock |
| **`unlockFlow`** | Master password → KEK → fetch `UserOrganizationKey` → unwrap DEK |
| **`orgSwitch`** | При смене `organizationId` — сброс DEK в vault, загрузка другой строки `UserOrganizationKey` |
| **`api-crypto-interceptor`** | Fetch wrapper: encrypt outgoing JSON fields / decrypt incoming по `cryptoSchemaVersion` |

**Web Crypto API:** только `subtle.encrypt` / `decrypt` / `deriveKey`; запрет custom crypto в JS userland для AES.

### 23.4. Multi-tenant matrix (Accountant Dilemma) — алгоритм

```
User U has KEK = KDF(password_U, salt_U)
For each Organization O_i membership:
  Server stores UserOrganizationKey(U, O_i) = Wrap(DEK_O_i, KEK_U)
Active org context = O_k:
  DEK_k = Unwrap(UserOrganizationKey(U, O_k), KEK_U)
  API ciphertext decrypted only with DEK_k
```

**Инвариант:** `DEK_O_i ≠ DEK_O_j` для `i ≠ j`. Компрометация `wrappedDek` для `(U, O_i)` без KEK_U **бесполезна**.

**Invite flow (PLANNED):** член с активным `DEK_O` создаёт `Wrap(DEK_O, KEK_invitee)` на клиенте invitee после принятия invite — сервер сохраняет новую строку `UserOrganizationKey`.

### 23.5. Трёхуровневое восстановление (технические потоки)

#### Tier 1 — BIP-39 seed (user self-service)

| Шаг | Actor | Действие |
|-----|-------|----------|
| 1 | Client | `mnemonic` → `KEK_new = Derive(mnemonic)` |
| 2 | Client | Для каждой org membership: `wrappedDek' = Wrap(DEK, KEK_new)` |
| 3 | API | `PATCH /api/users/me/crypto/rewrap` — массив `{ organizationId, wrappedDek, wrapNonce, wrapVersion }` |
| 4 | API | `PATCH /api/users/me/crypto/password-kdf` — новый salt/params (пароль уже сменён в auth) |

**Сервер:** не принимает mnemonic; только новые wraps.

#### Tier 2 — Organization Master Recovery Key (Owner)

| Шаг | Actor | Действие |
|-----|-------|----------|
| 1 | Client (Owner) | Ввод **OMRK** offline |
| 2 | Client | `DEK = Unwrap(organization.dekWrappedByOmrk, OMRK)` |
| 3 | Client | `wrappedDek_accountant = Wrap(DEK, KEK_accountant)` → API сохраняет для target user |
| 4 | Audit | `TENANT_CRYPTO_OWNER_RECOVERY` |

#### Tier 3 — State Identity Escrow (ASAN İmza / SİMA)

| Шаг | Actor | Действие |
|-----|-------|----------|
| 1 | Client (Owner) | `POST /api/organizations/:id/crypto/state-recovery/init` → `challengeId`, redirect URL / deep link |
| 2 | State GW | Mobile push / ASAN İmza; пользователь подтверждает личность (**VÖEN** юрлица + **PIN** владельца) |
| 3 | API | `POST /api/integrations/state-identity/callback` — проверка подписи ответа (JWKS / gov cert pinning), `sub`, `voen`, `nonce` |
| 4 | API | Выдача **`stateEscrowBlob`** + одноразовый **`recoveryToken`** (TTL ≤ 5 min) **только** инициатору |
| 5 | Client | `OMRK = Unwrap(stateEscrowBlob, keyMaterial from state assertion)` — **только в браузере**; далее как Tier 2 |
| 6 | Audit | `TENANT_CRYPTO_STATE_RECOVERY` + `stateProvider`, `assertionId` (без PII в логах) |

**Контракт state gateway (абстракция):**

| Поле ответа | Проверка |
|-------------|----------|
| `voen` | Совпадает с `Organization.voen` |
| `personPinHash` / `fin` | Совпадает с Owner membership FIN (хранится как blind index / HMAC) |
| `signature` | Валидна по цепочке гос. CA |
| `exp`, `nonce` | Freshness ≤ 300 s, nonce single-use в Redis |

**Платформа не хранит** приватный ключ расшифровки escrow — только ciphertext blob, привязанный к org.

### 23.6. REST (PLANNED, префикс `/api`)

| Метод | Путь | Auth | Назначение |
|-------|------|------|------------|
| GET | `/users/me/crypto/profile` | JWT | KDF salt/params, `wrapVersion` |
| PUT | `/users/me/crypto/profile` | JWT + audit | Обновление KDF metadata (после смены пароля) |
| GET | `/users/me/crypto/organization-keys` | JWT | Список `{ organizationId, wrappedDek, wrapNonce, wrapVersion }` |
| PUT | `/users/me/crypto/organization-keys/:organizationId` | JWT + audit | Upsert wrap для одной org |
| POST | `/organizations/:id/crypto/enable` | OWNER + audit | Инициализация DEK, OMRK wrap, опционально state escrow setup |
| POST | `/organizations/:id/crypto/state-recovery/init` | OWNER | Старт Tier 3 |
| POST | `/integrations/state-identity/callback` | mTLS / signed webhook | Callback гос. шлюза |
| POST | `/organizations/:id/crypto/state-recovery/complete` | OWNER + one-time token | Финализация после client unwrap |

**Все мутации** — `AuditMutationInterceptor`. **Нет** endpoint «decrypt for support».

### 23.7. Threat model (кратко)

| Угроза | Митигация Phase 15 |
|--------|-------------------|
| Компрометация БД | Ciphertext + wrapped keys; нет DEK |
| Компрометация API | Нет ключей в памяти сервиса (по дизайну) |
| Компрометация аккаунта бухгалтера | Только wraps для org, где есть membership; KEK под паролем |
| Malicious super-admin | Нет master decrypt; Tier 3 только с state auth Owner |
| Loss password + seed | Tier 2 (Owner OMRK) |
| Loss OMRK | Tier 3 (ASAN/SİMA) |

**Non-goals:** защита от скомпрометированного **клиентского** устройства с активной unlock-сессией; защита от **coerced** Owner с действующим ASAN (социальная инженерия).

### 23.8. Hardening checklist (перед COMPLETED)

- [ ] SAST: grep CI на `dekPlaintext` / логирование buffer.
- [ ] Unit: wrap/unwrap round-trip, wrong KEK → GCM auth fail.
- [ ] Integration: два org, один user — decrypt isolation.
- [ ] State sandbox E2E для Tier 3.
- [ ] PRD §14.2: `FEAT-SEC-CRYPTO-001` → **[x] COMPLETED**.

---

## 24. Spend-tier metering + debt ceilings (Phase 16)

### 24.0. Статус

| Поле | Значение |
|------|----------|
| **Статус** | [~] **PARTIAL** — `BillingMeterService`, `accumulatedBalance`, intraday SOFT_BLOCK, month-start invoice, premium shield |
| **Task ID** | **`FEAT-BIL-POSTPAID-001`** |
| **PRD** | **[PRD.md](./PRD.md) §16** |

### 24.1. Prisma / runtime fields

| Поле | Назначение |
|------|------------|
| **`Organization.accumulatedBalance`** | Накопленный metered-расход за текущий Baku-месяц (AZN) |
| **`Organization.billingPeriodKey`** | `YYYY-MM` (Baku), синхрон с subscription |
| **`OrganizationSubscription.currentTier`** | Потолок расхода: TIER_0=0, TIER_1=10, TIER_2=50, TIER_3=200 AZN (defaults, Super-Admin) |
| **`OrganizationSubscription.isTrial`** | **3 календарных месяца** Baku; signup **`TIER_0`** |
| **`UsageMeterEvent`** | Аудит meter (actionType, unitCostAzn, balanceAfter) |
| **`BillingStatus.HARD_BLOCK`** | Неоплаченный долг |

**Config:** `billing.meter_unit_pricing_v1`, `billing.tier_spend_ceiling.TIER_*`.

### 24.2. `BillingMeterService`

- `recordUsage(orgId, kind, qty)` — цены из `getMeterUnitPricing()`, инкремент `accumulatedBalance`, событие `UsageMeterEvent`.
- При достижении потолка tier → **SOFT_BLOCK** + **402** `USAGE_CAP_EXCEEDED`.
- `assertBillingNotHardBlocked` → **402** `CREDIT_HARD_LOCK`.

### 24.3. Billing rhythm (Asia/Baku)

1. **Month-start:** `BillingMonthlyService` @ `0 0 1 * *` `{ timeZone: "Asia/Baku" }` — строки Foundation (если не trial), **Metered usage** (`accumulatedBalance`), premium; сброс balance при выставлении.
2. **Intraday:** потолок tier до конца месяца → SOFT_BLOCK; оплата `PaymentOrder.metadata.tierIntradyUnlock` → `BillingSettlementService` + **tier++** (только intraday).
3. **Settlement:** month-start pay → ACTIVE, reset counters, **без** auto tier++.

### 24.4. API (Super-Admin)

- `PATCH /api/admin/config/billing/meter-unit-pricing`
- `PATCH /api/admin/config/billing/tier-spend-ceilings`
- `GET /api/public/pricing` — `meterUnitPricing`, `tiers[].spendCeilingAzn`

### 24.5. Premium trial shield

Без изменений: `tax_pro`, `trade_pro`, `compliance_pro` вне trial; `POST /api/billing/activate-premium`.

### 24.6. Deprecations

- Hard cap matrix enforcement (`QUOTA_EXCEEDED` на maxEmployees и т.д.) — снято.
- **`maxWorkspaces`** — удалено.
- Legacy `quota.tier.*`, `billing.price.*` — display / compat only.

### 24.7. Marketplace modules + bundles (dedup)

| Компонент | Путь |
|-----------|------|
| Аллокатор | `apps/api/src/billing/billing-entitlement.util.ts` (`allocateBillableEntitlements`) |
| Сервис | `billing-entitlement.service.ts` — `getMarketplaceSnapshot`, `computeInvoiceModuleLines` |
| Toggle bundle | `billing-bundle-toggle.service.ts` → `organization_bundles` |
| Web (Owner) | `apps/web/app/settings/subscription/page.tsx` — пакеты, модули, premium modal |
| Web (public) | `pricing-module-catalog-section.tsx` — цены из `GET /api/public/pricing` |

**Правило:** один `moduleKey` — одна billing-строка в месяце; пакет + тот же модуль à la carte → только пакет.

---

*Конец документа.*
