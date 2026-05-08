-- WA0001 (stage 1): add encrypted storage and blind index columns for
-- organization VÖEN, without breaking current plaintext read-path yet.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "tax_id_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "tax_id_blind_index" TEXT;

CREATE INDEX IF NOT EXISTS "organizations_tax_id_blind_idx"
  ON "organizations"("tax_id_blind_index");
