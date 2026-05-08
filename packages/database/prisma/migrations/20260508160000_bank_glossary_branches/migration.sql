-- Phase: System bank glossary (`bank_glossary`) and branches (`bank_branches`)
-- + FK on `organization_bank_accounts.bank_branch_id` for auto-generation of
-- NAS subaccount 221.<bank_code>.<seq> in AccountingService.

-- CreateTable: bank_glossary (system-level, no organization_id)
CREATE TABLE IF NOT EXISTS "bank_glossary" (
  "id"         UUID NOT NULL DEFAULT uuid_generate_v4(),
  "name_az"    TEXT NOT NULL,
  "voen"       TEXT NOT NULL,
  "code"       CHAR(2) NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_glossary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_glossary_voen_key" ON "bank_glossary"("voen");
CREATE UNIQUE INDEX IF NOT EXISTS "bank_glossary_code_key" ON "bank_glossary"("code");

-- CreateTable: bank_branches (FK -> bank_glossary)
CREATE TABLE IF NOT EXISTS "bank_branches" (
  "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
  "bank_id"     UUID NOT NULL,
  "branch_code" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "swift"       TEXT,
  "address"     TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_branches_bank_branch_code_uidx"
  ON "bank_branches"("bank_id", "branch_code");
CREATE INDEX IF NOT EXISTS "bank_branches_bank_idx"
  ON "bank_branches"("bank_id");

ALTER TABLE "bank_branches"
  ADD CONSTRAINT "bank_branches_bank_id_fkey"
  FOREIGN KEY ("bank_id") REFERENCES "bank_glossary"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Link OrganizationBankAccount -> BankBranch (nullable, SetNull on branch delete)
ALTER TABLE "organization_bank_accounts"
  ADD COLUMN IF NOT EXISTS "bank_branch_id" UUID;

CREATE INDEX IF NOT EXISTS "organization_bank_accounts_bank_branch_idx"
  ON "organization_bank_accounts"("bank_branch_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_bank_accounts_bank_branch_id_fkey'
  ) THEN
    ALTER TABLE "organization_bank_accounts"
      ADD CONSTRAINT "organization_bank_accounts_bank_branch_id_fkey"
      FOREIGN KEY ("bank_branch_id") REFERENCES "bank_branches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
