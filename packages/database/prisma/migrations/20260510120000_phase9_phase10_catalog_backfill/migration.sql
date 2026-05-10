-- Phase 9 / 10 repair: idempotent catalog backfill + FK creation if a DB missed earlier inserts.
-- Safe when 20260509170000 already applied with full FKs (INSERTs no-op, ADD CONSTRAINT skipped).

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

DO $$ BEGIN
  ALTER TABLE "organizations" ADD CONSTRAINT "organizations_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "organization_bank_accounts" ADD CONSTRAINT "organization_bank_accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_payment_drafts" ADD CONSTRAINT "bank_payment_drafts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "prepaid_expenses" ADD CONSTRAINT "prepaid_expenses_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "psa_projects" ADD CONSTRAINT "psa_projects_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "counterparty_bank_accounts" ADD CONSTRAINT "counterparty_bank_accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "holdings" ADD CONSTRAINT "holdings_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customs_declaration_items" ADD CONSTRAINT "customs_declaration_items_unit_of_measure_code_fkey" FOREIGN KEY ("unit_of_measure_code") REFERENCES "units_of_measure"("code") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
