-- Smart Seeding catalogs + currency/uom FK enforcement.

-- Enums
DO $$ BEGIN
  CREATE TYPE "PermissionCategory" AS ENUM ('CORE','BILLING','ACCOUNTING','SALES','PURCHASES','INVENTORY','HR','PSA','CUSTOMS','ADMIN','REPORTING','INTEGRATIONS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "UnitOfMeasureKind" AS ENUM ('COUNT','WEIGHT','LENGTH','AREA','VOLUME','PACK','TIME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TaxRateKind" AS ENUM ('VAT','EXCISE','INCOME','SOCIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SystemProductKind" AS ENUM ('SERVICE','GOODS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "currencies" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" VARCHAR(3) NOT NULL,
  "symbol" TEXT NOT NULL,
  "decimals" INTEGER NOT NULL DEFAULT 2,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "currencies_code_key" ON "currencies"("code");

-- Phase 9: seed currencies before FK enforcement (existing rows must reference valid codes).
INSERT INTO "currencies" ("id","code","symbol","decimals","name_az","name_ru","name_en","is_active","sort_order","created_at","updated_at")
VALUES
  (uuid_generate_v4(), 'AZN', '₼', 2, 'Azərbaycan manatı', 'Азербайджанский манат', 'Azerbaijani manat', true, 0, NOW(), NOW()),
  (uuid_generate_v4(), 'USD', '$', 2, 'ABŞ dolları', 'Доллар США', 'US dollar', true, 1, NOW(), NOW()),
  (uuid_generate_v4(), 'EUR', '€', 2, 'Avro', 'Евро', 'Euro', true, 2, NOW(), NOW()),
  (uuid_generate_v4(), 'TRY', '₺', 2, 'Türk lirəsi', 'Турецкая лира', 'Turkish lira', true, 3, NOW(), NOW()),
  (uuid_generate_v4(), 'RUB', '₽', 2, 'Rusiya rublu', 'Российский рубль', 'Russian ruble', true, 4, NOW(), NOW()),
  (uuid_generate_v4(), 'GBP', '£', 2, 'Britaniya funt sterlinqi', 'Фунт стерлингов', 'British pound', true, 5, NOW(), NOW()),
  (uuid_generate_v4(), 'KZT', '₸', 2, 'Qazaxıstan tengesi', 'Казахстанский тенге', 'Kazakhstani tenge', true, 6, NOW(), NOW()),
  (uuid_generate_v4(), 'UAH', '₴', 2, 'Ukrayna qrivnası', 'Украинская гривна', 'Ukrainian hryvnia', true, 7, NOW(), NOW()),
  (uuid_generate_v4(), 'GEL', '₾', 2, 'Gürcüstan larisi', 'Грузинский лари', 'Georgian lari', true, 8, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "roles" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "legacy_enum_role" "UserRole",
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_key" ON "roles"("code");

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "category" "PermissionCategory" NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_key" ON "permissions"("code");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

CREATE TABLE IF NOT EXISTS "units_of_measure" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "kind" "UnitOfMeasureKind" NOT NULL,
  "base_code" TEXT,
  "factor" DECIMAL(19,6) NOT NULL DEFAULT 1,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "units_of_measure_code_key" ON "units_of_measure"("code");

-- Phase 10: base UoM rows before optional FKs on tenant tables.
INSERT INTO "units_of_measure" ("id","code","kind","base_code","factor","name_az","name_ru","name_en","is_active","sort_order","created_at","updated_at")
VALUES
  (uuid_generate_v4(), 'pcs', 'COUNT'::"UnitOfMeasureKind", NULL, 1, 'ədəd', 'шт', 'pcs', true, 0, NOW(), NOW()),
  (uuid_generate_v4(), 'kg', 'WEIGHT'::"UnitOfMeasureKind", NULL, 1, 'kq', 'кг', 'kg', true, 1, NOW(), NOW()),
  (uuid_generate_v4(), 'm', 'LENGTH'::"UnitOfMeasureKind", NULL, 1, 'm', 'м', 'm', true, 2, NOW(), NOW()),
  (uuid_generate_v4(), 'm2', 'AREA'::"UnitOfMeasureKind", NULL, 1, 'm²', 'м²', 'm2', true, 3, NOW(), NOW()),
  (uuid_generate_v4(), 'pack', 'PACK'::"UnitOfMeasureKind", NULL, 1, 'paçka', 'пачка', 'pack', true, 4, NOW(), NOW()),
  (uuid_generate_v4(), 'litre', 'VOLUME'::"UnitOfMeasureKind", NULL, 1, 'litr', 'литр', 'litre', true, 5, NOW(), NOW()),
  (uuid_generate_v4(), 'hour', 'TIME'::"UnitOfMeasureKind", NULL, 1, 'saat', 'час', 'hour', true, 6, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "countries" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "iso2" CHAR(2) NOT NULL,
  "iso3" CHAR(3),
  "dialing_code" TEXT,
  "currency_code" TEXT,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "countries_iso2_key" ON "countries"("iso2");

CREATE TABLE IF NOT EXISTS "cities" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "country_iso2" CHAR(2) NOT NULL,
  "region" TEXT,
  "is_capital" BOOLEAN NOT NULL DEFAULT false,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cities_code_key" ON "cities"("code");
CREATE INDEX IF NOT EXISTS "cities_country_iso2_sort_order_idx" ON "cities"("country_iso2","sort_order");

CREATE TABLE IF NOT EXISTS "department_type_catalog" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "department_type_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "department_type_catalog_code_key" ON "department_type_catalog"("code");

CREATE TABLE IF NOT EXISTS "job_title_catalog" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "department_type_code" TEXT NOT NULL,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_title_catalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_title_catalog_code_key" ON "job_title_catalog"("code");
CREATE INDEX IF NOT EXISTS "job_title_catalog_department_type_code_sort_order_idx"
  ON "job_title_catalog"("department_type_code","sort_order");

CREATE TABLE IF NOT EXISTS "activity_types" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "activity_types_code_key" ON "activity_types"("code");

CREATE TABLE IF NOT EXISTS "notification_types" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "default_severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_types_code_key" ON "notification_types"("code");

CREATE TABLE IF NOT EXISTS "audit_categories" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "audit_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "audit_categories_code_key" ON "audit_categories"("code");

CREATE TABLE IF NOT EXISTS "tax_rates" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "kind" "TaxRateKind" NOT NULL,
  "region" TEXT NOT NULL DEFAULT 'AZ',
  "percent" DECIMAL(7,4) NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_code_key" ON "tax_rates"("code");
CREATE INDEX IF NOT EXISTS "tax_rates_kind_region_effective_from_idx" ON "tax_rates"("kind","region","effective_from");

CREATE TABLE IF NOT EXISTS "system_product_templates" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "kind" "SystemProductKind" NOT NULL DEFAULT 'SERVICE',
  "default_uom_code" TEXT,
  "default_vat_rate_code" TEXT,
  "default_price" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_product_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "system_product_templates_code_key" ON "system_product_templates"("code");
CREATE INDEX IF NOT EXISTS "system_product_templates_kind_is_active_sort_order_idx"
  ON "system_product_templates"("kind","is_active","sort_order");

ALTER TABLE "job_positions" ADD COLUMN IF NOT EXISTS "job_title_code" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unit_of_measure_code" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "unit_of_measure_code" TEXT;
ALTER TABLE "inventory_audit_lines" ADD COLUMN IF NOT EXISTS "unit_of_measure_code" TEXT;
ALTER TABLE "customs_declaration_items" ADD COLUMN IF NOT EXISTS "unit_of_measure_code" TEXT;
UPDATE "customs_declaration_items"
SET "unit_of_measure_code" = CASE
  WHEN lower(trim("unit")) IN ('шт','штук','pcs','piece','ədəd') THEN 'pcs'
  WHEN lower(trim("unit")) IN ('kg','kq','кг','kilogram') THEN 'kg'
  WHEN lower(trim("unit")) IN ('m','метр','metr') THEN 'm'
  WHEN lower(trim("unit")) IN ('m2','m²','кв.м') THEN 'm2'
  WHEN lower(trim("unit")) IN ('litr','литр','l') THEN 'litre'
  WHEN lower(trim("unit")) IN ('paçka','pack') THEN 'pack'
  ELSE NULL
END
WHERE "unit_of_measure_code" IS NULL AND "unit" IS NOT NULL;
ALTER TABLE "customs_declaration_items" DROP COLUMN IF EXISTS "unit";

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cities"
  ADD CONSTRAINT "cities_country_iso2_fkey" FOREIGN KEY ("country_iso2") REFERENCES "countries"("iso2") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_title_catalog"
  ADD CONSTRAINT "job_title_catalog_department_type_code_fkey" FOREIGN KEY ("department_type_code") REFERENCES "department_type_catalog"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_product_templates"
  ADD CONSTRAINT "system_product_templates_default_uom_code_fkey" FOREIGN KEY ("default_uom_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_product_templates"
  ADD CONSTRAINT "system_product_templates_default_vat_rate_code_fkey" FOREIGN KEY ("default_vat_rate_code") REFERENCES "tax_rates"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 9: point orphan currency codes at AZN before FK validation (invalid legacy values).
UPDATE "organizations" o SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = o."currency");
UPDATE "organization_bank_accounts" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "payment_orders" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "bank_payment_drafts" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "approval_policies" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "prepaid_expenses" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "psa_projects" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "accounts" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "counterparty_bank_accounts" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "invoices" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "customs_declarations" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "cash_orders" t SET "currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."currency");
UPDATE "holdings" t SET "base_currency" = 'AZN'
WHERE NOT EXISTS (SELECT 1 FROM "currencies" c WHERE c."code" = t."base_currency");

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "organization_bank_accounts" ADD CONSTRAINT "organization_bank_accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "bank_payment_drafts" ADD CONSTRAINT "bank_payment_drafts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "prepaid_expenses" ADD CONSTRAINT "prepaid_expenses_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "psa_projects" ADD CONSTRAINT "psa_projects_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "counterparty_bank_accounts" ADD CONSTRAINT "counterparty_bank_accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;

ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_job_title_code_fkey" FOREIGN KEY ("job_title_code") REFERENCES "job_title_catalog"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 10: clear UoM codes that are not in catalog before FK (legacy free-text).
UPDATE "products" p SET "unit_of_measure_code" = NULL
WHERE p."unit_of_measure_code" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "units_of_measure" u WHERE u."code" = p."unit_of_measure_code");
UPDATE "invoice_items" t SET "unit_of_measure_code" = NULL
WHERE t."unit_of_measure_code" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "units_of_measure" u WHERE u."code" = t."unit_of_measure_code");
UPDATE "inventory_audit_lines" t SET "unit_of_measure_code" = NULL
WHERE t."unit_of_measure_code" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "units_of_measure" u WHERE u."code" = t."unit_of_measure_code");
UPDATE "customs_declaration_items" t SET "unit_of_measure_code" = NULL
WHERE t."unit_of_measure_code" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "units_of_measure" u WHERE u."code" = t."unit_of_measure_code");

ALTER TABLE "products" ADD CONSTRAINT "products_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customs_declaration_items" ADD CONSTRAINT "customs_declaration_items_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
