CREATE TYPE "OcrJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'ERROR');

CREATE TABLE "ocr_jobs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "status" "OcrJobStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL,
  "file_key" TEXT NOT NULL,
  "file_mime" TEXT NOT NULL,
  "result_json" JSONB,
  "error_json" JSONB,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "triggered_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ocr_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customs_declarations" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "bgd_number" TEXT NOT NULL,
  "bgd_date" DATE NOT NULL,
  "currency" TEXT NOT NULL,
  "customs_value_azn" DECIMAL(19,4) NOT NULL,
  "customs_duty_azn" DECIMAL(19,4) NOT NULL,
  "customs_vat_azn" DECIMAL(19,4) NOT NULL,
  "fees_azn" DECIMAL(19,4) NOT NULL,
  "attachment_key" TEXT,
  "linked_purchase_transaction_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customs_declarations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customs_declarations_organization_id_bgd_number_key"
ON "customs_declarations"("organization_id", "bgd_number");
CREATE INDEX "customs_declarations_organization_id_bgd_date_idx"
ON "customs_declarations"("organization_id", "bgd_date");
CREATE INDEX "ocr_jobs_organization_id_status_created_at_idx"
ON "ocr_jobs"("organization_id", "status", "created_at");

ALTER TABLE "ocr_jobs"
ADD CONSTRAINT "ocr_jobs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customs_declarations"
ADD CONSTRAINT "customs_declarations_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customs_declarations"
ADD CONSTRAINT "customs_declarations_linked_purchase_transaction_id_fkey"
FOREIGN KEY ("linked_purchase_transaction_id") REFERENCES "transactions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
