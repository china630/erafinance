-- Org bank accounts registry (Settings -> Bank Accounts)

DO $$ BEGIN
  CREATE TYPE "BankAccountType" AS ENUM ('MAIN', 'SALARY', 'CARD', 'TENDER', 'CREDIT', 'VAT_DEPOSIT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "organization_bank_accounts"
  ALTER COLUMN "account_number" DROP NOT NULL;

ALTER TABLE "organization_bank_accounts"
  ALTER COLUMN "currency" TYPE TEXT USING "currency"::text,
  ALTER COLUMN "currency" SET DEFAULT 'AZN';

ALTER TABLE "organization_bank_accounts"
  ADD COLUMN IF NOT EXISTS "ledger_account_code" TEXT,
  ADD COLUMN IF NOT EXISTS "account_type" "BankAccountType" NOT NULL DEFAULT 'MAIN',
  ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

UPDATE "organization_bank_accounts"
SET "iban" = COALESCE(NULLIF(TRIM("iban"), ''), NULLIF(TRIM("account_number"), ''))
WHERE "iban" IS NULL OR TRIM("iban") = '';

UPDATE "organization_bank_accounts"
SET "ledger_account_code" = '221'
WHERE "ledger_account_code" IS NULL OR TRIM("ledger_account_code") = '';

ALTER TABLE "organization_bank_accounts"
  ALTER COLUMN "iban" SET NOT NULL,
  ALTER COLUMN "ledger_account_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_bank_accounts_org_iban_uidx"
  ON "organization_bank_accounts"("organization_id", "iban");

CREATE INDEX IF NOT EXISTS "organization_bank_accounts_org_arch_created_idx"
  ON "organization_bank_accounts"("organization_id", "is_archived", "created_at");

CREATE INDEX IF NOT EXISTS "organization_bank_accounts_org_type_idx"
  ON "organization_bank_accounts"("organization_id", "account_type");

CREATE INDEX IF NOT EXISTS "organization_bank_accounts_org_ledger_idx"
  ON "organization_bank_accounts"("organization_id", "ledger_account_code");
