# Запуск ERA Finance: чек-лист к live (объединённый)

**Роль:** Principal System Architect & CTO  
**Источники правды:** [PRD.md](../../PRD.md), [TZ.md](../../TZ.md).  
**Происхождение:** базовая версия + слияние с внешним чек-листом (Gemini 3.1 PRO).  
**Нумерация:** единая сквозная **1–173** (этапы A–F + миграции).  
**Статус:** отмечайте `[x]` по мере закрытия.

---

## Сопоставление с внешним списком (кратко)

| Тема внешнего списка | Номера шагов в этом файле |
|---------------------|---------------------------|
| Техническая зачистка (console, MFA, CORS, headers, guards, bulk, CI) | **26–33** |
| DevOps (PITR, S3, Redis, Nginx, SSL, Grafana, Cloudflare, SSH) | **34–65** |
| Контент / шаблоны / техдолг продукта | **66–97** |
| Биллинг / эквайринг / квоты / trial | **98–126** |
| Локализация / smoke / запуск | **127–172** |
| Миграции «с нуля» на пустой БД | **173** |
| Ошибочное имя `TenantTimeTravelService` | Заменено на **`RollbackService`** — шаг **91** |

---

## Исключено из финальной версии чек-листа (осознанно)

1. **«Заменить все `NotImplementedException` на текст „В разработке“»** — **не делаем.** См. контроль UI/фич в шагах **153–172** (этап F).
2. **«Удалить `*.spec.ts` из dist»** — не как отдельный шаг; см. **шаг 33** (CI + образ).
3. **`npm run audit:verify`** — корень делегирует в `apps/api/scripts/audit-verify.ts` (шаг **29**); на staging-копии задайте `AUDIT_VERIFY_STRICT=1`; полный список id — `AUDIT_VERIFY_VERBOSE=1`.
4. **`SecurityHeaderInterceptor` по имени** — см. **шаги 30, 54** (Helmet / Nginx).
5. **Wipe всех данных на проде** — см. **шаг 154** (staging / wipe-tenant).
6. **`BillingStatus.READ_ONLY`** — сверка с PRD; см. **шаг 116**.
7. **Фичи без кода** (Live Chat, Partner Program, промокоды) — **бэклог**; не в нумерации.

---

## Этап A — Foundations (шаги 1–33)

1. [x] Зафиксировать **целевую версию Node.js** и зафиксировать в CI/образах (см. [docs/deploy/PRE-RELEASE-CHECKLIST.md](../deploy/PRE-RELEASE-CHECKLIST.md)).
2. [x] Выровнять **Prisma** с планом апгрейда (там же) — или явно отложить с записью риска в релиз-нотах.
3. [x] Единый корневой **`.env`** по [`.cursor/rules/erafinance-local-dev.mdc`](../../.cursor/rules/erafinance-local-dev.mdc): `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `REDIS_URL`, `AUDIT_HASH_SECRET` (или осознанный fallback — см. `apps/api/src/audit/audit.service.ts`).
4. [x] Проверить **`apps/api/.env`** не перетирает критичные прод-секреты при деплое (`apps/api/src/load-env-paths.ts`).
5. [x] **`STEP_UP_HMAC_SECRET`** — `apps/api/src/platform-recovery/step-up/step-up-auth.service.ts`.
6. [x] **`INVOICE_PORTAL_TOKEN_SECRET`** (TZ §14.0.1).
7. [x] **`AUDIT_ALERT_WEBHOOK_URL`** — `apps/api/src/audit/audit-chain-cron.service.ts`.
8. [x] **`SMTP_*`** — prod, не только лог: `apps/api/src/mail/mail.service.ts`.
9. [x] **`S3_*`** / `STORAGE_DRIVER` — smoke префиксов: `apps/api/src/storage/s3-storage.service.ts`, `apps/api/src/storage/storage.constants.ts`.
10. [x] **`ensureBucketVersioningAndObjectLock`** — без бесконечных WARN; подтвердить конфиг бакета.
11. [x] **`npm run db:migrate`** на staging/prod — `packages/database/prisma/migrations/`.
12. [x] **`npm run db:deploy`** после релиза со строками UI (TZ §17).
13. [x] **`npm run db:generate -w @erafinance/database`** после миграций.
14. [x] **`npm run build`** — зелёный (включает `i18n:audit`).
15. [x] **ESLint `no-raw-tenant-mutation`:** `apps/api/.eslintrc.cjs`, `apps/api/eslint-rules/no-raw-tenant-mutation.js` — `npm run lint -w @erafinance/api`.
16. [x] Ручной аудит **`$queryRaw` / `$executeRaw`** в `apps/api/src` — предикат `organizationId` / whitelist.
17. [x] **Порядок `APP_GUARD`:** `apps/api/src/app.module.ts` (`ThrottlerGuard`, `JwtAuthGuard`, `DisputeFreezeGuard`, `SubscriptionReadOnlyGuard`, `BillingAccessGuard`, `AuditorMutationGuard`).
18. [x] Задокументировать порядок guards для on-call (ссылка на этот файл + TZ §2/§9).
19. [x] **Super-Admin:** только `isSuperAdmin` — `apps/api/src/auth/guards/super-admin.guard.ts`, `apps/web/app/super-admin/**`.
20. [x] **MFA / step-up Super-Admin:** текущий email-OTP + `X-StepUp-Token` (`apps/api/src/platform-recovery/step-up/*`); дорожная карта TOTP / обязательный step-up на все `admin/*` мутации.
21. [x] **JWT / refresh** — `apps/api/src/auth/strategies/jwt.strategy.ts`, `apps/api/src/auth/auth.service.ts`.
22. [x] **CORS / HTTPS** — `apps/api/src/main.ts`, reverse proxy — [docs/deploy/deploy.md](../deploy/deploy.md).
23. [x] **Rate limiting** — публичные маршруты (TZ §14.0.1): глобально `ThrottlerModule` + `ThrottlerGuard` в `apps/api/src/app.module.ts`, точечные `@Throttle` / `@SkipThrottle` на auth, webhooks, health, i18n public.
24. [x] **Sentry** — `apps/api/src/instrument.ts`, `app.module.ts`.
25. [x] **Тег релиза + changelog** — ссылка на этот файл в release PR.
26. [x] Убрать **отладочные `console.log` / `debugger`** из `apps/api` и `apps/web` на прод-путях (lint rule или pre-commit + поиск по репо).
27. [x] **`@RequiresModule` / `SubscriptionGuard`:** аудит контроллеров платных модулей — `apps/api/src/subscription/subscription.guard.ts`, декоратор `@RequiresModule`, контроллеры `integrations`, `customs`, `ocr`, `manufacturing` и т.д.
28. [x] **`PrismaSoftDeleteExtension`:** регрессия `delete` → `deletedAt` — `apps/api/src/prisma/prisma-soft-delete.extension.ts`, `apps/api/src/common/actor-context.ts`.
29. [x] **Hash-chain аудита на объёме:** прогон `AuditService.verifyOrganizationChain` / полный `verifyChain` на staging-копии с **1000+** логами (скрипт опционально добавить в `package.json` как `audit:verify`).
30. [x] **Security headers:** CSP / `X-Frame-Options` / HSTS на edge (Nginx) и/или Helmet в `apps/api/src/main.ts` (если принято архитектурно).
31. [x] **Индексы `Transaction` / `JournalEntry`** — см. TZ §16.6 / PRD отчётность; `packages/database/prisma/schema.prisma`, миграции при необходимости.
32. [x] **Bulk DTO:** лимиты размера массивов + `class-validator` — `apps/api/src/**/dto/bulk-*.dto.ts`, глобальный `ValidationPipe` в `apps/api/src/main.ts`.
33. [x] **CI:** тесты до merge в `main` + образ без dev-only файлов (тесты не «в dist», а отдельный job).

---

## Этап B — Infrastructure (шаги 34–65)

34. [x] **Docker / оркестрация** — [docs/deploy/README.md](../deploy/README.md).
35. [x] **Backups `pg_dump`** — TZ §16.6, `scripts/db-backup.sh` при наличии.
36. [x] **PITR / WAL** — задокументировать RPO/RTO: [docs/deploy/DR_RUNBOOK.md](../deploy/DR_RUNBOOK.md).
37. [x] **Restore drill** + `npm run platform:dr-validate` — `scripts/dr-drill-validate.ts`.
38. [x] **Redis** — persistence, maxmemory, разделение DB для BullMQ при необходимости.
39. [x] **BullMQ Payroll** — `apps/api/src/hr/payroll-heavy.queue.ts` + worker, failed/delayed alerts.
40. [x] **BullMQ Billing** — `apps/api/src/billing/billing-monthly.queue.ts`.
41. [x] **BullMQ Banking** — `apps/api/src/banking/bank-sync.queue.ts`, `bank-balances-sync.queue.ts`.
42. [x] **BullMQ OCR** — `apps/api/src/ocr/ocr.queue.ts`, retries/backoff.
43. [x] **BullMQ Audit archive** — `apps/api/src/audit/audit-archive.queue.ts` при включении.
44. [x] **Метрики очередей** — Prometheus / Bull Board / runbook «вручную через Redis».
45. [x] **Ротация логов**, без секретов в stdout.
46. [x] **Health checks** для LB.
47. [x] **Next.js prod** — `apps/web/next.config.ts`, `NEXT_PUBLIC_API_URL`.
48. [x] **Расширение** — [docs/deploy/EXTENSION_MVP_DEPLOY.md](../deploy/EXTENSION_MVP_DEPLOY.md).
49. [x] **Object Lock retention** — `storage.constants.ts` vs юридический срок.
50. [x] **Vault / CI secrets** — нет `.env` в образах.
51. [x] **Firewall** — DB/Redis не в публичную сеть.
52. [x] **Timezone smoke** — UTC в БД, AZ в UI (PRD §12).
53. [x] **Capacity planning** — vCPU/RAM Postgres+API+Web.
54. [x] **PITR + WAL в S3** (если self-hosted) — процедура в DR_RUNBOOK; managed RDS — использовать нативный PITR.
55. [x] **Versioning** для бакета (не только evidence/invoices — см. уже реализованные префиксы в `storage.constants.ts`).
56. [x] **Nginx** reverse proxy + gzip/brotli — [docs/nginx-maintenance.conf](../nginx-maintenance.conf), пример прода: [docs/nginx-erafinance-production.example.conf](../nginx-erafinance-production.example.conf).
57. [x] **Let's Encrypt** для публичных хостов API/Web.
58. [x] **Grafana + Prometheus** — RAM/CPU/API latency.
59. [x] **Sentry** на **web** (если ещё не подключён) — симметрично API.
60. [x] **Алерты в Telegram** при падении API/Postgres/Redis (дополнение к `AUDIT_ALERT_WEBHOOK_URL`).
61. [x] **ulimit / memory** для Node — документировать в runbook.
62. [x] **Cloudflare WAF** (опционально) — DDoS, bot fight.
63. [x] **Retention snapshot** 30 дней (или согласовать с `storage.constants.ts` / юристом) — lifecycle policy S3 + БД `OrganizationDataSnapshot.expiresAt`.
64. [x] **Изоляция воркеров** — отдельный процесс/контейнер для BullMQ workers, не shared с API при высокой нагрузке.
65. [x] **SSH** — ключи, allowlist IP, запрет password auth.

---

## Этап C — Content & Product (шаги 66–97)

Детали, заглушки и переменные окружения: **[docs/launch/STAGE_C_CONTENT.md](STAGE_C_CONTENT.md)**.

66. [x] **Seeds / bootstrap** — `packages/database/prisma/seed.ts` + `packages/database/scripts/**`; политика prod в STAGE_C.
67. [x] **Тестовые данные** — Demo-org только при `SEED_DEMO_ORG=1` (фиксированный UUID), см. STAGE_C.
68. [x] **ГТК `bgd-blank.xlsx`** — `apps/api/src/integrations/templates/customs/`.
69. [x] **ГНС `e-qaime-blank.xlsx`** — `apps/api/src/integrations/templates/dvx/`.
70. [x] **ƏMAS `e-muqavile-blank.xlsx`** — `apps/api/src/integrations/templates/emas/`.
71. [x] **`templates-assets.service.ts`** — выдача шаблонов.
72. [x] **OCR stubs** — `openai-ocr.provider.ts`, `gemini-ocr.provider.ts` (намеренно для конвейера; см. STAGE_C).
73. [x] **Stub PDF billing** — `billing-payment-orders.service.ts` (не фискальный PDF; см. STAGE_C / этап D).
74. [x] **Snapshots** — `snapshot.service.ts`: JSON-артефакт в object storage + метаданные; `snapshot.worker.ts` — async COPY в бэклоге (STAGE_C).
75. [ ] **`restoreToPointInTime`** — `rollback.service.ts` (R5.2): forward replay **не реализован** — см. STAGE_C.  
    > **Architect:** намеренно отложено — нужен устойчивый forward-replay по `AuditLog` в TEMP-схему поверх baseline snapshot; риск для прод-данных выше выгоды до R5.x и DR-репетиций. До внедрения — `restoreFromSnapshot` (MVP) и evidence ZIP.
76. [x] **SMS dispute** — провайдер +994 в бэклоге; email + in-app тексты AZ/RU/EN в `ownership-dispute-notification.copy.ts`.
77. [x] **Банки prod** — `apps/api/src/banking/**`, circuit breaker.
78. [x] **Payroll export** — `payroll-export.service.ts`.
79. [x] **Extension gating** — `apps/extension/**` + веб-мост / подписка (STAGE_C).
80. [x] **Справочники** — курсы ЦБ (`fx/cbar-*`), NAS в сиде / онбординге.
81. [x] **Демо-org политика** — флаг сида + отдельный UUID; soft-delete на tenant-моделях по TZ.
82. [x] **Manual / docs** — футер на auth + `/help`; URL через `NEXT_PUBLIC_ERAFINANCE_*` (см. `apps/web/.env.example`).
83. [x] **Dispute legal templates** — `apps/api/src/platform-recovery/dispute/legal-templates/*.md`.
84. [x] **`/dispute/[id]`** — `apps/web/app/dispute/[id]/page.tsx` + публичный путь в `middleware` / `layout`.
85. [x] **Super-admin security** — `apps/web/app/super-admin/organizations/[id]/security/page.tsx`.
86. [x] **i18n** — `packages/i18n/src/resources.ts`; `npm run i18n:audit` (RU+AZ).
87. [x] **AZ терминология** — единый каталог ключей в i18n; выверка с носителем — процесс в STAGE_C.
88. [x] **Terms of Service** — контент вне репо; ссылка `NEXT_PUBLIC_ERAFINANCE_TERMS_URL` в UI.
89. [x] **Privacy Policy** — контент вне репо; ссылка `NEXT_PUBLIC_ERAFINANCE_PRIVACY_URL` в UI.
90. [x] **Dispute Notice** — email-тело в copy-модуле; юридические шаблоны — `legal-templates/*.md`.
91. [x] **FAQ** — `/help` (ASAN İmza, первые шаги) + i18n `help.*`.
92. [ ] **Email-шаблоны** — SMTP есть; HTML-шаблоны регистрации/оплаты — бэклог (STAGE_C).  
    > **Architect:** plain-текст достаточен для MVP; HTML, бренд, локали — отдельный спринт. Не блокирует эквайринг и webhooks.
93. [ ] **Landing / RPA+OCR** — маркетинг вне монорепо (ссылки через env / STAGE_C).  
    > **Architect:** маркетинг и SEO — отдельный деплой/CDN; в монорепо — продукт и deeplink через `NEXT_PUBLIC_*`.
94. [x] **Видеоинструкция** — `NEXT_PUBLIC_ERAFINANCE_VIDEO_URL` в футере и `/help`.
95. [x] **Баннеры `RpaUpsellModal`** — `apps/web/components/rpa-upsell-modal.tsx` + i18n `bulk.upsell.*`.
96. [x] **Status page** — внешний URL `NEXT_PUBLIC_ERAFINANCE_STATUS_URL` + процесс обновления в STAGE_C.
97. [ ] **Справочник банков AZ** — централизованной таблицы нет; SWIFT/MFO в счетах организации/контрагента (бэклог сида — STAGE_C).  
    > **Architect:** автокомплит и справочник CBAR — отдельная модель + актуализация; пока — free-text SWIFT в `OrganizationBankAccount` и валидация формата.

---

## Этап D — Billing & Monetization (шаги 98–126)

Детали, ключи `SystemConfig`, квоты и бэклог: **[docs/launch/STAGE_D_BILLING.md](STAGE_D_BILLING.md)**.

98. [x] **`PricingModules`** — сид слоя `core` через `prisma/seed.ts` → `lib/core/pricing-module-seed.ts` + скрипты `packages/database/scripts/**`.
99. [x] **`SystemConfig`** — ключи цен/квот/юнит-тарифов: `apps/api/src/system-config/system-config.service.ts`.
100. [x] **`SubscriptionAccessService`** — `apps/api/src/subscription/subscription-access.service.ts` (модули, ENTERPRISE, customConfig).
101. [x] **`SubscriptionGuard` + `@RequiresModule`** — `subscription.guard.ts`, декоратор, контроллеры (banking, manufacturing, …).
102. [x] **`QuotaService` / `QuotaGuard`** — `apps/api/src/quota/**`.
103. [x] **HTTP 402** — `QuotaExceededException`, `BillingAccessGuard` (SOFT_BLOCK export); фронт `api-client.ts`, модалки.
104. [x] **`BillingAccessGuard`** — глобальный guard; платежные пути исключены; **OWNER-only** на `BillingController` через `@Roles(OWNER)`.
105. [x] **`SubscriptionReadOnlyGuard`** — после `expiresAt` мутации 403 (белый список auth/billing/public).
106. [x] **Post-paid crons** — `BillingMonthlyService`: выставление счёта, SOFT_BLOCK; 6-е число — HARD_BLOCK; напоминание 25-го.
107. [x] **`npm run platform:billing-reconcile`** — `scripts/billing-reconciliation.ts` (корневой `package.json`).
108. [x] **Webhooks** — `PaymentProviderService.handleWebhook` + `finalizePaidOrder` / `recordPaidOrderInvoice` (идемпотентность `paymentOrderId`, `updateMany` PENDING→PAID).
109. [ ] **Провайдеры** — staging E2E → prod keys (операционный чеклист деплоя, см. STAGE_D).  
    > **Architect:** код идемпотентности готов; «готово» = подписанный контракт + отдельные ключи/URL staging vs prod + один зафиксированный happy-path в runbook (сумма, webhook, `billingStatus`). Не смешивать mock-режим провайдера с prod.
110. [x] **`trade_pro`** — `@RequiresModule` на `customs`, `ocr`. **`recovery_pro`** — tenant-модуль в PRD для расширенного recovery; сейчас recovery API под **SuperAdmin** (см. STAGE_D).
111. [x] **BillingInvoice PDF** — `BillingPlatformService.buildSubscriptionInvoicePdfBuffer` (клиентский платформенный счёт); payment-order PDF остаётся подтверждением оплаты (не фискальный).
112. [ ] **BI / CSV** (опционально) — бэклог.  
    > **Architect:** не блокер Go-Live; при появлении отчётов — отдельный модуль экспорта с квотами и аудитом (TZ), не «сырой» SQL клиенту.
113. [ ] **НДС / AZN smoke** — регрессионные сценарии вручную / E2E (см. STAGE_D).  
    > **Architect:** автоматизировать позже; до релиза — чеклист из 3–5 сценариев (инвойс с НДС, exempt, округление AZN, проводка) в [STAGE_E_GO_LIVE.md](STAGE_E_GO_LIVE.md).
114. [ ] **Refund policy** — процесс поддержки вне кода (STAGE_D шаблон для саппорта).  
    > **Architect:** one-click refund (шаг 125) отсутствует — политика = ручной разбор + корректировка в биллинге/банке; зафиксировать SLA и ответственного до публичного маркетинга.
115. [ ] **Боевой эквайринг** — ключи PAŞA Bank / redirect URL в prod `.env` (STAGE_D).  
    > **Architect:** после переключения проверить `API_PUBLIC_URL` (webhook), `WEB_APP_PUBLIC_URL` (return), TLS и whitelist IP у банка; первую оплату провести под наблюдением (см. этап F, шаг 166).
116. [x] **Сверка статусов** — `BillingStatus` SOFT_BLOCK = ограничение экспорта (402); HARD_BLOCK = read-only мутации (402); «read-only по подписке» = `SUBSCRIPTION_READ_ONLY` (403) — задокументировано в STAGE_D.
117. [ ] **Промокоды** — бэклог (`PricingService`).  
    > **Architect:** не вводить «скрытые» скидки через ручные правки БД без аудита; до реализации — только Super-Admin патч подписки/цены по процессу.
118. [x] **Предупреждение до SOFT_BLOCK** — cron `0 10 25 * *` (`runBillingReminderCron`).
119. [x] **Квота OCR для `trade_pro`** — лимит заявок/месяц на организацию через `SystemConfig` + `QuotaService.assertOcrJobsPerMonth` (см. STAGE_D).
120. [ ] **WhatsApp пакеты** — roadmap PRD, не MVP.  
    > **Architect:** отдельный продуктовый и юридический контур (мессенджер как канал); не смешивать с PAŞA webhooks.
121. [x] **Self-billing invoice** — `SubscriptionInvoice` + строки + PDF endpoint; регрессия — unit-тесты webhooks / reconcile при изменениях.
122. [x] **Демо до конца месяца** — `auth.service.ts` при `register` и `createOrganizationForExistingUser` (`isTrial`, `expiresAt` = конец UTC-календарного месяца регистрации, `subscription-demo-period.util.ts`); на 1-е число только уведомление о старте платного периода, без счёта за бесплатный входной месяц.
123. [x] **ENTERPRISE** — полный доступ в `computeEntitlements` / `assertModuleAccess`.
124. [ ] **Recurring** — нативный рекуррент провайдера + подпись — roadmap (сейчас post-paid счёт + оплата).  
    > **Architect:** текущая модель — выставление счёта + оплата; рекуррент требует хранения mandate/token у провайдера и отдельного compliance-ревью.
125. [ ] **Refund one-click** — бэклог.  
    > **Architect:** связать с п. 114; API refund без банковского подтверждения — зона риска, не делать в спешке перед Go-Live.
126. [x] **Upgrade / pro-rata** — `PaymentProviderService.createModuleToggleOrder`, `BillingService.calculateUpgradePrice`, `billing-toggle.service.ts` (сверка при изменении TZ).

---

## Этап E — Localization & Launch (шаги 127–152)

Карта smoke, i18n и Go-Live: **[docs/launch/STAGE_E_GO_LIVE.md](STAGE_E_GO_LIVE.md)**.

127. [x] **`npm run i18n:audit`** — шлюз в корневом `npm run build` (`package.json`); см. [PRE-RELEASE-CHECKLIST.md](../deploy/PRE-RELEASE-CHECKLIST.md).
128. [x] **`npm run i18n:catalog`** → `apps/api/src/admin/i18n-default-catalog-data.json` — при любой смене `packages/i18n`; коммит JSON в том же PR.
129. [ ] **`db:sync-i18n` / deploy** — на **staging/prod** после релиза переводов (`npm run db:deploy` или `db:sync-i18n` по политике prune).
130. [ ] **`db:audit-i18n-overrides`** — перед прод-деплоем, если правили оверрайды в БД.
131. [x] **Ключи dispute/security** — `packages/i18n/src/resources.ts` (`disputePublic.*`, `superAdmin.security*` RU/AZ).
132. [x] **Fallback `az`** — `apps/web/lib/i18n/ui-lang.ts` (`ru` иначе `az`).
133. [x] **Smoke auth** — матрица в STAGE_E; минимум: PRE-RELEASE (логин, health).
134. [x] **Smoke core учёт** — матрица в STAGE_E; выполнение на staging зафиксировать в тикете релиза.
135. [x] **Smoke payroll** — по матрице STAGE_E, если включён `hr_full`.
136. [x] **Smoke banking** — по матрице STAGE_E, если включён `banking_pro`.
137. [ ] **Load test** (опционально) — k6/Locust; см. STAGE_E.  
    > **Architect:** не блокер первого Go-Live при низком трафике; обязателен перед публичным маркетингом или SLO.
138. [x] **Rollback релиза** — [docs/deploy/DR_RUNBOOK.md](../deploy/DR_RUNBOOK.md); откат приложения ≠ откат миграций без процедуры.
139. [ ] **On-call / алерты** — Grafana/Prometheus, Telegram webhooks (см. этап B).  
    > **Architect:** «готово» = ростер дежурных + маршрут эскалации + тестовый триггер алерта до Go-Live.
140. [x] **Post-deploy** — [docs/deploy/deploy.ru.md](../deploy/deploy.ru.md).
141. [ ] **48h KPI мониторинг** — ops после первого prod-трафика.
142. [x] **Юридические ссылки** — `NEXT_PUBLIC_ERAFINANCE_*` + `PublicLegalFooter` / `/help` (этап C).
143. [ ] **Freeze window** — календарное решение продукта; техника: только `migrate deploy`, без `db push` на прод.
144. [ ] **Go-Live sign-off** — вне репозитория (руководство + инженерия + поддержка).
145. [ ] **Zod / validation messages** — AZ/RU там, где текст уходит в UI.  
    > **Architect:** точечный аудит `class-validator` / Zod messages; не переводить внутренние коды ошибок, если клиент показывает i18n-ключ.
146. [ ] **PDF Ownership Transfer** — `transfer-certificate.service.ts`; брендинг можно итерировать после первого релиза.
147. [x] **SEO meta (приложение)** — `SeoHeadSync` в `apps/web/app/providers.tsx` (`seo.title` / `seo.description`). Landing — вне монорепо.
148. [x] **Фавикон** — `apps/web/app/icon.svg` (App Router). Логотипы в шапке — по DESIGN при необходимости отдельным PR.
149. [ ] **Адаптив** — ручной проход tablet на invoices / payroll / settings.
150. [ ] **Восстановление пароля** на prod SMTP.  
    > **Architect:** self-service forgot-password **в коде пока нет** — до реализации: поддержка вручную + документированный процесс сброса или отложенный публичный маркетинг.
151. [ ] **NAS / coa-templates** — сиды + Super-Admin chart; актуализация по продуктовому регламенту.
152. [ ] **Калибровка OCR prompt** — после реальных ключей провайдера и снятия stub; мониторить `ocr_jobs`.

---

## Этап F — Релизный марафон и операции (шаги 153–172)

Детали и smoke: **[docs/launch/STAGE_E_GO_LIVE.md](STAGE_E_GO_LIVE.md)** §Stage F.

153. [ ] **Публикация расширения** в Chrome Web Store — [EXTENSION_MVP_DEPLOY.md](../deploy/EXTENSION_MVP_DEPLOY.md).  
    > **Architect:** версия extension и ERP должны быть совместимы по `@erafinance/api-contracts` и CORS; rollout extension — отдельной волной от API.
154. [ ] **Smoke RPA / e-taxes** — staging + реальная org; сценарии из плана extension.  
    > **Architect:** закрывать только при зафиксированном видео/логе сценария: login → capture → submit → callback/status.
155. [ ] **Очистка staging** — `db:wipe-tenant` и т.д.; **никогда** произвольный wipe prod.  
    > **Architect:** разрешена только tenant-scoped очистка по runbook; запрет массового удаления без change-request.
156. [ ] **Первая «официальная» org на prod** — контролируемый сценарий; не смешивать с удалением данных клиентов.  
    > **Architect:** запускать в «белый список» с ручным наблюдением логов API/BullMQ/webhooks.
157. [ ] **Chrome/Edge версии** — матрица для extension (ручная или BrowserStack).  
    > **Architect:** минимум N-2 stable для Chrome/Edge и один smoke на чистом профиле браузера.
158. [ ] **`AuditChainCronService`** — первый успешный цикл на prod-mirror / prod по runbook аудита.  
    > **Architect:** шаг закрыт после 1 успешного отчёта + 0 CRITICAL alert по цепочке в течение 24 часов.
159. [ ] **PDF под нагрузкой** — k6; отдельно invoice PDF и billing PDF (разные воркеры).  
    > **Architect:** критерий — отсутствие деградации API p95 и ошибок воркеров при параллельной генерации.
160. [ ] **Pen-test / OWASP** — вне функционального QA; критические до публичного анонса.  
    > **Architect:** блокер маркетингового релиза при High/Critical без компенсационных мер.
161. [ ] **Assistant за пределами AZ** — только если заявлено: geo/VPN/compliance отдельным решением.  
    > **Architect:** не блокер локального Go-Live; закрывать только при экспортном scope в PRD.
162. [ ] **Страница партнёров** — маркетинг вне монорепо или статический маршрут позже.  
    > **Architect:** не блокер запуска ядра ERP.
163. [x] **Maintenance mode** — `MAINTENANCE_MODE` в `apps/web/middleware.ts` + [docs/nginx-maintenance.conf](../nginx-maintenance.conf); процесс comms — ops.
164. [ ] **Beta-приглашения** — продуктовый набор метрик.  
    > **Architect:** определить входной канал, размер выборки и метрики активации до рассылки.
165. [ ] **Мониторинг первой волны** — воронка, 5xx, webhooks биллинга.  
    > **Architect:** минимум 48h усиленного наблюдения с on-call эскалацией.
166. [ ] **Первая реальная оплата** — наблюдение PAŞA → webhook → `SubscriptionInvoice` / `billingStatus`.  
    > **Architect:** блокер финансового sign-off; закрывать только при подтверждённой end-to-end транзакции.
167. [ ] **Бэкап после первого дня** — off-site по DR_RUNBOOK.  
    > **Architect:** обязательная контрольная точка DR после первого боевого дня.
168. [ ] **НДС Exempt (`vatRate = -1`)** — регрессия при изменениях sales/invoices.  
    > **Architect:** grep `vatRate` / `VAT_EXEMPT` в API и web перед релизом, затронувшим налоговые поля.
169. [ ] **`DisputeFreezeGuard`** — интеграционный тест (бэклог CI); guard уже в `APP_GUARD`.  
    > **Architect:** не блокер текущего Go-Live при наличии unit/feature smoke, но обязателен до масштабирования recovery-модуля.
170. [ ] **Очистка `uploads/` / dev Redis** — только не-клиентские артефакты; не трогать prod storage с данными org.
171. [x] **Согласованность `@erafinance/api-contracts` и web** — workspace dependency `*` в `apps/web` и `apps/extension`; breaking changes — единый PR/мажор.
172. [ ] **GO LIVE** — формальное закрытие чек-листа (бизнес-решение).

---

## Миграции «с нуля» (шаг 173)

173. [ ] На **пустой** БД: `prisma migrate deploy` (**без** `migrate reset` на prod). Для локальной проверки — отдельный disposable Postgres.

---

## Критический путь (12 шагов) — привязка к номерам

| # крит. пути | Суть | Связанные шаги чек-листа |
|--------------|------|---------------------------|
| 1 | Prod БД + миграции | **11–13**, **173** |
| 2 | Секреты | **3–7**, **50** |
| 3 | Backup / restore / PITR | **35–37**, **54** |
| 4 | Redis + BullMQ | **38**, **39–43**, **44** |
| 5 | S3 versioning + Object Lock | **9–10**, **49**, **55** |
| 6 | SMTP и алерты | **8**, **7**, **60** |
| 7 | HTTPS + CORS | **22**, **56–57** |
| 8 | Расширение (если в релизе) | **48**, **153** |
| 9 | Реальные шаблоны ГТК/ГНС/ƏMAS | **68–70** |
| 10 | Эквайринг + webhooks + блокировки | **106–108**, **115** |
| 11 | Сборка + i18n gate | **14**, **127–128** |
| 12 | MFA / step-up Super-Admin | **20**, **5** |

---

*Объединение и сквозная нумерация: 2026-05-06.*
