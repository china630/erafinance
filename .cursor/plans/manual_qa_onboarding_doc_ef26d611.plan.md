---
name: Manual QA onboarding doc
overview: Добавить в корневой каталог `docs/` новый markdown-документ с пошаговыми ручными тест-сценариями в порядке онбординга новой компании, с опорой на PRD/TZ и карту модулей; связать с существующим мануалом бухгалтера, не заменяя его.
todos:
  - id: add-manual-qa-dir
    content: Create docs/manual-qa/README.md + MANUAL_E2E_ONBOARDING.md with template, TOC, PRD/TZ links
    status: completed
  - id: author-phases-1-12
    content: "Write test scenarios: preconditions through sales/purchases/inventory (onboarding order)"
    status: completed
  - id: author-phases-13-26
    content: "Write scenarios: treasury, HR, reporting, netting, period lock, audit, holding; role matrix"
    status: completed
  - id: verify-routes
    content: Spot-check web routes against apps/web/app (reconciliation, reporting paths) before finalizing
    status: completed
isProject: false
---

# Ручные E2E-сценарии (онбординг компании)

## Цель и отличие от существующих материалов

- **Цель:** один файл для **QA / приёмочного ручного прогона**: что открыть, что ввести, что проверить (ожидаемый результат, роль, предусловия).
- **Порядок:** строго **как новая компания входит в систему** — от регистрации и тенанта до операционной работы, отчётности и **закрытия периода** (PRD §4.2 — Period Close Checklist: черновики инвойсов, отрицательные остатки, амортизация ОС).
- **Не дублировать** подробный пользовательский мануал: [docs/manual-accountant/manual-buhgalter.md](docs/manual-accountant/manual-buhgalter.md) остаётся источником «как пользоваться»; новый документ — **тест-кейсы** со ссылками на PRD/TZ по разделам.

## Источники содержания (уже прочитаны)

- [PRD.md](PRD.md): §3.2 (join/VÖEN), §4.1 (IAM, invites, profile), §4.1.2–4.1.3 (migration / opening balances wizard), §4.2 (ledger, period close), §4.3–4.5 (CRM, sales/purchases, treasury), §4.6–4.7 (HR, reporting), §4.8–4.10 (audit, inventory, manufacturing), §4.11 (netting), §4.12 (холдинг).
- [TZ.md](TZ.md): §0.0 (ориентир по API), §2 (IAM), §6.0 (treasury/cash), §7 (HR/payroll), §10–11 (inventory/reconciliation при необходимости).
- [.cursor/rules/erafinance-module-map.mdc](.cursor/rules/erafinance-module-map.mdc): соответствие **модуль → типичные маршруты** `apps/web/app/...` для указания «где кликать».

## Предлагаемая структура файла

Разместить: **[docs/manual-qa/MANUAL_E2E_ONBOARDING.md](docs/manual-qa/MANUAL_E2E_ONBOARDING.md)** (новая папка `docs/manual-qa/`), опционально **[docs/manual-qa/README.md](docs/manual-qa/README.md)** — одна страница: назначение, ссылка на PRD/TZ, ссылка на мануал бухгалтера.

### Шаблон тест-кейса (единый по всему документу)

Для каждого сценария: **ID**, **Модуль (PRD §4.x)**, **Роли**, **Предусловия**, **Шаги**, **Ожидаемый результат**, **Негатив / регресс** (где уместно).

### Оглавление по фазам онбординга (порядок разделов)

1. **Предусловия стенда** — API+Web, тестовый пользователь, валюты/справочники платформы (без глубины super-admin, только «стенд готов»).
2. **Регистрация и создание организации** — `RegisterOrg`: ОПФ → `OrganizationKind`, VÖEN 10 цифр, антидубликат; smoke главной книги после провижна плана (PRD §4.1.1, §4.2).
3. **Альтернатива: join по VÖEN** — Access Request, уведомление владельцу, approve/reject (PRD §3.2).
4. **Профиль пользователя** — `/settings/profile`: имя, телефон +994, локаль AZ/RU, смена пароля, конфликт email (PRD §4.1).
5. **Организация: реквизиты и идентичность** — `/settings/organization`, логотип, банковские счета организации (PRD §4.5, модуль org/global-directory).
6. **Подписка и биллинг (Owner)** — `/settings/subscription`, `/billing` при необходимости; проверка gating по модулю (PRD §7, TZ §14 — кратко, без провайдерских секретов).
7. **Команда и доступ** — `/settings/team`: приглашение, accept, revoke; проверка ролей (Accountant, PROCUREMENT, WAREHOUSE_KEEPER, HR_*, AUDITOR) и ограничений (PRD §4.1, payroll access PRD §4.6).
8. **Миграция vs с нуля** — `/settings/migration`: ветка **Start from scratch** (минимальный smoke) и ветка **wizard**: шаблоны Finance/HR/Inventory, Preview, Post, повторный Post → конфликт/блокировка (PRD §4.1.3).
9. **План счетов и бухгалтерский контур** — `/accounting/chart`, импорт счёта из шаблона; `/accounting/mapping`, `/accounting/ifrs-mapping`; ручная операция (journal voucher) если есть в UI; переключение NAS/IFRS в отчётах (PRD §4.2, §4.2.1).
10. **Master data: контрагенты** — `/crm/counterparties`: создание, VÖEN lookup, редактирование, банковские счета контрагента, merge дубликатов (PRD §4.3).
11. **Master data: каталог** — `/catalog/products`: товар (SKU, склад) и услуга (без SKU в UI) (PRD §4.4).
12. **Продажи** — `/sales/invoices`: черновик → отправлен → оплата (касса/банк по продукту), PDF AZ/RU/EN, ссылка портала, `vatInclusive`, строки НДС; негатив: оплата при отрицательной кассе если воспроизводимо (PRD §4.4, §4.4.1).
13. **Закупки и склад** — `/purchases`: alış fakturası (товары/услуги/dual), индикатор прихода; `/inventory/receipts`: приход по основанию и вручную (PRD §4.4, §4.10).
14. **Склад: операции и контроль** — остатки `/inventory/balances`, перемещение, отгрузка с основанием продажи, сличительная ведомость `/inventory/audits`, физическая корректировка `/inventory/physical` (PRD §4.10, §4.10.0).
15. **Производство (при включённом модуле)** — `/manufacturing`: рецепт, выпуск, проверка движений и проводок (PRD §4.10A).
16. **Касса и банк** — `/banking/cash`, `/banking`: MKO/MXO сценарии из PRD §4.5 / §4.5.1; очередь исходящих платежей, синхронизация, внутренний перевод, конвертация, инкассация (PRD §4.5, TZ §6.0).
17. **HR и зарплата** — департаменты/должности/штат, найм с hire-gate, табель, отсутствия, расчёт ЗП, реестр до **PAID** и проводки по ЦФО (PRD §4.6).
18. **ОС, PSA, таможня** — короткие модули-сценарии с пометкой «если модуль в тарифе»: fixed-assets, `psa/projects`, `customs` (PRD §4.4.2 / модульная карта).
19. **Интеграции** — `/admin/integrations/health` (Owner): статусы, без секретов (PRD/TZ интеграции).
20. **Отчёты** — `/reporting`: ОСВ, P&L, баланс, ДДС; фильтр департамента; регламентированные `/reports`; налоговый экспорт `/reporting/tax-export` (workflow e-Taxes по PRD §4.7).
21. **Акт сверки и взаимозачёт** — `/sales/reconciliation` или `/reporting/reconciliation` (сверить с актуальным маршрутом в коде при написании — в PRD указаны оба варианта в разных абзацах), preview netting (PRD §4.11).
22. **Закрытие периода** — установка `lockedPeriodUntil`: намеренно оставить DRAFT-инвойс / отрицательный остаток / без амортизации ОС — ожидание **блокировки**; затем исправление и успешное закрытие (PRD §4.2).
23. **Пост-лок: редактирование и проведение** — попытка провести документ в закрытом месяце → отказ (PRD §4.5.2, §4.2).
24. **Аудит** — `/settings/audit`: просмотр цепочки; опционально `POST /api/audit/verify-chain` через DevTools/Swagger (PRD §4.8).
25. **Audit Hub (add-on)** — только если entitlement: guest invite, engagement headers, экспорт выборки (PRD §4.8.1, module map).
26. **Холдинг** — `/companies`, `/holding`: создание холдинга, привязка org, сводный P&L / cash (PRD §1.1, §4.12).

В конце документа: **матрица ролей × фазы** (краткая таблица), **ссылки** на PRD §4, TZ §2/§6/§7, [erafinance-module-map.mdc](.cursor/rules/erafinance-module-map.mdc).

## Технические замечания при реализации

- При фиксации URL сверять **актуальные** пути в `apps/web/app` (редиректы legacy → канон, как в PRD §4.4 для инвойсов).
- Явно помечать сценарии **PLANNED** из PRD (например international trade §4.4.2) как «пропуск или smoke только если UI есть».
- Язык документа: **русский** (как запрос пользователя); идентификаторы экранов/маршрутов — как в UI.

## Объём

Один файл ~**400–900 строк** markdown — исчерпывающий чеклист без дублирования полноты автотестов; приоритет — **онбординг + критический финансовый контур + закрытие периода**.
