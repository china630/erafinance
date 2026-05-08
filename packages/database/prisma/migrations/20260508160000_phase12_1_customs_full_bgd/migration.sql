-- Phase 12.1: Full BGD capture — declaration status, parties, line items, tariff rates.

CREATE TYPE "CustomsDeclarationStatus" AS ENUM ('DRAFT', 'CAPTURED', 'ATTACHED', 'ARCHIVED');

ALTER TABLE "customs_declarations"
ADD COLUMN "status" "CustomsDeclarationStatus";

UPDATE "customs_declarations" SET "status" = 'CAPTURED' WHERE "status" IS NULL;

ALTER TABLE "customs_declarations"
ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "customs_declarations"
ADD COLUMN "regime_code" TEXT,
ADD COLUMN "currency_rate" DECIMAL(19,6),
ADD COLUMN "sender_voen" TEXT,
ADD COLUMN "sender_name" TEXT,
ADD COLUMN "receiver_voen" TEXT,
ADD COLUMN "receiver_name" TEXT,
ADD COLUMN "sender_counterparty_id" UUID,
ADD COLUMN "receiver_counterparty_id" UUID,
ADD COLUMN "total_invoice_value" DECIMAL(19,4),
ADD COLUMN "total_statistical_value_azn" DECIMAL(19,4),
ADD COLUMN "calculated_duty_azn" DECIMAL(19,4),
ADD COLUMN "calculated_vat_azn" DECIMAL(19,4);

CREATE INDEX "customs_declarations_organization_id_status_idx" ON "customs_declarations" ("organization_id", "status");

ALTER TABLE "customs_declarations"
ADD CONSTRAINT "customs_declarations_sender_counterparty_id_fkey"
FOREIGN KEY ("sender_counterparty_id") REFERENCES "counterparties" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customs_declarations"
ADD CONSTRAINT "customs_declarations_receiver_counterparty_id_fkey"
FOREIGN KEY ("receiver_counterparty_id") REFERENCES "counterparties" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "customs_declaration_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "declaration_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "hs_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit" TEXT,
    "weight_net_kg" DECIMAL(19,4) NOT NULL,
    "weight_gross_kg" DECIMAL(19,4) NOT NULL,
    "invoice_value" DECIMAL(19,4) NOT NULL,
    "statistical_value_azn" DECIMAL(19,4) NOT NULL,
    "duty_rate_percent" DECIMAL(7,4) NOT NULL,
    "vat_rate_percent" DECIMAL(7,4) NOT NULL,
    "excise_percent" DECIMAL(7,4) NOT NULL,
    "calculated_duty_azn" DECIMAL(19,4) NOT NULL,
    "calculated_vat_azn" DECIMAL(19,4) NOT NULL,
    "calculated_excise_azn" DECIMAL(19,4) NOT NULL,
    "portal_duty_azn" DECIMAL(19,4),
    "portal_vat_azn" DECIMAL(19,4),
    "notes" TEXT,
    CONSTRAINT "customs_declaration_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customs_declaration_items_declaration_id_sequence_number_key"
ON "customs_declaration_items" ("declaration_id", "sequence_number");

CREATE INDEX "customs_declaration_items_organization_id_hs_code_idx"
ON "customs_declaration_items" ("organization_id", "hs_code");

ALTER TABLE "customs_declaration_items"
ADD CONSTRAINT "customs_declaration_items_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customs_declaration_items"
ADD CONSTRAINT "customs_declaration_items_declaration_id_fkey"
FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "customs_tariff_rates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "hs_code" TEXT NOT NULL,
    "description" TEXT,
    "duty_rate_percent" DECIMAL(7,4) NOT NULL,
    "vat_rate_percent" DECIMAL(7,4) NOT NULL,
    "excise_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_tariff_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customs_tariff_rates_hs_code_key" ON "customs_tariff_rates" ("hs_code");

CREATE INDEX "customs_tariff_rates_hs_code_effective_from_idx" ON "customs_tariff_rates" ("hs_code", "effective_from");
