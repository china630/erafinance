-- NAS plans: OrganizationKind replaces CoaTemplateProfile + TemplateGroup on catalog rows.
-- TemplateAccount / ChartOfAccountsEntry: composite unique (kind, code) — same numeric code may differ by kind.

CREATE TYPE "OrganizationKind" AS ENUM ('COMMERCIAL', 'BUDGET', 'NCO');

-- organizations.kind (from coa_template_profile + payroll settings hint)
ALTER TABLE "organizations" ADD COLUMN "kind" "OrganizationKind";

UPDATE "organizations" SET "kind" = CASE
  WHEN COALESCE("settings"::jsonb->>'templateGroup', '') = 'GOVERNMENT' THEN 'BUDGET'::"OrganizationKind"
  ELSE 'COMMERCIAL'::"OrganizationKind"
END;

ALTER TABLE "organizations" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "kind" SET DEFAULT 'COMMERCIAL'::"OrganizationKind";

DROP INDEX IF EXISTS "organizations_coa_template_profile_idx";
ALTER TABLE "organizations" DROP COLUMN "coa_template_profile";

CREATE INDEX "organizations_kind_idx" ON "organizations"("kind");

-- template_accounts: per-kind rows; drop global unique on code
ALTER TABLE "template_accounts" ADD COLUMN "kind" "OrganizationKind" NOT NULL DEFAULT 'COMMERCIAL';

ALTER TABLE "template_accounts" DROP COLUMN "template_groups";

DROP TYPE "CoaTemplateProfile";

DROP INDEX IF EXISTS "template_accounts_code_key";

CREATE UNIQUE INDEX "template_accounts_kind_code_key" ON "template_accounts" ("kind", "code");

-- chart_of_accounts_entries
ALTER TABLE "chart_of_accounts_entries" ADD COLUMN "kind" "OrganizationKind" NOT NULL DEFAULT 'COMMERCIAL';

UPDATE "chart_of_accounts_entries" SET "kind" = CASE "template_group"::text
  WHEN 'GOVERNMENT' THEN 'BUDGET'::"OrganizationKind"
  WHEN 'SMALL_BUSINESS' THEN 'COMMERCIAL'::"OrganizationKind"
  ELSE 'COMMERCIAL'::"OrganizationKind"
END;

-- Multiple template_group rows can map to the same kind, producing duplicate (kind, code).
-- Keep the lexicographically smallest id per (kind, code); repoint tenant accounts, then delete extras.
UPDATE "accounts" AS a
SET "chart_entry_id" = sub.keep_id
FROM (
  SELECT c.id AS dup_id,
    (
      SELECT c2.id
      FROM "chart_of_accounts_entries" c2
      WHERE c2.kind = c.kind AND c2.code = c.code
      ORDER BY c2.id
      LIMIT 1
    ) AS keep_id
  FROM "chart_of_accounts_entries" c
) AS sub
WHERE a."chart_entry_id" = sub.dup_id
  AND sub.dup_id <> sub.keep_id;

DELETE FROM "chart_of_accounts_entries" AS c
WHERE EXISTS (
  SELECT 1
  FROM "chart_of_accounts_entries" AS keep
  WHERE keep.kind = c.kind
    AND keep.code = c.code
    AND keep.id < c.id
);

DROP INDEX IF EXISTS "chart_of_accounts_entries_template_group_code_key";
ALTER TABLE "chart_of_accounts_entries" DROP COLUMN "template_group";

CREATE UNIQUE INDEX "chart_of_accounts_entries_kind_code_key" ON "chart_of_accounts_entries" ("kind", "code");

DROP TYPE "TemplateGroup";
