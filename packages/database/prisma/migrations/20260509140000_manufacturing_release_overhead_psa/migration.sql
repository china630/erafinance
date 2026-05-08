-- E6: manufacturing release audit row + overhead allocation
-- E7: PSA projects / tasks / time entries + invoice.project_id

CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProjectBillingMode" AS ENUM ('FIXED', 'HOURLY');
CREATE TYPE "ProjectTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'INVOICED');

CREATE TABLE IF NOT EXISTS "psa_projects" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_mode" "ProjectBillingMode" NOT NULL DEFAULT 'HOURLY',
    "hourly_rate" DECIMAL(19,4),
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "department_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "psa_projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "psa_projects_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "psa_projects_counterparty_id_fkey"
      FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "psa_projects_department_id_fkey"
      FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "psa_projects_org_code_key" UNIQUE ("organization_id", "code")
);

CREATE INDEX IF NOT EXISTS "psa_projects_org_status_idx" ON "psa_projects" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "psa_project_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'OPEN',
    "estimated_hours" DECIMAL(19,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "psa_project_tasks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "psa_project_tasks_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "psa_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "psa_project_tasks_project_idx" ON "psa_project_tasks" ("project_id");

CREATE TABLE IF NOT EXISTS "psa_time_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "task_id" UUID,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(19,4) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate_snapshot" DECIMAL(19,4) NOT NULL,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "billing_invoice_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "psa_time_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "psa_time_entries_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "psa_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "psa_time_entries_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "psa_project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "psa_time_entries_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "psa_time_entries_billing_invoice_id_fkey"
      FOREIGN KEY ("billing_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "psa_time_entries_project_date_idx" ON "psa_time_entries" ("project_id", "date");
CREATE INDEX IF NOT EXISTS "psa_time_entries_employee_idx" ON "psa_time_entries" ("employee_id");

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "project_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_project_id_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "psa_projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "invoices_project_id_idx" ON "invoices" ("project_id");

CREATE TABLE IF NOT EXISTS "manufacturing_releases" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "finished_product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "material_cost" DECIMAL(19,4) NOT NULL,
    "document_date" DATE NOT NULL,
    "finished_goods_transaction_id" UUID,
    "finished_goods_stock_movement_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "manufacturing_releases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "manufacturing_releases_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "manufacturing_releases_recipe_id_fkey"
      FOREIGN KEY ("recipe_id") REFERENCES "product_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "manufacturing_releases_finished_product_id_fkey"
      FOREIGN KEY ("finished_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "manufacturing_releases_warehouse_id_fkey"
      FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "manufacturing_releases_finished_goods_transaction_id_fkey"
      FOREIGN KEY ("finished_goods_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "manufacturing_releases_finished_goods_stock_movement_id_fkey"
      FOREIGN KEY ("finished_goods_stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "manufacturing_releases_org_date_idx"
  ON "manufacturing_releases" ("organization_id", "document_date");

CREATE TYPE "OverheadDriverType" AS ENUM ('VOLUME', 'TIME', 'MATERIAL_COST');

CREATE TABLE IF NOT EXISTS "overhead_drivers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OverheadDriverType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "overhead_drivers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "overhead_drivers_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "overhead_drivers_org_idx" ON "overhead_drivers" ("organization_id");

CREATE TABLE IF NOT EXISTS "overhead_pools" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "source_account_code" TEXT NOT NULL,
    "credit_account_code" TEXT NOT NULL DEFAULT '741',
    "debit_account_code" TEXT NOT NULL DEFAULT '204',
    "driver_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "overhead_pools_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "overhead_pools_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "overhead_pools_driver_id_fkey"
      FOREIGN KEY ("driver_id") REFERENCES "overhead_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "overhead_pools_org_period_driver_key" UNIQUE ("organization_id", "period", "driver_id")
);

CREATE TABLE IF NOT EXISTS "overhead_allocations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pool_id" UUID NOT NULL,
    "manufacturing_release_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "release_transaction_id" UUID,
    CONSTRAINT "overhead_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "overhead_allocations_pool_id_fkey"
      FOREIGN KEY ("pool_id") REFERENCES "overhead_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "overhead_allocations_manufacturing_release_id_fkey"
      FOREIGN KEY ("manufacturing_release_id") REFERENCES "manufacturing_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "overhead_allocations_release_transaction_id_fkey"
      FOREIGN KEY ("release_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "overhead_allocations_pool_release_key" UNIQUE ("pool_id", "manufacturing_release_id")
);

CREATE INDEX IF NOT EXISTS "overhead_allocations_pool_idx" ON "overhead_allocations" ("pool_id");
