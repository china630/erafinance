-- WA0019: block duplicate organization registration by VÖEN.
-- Keep DB-level guard even if service validation is bypassed.

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_tax_id_key"
  ON "organizations"("tax_id");
