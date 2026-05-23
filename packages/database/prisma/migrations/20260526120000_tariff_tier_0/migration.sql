-- Step 1/2: add TIER_0 to TariffTier (must commit before using the new label).
-- Default is applied in 20260526120001_tariff_tier_0_default (separate transaction).

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TariffTier' AND e.enumlabel = 'TIER_0'
  ) THEN
    ALTER TYPE "TariffTier" ADD VALUE 'TIER_0' BEFORE 'TIER_1';
  END IF;
END
$body$;
