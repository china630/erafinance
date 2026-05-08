-- Approval workflow (PRD §5.E.3 / TZ §12.8.3)

CREATE TYPE "ApprovalDocumentType" AS ENUM (
  'CASH_ORDER',
  'PURCHASE_INVOICE',
  'PAYROLL_RUN',
  'BANK_MANUAL_ENTRY'
);

CREATE TYPE "ApprovalRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "ApprovalStepDecision" AS ENUM (
  'APPROVED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS "approval_policies" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "document_type" "ApprovalDocumentType" NOT NULL,
    "amount_from" DECIMAL(19,4),
    "amount_to" DECIMAL(19,4),
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "approver_roles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[],
    "require_owner" BOOLEAN NOT NULL DEFAULT false,
    "require_director" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_policies_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "approval_policies_org_doc_idx"
  ON "approval_policies" ("organization_id", "document_type", "is_active");

CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "document_type" "ApprovalDocumentType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_user_id" UUID NOT NULL,
    "current_step_no" INTEGER NOT NULL DEFAULT 1,
    "total_steps" INTEGER NOT NULL,
    "final_decision_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_requests_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approval_requests_requested_by_user_id_fkey"
      FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_requests_org_doc_entity_uidx"
  ON "approval_requests" ("organization_id", "document_type", "entity_id")
  WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "approval_requests_org_status_idx"
  ON "approval_requests" ("organization_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "approval_steps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "request_id" UUID NOT NULL,
    "step_no" INTEGER NOT NULL,
    "assigned_role" "UserRole" NOT NULL,
    "approver_user_id" UUID,
    "decision" "ApprovalStepDecision",
    "comment" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "approval_steps_request_id_fkey"
      FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approval_steps_approver_user_id_fkey"
      FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "approval_steps_request_id_step_no_key" UNIQUE ("request_id", "step_no"),
    CONSTRAINT "approval_steps_reject_requires_comment_chk" CHECK (
      ("decision" IS DISTINCT FROM 'REJECTED'::"ApprovalStepDecision")
      OR ("comment" IS NOT NULL AND length(trim("comment")) > 0)
    )
);

CREATE INDEX IF NOT EXISTS "approval_steps_request_idx" ON "approval_steps" ("request_id", "step_no");
