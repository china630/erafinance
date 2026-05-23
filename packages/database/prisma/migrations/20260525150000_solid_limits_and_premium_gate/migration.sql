-- Hybrid limits + premium trial gate: CreditTier -> TariffTier (3 tiers), subscription columns.

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TariffTier') THEN
    CREATE TYPE "TariffTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');
  END IF;
END
$body$;

-- Map TIER_4 -> TIER_3 before enum swap
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_subscriptions' AND column_name = 'credit_tier'
  ) THEN
    UPDATE organization_subscriptions
    SET credit_tier = 'TIER_3'
    WHERE credit_tier::text = 'TIER_4';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'current_credit_tier'
  ) THEN
    UPDATE organizations
    SET current_credit_tier = 'TIER_3'
    WHERE current_credit_tier::text = 'TIER_4';
  END IF;
END
$body$;

ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS current_tier "TariffTier",
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS activated_premium_modules TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS billing_period_key VARCHAR(7);

DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_subscriptions' AND column_name = 'credit_tier'
  ) THEN
    UPDATE organization_subscriptions
    SET current_tier = CASE credit_tier::text
      WHEN 'TIER_4' THEN 'TIER_3'::"TariffTier"
      WHEN 'TIER_3' THEN 'TIER_3'::"TariffTier"
      WHEN 'TIER_2' THEN 'TIER_2'::"TariffTier"
      ELSE 'TIER_1'::"TariffTier"
    END
    WHERE current_tier IS NULL;
  ELSE
    UPDATE organization_subscriptions
    SET current_tier = 'TIER_1'::"TariffTier"
    WHERE current_tier IS NULL;
  END IF;
END
$body$;

UPDATE organization_subscriptions
SET trial_expires_at = expires_at
WHERE trial_expires_at IS NULL AND is_trial = true AND expires_at IS NOT NULL;

UPDATE organization_subscriptions
SET is_trial = true
WHERE is_trial = false AND trial_expires_at IS NOT NULL AND trial_expires_at > NOW();

ALTER TABLE organization_subscriptions
  ALTER COLUMN current_tier SET DEFAULT 'TIER_1',
  ALTER COLUMN current_tier SET NOT NULL;

ALTER TABLE organization_subscriptions
  DROP COLUMN IF EXISTS credit_tier;

DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditTier') THEN
  ALTER TABLE organizations
    ALTER COLUMN current_credit_tier TYPE "TariffTier"
    USING (
      CASE current_credit_tier::text
        WHEN 'TIER_4' THEN 'TIER_3'::"TariffTier"
        WHEN 'TIER_3' THEN 'TIER_3'::"TariffTier"
        WHEN 'TIER_2' THEN 'TIER_2'::"TariffTier"
        ELSE 'TIER_1'::"TariffTier"
      END
    );
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END
$body$;

DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditTier') THEN
    DROP TYPE "CreditTier";
  END IF;
EXCEPTION
  WHEN dependent_objects_still_exist THEN NULL;
END
$body$;
