-- Rollback wave 6 organizations.tax_id drop to keep API compile/runtime stable.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "tax_id" TEXT NOT NULL DEFAULT '__enc__org__rollback';

UPDATE "organizations"
SET "tax_id" = '__enc__org__' || REPLACE("id"::text, '-', '')
WHERE "tax_id" IS NULL
   OR "tax_id" = '__enc__org__rollback';

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_tax_id_key"
  ON "organizations"("tax_id");

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_tax_id_placeholder_chk"
  CHECK (LEFT("tax_id", 12) = '__enc__org__');
