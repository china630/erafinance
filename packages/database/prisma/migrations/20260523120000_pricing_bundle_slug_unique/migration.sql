-- Replace partial unique index on pricing_bundles.slug (breaks Prisma upsert) with full unique index.
-- PostgreSQL allows multiple NULL slug values under a standard UNIQUE index.

DROP INDEX IF EXISTS "pricing_bundles_slug_key";

CREATE UNIQUE INDEX IF NOT EXISTS "pricing_bundles_slug_key"
  ON "pricing_bundles" ("slug");
