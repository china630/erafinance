-- Dispute & Recovery: dual approval, ownership disputes, security state, snapshots, rollback records.

CREATE TYPE "DualApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED');
CREATE TYPE "DisputeStatus" AS ENUM ('EVIDENCE_REQUIRED', 'EVIDENCE_REVIEW', 'INCUMBENT_NOTIFIED', 'COOLDOWN', 'APPROVED', 'REJECTED', 'EXECUTED', 'REVERTED');
CREATE TYPE "DisputeSeverity" AS ENUM ('SOFT', 'HARD');
CREATE TYPE "SecurityMode" AS ENUM ('NORMAL', 'DISPUTE', 'POST_TRANSFER_LOCK', 'ROLLBACK_IN_PROGRESS', 'HARD_BLOCK_PLATFORM');
CREATE TYPE "TenantRollbackStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ABORTED');

CREATE TABLE "dual_approval_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "purpose" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "requester_id" UUID NOT NULL,
    "approver_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "status" "DualApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "executed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dual_approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ownership_disputes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "claimant_user_id" UUID NOT NULL,
    "incumbent_user_id" UUID NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'EVIDENCE_REQUIRED',
    "severity" "DisputeSeverity" NOT NULL DEFAULT 'SOFT',
    "evidence_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "verified_against" JSONB,
    "cooldown_ends_at" TIMESTAMPTZ(6),
    "approval_request_id" UUID,
    "legal_case_ref" TEXT,
    "signed_certificate_key" TEXT,
    "counter_claim_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMPTZ(6),
    CONSTRAINT "ownership_disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_security_states" (
    "organization_id" UUID NOT NULL,
    "mode" "SecurityMode" NOT NULL DEFAULT 'NORMAL',
    "lock_until" TIMESTAMPTZ(6),
    "active_dispute_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_security_states_pkey" PRIMARY KEY ("organization_id")
);

CREATE TABLE "organization_data_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "taken_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "triggered_by_user_id" UUID,
    CONSTRAINT "organization_data_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_rollback_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "status" "TenantRollbackStatus" NOT NULL DEFAULT 'PENDING',
    "progress_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "tenant_rollback_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dual_approval_requests_status_expires_at_idx" ON "dual_approval_requests"("status", "expires_at");
CREATE INDEX "ownership_disputes_organization_id_status_idx" ON "ownership_disputes"("organization_id", "status");
CREATE INDEX "organization_data_snapshots_organization_id_taken_at_idx" ON "organization_data_snapshots"("organization_id", "taken_at");
CREATE INDEX "tenant_rollback_records_organization_id_created_at_idx" ON "tenant_rollback_records"("organization_id", "created_at");

ALTER TABLE "dual_approval_requests" ADD CONSTRAINT "dual_approval_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ownership_disputes" ADD CONSTRAINT "ownership_disputes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ownership_disputes" ADD CONSTRAINT "ownership_disputes_claimant_user_id_fkey" FOREIGN KEY ("claimant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ownership_disputes" ADD CONSTRAINT "ownership_disputes_incumbent_user_id_fkey" FOREIGN KEY ("incumbent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ownership_disputes" ADD CONSTRAINT "ownership_disputes_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "dual_approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_security_states" ADD CONSTRAINT "organization_security_states_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_security_states" ADD CONSTRAINT "organization_security_states_active_dispute_id_fkey" FOREIGN KEY ("active_dispute_id") REFERENCES "ownership_disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_data_snapshots" ADD CONSTRAINT "organization_data_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_data_snapshots" ADD CONSTRAINT "organization_data_snapshots_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_rollback_records" ADD CONSTRAINT "tenant_rollback_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_rollback_records" ADD CONSTRAINT "tenant_rollback_records_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "organization_data_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
