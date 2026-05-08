-- WA0001 (stage 2): make blind index the primary uniqueness guard.
-- NULL values are allowed during migration windows; unique enforced for
-- populated rows.

DROP INDEX IF EXISTS "organizations_tax_id_blind_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_tax_id_blind_index_key"
  ON "organizations"("tax_id_blind_index")
  WHERE "tax_id_blind_index" IS NOT NULL;
