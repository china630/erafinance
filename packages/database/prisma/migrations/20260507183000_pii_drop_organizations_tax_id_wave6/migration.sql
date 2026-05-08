-- PII cutover wave 6:
-- drop legacy plaintext organizations.tax_id column.

ALTER TABLE "organizations"
  DROP CONSTRAINT IF EXISTS "organizations_tax_id_placeholder_chk";

DROP INDEX IF EXISTS "organizations_tax_id_key";

ALTER TABLE "organizations"
  DROP COLUMN IF EXISTS "tax_id";
