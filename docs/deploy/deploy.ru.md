# ERA Finance — развёртывание в production (Ubuntu 24.04 + Docker Compose)

Цель: поднять стек из `docker-compose.prod.yml`:
- Postgres **16** (`db`)
- Redis **7** (`redis`)
- NestJS API (`api`)
- Next.js Web (`web`)

Документ обновлён под:
- **Node.js 22** (образы `apps/api/Dockerfile`, `apps/web/Dockerfile`)
- **Prisma ORM 7** + **`prisma.config.ts`** + **driver adapter** (`@prisma/adapter-pg`)
- Требование **HTTPS** для production web-origin (см. `TZ.md` §1)

---

## 0. Быстрый чек-лист перед стартом

- Есть домен и будет настроен HTTPS (Caddy/nginx/Traefik) → трафик на `web:3000`.
- В корне репозитория будет `.env` (шаблон: `env.production.example`).
- Вы понимаете, что `NEXT_PUBLIC_*` переменные **вшиваются в клиентский бандл на этапе build**.
- На сервере открыт только нужный внешний порт (обычно 80/443); Postgres/Redis наружу не публикуем.
- После **каждого** деплоя с новым кодом фронта: не забыть шаг **синхронизации переводов в БД** (§7.3) — иначе **`GET /api/public/translations`** и кэш i18n могут расходиться с бандлом **`resources.ts`** (на клиенте язык UI — только **ru** / **az**, при неопределённом коде — **az**; см. PRD §7.6.1, TZ §17).
- Если **прод** — **greenfield со сносом БД** (пустая база / новый том, данных переносить не нужно), используйте **п. 7.0.1 (A)** — без baseline/`migrate resolve`; далее миграции + i18n + `db:prod-init` как обычно.
- **Переезд на DigitalOcean с пустой БД** (без восстановления дампа со старого сервера): начните с **п. 0.1**, затем разделы 1–9.

---

## 0.1. Переезд на DigitalOcean (greenfield — БД с нуля)

Этот раздел — для сценария, когда вы **намеренно не переносите** бизнес-данные со старого хоста: новый инстанс Postgres (или новый Docker-том) и **пустая** база с именем **`erafinance`** (как в `env.production.example`, `.env.example` и дефолтах `docker-compose.prod.yml`). Данные со старого сервера с другим именем БД или старой историей миграций в новый инстанс **не заливаем**.

**Не восстанавливайте** старый `pg_dump` в новую базу, если не идёте по п. **7.0.1 (C)** (сохранение данных + baseline). Дамп со старой схемой/историей миграций конфликтует с единственной squashed-миграцией `20260520120000_squashed_schema`.

### 0.1.1. Целевая архитектура на DigitalOcean

| Компонент | Рекомендация (MVP) | Усиление (позже) |
|-----------|-------------------|------------------|
| Регион | **FRA1** или **AMS3** (EU; TZ §1.4, §1.6) | Тот же |
| API + Web + воркеры BullMQ | **Droplet** Ubuntu 24.04, Docker Compose (`docker-compose.prod.yml`) | Отдельный worker-droplet при росте нагрузки |
| PostgreSQL 16 | Контейнер `db`, том `pgdata` | **Managed Database for PostgreSQL** (приватный hostname в VPC) |
| Redis 7 | Контейнер `redis` | **Managed Redis** (`noeviction`, только VPC) |
| Файлы | `STORAGE_DRIVER=local` | **Spaces** (S3-совместимое; п. 0.1.6) |
| HTTPS | **Caddy** или Nginx на дроплете → `127.0.0.1:3000` | По желанию **Cloudflare** спереди |
| DNS | **A** на публичный IPv4 дроплета (или Floating IP) | То же |

Сеть (TZ §1.6): Postgres и Redis **не** публикуются в интернет. На дроплете не открывайте **5432** / **6379** наружу (не задавайте `POSTGRES_PUBLISH_PORT` / `REDIS_PUBLISH_PORT` без файрвола; используйте **Cloud Firewall** DO + `ufw`).

### 0.1.2. Имя БД и учётная запись: `erafinance`

Стандарт для prod и локальной разработки (шаблоны в репозитории):

```bash
POSTGRES_USER=erafinance
POSTGRES_DB=erafinance
```

`DATABASE_URL` в `.env` на дроплете должен совпадать с этими значениями (Compose собирает URL для `api` из `POSTGRES_*` автоматически).

Если на дроплете уже есть **старый том** Postgres, созданный с **другим** `POSTGRES_DB`, внутри тома останется прежняя база — смена только переменных в `.env` **не переименует** данные. Для greenfield: **`docker compose … down -v`** (удаление тома `pgdata`) или новый пустой Managed DB с именем **`erafinance`**.

### 0.1.3. Чеклист перед переездом (со старого хоста)

| Шаг | Действие |
|-----|----------|
| 1 | Согласовать **окно обслуживания** (maintenance, п. 7.0). |
| 2 | Сохранить **секреты**, которые нужны на новом месте: SMTP, Spaces/S3, ключи интеграций; JWT — лучше **новые** на greenfield. |
| 3 | Зафиксировать **публичный URL** для `CORS_ORIGINS` и DNS. |
| 4 | На коммите релиза: `npm run build` (`i18n:audit`). При правках `resources.ts`: `npm run i18n:catalog` + коммит `i18n-default-catalog-data.json`. |
| 5 | По желанию: финальный бэкап на старом хосте (`scripts/backup-db.sh`) **только в архив**, не для заливки в новую пустую БД. |

### 0.1.4. Создание ресурсов в DigitalOcean

1. **Project** (по желанию): дроплет, БД, bucket.
2. **VPC** в **FRA1** или **AMS3**.
3. **Droplet**: Ubuntu **24.04**, для пилота часто хватает **2 vCPU / 4 GB**, SSH-ключ, мониторинг.
4. **Cloud Firewall**: вход **22** (с вашего IP), **80**, **443**; **запрет** **5432**, **6379**, **4000** с `0.0.0.0/0`.
5. **Floating IP** (опционально) — до переключения DNS.
6. **DNS**: TTL **300** за сутки до cutover; **A** на IP дроплета.
7. **Spaces** (если S3): bucket рядом с регионом; access keys; endpoint вида `https://fra1.digitaloceanspaces.com`.

Managed Postgres/Redis вместо контейнеров — тот же VPC, trusted source = дроплет. Подключение внешнего `DATABASE_URL` потребует override Compose (в стандартном `docker-compose.prod.yml` БД — сервис `db`). Ниже — путь MVP с контейнером `db`.

### 0.1.5. Порядок команд на новом дроплете (greenfield)

Подставьте: `YOUR_GIT_URL`, `your-domain.tld`, секреты.

```bash
# --- 1) ОС + Docker (см. раздел 2) ---
ssh root@IP_ДРОПЛЕТА
# ... установка Docker по разделу 2 ...

# --- 2) Каталог приложения ---
sudo mkdir -p /opt/erafinance_erp
sudo chown "$USER":"$USER" /opt/erafinance_erp
cd /opt/erafinance_erp
git clone YOUR_GIT_URL .
git checkout main   # или тег релиза

# --- 3) Production .env ---
cp env.production.example .env
nano .env
```

**Минимум в `.env`:**

| Переменная | Примечание |
|------------|------------|
| `COMPOSE_PROJECT_NAME` | `erafinance_prod` |
| `POSTGRES_USER` | `erafinance` |
| `POSTGRES_DB` | `erafinance` |
| `POSTGRES_PASSWORD` | надёжный пароль |
| `REDIS_URL` | `redis://redis:6379` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | новые длинные значения |
| `CORS_ORIGINS` | `https://your-domain.tld` |
| `NEXT_PUBLIC_API_URL` | `http://api:4000` (внутри Compose) |
| `STORAGE_DRIVER` | `s3` + Spaces или `local` |

```bash
# --- 4) Каталог файлов (если local storage) ---
sudo mkdir -p /var/lib/erafinance/storage
sudo chown 1001:1001 /var/lib/erafinance/storage

# --- 5) Maintenance + пустой том Postgres ---
# В .env: MAINTENANCE_MODE=1
docker compose -f docker-compose.prod.yml up -d --build

# Первый запуск ИЛИ смена имени БД — пустой том:
# ВНИМАНИЕ: удаляет все данные в томе pgdata
docker compose -f docker-compose.prod.yml down
docker volume rm erafinance_prod_pgdata 2>/dev/null || docker volume ls | grep pgdata

docker compose -f docker-compose.prod.yml up -d db redis
docker compose -f docker-compose.prod.yml up -d --build

# --- 6) Схема + платформа (п. 7.0.1 A) ---
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init

# --- 7) HTTPS (раздел 8) ---
# --- 8) Проверки (раздел 9) ---
# Убрать MAINTENANCE_MODE из .env:
docker compose -f docker-compose.prod.yml up -d web
```

Платформенные пользователи создаются через `db:seed` / `db:prod-init` по правилам репозитория. Отдельный хеш super-admin: `npm run docker-init:super-admin-hash` из корня (с корректным `DATABASE_URL`).

### 0.1.6. DigitalOcean Spaces (хранилище файлов)

В `.env` для `api`:

```bash
STORAGE_DRIVER=s3
S3_ENDPOINT=https://fra1.digitaloceanspaces.com
S3_REGION=fra1
S3_BUCKET=имя-bucket
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Пересборка образа **не** нужна — после правки `.env`:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

### 0.1.7. Обновления после запуска

| Тип изменения | Команда |
|---------------|---------|
| Только код/образы | `bash scripts/deploy-prod-code.sh` |
| Новые миграции Prisma | `bash scripts/deploy-prod-db-migrate.sh` (с бэкапом) |
| Только i18n | `docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune` |

Настройте cron для `scripts/backup-db.sh`, копии храните вне дроплета. См. `DR_RUNBOOK.md`.

### 0.1.8. Связанные документы

| Документ | Назначение |
|----------|------------|
| `PRE-RELEASE-CHECKLIST.md` | Сборка, i18n, smoke перед релизом |
| `DR_RUNBOOK.md` | Бэкапы и восстановление |
| `../launch/STAGE_B_INFRASTRUCTURE.md` | Инфра, шаги 34–65 |
| `TZ.md` §1.4–1.7, §1.6 | VPC, Redis, регион |

---

## 1. SSH

```bash
ssh deploy@YOUR_SERVER_IP
```

---

## 2. Docker (Ubuntu 24.04)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"${VERSION_CODENAME:-noble}\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Перезайди в SSH или выполни `newgrp docker`, затем:

```bash
docker version
docker compose version
```

---

## 3. Git

```bash
sudo apt-get install -y git
```

---

## 4. Клонирование репозитория

```bash
sudo mkdir -p /opt/erafinance_erp
sudo chown "$USER":"$USER" /opt/erafinance_erp
cd /opt/erafinance_erp
git clone YOUR_GIT_URL .
```

`YOUR_GIT_URL` — любой URL удалённого репозитория (после переименования на GitHub достаточно обновить `git remote` или использовать новый URL при клоне). Имя каталога на сервере (`/opt/erafinance_erp`) в документации условное: если клонируете в другой путь, подставьте его во всех командах ниже.

---

## 5. Production `.env` (корень репозитория)

```bash
cp env.production.example .env
nano .env
```

### Минимально обязательные переменные

- **Postgres**:
  - `POSTGRES_PASSWORD` (обязательна)
  - опционально `POSTGRES_USER`, `POSTGRES_DB`
- **API**:
  - `REDIS_URL=redis://redis:6379`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `AUDIT_HASH_SECRET` (рекомендуется)
  - `CORS_ORIGINS=https://your-domain.tld` (можно несколько через запятую)
- **Web**:
  - `NEXT_PUBLIC_API_URL=http://api:4000` (для сборки/SSR внутри сети Compose)

### Часто нужные опции (рекомендуется настроить до публичного запуска)

- **Storage (логотипы, PDF)**:
  - production: `STORAGE_DRIVER=s3` + `S3_*`
  - альтернативно: `STORAGE_DRIVER=local` + `STORAGE_LOCAL_ROOT`
- **SMTP**:
  - `SMTP_HOST` + `SMTP_*` — без этого письма не отправляются
- **Sentry**:
  - API: `SENTRY_DSN_API`
  - Web client: `NEXT_PUBLIC_SENTRY_DSN`
  - sourcemaps upload для web build: `SENTRY_UPLOAD_SOURCEMAPS=1` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT_WEB`

### Важно про `NEXT_PUBLIC_*`

`NEXT_PUBLIC_*` попадают в Next.js bundle **во время** `docker build` (см. `apps/web/Dockerfile`). Если меняете эти значения — нужно **пересобрать образ web**.

---

## 6. Первый запуск стека

Из корня (где лежит `docker-compose.prod.yml`):

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Логи:

```bash
docker compose -f docker-compose.prod.yml logs -f api web
```

---

## 7. Prisma 7: миграции и первичная инициализация

В этом репозитории Prisma настроена через `packages/database/prisma.config.ts`.
В production миграции применяем **только** командой `prisma migrate deploy` (никаких `migrate dev`).

### 7.0. Maintenance mode перед миграциями (рекомендуется)

Перед `db:migrate:deploy` включайте maintenance mode, чтобы пользователи не работали в момент изменения схемы.

#### Вариант A — одна настройка в `.env` (проще всего при типовом деплое)

В корневом `.env` задайте для сервиса `web`:

```bash
MAINTENANCE_MODE=1
```

Поддерживаемые значения: `1`, `true`, `yes`, `on` (без учёта регистра). Выключение: удалите переменную, `0` или `false`.

Пересборка образа `web` **не нужна**; Compose уже пробрасывает переменную в контейнер. Нужен **перезапуск** процесса Next:

```bash
docker compose -f docker-compose.prod.yml up -d web
```

Дальше миграции и инициализация (как в п. 7.1–7.2), затем снимите `MAINTENANCE_MODE` и снова `up -d web`.

**Ограничение:** ответ 503 отдаёт только контейнер **Next (`web`)**. Запросы, которые не проходят через него (например, отдельно опубликованный порт API на хосте), этой настройкой не отключаются. В таких схемах используйте вариант B.

#### Вариант B — Nginx (или другой reverse proxy) перед приложением

503 на границе HTTPS, до Node/Docker — надёжнее при нестандартной публикации портов.

- `docs/maintenance.html` — страница обслуживания (AZ/RU); для варианта A дублируется в коде (`apps/web/lib/maintenance-page-html.ts`, держите визуально в согласовании при правках).
- `docs/nginx-maintenance.conf` — сниппет: 503, если существует файл-флаг `/var/www/html/maintenance.enable`.

Пример последовательности на сервере:

```bash
# 1) разово: положить maintenance.html и подключить nginx-сниппет
sudo cp /opt/erafinance_erp/docs/maintenance.html /var/www/html/maintenance.html
# include /opt/erafinance_erp/docs/nginx-maintenance.conf; внутри server { ... }

# 2) включить maintenance
sudo touch /var/www/html/maintenance.enable
sudo nginx -t && sudo systemctl reload nginx

# 3) миграции / i18n / инициализация
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init

# 4) выключить maintenance
sudo rm -f /var/www/html/maintenance.enable
sudo nginx -t && sudo systemctl reload nginx
```

### 7.0.1. Одна squashed-миграция и сценарии базы

В репозитории **одна** папка Prisma Migrate: **`20260520120000_squashed_schema`**. Выберите сценарий по вашему стенду.

#### A) Прод: снос БД и установка с нуля (осознанно, без переноса данных)

Если на целевом Postgres **допустимо полное удаление бизнес-данных** (первый выход в прод без миграции со старой схемы, пересборка staging, жёсткий cutover), **baseline не нужен** и **`migrate resolve` не нужен**. Нужна **пустая** база приложения (нет таблиц/enum из старого деплоя), затем обычный порядок из п. 7.1–7.2.

1. Включите maintenance mode (п. 7.0).
2. Остановите обращения к БД, затем **удалите базу приложения** (или том Postgres в Docker / новый пустой инстанс). Создайте **пустую** базу с тем же именем `POSTGRES_DB` и учётными данными, что в `.env` / `DATABASE_URL`.
3. Поднимите `db` и `redis`, затем из контейнера `api`, как в п. 7.1–7.2, например:

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
```

4. Снимите maintenance mode.

**Без отката:** без бэкапа восстановить удалённые данные нельзя. Не применяйте этот путь к продакшену, где нужно сохранить организации, проводки и т.д.

#### B) Новая пустая база (первый запуск, схемы ещё не было)

Это конечное состояние после п. A: достаточно `npm run db:migrate:deploy` в `api` (или `prisma migrate deploy` с корректным `DATABASE_URL`) — Prisma применит `migration.sql` и заполнит `_prisma_migrations`.

#### C) Существующая база со схемой от старых миграций (данные сохраняем)

**Нельзя** просто запустить `migrate deploy` поверх уже созданной схемы из удалённой истории миграций — будут ошибки вида «relation already exists». Либо переходите на п. **A** (со сносом), либо baseline:

1. Резервная копия Postgres.
2. Очистка **только** служебной таблицы миграций:

```sql
DELETE FROM "_prisma_migrations";
```

3. Пометить squashed-миграцию как применённую **без выполнения SQL** (схема уже должна соответствовать ожиданиям приложения):

```bash
npx prisma migrate resolve --applied 20260520120000_squashed_schema
```

4. Затем:

```bash
npx prisma migrate deploy
```

В Docker Compose из корня репозитория:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate resolve --applied 20260520120000_squashed_schema
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
```

**Для разработчиков:** актуальный `migration.sql` в репозитории собирается, например, командой Prisma 7 `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` из каталога `packages/database` (см. документацию Prisma Migrate: *Baselining*, *drift*). Папка в репо: **`20260520120000_squashed_schema`**.

### 7.1. Миграции (обязательно)

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
```

`DATABASE_URL` и остальные переменные из `.env` на хосте попадают в контейнер через `env_file` в `docker-compose.prod.yml`; отдельный `dotenv-cli` в образе для этих команд не требуется.

### 7.2. Идемпотентная “доводка” платформенных данных (рекомендуется)

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
```

Примечание: `db:prod-init` должен быть идемпотентным; это не “reset”. Корневой **`npm run db:prod-init`** (так его вызывают из `docker compose … exec api`) уже включает **`db:migrate:deploy`**, **`db:seed`**, **`db:sync-i18n:prune`** и скрипт **`db:prod-init`** в workspace `@erafinance/database` — отдельный §7.3 в этом случае дублирует синхронизацию, но не вредит. Если хотите **явный** порядок без повторного `migrate`/`seed` из корня: выполните §7.1 и §7.3, затем только **`npm run db:prod-init -w @erafinance/database`** (доводка платформы без полной цепочки корня).

### 7.3. Синхронизация переводов (i18n) в Postgres — **не пропускать на проде**

Строки **RU/AZ** для UI лежат в **`apps/web/lib/i18n/resources.ts`** (в образ `api` файл копируется при сборке). Таблица **`translation_overrides`** и ответ **`GET /api/public/translations?locale=ru|az`** должны соответствовать этому словарю: иначе после релиза на проде возможны «старые» подписи или лишние ключи в БД.

**Клиент (web):** в браузере поддерживаются только **`ru`** и **`az`**; при нераспознанном языке (localStorage, браузер) действует **`az`**. Подмешивание оверрайдов из ответа API выполняется с нормализацией плоских ключей и **глубоким merge с перезаписью** совпадающих путей в бандле — иначе правки из БД по ключам, уже есть в `resources.ts`, не будут видны. Подробности реализации — **`apps/web/lib/i18n/apply-db-overrides.ts`**, **`apps/web/lib/i18n/ui-lang.ts`** (PRD §7.6.1, TZ §17).

**Рекомендуемый шаг после `db:migrate:deploy` на каждом релизе** (идемпотентно, из контейнера `api`, `WORKDIR` = корень монорепо в образе):

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
```

Что делает команда:

- upsert всех плоских ключей **ru** и **az** из `resources.ts` в **`translation_overrides`**;
- удаляет из **ru/az** строки, ключей которых **больше нет** в `resources.ts` (актуализация после переименований);
- обновляет **`system_config`** ключ **`i18n.cacheVersion`** — клиенты перезапрашивают оверрайды.

**Альтернатива одной строкой** (миграции + синхронизация i18n с prune; без seed):

```bash
docker compose -f docker-compose.prod.yml exec api npm run db:deploy
```

Если нужен только upsert **без** удаления устаревших ключей (редко на проде): `npm run db:sync-i18n` — см. [TZ.md](../TZ.md) §17.

Связь с CI: перед сборкой образов выполняйте **`npm run i18n:audit`** (сканирует **`apps/web/app`**, **`apps/web/components`**, **`apps/web/lib`**) и при изменении `resources.ts` — **`npm run i18n:catalog`** (обновление `apps/api/src/admin/i18n-default-catalog-data.json`); подробности — **PRD §7.6.1**, **TZ §17**.

### 7.4. Локально (Windows / dev): тот же порядок, что «migrate + prune + bump»

Из **корня** монорепо, с **`DATABASE_URL`** в корневом **`.env`** (как в [erafinance-local-dev](../.cursor/rules/erafinance-local-dev.mdc)):

```bash
npx dotenv-cli -e .env -- npm run db:deploy
```

Это **`prisma migrate deploy`** + **`db:sync-i18n:prune`** (upsert всех ключей **ru/az** из `resources.ts` в **`translation_overrides`**, prune устаревших, инкремент **`i18n.cacheVersion`**).

Проверка согласованности БД с клиентским пайплайном оверрайдов (dry-run):

```bash
npx dotenv-cli -e .env -- npm run db:audit-i18n-overrides -w @erafinance/database
```

Ожидаемо: `dropped normalized keys=0`, `invalid raw keys=0`. Подробности — **TZ §17**.

---

## 8. HTTPS (обязательно для production)

Production web-origin должен быть **HTTPS**.

### 8.1. Рекомендуемый путь: Caddy (быстрее всего)

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

Создайте `/etc/caddy/Caddyfile`:

```caddy
your-domain.tld {
  reverse_proxy 127.0.0.1:3000
}
```

Применение:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy автоматически выпустит/обновит Let's Encrypt сертификат.

### 8.2. Альтернатива: Nginx

Остаётся валидным: `https://your-domain.tld` → `http://127.0.0.1:3000` (контейнер `web`).

API можно не публиковать отдельно: браузер ходит через тот же origin `/api/*` (Next rewrites).

---

## 9. Проверки после деплоя

- `GET /api/health` через публичный web-origin (например `https://your-domain.tld/api/health`)
- Логин/регистрация в UI
- Проверка, что переводы подгружаются (нет ошибок `Failed to fetch`/`Unexpected end of JSON input`)
- После шага §7.3: **`GET /api/public/translations?locale=ru`** и **`?locale=az`** — при полном зеркале из `resources.ts` в ответе большой объект оверрайдов; переключатель языка в UI (**ru** / **az**) должен показывать ожидаемые строки (при расхождении повторите `db:sync-i18n:prune`, сбросьте кэш браузера и проверьте `erafinance_i18n_lang` в localStorage)

---

## 10. Типовые проблемы

- **`npm install` / `prisma generate` падает из-за `DATABASE_URL`**: убедитесь, что `.env` в корне и `DATABASE_URL`/`POSTGRES_*` заданы корректно (в compose `DATABASE_URL` для `api` собирается автоматически).
- **Windows локально: ENOTEMPTY/EPERM в `.next`**: остановить `next dev`, запустить `npm run clean -w @erafinance/web`, повторить build; добавить исключение антивируса для `apps/web/.next`.
- **На проде «старые» подписи или сырые ключи i18n после деплоя**: не выполнен §7.3 — запустите `docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune` (или `db:deploy` сразу после миграций). Локально: из корня репозитория `npx dotenv-cli -e .env -o -- npm run db:sync-i18n` (без prune) или `… db:sync-i18n:prune`.

---

## 11. Runbook: «снести дроплет и поднять заново» (без данных)

Сценарий подходит, если в production нет бизнес-данных и можно безболезненно пересоздать сервер.

### 11.1. На новой машине (Ubuntu 24.04)

1) Установи Docker и Git (см. разделы 2–3).
2) Клонируй репозиторий в `/opt/erafinance_erp`.
3) Подготовь `.env`:

```bash
cd /opt/erafinance_erp
cp env.production.example .env
nano .env
```

Минимум: `POSTGRES_PASSWORD`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`.

### 11.2. Поднять стек + миграции

```bash
cd /opt/erafinance_erp
docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml exec api npm run db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:sync-i18n:prune
docker compose -f docker-compose.prod.yml exec api npm run db:prod-init
```

Команда `db:prod-init` из корня в `package.json` уже включает migrate + seed + **prune-синк i18n**; здесь шаг **`db:sync-i18n:prune`** перед `db:prod-init` даёт явный порядок «схема → словарь → остальная инициализация» и совпадает с типовым деплоем из §7.

### 11.3. Проверки

- Web открывается по HTTPS.
- `GET https://your-domain.tld/api/health` отдаёт 200.
- Логин/регистрация работают.

### 11.4. Если нужно повторить «с нуля»

Остановить и удалить контейнеры и данные:

```bash
cd /opt/erafinance_erp
docker compose -f docker-compose.prod.yml down -v
```

Затем снова выполнить шаги из 11.2.

