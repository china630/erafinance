-- Trial package fields on pricing_bundles
ALTER TABLE "pricing_bundles" ADD COLUMN IF NOT EXISTS "is_trial_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pricing_bundles" ADD COLUMN IF NOT EXISTS "trial_duration_days" INTEGER;
ALTER TABLE "pricing_bundles" ADD COLUMN IF NOT EXISTS "trial_quotas" JSONB;
CREATE INDEX IF NOT EXISTS "pricing_bundles_is_trial_default_idx" ON "pricing_bundles"("is_trial_default");

-- Referral program
CREATE TYPE "ReferralCommissionStatus" AS ENUM ('ACCRUED', 'PAID', 'CANCELLED');

CREATE TABLE "partners" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "owner_user_id" UUID,
    "is_corporate" BOOLEAN NOT NULL DEFAULT false,
    "fixed_rate_percent" DECIMAL(5,2),
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

ALTER TABLE "partners" ADD CONSTRAINT "partners_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "partner_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "signup_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "window_ends_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referrals_organization_id_key" ON "referrals"("organization_id");
CREATE INDEX "referrals_partner_id_idx" ON "referrals"("partner_id");
CREATE INDEX "referrals_window_ends_at_idx" ON "referrals"("window_ends_at");

ALTER TABLE "referrals" ADD CONSTRAINT "referrals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_commissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "referral_id" UUID NOT NULL,
    "subscription_invoice_id" UUID,
    "amount_azn" DECIMAL(19,4) NOT NULL,
    "rate_percent" DECIMAL(5,2) NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "status" "ReferralCommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_commissions_referral_id_period_year_period_month_key" ON "referral_commissions"("referral_id", "period_year", "period_month");
CREATE INDEX "referral_commissions_subscription_invoice_id_idx" ON "referral_commissions"("subscription_invoice_id");

ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_subscription_invoice_id_fkey" FOREIGN KEY ("subscription_invoice_id") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UserRole: PARTNER
ALTER TYPE "UserRole" ADD VALUE 'PARTNER';

-- Fixed assets: extra depreciation methods + columns
ALTER TYPE "FixedAssetDepreciationMethod" ADD VALUE 'REDUCING_BALANCE';
ALTER TYPE "FixedAssetDepreciationMethod" ADD VALUE 'UNITS_OF_PRODUCTION';

ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "total_expected_units" DECIMAL(19,4);
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "units_produced_total" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "declining_balance_rate" DECIMAL(5,4);
