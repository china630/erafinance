-- Advanced bank registry: isFrozen + account type normalization

ALTER TABLE "organization_bank_accounts"
  ADD COLUMN IF NOT EXISTS "is_frozen" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankAccountType') THEN
    ALTER TYPE "BankAccountType" RENAME TO "BankAccountType_old";
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BankAccountType" AS ENUM (
    'MAIN',
    'SALARY',
    'CARD',
    'TENDER',
    'CREDIT',
    'VAT_DEPOSIT'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE "organization_bank_accounts"
  ALTER COLUMN "account_type" DROP DEFAULT;

ALTER TABLE "organization_bank_accounts"
  ALTER COLUMN "account_type" TYPE "BankAccountType"
  USING (
    CASE
      WHEN "account_type"::text = 'OTHER' THEN 'MAIN'::"BankAccountType"
      ELSE "account_type"::text::"BankAccountType"
    END
  );

ALTER TABLE "organization_bank_accounts"
  ALTER COLUMN "account_type" SET DEFAULT 'MAIN';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankAccountType_old') THEN
    DROP TYPE "BankAccountType_old";
  END IF;
END $$;
