-- Phase 10: integration sync status columns + run log table

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationSyncStatus') THEN
    CREATE TYPE "IntegrationSyncStatus" AS ENUM ('NOT_SYNCED', 'IN_PROGRESS', 'SYNCED', 'ERROR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationPortal') THEN
    CREATE TYPE "IntegrationPortal" AS ENUM ('DVX', 'EMAS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationTransport') THEN
    CREATE TYPE "IntegrationTransport" AS ENUM ('RPA_WIDGET', 'EXCEL_IMPORT');
  END IF;
END $$;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "dvx_sync_status" "IntegrationSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
  ADD COLUMN IF NOT EXISTS "dvx_synced_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "dvx_sync_error" TEXT,
  ADD COLUMN IF NOT EXISTS "dvx_external_id" TEXT;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "emas_sync_status" "IntegrationSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
  ADD COLUMN IF NOT EXISTS "emas_synced_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "emas_sync_error" TEXT,
  ADD COLUMN IF NOT EXISTS "emas_external_id" TEXT;

CREATE TABLE IF NOT EXISTS "integration_sync_runs" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "portal" "IntegrationPortal" NOT NULL,
  "flow" TEXT NOT NULL,
  "transport" "IntegrationTransport" NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ(6),
  "total_count" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "triggered_by_user_id" UUID,
  "notes" JSONB,
  CONSTRAINT "integration_sync_runs_org_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "integration_sync_runs_org_portal_started_idx"
  ON "integration_sync_runs" ("organization_id", "portal", "started_at");
