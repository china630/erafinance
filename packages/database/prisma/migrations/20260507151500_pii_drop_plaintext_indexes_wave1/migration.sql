-- PII cutover wave 1:
-- remove legacy plaintext index/unique dependencies where blind-index guards already exist.

DROP INDEX IF EXISTS "employees_organization_id_fin_code_key";
DROP INDEX IF EXISTS "employees_org_fin_code_key";

DROP INDEX IF EXISTS "counterparties_organization_id_tax_id_idx";
DROP INDEX IF EXISTS "counterparties_org_tax_id_idx";
