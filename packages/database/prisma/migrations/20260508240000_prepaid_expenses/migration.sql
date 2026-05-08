-- Prepaid expenses (РБП) — PRD §5.E.5 / TZ §12.8.5 (MVP tables)

CREATE TYPE "PrepaidExpenseStatus" AS ENUM (
  'ACTIVE',
  'FULLY_AMORTIZED',
  'CANCELLED'
);

CREATE TYPE "PrepaidExpenseScheduleStatus" AS ENUM (
  'PENDING',
  'POSTED',
  'SKIPPED_CLOSED'
);

CREATE TABLE IF NOT EXISTS "prepaid_expenses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "counterparty_id" UUID,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "monthly_amount" DECIMAL(19,4) NOT NULL,
    "status" "PrepaidExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "expense_account_code" TEXT NOT NULL DEFAULT '731',
    "prepaid_account_code" TEXT NOT NULL DEFAULT '133',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prepaid_expenses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prepaid_expenses_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prepaid_expenses_counterparty_id_fkey"
      FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "prepaid_expenses_org_status_idx"
  ON "prepaid_expenses" ("organization_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "prepaid_expense_schedules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "prepaid_expense_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" "PrepaidExpenseScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "posted_transaction_id" UUID,
    CONSTRAINT "prepaid_expense_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prepaid_expense_schedules_prepaid_expense_id_fkey"
      FOREIGN KEY ("prepaid_expense_id") REFERENCES "prepaid_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prepaid_expense_schedules_posted_transaction_id_fkey"
      FOREIGN KEY ("posted_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "prepaid_expense_schedules_prepaid_expense_id_period_key" UNIQUE ("prepaid_expense_id", "period")
);

CREATE INDEX IF NOT EXISTS "prepaid_expense_schedules_period_idx"
  ON "prepaid_expense_schedules" ("prepaid_expense_id", "period");
