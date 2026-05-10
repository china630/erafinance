-- Painted door / early-access funnel for industry vertical validation

CREATE TYPE "EarlyAccessModuleKey" AS ENUM ('RETAIL_ECOM', 'LOGISTICS_CUSTOMS', 'CONSTRUCTION', 'CRM_WHATSAPP');

CREATE TYPE "EarlyAccessEventType" AS ENUM ('VIEW_CLICK', 'MODAL_OPEN', 'MODAL_CLOSE', 'CTA_CLICK', 'SURVEY_SUBMIT');

CREATE TABLE "early_access_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "module_key" "EarlyAccessModuleKey" NOT NULL,
    "event_type" "EarlyAccessEventType" NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "subscription_tier" VARCHAR(32),
    "industry_snapshot" VARCHAR(64),
    "session_id" UUID NOT NULL,
    "duration_ms" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_ip" VARCHAR(64),
    "user_agent" VARCHAR(512),

    CONSTRAINT "early_access_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "early_access_signups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "module_key" "EarlyAccessModuleKey" NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_tier" VARCHAR(32),
    "industry" VARCHAR(64),
    "survey_answer" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_access_signups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "early_access_threshold_alerts" (
    "module_key" "EarlyAccessModuleKey" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fired_to_count" INTEGER NOT NULL,

    CONSTRAINT "early_access_threshold_alerts_pkey" PRIMARY KEY ("module_key","threshold")
);

CREATE INDEX "early_access_events_module_key_created_at_idx" ON "early_access_events"("module_key", "created_at");

CREATE INDEX "early_access_events_organization_id_module_key_idx" ON "early_access_events"("organization_id", "module_key");

CREATE INDEX "early_access_events_session_id_idx" ON "early_access_events"("session_id");

CREATE UNIQUE INDEX "early_access_signups_module_key_organization_id_key" ON "early_access_signups"("module_key", "organization_id");

CREATE INDEX "early_access_signups_organization_id_idx" ON "early_access_signups"("organization_id");

CREATE INDEX "early_access_signups_module_key_created_at_idx" ON "early_access_signups"("module_key", "created_at");

ALTER TABLE "early_access_events" ADD CONSTRAINT "early_access_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "early_access_events" ADD CONSTRAINT "early_access_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "early_access_signups" ADD CONSTRAINT "early_access_signups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "early_access_signups" ADD CONSTRAINT "early_access_signups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
