-- WA0019: block duplicate organization registration by VÖEN (plaintext column era).
-- After PII wave 6c, `organizations.tax_id` is dropped; uniqueness is enforced via
-- `tax_id_blind_index` (see 20260509153000_org_tax_id_blind_unique). Keep this step
-- idempotent for DBs that still had `tax_id` when this migration was introduced.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'tax_id'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "organizations_tax_id_key"
      ON "organizations"("tax_id");
  END IF;
END $$;
