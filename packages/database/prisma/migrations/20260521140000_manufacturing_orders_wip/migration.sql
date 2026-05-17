-- Manufacturing orders (WIP state machine)

DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ManufacturingOrderStatus') THEN
    CREATE TYPE "ManufacturingOrderStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  END IF;
END $t$;

CREATE TABLE IF NOT EXISTS "manufacturing_orders" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "recipe_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "quantity" DECIMAL(19, 4) NOT NULL,
  "status" "ManufacturingOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "material_cost" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  "wip_transaction_id" UUID,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "manufacturing_release_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "manufacturing_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_orders_manufacturing_release_id_key"
  ON "manufacturing_orders" ("manufacturing_release_id")
  WHERE "manufacturing_release_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "mfg_orders_org_status_idx"
  ON "manufacturing_orders" ("organization_id", "status");

CREATE INDEX IF NOT EXISTS "mfg_orders_org_created_idx"
  ON "manufacturing_orders" ("organization_id", "created_at");

CREATE TABLE IF NOT EXISTS "manufacturing_order_lines" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "manufacturing_order_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity_required" DECIMAL(19, 4) NOT NULL,
  "quantity_issued" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  "line_cost" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  CONSTRAINT "manufacturing_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mfg_order_line_order_product_uidx"
  ON "manufacturing_order_lines" ("manufacturing_order_id", "product_id");

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "product_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_wip_transaction_id_fkey"
    FOREIGN KEY ("wip_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_orders"
    ADD CONSTRAINT "manufacturing_orders_manufacturing_release_id_fkey"
    FOREIGN KEY ("manufacturing_release_id") REFERENCES "manufacturing_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_order_lines"
    ADD CONSTRAINT "manufacturing_order_lines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_order_lines"
    ADD CONSTRAINT "manufacturing_order_lines_manufacturing_order_id_fkey"
    FOREIGN KEY ("manufacturing_order_id") REFERENCES "manufacturing_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "manufacturing_order_lines"
    ADD CONSTRAINT "manufacturing_order_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;
