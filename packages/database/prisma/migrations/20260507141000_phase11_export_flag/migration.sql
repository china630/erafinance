ALTER TABLE "counterparties"
ADD COLUMN "country" TEXT;

ALTER TABLE "invoices"
ADD COLUMN "is_international" BOOLEAN NOT NULL DEFAULT false;
