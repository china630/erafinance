-- Fixed asset monthly usage (UNITS_OF_PRODUCTION input before close)

CREATE TABLE IF NOT EXISTS "fixed_asset_monthly_usage" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "fixed_asset_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "period_units" DECIMAL(19, 4) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_monthly_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_monthly_usage_asset_period_uidx"
  ON "fixed_asset_monthly_usage" ("fixed_asset_id", "year", "month");

CREATE INDEX IF NOT EXISTS "fixed_asset_monthly_usage_org_period_idx"
  ON "fixed_asset_monthly_usage" ("organization_id", "year", "month");

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_monthly_usage"
    ADD CONSTRAINT "fixed_asset_monthly_usage_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_monthly_usage"
    ADD CONSTRAINT "fixed_asset_monthly_usage_fixed_asset_id_fkey"
    FOREIGN KEY ("fixed_asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;
