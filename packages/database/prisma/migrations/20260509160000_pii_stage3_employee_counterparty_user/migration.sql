-- Encryption-at-rest stage 3: employee/counterparty/user PII mirrored
-- into encrypted payload + blind index columns for future plaintext cutover.

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "fin_code_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "fin_code_blind_index" TEXT,
  ADD COLUMN IF NOT EXISTS "first_name_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "last_name_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "voen_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "voen_blind_index" TEXT;

ALTER TABLE "counterparties"
  ADD COLUMN IF NOT EXISTS "name_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "tax_id_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "tax_id_blind_index" TEXT;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "full_name_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "first_name_cipher" TEXT,
  ADD COLUMN IF NOT EXISTS "last_name_cipher" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "employees_org_fin_blind_uidx"
  ON "employees"("organization_id", "fin_code_blind_index")
  WHERE "fin_code_blind_index" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "employees_org_voen_blind_idx"
  ON "employees"("organization_id", "voen_blind_index");

CREATE UNIQUE INDEX IF NOT EXISTS "counterparties_org_tax_blind_uidx"
  ON "counterparties"("organization_id", "tax_id_blind_index")
  WHERE "tax_id_blind_index" IS NOT NULL;
