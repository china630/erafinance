-- PII cutover wave 5b:
-- final drop legacy plaintext counterparties.name / counterparties.tax_id.

ALTER TABLE "counterparties"
  DROP CONSTRAINT IF EXISTS "counterparties_tax_id_placeholder_chk";

ALTER TABLE "counterparties"
  DROP CONSTRAINT IF EXISTS "counterparties_name_placeholder_chk";

ALTER TABLE "counterparties"
  DROP COLUMN IF EXISTS "tax_id",
  DROP COLUMN IF EXISTS "name";
