-- Risk & Compliance (ERM) system-generated alerts
-- Idempotent: safe if enums/table were created earlier (e.g. db push or partial apply).

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskAuditType') THEN
    CREATE TYPE "RiskAuditType" AS ENUM ('TAX', 'FRAUD', 'COMPLIANCE');
  END IF;
END $t$;

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskSeverity') THEN
    CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
  END IF;
END $t$;

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskAuditStatus') THEN
    CREATE TYPE "RiskAuditStatus" AS ENUM ('PENDING', 'MITIGATED', 'IGNORED');
  END IF;
END $t$;

-- Stale dev state: table existed without ERM columns (e.g. drift / partial apply). Replace shell.
DO $t$ BEGIN
  IF to_regclass('public.risk_audits') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'risk_audits' AND column_name = 'dedupe_key'
     ) THEN
    DROP TABLE "risk_audits" CASCADE;
  END IF;
END $t$;

CREATE TABLE IF NOT EXISTS "risk_audits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "type" "RiskAuditType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "status" "RiskAuditStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "dedupe_key" TEXT NOT NULL,
    "mitigation_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "risk_audits_org_dedupe_uidx" ON "risk_audits"("organization_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "risk_audits_org_status_sev_idx" ON "risk_audits"("organization_id", "status", "severity");
CREATE INDEX IF NOT EXISTS "risk_audits_org_type_idx" ON "risk_audits"("organization_id", "type");

DO $t$ BEGIN
  ALTER TABLE "risk_audits" ADD CONSTRAINT "risk_audits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $t$;
