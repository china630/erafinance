-- Phase: enrich `bank_glossary` and `bank_branches` so the `docs/banks.md`
-- importer can carry correspondent IBAN, SWIFT, head-office contacts and
-- per-branch phone arrays. Idempotent: every column is added with IF NOT
-- EXISTS, and indexes are created with IF NOT EXISTS.

ALTER TABLE "bank_glossary"
  ADD COLUMN IF NOT EXISTS "correspondent_iban" TEXT,
  ADD COLUMN IF NOT EXISTS "swift"              TEXT,
  ADD COLUMN IF NOT EXISTS "head_phones"        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "head_address"       TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "bank_glossary_correspondent_iban_key"
  ON "bank_glossary"("correspondent_iban")
  WHERE "correspondent_iban" IS NOT NULL;

ALTER TABLE "bank_branches"
  ADD COLUMN IF NOT EXISTS "phones"         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "is_head_office" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "bank_branches_bank_head_office_idx"
  ON "bank_branches"("bank_id", "is_head_office");
