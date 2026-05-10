-- Rename OrganizationKind value NCO -> NGO and add legal-form fields.

ALTER TYPE "OrganizationKind" RENAME VALUE 'NCO' TO 'NGO';

ALTER TABLE "organizations"
  ADD COLUMN "legal_form" "CounterpartyLegalForm" NOT NULL DEFAULT 'LLC';

UPDATE "organizations"
SET "legal_form" = CASE "kind"
  WHEN 'BUDGET'::"OrganizationKind" THEN 'STATE_AGENCY'::"CounterpartyLegalForm"
  WHEN 'NGO'::"OrganizationKind" THEN 'NGO'::"CounterpartyLegalForm"
  ELSE 'LLC'::"CounterpartyLegalForm"
END
WHERE "legal_form" IS NULL;

ALTER TABLE "global_company_directory"
  ADD COLUMN "legal_form" "CounterpartyLegalForm";

ALTER TABLE "global_counterparties"
  ADD COLUMN "legal_form" "CounterpartyLegalForm";
