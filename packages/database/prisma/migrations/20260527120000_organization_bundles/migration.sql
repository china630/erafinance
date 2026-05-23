-- Organization marketplace bundles (post-paid, deduped billing vs à la carte modules)

CREATE TABLE IF NOT EXISTS "organization_bundles" (
    "organization_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending_deactivation" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "access_until" TIMESTAMPTZ(6),

    CONSTRAINT "organization_bundles_pkey" PRIMARY KEY ("organization_id","bundle_id")
);

DO $org_bundle_fk_org$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_bundles_organization_id_fkey'
  ) THEN
    ALTER TABLE "organization_bundles"
      ADD CONSTRAINT "organization_bundles_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $org_bundle_fk_org$;

DO $org_bundle_fk_bundle$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_bundles_bundle_id_fkey'
  ) THEN
    ALTER TABLE "organization_bundles"
      ADD CONSTRAINT "organization_bundles_bundle_id_fkey"
      FOREIGN KEY ("bundle_id") REFERENCES "pricing_bundles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $org_bundle_fk_bundle$;

CREATE INDEX IF NOT EXISTS "organization_bundles_organization_id_idx"
  ON "organization_bundles"("organization_id");
