-- Phase 16: CreditTier post-paid pivot (replaces SubscriptionTier)

DO $credit_tier$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditTier') THEN
    CREATE TYPE "CreditTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4');
  END IF;
END $credit_tier$;

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "current_credit_tier" "CreditTier" NOT NULL DEFAULT 'TIER_1',
  ADD COLUMN IF NOT EXISTS "accumulated_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "billing_period_key" VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "whatsapp_alerts_used" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ocr_pages_used" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "usage_meter_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "action_type" VARCHAR(64) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_cost_azn" DECIMAL(12,4) NOT NULL,
  "balance_after" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_meter_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "usage_meter_events_organization_id_created_at_idx"
  ON "usage_meter_events"("organization_id", "created_at");

DO $fk_usage$ BEGIN
  ALTER TABLE "usage_meter_events"
    ADD CONSTRAINT "usage_meter_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $fk_usage$;

ALTER TABLE "organization_subscriptions"
  ADD COLUMN IF NOT EXISTS "credit_tier" "CreditTier";

UPDATE "organization_subscriptions"
SET "credit_tier" = CASE
  WHEN "tier"::text = 'STARTER' THEN 'TIER_1'::"CreditTier"
  WHEN "tier"::text = 'BUSINESS' THEN 'TIER_2'::"CreditTier"
  WHEN "tier"::text = 'ENTERPRISE' THEN 'TIER_4'::"CreditTier"
  ELSE 'TIER_1'::"CreditTier"
END
WHERE "credit_tier" IS NULL;

ALTER TABLE "organization_subscriptions"
  ALTER COLUMN "credit_tier" SET DEFAULT 'TIER_1';

UPDATE "organization_subscriptions"
SET "credit_tier" = 'TIER_1'::"CreditTier"
WHERE "credit_tier" IS NULL;

ALTER TABLE "organization_subscriptions"
  ALTER COLUMN "credit_tier" SET NOT NULL;

UPDATE "organizations" o
SET "current_credit_tier" = COALESCE(
  (SELECT os."credit_tier" FROM "organization_subscriptions" os WHERE os."organization_id" = o."id"),
  'TIER_1'::"CreditTier"
);

ALTER TABLE "organization_subscriptions" DROP COLUMN IF EXISTS "tier";

DROP TYPE IF EXISTS "SubscriptionTier";
