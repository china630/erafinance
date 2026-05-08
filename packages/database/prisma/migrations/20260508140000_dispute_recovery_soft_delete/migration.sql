-- Dispute & Recovery R1.1: soft-delete columns on tenant business tables (idempotent adds).

ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "organization_memberships_org_deleted_at_idx" ON "organization_memberships" ("organization_id", "deleted_at");

ALTER TABLE "organization_invites" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "organization_invites" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "organization_invites" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "organization_invites_org_deleted_at_idx" ON "organization_invites" ("organization_id", "deleted_at");

ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "access_requests_org_deleted_at_idx" ON "access_requests" ("organization_id", "deleted_at");

ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "departments_org_deleted_at_idx" ON "departments" ("organization_id", "deleted_at");

ALTER TABLE "job_positions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "job_positions" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "job_positions" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "job_positions_dept_deleted_at_idx" ON "job_positions" ("department_id", "deleted_at");

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "employees_org_deleted_at_idx" ON "employees" ("organization_id", "deleted_at");

ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "warehouses_org_deleted_at_idx" ON "warehouses" ("organization_id", "deleted_at");

ALTER TABLE "warehouse_bins" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "warehouse_bins" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "warehouse_bins" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "warehouse_bins_org_deleted_at_idx" ON "warehouse_bins" ("organization_id", "deleted_at");

ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "stock_items_org_deleted_at_idx" ON "stock_items" ("organization_id", "deleted_at");

ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "inventory_audits" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "inventory_audits_org_deleted_at_idx" ON "inventory_audits" ("organization_id", "deleted_at");

ALTER TABLE "inventory_audit_lines" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_audit_lines" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "inventory_audit_lines" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "inventory_audit_lines_org_deleted_at_idx" ON "inventory_audit_lines" ("organization_id", "deleted_at");

ALTER TABLE "inventory_adjustments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_adjustments" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "inventory_adjustments" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "inventory_adjustments_org_deleted_at_idx" ON "inventory_adjustments" ("organization_id", "deleted_at");

ALTER TABLE "inventory_adjustment_lines" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "inventory_adjustment_lines_adj_deleted_at_idx" ON "inventory_adjustment_lines" ("adjustment_id", "deleted_at");

ALTER TABLE "cash_desks" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "cash_desks" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "cash_desks" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "cash_desks_org_deleted_at_idx" ON "cash_desks" ("organization_id", "deleted_at");

ALTER TABLE "cash_flow_items" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "cash_flow_items" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "cash_flow_items" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "cash_flow_items_org_deleted_at_idx" ON "cash_flow_items" ("organization_id", "deleted_at");

ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "payroll_runs_org_deleted_at_idx" ON "payroll_runs" ("organization_id", "deleted_at");

DO $$
BEGIN
  -- Some legacy local DB snapshots may have `salary_registry` instead of
  -- `salary_registries`; handle both names to keep migration deploy-safe.
  IF to_regclass('"salary_registries"') IS NOT NULL THEN
    ALTER TABLE "salary_registries" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
    ALTER TABLE "salary_registries" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
    ALTER TABLE "salary_registries" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
    CREATE INDEX IF NOT EXISTS "salary_registries_org_deleted_at_idx" ON "salary_registries" ("organization_id", "deleted_at");
  ELSIF to_regclass('"salary_registry"') IS NOT NULL THEN
    ALTER TABLE "salary_registry" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
    ALTER TABLE "salary_registry" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
    ALTER TABLE "salary_registry" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
    CREATE INDEX IF NOT EXISTS "salary_registry_org_deleted_at_idx" ON "salary_registry" ("organization_id", "deleted_at");
  END IF;
END $$;

ALTER TABLE "bank_payment_drafts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "bank_payment_drafts" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "bank_payment_drafts" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "bank_payment_drafts_org_deleted_at_idx" ON "bank_payment_drafts" ("organization_id", "deleted_at");

ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "payroll_slips" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "payroll_slips_org_deleted_at_idx" ON "payroll_slips" ("organization_id", "deleted_at");

ALTER TABLE "absences" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "absences" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "absences" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "absences_org_deleted_at_idx" ON "absences" ("organization_id", "deleted_at");

ALTER TABLE "timesheets" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "timesheets" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "timesheets" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "timesheets_org_deleted_at_idx" ON "timesheets" ("organization_id", "deleted_at");

ALTER TABLE "timesheet_entries" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "timesheet_entries" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "timesheet_entries" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "timesheet_entries_ts_deleted_at_idx" ON "timesheet_entries" ("timesheet_id", "deleted_at");

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "notifications_user_deleted_at_idx" ON "notifications" ("user_id", "deleted_at");

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "accounts_org_deleted_at_idx" ON "accounts" ("organization_id", "deleted_at");

ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "account_mappings_org_deleted_at_idx" ON "account_mappings" ("organization_id", "deleted_at");

ALTER TABLE "ifrs_mapping_rules" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "ifrs_mapping_rules" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "ifrs_mapping_rules" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "ifrs_mapping_rules_org_deleted_at_idx" ON "ifrs_mapping_rules" ("organization_id", "deleted_at");

ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "counterparties_org_deleted_at_idx" ON "counterparties" ("organization_id", "deleted_at");

ALTER TABLE "counterparty_bank_accounts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "counterparty_bank_accounts" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "counterparty_bank_accounts" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "counterparty_bank_accounts_cp_deleted_at_idx" ON "counterparty_bank_accounts" ("counterparty_id", "deleted_at");

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "products_org_deleted_at_idx" ON "products" ("organization_id", "deleted_at");

ALTER TABLE "product_recipes" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "product_recipes" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "product_recipes" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "product_recipes_org_deleted_at_idx" ON "product_recipes" ("organization_id", "deleted_at");

ALTER TABLE "product_recipe_lines" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "product_recipe_lines" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "product_recipe_lines" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "product_recipe_lines_recipe_deleted_at_idx" ON "product_recipe_lines" ("recipe_id", "deleted_at");

ALTER TABLE "product_recipe_byproducts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "product_recipe_byproducts" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "product_recipe_byproducts" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "product_recipe_byproducts_recipe_deleted_at_idx" ON "product_recipe_byproducts" ("recipe_id", "deleted_at");

ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "fixed_assets_org_deleted_at_idx" ON "fixed_assets" ("organization_id", "deleted_at");

ALTER TABLE "fixed_asset_depreciation_months" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "fixed_asset_depreciation_months" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "fixed_asset_depreciation_months" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "fixed_asset_depreciation_months_org_deleted_at_idx" ON "fixed_asset_depreciation_months" ("organization_id", "deleted_at");

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "invoices_org_deleted_at_idx" ON "invoices" ("organization_id", "deleted_at");

ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "invoice_payments" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "invoice_payments_org_deleted_at_idx" ON "invoice_payments" ("organization_id", "deleted_at");

ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "invoice_items_org_deleted_at_idx" ON "invoice_items" ("organization_id", "deleted_at");

ALTER TABLE "customs_declarations" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "customs_declarations" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "customs_declarations" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "customs_declarations_org_deleted_at_idx" ON "customs_declarations" ("organization_id", "deleted_at");

ALTER TABLE "tax_declaration_exports" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "tax_declaration_exports" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "tax_declaration_exports" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "tax_declaration_exports_org_deleted_at_idx" ON "tax_declaration_exports" ("organization_id", "deleted_at");

ALTER TABLE "cash_orders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "cash_orders" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "cash_orders" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "cash_orders_org_deleted_at_idx" ON "cash_orders" ("organization_id", "deleted_at");

ALTER TABLE "advance_reports" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "advance_reports" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "advance_reports" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "advance_reports_org_deleted_at_idx" ON "advance_reports" ("organization_id", "deleted_at");

ALTER TABLE "organization_bank_accounts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "organization_bank_accounts" ADD COLUMN IF NOT EXISTS "deleted_by_user_id" UUID;
ALTER TABLE "organization_bank_accounts" ADD COLUMN IF NOT EXISTS "deleted_reason" TEXT;
CREATE INDEX IF NOT EXISTS "organization_bank_accounts_org_deleted_at_idx" ON "organization_bank_accounts" ("organization_id", "deleted_at");
