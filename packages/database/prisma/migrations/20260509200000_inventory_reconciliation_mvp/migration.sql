-- Inventory reconciliation MVP: audit status machine, line discrepancy fields,
-- partial unique active reconciliation per warehouse, deprecate INVENTORY_COUNT doc type.
--
-- Idempotent where possible: a failed deploy may have committed early DDL before a later
-- statement errored (e.g. subquery in ALTER ... USING — fixed in step 6 via UPDATE).

-- 1) New enum for line discrepancy classification
DO $$ BEGIN
  CREATE TYPE "InventoryDiscrepancyKind" AS ENUM ('NONE', 'SURPLUS', 'SHORTAGE_WRITEOFF', 'SHORTAGE_EMPLOYEE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Replace InventoryAuditStatus (remove APPROVED, add COUNTING/REVIEW/COMPLETED/CANCELLED)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'InventoryAuditStatus'
      AND e.enumlabel = 'COUNTING'
  ) THEN
    RETURN;
  END IF;

  CREATE TYPE "InventoryAuditStatus_new" AS ENUM ('DRAFT', 'COUNTING', 'REVIEW', 'COMPLETED', 'CANCELLED');

  ALTER TABLE "inventory_audits"
    ALTER COLUMN "status" TYPE "InventoryAuditStatus_new"
    USING (
      CASE "status"::text
        WHEN 'APPROVED' THEN 'COMPLETED'::"InventoryAuditStatus_new"
        WHEN 'DRAFT' THEN 'DRAFT'::"InventoryAuditStatus_new"
        ELSE 'DRAFT'::"InventoryAuditStatus_new"
      END
    );

  DROP TYPE "InventoryAuditStatus";
  ALTER TYPE "InventoryAuditStatus_new" RENAME TO "InventoryAuditStatus";
END $$;

-- 3) inventory_audits: new columns
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "responsible_employee_id" UUID;
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "posted_transaction_id" UUID;

DO $$ BEGIN
  ALTER TABLE "inventory_audits"
    ADD CONSTRAINT "inventory_audits_responsible_employee_id_fkey"
    FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_audits"
    ADD CONSTRAINT "inventory_audits_posted_transaction_id_fkey"
    FOREIGN KEY ("posted_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "inventory_audits_org_wh_status_idx"
  ON "inventory_audits" ("organization_id", "warehouse_id", "status");

-- 4) inventory_audit_lines: discrepancy + accountable + posted amount + reason
ALTER TABLE "inventory_audit_lines"
  ADD COLUMN IF NOT EXISTS "discrepancy_kind" "InventoryDiscrepancyKind" NOT NULL DEFAULT 'NONE';
ALTER TABLE "inventory_audit_lines"
  ADD COLUMN IF NOT EXISTS "accountable_employee_id" UUID;
ALTER TABLE "inventory_audit_lines"
  ADD COLUMN IF NOT EXISTS "posted_amount_azn" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "inventory_audit_lines"
  ADD COLUMN IF NOT EXISTS "reason_note" TEXT;

DO $$ BEGIN
  ALTER TABLE "inventory_audit_lines"
    ADD CONSTRAINT "inventory_audit_lines_accountable_employee_id_fkey"
    FOREIGN KEY ("accountable_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_audit_lines"
    ADD CONSTRAINT "inventory_audit_lines_emp_consistency_chk"
    CHECK (
      ("discrepancy_kind"::text = 'SHORTAGE_EMPLOYEE' AND "accountable_employee_id" IS NOT NULL)
      OR ("discrepancy_kind"::text <> 'SHORTAGE_EMPLOYEE')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5) At most one active reconciliation (COUNTING or REVIEW) per warehouse per org
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_audits_active_per_warehouse_uidx"
  ON "inventory_audits" ("organization_id", "warehouse_id")
  WHERE "status" IN ('COUNTING', 'REVIEW') AND "deleted_at" IS NULL;

-- 6) Remove INVENTORY_COUNT from InventoryAdjustmentDocType
-- PostgreSQL forbids subqueries inside ALTER COLUMN ... USING; migrate via temp column + UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'InventoryAdjustmentDocType'
      AND e.enumlabel = 'INVENTORY_COUNT'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryAdjustmentDocType_new') THEN
    CREATE TYPE "InventoryAdjustmentDocType_new" AS ENUM ('WRITE_OFF', 'SURPLUS');
  END IF;

  ALTER TABLE "inventory_adjustments" DROP COLUMN IF EXISTS "doc_type_new";

  ALTER TABLE "inventory_adjustments" ADD COLUMN "doc_type_new" "InventoryAdjustmentDocType_new";

  UPDATE "inventory_adjustments" ia
  SET "doc_type_new" = CASE ia."doc_type"::text
    WHEN 'WRITE_OFF' THEN 'WRITE_OFF'::"InventoryAdjustmentDocType_new"
    WHEN 'SURPLUS' THEN 'SURPLUS'::"InventoryAdjustmentDocType_new"
    WHEN 'INVENTORY_COUNT' THEN (
      CASE
        WHEN COALESCE(
          (
            SELECT SUM(l."delta_quantity")
            FROM "inventory_adjustment_lines" l
            WHERE l."adjustment_id" = ia."id"
              AND l."deleted_at" IS NULL
          ),
          0
        ) > 0
        THEN 'SURPLUS'::"InventoryAdjustmentDocType_new"
        ELSE 'WRITE_OFF'::"InventoryAdjustmentDocType_new"
      END
    )
    ELSE 'WRITE_OFF'::"InventoryAdjustmentDocType_new"
  END;

  ALTER TABLE "inventory_adjustments" DROP COLUMN "doc_type";
  ALTER TABLE "inventory_adjustments" RENAME COLUMN "doc_type_new" TO "doc_type";
  ALTER TABLE "inventory_adjustments" ALTER COLUMN "doc_type" SET NOT NULL;

  DROP TYPE "InventoryAdjustmentDocType";
  ALTER TYPE "InventoryAdjustmentDocType_new" RENAME TO "InventoryAdjustmentDocType";
END $$;
