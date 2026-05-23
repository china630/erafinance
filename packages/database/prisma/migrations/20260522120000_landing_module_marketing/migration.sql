-- Landing module marketing content + PricingBundle.slug

CREATE TABLE IF NOT EXISTS "landing_module_marketing" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "module_slug" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "names" JSONB NOT NULL,
  "descriptions" JSONB NOT NULL,
  "tasks" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "landing_module_marketing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "landing_module_marketing_module_slug_key"
  ON "landing_module_marketing" ("module_slug");

ALTER TABLE "pricing_bundles" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Full unique index (not partial): Prisma upsert on `slug` requires ON CONFLICT (slug).
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_bundles_slug_key"
  ON "pricing_bundles" ("slug");
