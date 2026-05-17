-- Council of Elders (compliance_pro multi-agent verdicts)

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouncilTriggerSource') THEN
    CREATE TYPE "CouncilTriggerSource" AS ENUM (
      'MANUAL',
      'TAX_LIMIT_HIT',
      'HIGH_VALUE_TRANSACTION',
      'VOEN_RISKY_COUNTERPARTY',
      'WEEKLY_CRON',
      'PRE_TAX_CRON'
    );
  END IF;
END $t$;

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouncilTargetEntityType') THEN
    CREATE TYPE "CouncilTargetEntityType" AS ENUM (
      'ORGANIZATION',
      'RISK_AUDIT',
      'INVOICE',
      'CASH_ORDER',
      'LEDGER_PERIOD'
    );
  END IF;
END $t$;

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouncilVerdictStatus') THEN
    CREATE TYPE "CouncilVerdictStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
  END IF;
END $t$;

CREATE TABLE IF NOT EXISTS "council_verdicts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "risk_audit_id" UUID,
    "trigger_source" "CouncilTriggerSource" NOT NULL,
    "target_entity_type" "CouncilTargetEntityType" NOT NULL,
    "target_entity_id" UUID,
    "target_entity_label" TEXT NOT NULL,
    "elder_verdicts" JSONB NOT NULL DEFAULT '{}',
    "final_score" INTEGER,
    "final_severity" "RiskSeverity",
    "summary_az" TEXT,
    "summary_ru" TEXT,
    "suggested_action" TEXT,
    "status" "CouncilVerdictStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "dedupe_key" TEXT,
    "requested_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "council_verdicts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "council_verdicts_org_dedupe_uidx"
  ON "council_verdicts"("organization_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "council_verdicts_org_status_idx"
  ON "council_verdicts"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "council_verdicts_org_risk_audit_idx"
  ON "council_verdicts"("organization_id", "risk_audit_id");

DO $t$ BEGIN
  ALTER TABLE "council_verdicts" ADD CONSTRAINT "council_verdicts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $t$;

DO $t$ BEGIN
  ALTER TABLE "council_verdicts" ADD CONSTRAINT "council_verdicts_risk_audit_id_fkey"
    FOREIGN KEY ("risk_audit_id") REFERENCES "risk_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $t$;
