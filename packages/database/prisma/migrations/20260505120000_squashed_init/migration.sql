-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CoaTemplateProfile" AS ENUM ('COMMERCIAL_FULL', 'COMMERCIAL_SMALL');

-- CreateEnum
CREATE TYPE "InventoryValuationMethod" AS ENUM ('AVCO', 'FIFO');

-- CreateEnum
CREATE TYPE "OrgBankAccountCurrency" AS ENUM ('AZN', 'USD', 'EUR', 'RUB', 'TRY');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'USER', 'PROCUREMENT', 'AUDITOR', 'WAREHOUSE_KEEPER', 'HR_OFFICER', 'HR_MANAGER', 'DEPARTMENT_HEAD');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CounterpartyKind" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');

-- CreateEnum
CREATE TYPE "CounterpartyRole" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH', 'OTHER');

-- CreateEnum
CREATE TYPE "CounterpartyLegalForm" AS ENUM ('INDIVIDUAL', 'LLC', 'CJSC', 'OJSC', 'PUBLIC_LEGAL_ENTITY', 'STATE_AGENCY', 'NGO', 'BRANCH', 'HOA');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED', 'PARTIALLY_PAID', 'LOCKED_BY_SIGNATURE');

-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('ASAN_IMZA', 'SIMA');

-- CreateEnum
CREATE TYPE "DigitalSignatureStatus" AS ENUM ('PENDING_MOBILE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignedDocumentKind" AS ENUM ('INVOICE', 'RECONCILIATION_ACT');

-- CreateEnum
CREATE TYPE "BankStatementLineType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "BankStatementChannel" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "BankStatementLineOrigin" AS ENUM ('FILE_IMPORT', 'DIRECT_SYNC', 'WEBHOOK', 'INVOICE_PAYMENT_SYSTEM', 'MANUAL_CASH_OUT', 'MANUAL_BANK_ENTRY');

-- CreateEnum
CREATE TYPE "CbarRateStatus" AS ENUM ('PRELIMINARY', 'FINAL');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "SalaryRegistryStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- CreateEnum
CREATE TYPE "BankPaymentDraftStatus" AS ENUM ('PENDING', 'SENT', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SalaryPayoutFormat" AS ENUM ('ABB_XML', 'UNIVERSAL_XLSX');

-- CreateEnum
CREATE TYPE "EmployeeKind" AS ENUM ('EMPLOYEE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "TimesheetEntryType" AS ENUM ('WORK', 'VACATION', 'SICK', 'OFF', 'BUSINESS_TRIP');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('SALE', 'PURCHASE', 'ADJUSTMENT', 'MANUFACTURING', 'RECEIPT', 'SHIPMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "InventoryAuditStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentDocType" AS ENUM ('WRITE_OFF', 'SURPLUS', 'INVENTORY_COUNT');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('NAS', 'IFRS');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'SOFT_BLOCK', 'HARD_BLOCK');

-- CreateEnum
CREATE TYPE "PricingKind" AS ENUM ('FOUNDATION', 'MODULE', 'QUOTA');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FixedAssetDepreciationMethod" AS ENUM ('STRAIGHT_LINE');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');

-- CreateEnum
CREATE TYPE "TaxDeclarationType" AS ENUM ('SIMPLIFIED_TAX');

-- CreateEnum
CREATE TYPE "TaxDeclarationExportStatus" AS ENUM ('GENERATED', 'UPLOADED', 'CONFIRMED_BY_TAX');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashOrderKind" AS ENUM ('KMO', 'KXO');

-- CreateEnum
CREATE TYPE "CashOrderStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashOrderPkoSubtype" AS ENUM ('INCOME_FROM_CUSTOMER', 'RETURN_FROM_ACCOUNTABLE', 'WITHDRAWAL_FROM_BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "CashOrderRkoSubtype" AS ENUM ('SALARY', 'SUPPLIER_PAYMENT', 'ACCOUNTABLE_ISSUE', 'BANK_DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvanceReportStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "AbsencePayFormula" AS ENUM ('LABOR_LEAVE_304', 'SICK_LEAVE_STAJ', 'UNPAID_RECORD');

-- CreateEnum
CREATE TYPE "HoldingAccessRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "TemplateGroup" AS ENUM ('COMMERCIAL', 'GOVERNMENT', 'SMALL_BUSINESS');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "legal_address" TEXT,
    "phone" TEXT,
    "director_name" TEXT,
    "logo_url" TEXT,
    "valuation_method" "InventoryValuationMethod" NOT NULL DEFAULT 'AVCO',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "subscription_plan" TEXT,
    "billing_status" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "bank_webhook_secret" TEXT,
    "owner_id" UUID,
    "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "holding_id" UUID,
    "coa_template_profile" "CoaTemplateProfile" NOT NULL DEFAULT 'COMMERCIAL_FULL',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "parent_code" TEXT,
    "cash_profile" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "template_groups" "CoaTemplateProfile"[] DEFAULT ARRAY[]::"CoaTemplateProfile"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "ledger_type" "LedgerType" NOT NULL DEFAULT 'NAS',
    "balance_date" DATE NOT NULL,
    "debit_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_bank_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "currency" "OrgBankAccountCurrency" NOT NULL,
    "iban" TEXT,
    "swift" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_company_directory" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tax_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_address" TEXT,
    "phone" TEXT,
    "director_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_company_directory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_modules" (
    "organization_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending_deactivation" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "access_until" TIMESTAMPTZ(6),

    CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("organization_id","module_key")
);

-- CreateTable
CREATE TABLE "pricing" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "kind" "PricingKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount_azn" DECIMAL(12,2) NOT NULL,
    "unit_size" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "billing_period" TEXT,
    "pdf_link" TEXT,
    "payment_order_id" UUID,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "subscription_invoice_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "billing_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("user_id","organization_id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by_user_id" UUID,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invites" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "manager_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_positions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "department_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "total_slots" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "min_salary" DECIMAL(19,4) NOT NULL,
    "max_salary" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "amount_azn" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'pasha_bank',
    "provider_txn_id" TEXT,
    "months_applied" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "idempotency_key" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "custom_config" JSONB,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_modules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_per_month" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_bundles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "module_keys" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_overrides" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "locale" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_audits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "warehouse_id" UUID NOT NULL,

    CONSTRAINT "inventory_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "inventory_account_code" TEXT NOT NULL DEFAULT '201',

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "bin_id" UUID,
    "quantity" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "bin_id" UUID,
    "type" "StockMovementType" NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "note" TEXT,
    "invoice_id" UUID,
    "transfer_batch_id" UUID,
    "document_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bins" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbar_official_rates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rate_date" DATE NOT NULL,
    "currency_code" TEXT NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "nominal" INTEGER NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "status" "CbarRateStatus" NOT NULL DEFAULT 'PRELIMINARY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbar_official_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "fin_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "hire_date" DATE NOT NULL,
    "salary" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "kind" "EmployeeKind" NOT NULL DEFAULT 'EMPLOYEE',
    "voen" TEXT,
    "contractor_monthly_social_azn" DECIMAL(19,4),
    "initial_salary_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "initial_vacation_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "avg_monthly_salary_last_year" DECIMAL(19,4),
    "position_id" UUID NOT NULL,
    "accountable_account_code_244" TEXT,
    "patronymic" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "timesheet_id" UUID,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_registries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "status" "SalaryRegistryStatus" NOT NULL DEFAULT 'DRAFT',
    "payout_format" "SalaryPayoutFormat" NOT NULL,
    "external_id" TEXT,
    "export_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_payment_drafts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "recipient_iban" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT,
    "provider_draft_id" TEXT,
    "status" "BankPaymentDraftStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bank_payment_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_slips" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "gross" DECIMAL(19,4) NOT NULL,
    "income_tax" DECIMAL(19,4) NOT NULL,
    "dsmf_worker" DECIMAL(19,4) NOT NULL,
    "dsmf_employer" DECIMAL(19,4) NOT NULL,
    "its_worker" DECIMAL(19,4) NOT NULL,
    "its_employer" DECIMAL(19,4) NOT NULL,
    "unemployment_worker" DECIMAL(19,4) NOT NULL,
    "unemployment_employer" DECIMAL(19,4) NOT NULL,
    "net" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contractor_social_withheld" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "timesheet_work_days" INTEGER,
    "timesheet_vacation_days" INTEGER,
    "timesheet_sick_days" INTEGER,
    "timesheet_business_trip_days" INTEGER,

    CONSTRAINT "payroll_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "absence_type_id" UUID NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "timesheet_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "day_date" DATE NOT NULL,
    "type" "TimesheetEntryType" NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL DEFAULT 8,
    "locked_from_absence" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "default_warehouse_id" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "ledger_type" "LedgerType" NOT NULL DEFAULT 'NAS',
    "chart_entry_id" UUID,
    "template_account_id" UUID,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_mappings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "nas_account_id" UUID NOT NULL,
    "ifrs_account_id" UUID NOT NULL,
    "ratio" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifrs_mapping_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "source_nas_account_code" TEXT NOT NULL,
    "target_ifrs_account_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ifrs_mapping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_ifrs_mappings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "nas_code" TEXT NOT NULL,
    "ifrs_code" TEXT NOT NULL,
    "ratio" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_ifrs_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "counterparty_id" UUID,
    "purchase_snapshot" JSONB,
    "sales_snapshot" JSONB,
    "department_id" UUID,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ledger_type" "LedgerType" NOT NULL DEFAULT 'NAS',

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterparties" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "kind" "CounterpartyKind" NOT NULL,
    "role" "CounterpartyRole" NOT NULL DEFAULT 'CUSTOMER',
    "legal_form" "CounterpartyLegalForm" NOT NULL DEFAULT 'LLC',
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "is_vat_payer" BOOLEAN NOT NULL DEFAULT false,
    "global_id" UUID,
    "portal_locale" TEXT,

    CONSTRAINT "counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counterparty_bank_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "counterparty_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "swift" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counterparty_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_signature_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "certificate_thumbprint" TEXT,
    "signed_at" TIMESTAMP(3),
    "provider" "SignatureProvider" NOT NULL,
    "status" "DigitalSignatureStatus" NOT NULL DEFAULT 'PENDING_MOBILE',
    "certificate_subject" TEXT,
    "certificate_issuer" TEXT,
    "pending_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "document_kind" "SignedDocumentKind" NOT NULL DEFAULT 'INVOICE',
    "content_hash_sha256" VARCHAR(64),

    CONSTRAINT "digital_signature_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(19,4) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_service" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recipes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "finished_product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recipe_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recipe_id" UUID NOT NULL,
    "component_product_id" UUID NOT NULL,
    "quantity_per_unit" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "waste_factor" DECIMAL(19,6) NOT NULL DEFAULT 0,

    CONSTRAINT "product_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recipe_byproducts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "recipe_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_per_unit" DECIMAL(19,4) NOT NULL,
    "cost_factor" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_recipe_byproducts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inventory_number" TEXT NOT NULL,
    "commissioning_date" DATE NOT NULL,
    "initial_cost" DECIMAL(19,4) NOT NULL,
    "useful_life_months" INTEGER NOT NULL,
    "salvage_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "depreciation_method" "FixedAssetDepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "booked_depreciation" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset_depreciation_months" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "fixed_asset_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_asset_depreciation_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date" DATE NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "debit_account_code" TEXT NOT NULL DEFAULT '101',
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "warehouse_id" UUID,
    "revenue_posted_transaction_id" UUID,
    "inventory_settled" BOOLEAN NOT NULL DEFAULT false,
    "revenue_recognized" BOOLEAN NOT NULL DEFAULT false,
    "payment_received" BOOLEAN NOT NULL DEFAULT false,
    "recognized_at" TIMESTAMP(3),
    "public_token" VARCHAR(200),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "allocated_amount" DECIMAL(19,4) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_declaration_exports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "tax_type" "TaxDeclarationType" NOT NULL,
    "period" TEXT NOT NULL,
    "generated_file_url" TEXT NOT NULL,
    "receipt_file_url" TEXT,
    "status" "TaxDeclarationExportStatus" NOT NULL DEFAULT 'GENERATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_declaration_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" DATE NOT NULL,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "bank_name" TEXT NOT NULL,
    "source_file_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "channel" "BankStatementChannel" NOT NULL DEFAULT 'BANK',

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "bank_statement_id" UUID NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "type" "BankStatementLineType" NOT NULL,
    "is_matched" BOOLEAN NOT NULL DEFAULT false,
    "counterparty_tax_id" TEXT,
    "value_date" DATE,
    "matched_invoice_id" UUID,
    "raw_row" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "integration_key" TEXT,
    "origin" "BankStatementLineOrigin" NOT NULL DEFAULT 'FILE_IMPORT',
    "cash_flow_item_id" UUID,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CashOrderKind" NOT NULL,
    "status" "CashOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "pko_subtype" "CashOrderPkoSubtype",
    "rko_subtype" "CashOrderRkoSubtype",
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "amount" DECIMAL(19,4) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "cash_account_code" TEXT NOT NULL DEFAULT '101.01',
    "offset_account_code" TEXT,
    "counterparty_id" UUID,
    "employee_id" UUID,
    "source_invoice_id" UUID,
    "source_invoice_payment_id" UUID,
    "skip_journal_posting" BOOLEAN NOT NULL DEFAULT false,
    "linked_transaction_id" UUID,
    "posted_transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cash_desk_id" UUID,
    "cash_flow_item_id" UUID,
    "withholding_tax_amount" DECIMAL(19,4),

    CONSTRAINT "cash_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "expense_lines" JSONB NOT NULL DEFAULT '[]',
    "total_declared" DECIMAL(19,4) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "status" "AdvanceReportStatus" NOT NULL DEFAULT 'DRAFT',
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "product_id" UUID,
    "description" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "line_total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID,
    "user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_values" JSONB,
    "new_values" JSONB,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "hash" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_archives" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID,
    "user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "old_values" JSONB,
    "new_values" JSONB,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absence_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_az" TEXT NOT NULL,
    "is_paid" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "formula" "AbsencePayFormula" NOT NULL,
    "max_calendar_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absence_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_desks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "employee_id" UUID,
    "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_desks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_flow_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "template_group" "TemplateGroup" NOT NULL DEFAULT 'COMMERCIAL',
    "code" TEXT NOT NULL,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "parent_code" TEXT,
    "cash_profile" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_of_accounts_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_counterparties" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tax_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_address" TEXT,
    "vat_status" BOOLEAN,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_memberships" (
    "user_id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "role" "HoldingAccessRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_memberships_pkey" PRIMARY KEY ("user_id","holding_id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'AZN',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_audit_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "inventory_audit_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "system_qty" DECIMAL(19,4) NOT NULL,
    "fact_qty" DECIMAL(19,4) NOT NULL,
    "cost_price" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_audit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL DEFAULT '',
    "doc_type" "InventoryAdjustmentDocType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustment_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "adjustment_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "expected_quantity" DECIMAL(19,4) NOT NULL,
    "actual_quantity" DECIMAL(19,4) NOT NULL,
    "delta_quantity" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_bank_webhook_secret_key" ON "organizations"("bank_webhook_secret");

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- CreateIndex
CREATE INDEX "organizations_holding_id_id_idx" ON "organizations"("holding_id", "id");

-- CreateIndex
CREATE INDEX "organizations_holding_id_idx" ON "organizations"("holding_id");

-- CreateIndex
CREATE INDEX "organizations_coa_template_profile_idx" ON "organizations"("coa_template_profile");

-- CreateIndex
CREATE UNIQUE INDEX "template_accounts_code_key" ON "template_accounts"("code");

-- CreateIndex
CREATE INDEX "template_accounts_code_idx" ON "template_accounts"("code");

-- CreateIndex
CREATE INDEX "account_balances_organization_id_ledger_type_balance_date_idx" ON "account_balances"("organization_id", "ledger_type", "balance_date");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_organization_id_account_id_ledger_type_bal_key" ON "account_balances"("organization_id", "account_id", "ledger_type", "balance_date");

-- CreateIndex
CREATE INDEX "organization_bank_accounts_organization_id_idx" ON "organization_bank_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_company_directory_tax_id_key" ON "global_company_directory"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_key_key" ON "pricing"("key");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_payment_order_id_key" ON "subscription_invoices"("payment_order_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_user_id_idx" ON "subscription_invoices"("user_id");

-- CreateIndex
CREATE INDEX "subscription_invoices_user_id_date_idx" ON "subscription_invoices"("user_id", "date");

-- CreateIndex
CREATE INDEX "subscription_invoices_user_id_billing_period_idx" ON "subscription_invoices"("user_id", "billing_period");

-- CreateIndex
CREATE INDEX "billing_invoice_items_subscription_invoice_id_idx" ON "billing_invoice_items"("subscription_invoice_id");

-- CreateIndex
CREATE INDEX "billing_invoice_items_organization_id_idx" ON "billing_invoice_items"("organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE INDEX "access_requests_organization_id_status_idx" ON "access_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "access_requests_requester_id_idx" ON "access_requests"("requester_id");

-- CreateIndex
CREATE INDEX "organization_invites_organization_id_email_idx" ON "organization_invites"("organization_id", "email");

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "job_positions_department_id_idx" ON "job_positions"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_idempotency_key_key" ON "payment_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_orders_organization_id_idx" ON "payment_orders"("organization_id");

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_modules_key_key" ON "pricing_modules"("key");

-- CreateIndex
CREATE INDEX "translation_overrides_locale_idx" ON "translation_overrides"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "translation_overrides_locale_key_key" ON "translation_overrides"("locale", "key");

-- CreateIndex
CREATE INDEX "inventory_audits_organization_id_idx" ON "inventory_audits"("organization_id");

-- CreateIndex
CREATE INDEX "inventory_audits_org_wh_date_idx" ON "inventory_audits"("organization_id", "warehouse_id", "date");

-- CreateIndex
CREATE INDEX "warehouses_organization_id_idx" ON "warehouses"("organization_id");

-- CreateIndex
CREATE INDEX "stock_items_organization_id_warehouse_id_idx" ON "stock_items"("organization_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_organization_id_warehouse_id_product_id_key" ON "stock_items"("organization_id", "warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_warehouse_id_document_date__idx" ON "stock_movements"("organization_id", "warehouse_id", "document_date", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_product_id_document_date_cr_idx" ON "stock_movements"("organization_id", "product_id", "document_date", "created_at");

-- CreateIndex
CREATE INDEX "warehouse_bins_organization_id_warehouse_id_idx" ON "warehouse_bins"("organization_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_warehouse_id_barcode_idx" ON "warehouse_bins"("warehouse_id", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_bins_warehouse_id_code_key" ON "warehouse_bins"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "cbar_official_rates_rate_date_status_idx" ON "cbar_official_rates"("rate_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cbar_official_rates_rate_date_currency_code_key" ON "cbar_official_rates"("rate_date", "currency_code");

-- CreateIndex
CREATE INDEX "employees_position_id_idx" ON "employees"("position_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_created_at_idx" ON "employees"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_fin_code_key" ON "employees"("organization_id", "fin_code");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_status_idx" ON "payroll_runs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organization_id_year_month_key" ON "payroll_runs"("organization_id", "year", "month");

-- CreateIndex
CREATE INDEX "salary_registries_organization_id_payroll_run_id_idx" ON "salary_registries"("organization_id", "payroll_run_id");

-- CreateIndex
CREATE INDEX "salary_registries_organization_id_status_idx" ON "salary_registries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bank_payment_drafts_organization_id_status_idx" ON "bank_payment_drafts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bank_payment_drafts_organization_id_created_at_idx" ON "bank_payment_drafts"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "payroll_slips_organization_id_payroll_run_id_idx" ON "payroll_slips"("organization_id", "payroll_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_slips_payroll_run_id_employee_id_key" ON "payroll_slips"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "absences_organization_id_employee_id_idx" ON "absences"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "absences_organization_id_start_date_idx" ON "absences"("organization_id", "start_date");

-- CreateIndex
CREATE INDEX "absences_absence_type_id_idx" ON "absences"("absence_type_id");

-- CreateIndex
CREATE INDEX "timesheets_organization_id_year_month_idx" ON "timesheets"("organization_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_organization_id_year_month_key" ON "timesheets"("organization_id", "year", "month");

-- CreateIndex
CREATE INDEX "timesheet_entries_timesheet_id_employee_id_idx" ON "timesheet_entries"("timesheet_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_entries_timesheet_id_employee_id_day_date_key" ON "timesheet_entries"("timesheet_id", "employee_id", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_default_warehouse_id_idx" ON "users"("default_warehouse_id");

-- CreateIndex
CREATE INDEX "accounts_organization_id_created_at_idx" ON "accounts"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "accounts_organization_id_currency_idx" ON "accounts"("organization_id", "currency");

-- CreateIndex
CREATE INDEX "accounts_organization_id_ledger_type_idx" ON "accounts"("organization_id", "ledger_type");

-- CreateIndex
CREATE INDEX "accounts_chart_entry_id_idx" ON "accounts"("chart_entry_id");

-- CreateIndex
CREATE INDEX "accounts_template_account_id_idx" ON "accounts"("template_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_organization_id_code_ledger_type_key" ON "accounts"("organization_id", "code", "ledger_type");

-- CreateIndex
CREATE INDEX "account_mappings_organization_id_idx" ON "account_mappings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_mappings_organization_id_nas_account_id_key" ON "account_mappings"("organization_id", "nas_account_id");

-- CreateIndex
CREATE INDEX "ifrs_mapping_rules_organization_id_source_nas_account_code__idx" ON "ifrs_mapping_rules"("organization_id", "source_nas_account_code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ifrs_mapping_rules_organization_id_source_nas_account_code__key" ON "ifrs_mapping_rules"("organization_id", "source_nas_account_code", "target_ifrs_account_code");

-- CreateIndex
CREATE INDEX "template_ifrs_mappings_nas_code_idx" ON "template_ifrs_mappings"("nas_code");

-- CreateIndex
CREATE INDEX "template_ifrs_mappings_ifrs_code_idx" ON "template_ifrs_mappings"("ifrs_code");

-- CreateIndex
CREATE UNIQUE INDEX "template_ifrs_mappings_nas_code_ifrs_code_key" ON "template_ifrs_mappings"("nas_code", "ifrs_code");

-- CreateIndex
CREATE INDEX "transactions_organization_id_date_idx" ON "transactions"("organization_id", "date");

-- CreateIndex
CREATE INDEX "transactions_org_status_period_idx" ON "transactions"("organization_id", "is_final", "date");

-- CreateIndex
CREATE INDEX "transactions_counterparty_id_idx" ON "transactions"("counterparty_id");

-- CreateIndex
CREATE INDEX "transactions_organization_id_created_at_idx" ON "transactions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_organization_id_date_is_locked_idx" ON "transactions"("organization_id", "date", "is_locked");

-- CreateIndex
CREATE INDEX "transactions_department_id_idx" ON "transactions"("department_id");

-- CreateIndex
CREATE INDEX "journal_entries_organization_id_transaction_id_idx" ON "journal_entries"("organization_id", "transaction_id");

-- CreateIndex
CREATE INDEX "journal_entries_organization_id_account_id_idx" ON "journal_entries"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "journal_entries_account_id_idx" ON "journal_entries"("account_id");

-- CreateIndex
CREATE INDEX "journal_entries_org_period_status_ledger_idx" ON "journal_entries"("organization_id", "ledger_type", "transaction_id");

-- CreateIndex
CREATE INDEX "journal_entries_organization_id_created_at_idx" ON "journal_entries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "journal_entries_organization_id_ledger_type_idx" ON "journal_entries"("organization_id", "ledger_type");

-- CreateIndex
CREATE INDEX "counterparties_organization_id_tax_id_idx" ON "counterparties"("organization_id", "tax_id");

-- CreateIndex
CREATE INDEX "counterparties_organization_id_created_at_idx" ON "counterparties"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "counterparties_global_id_idx" ON "counterparties"("global_id");

-- CreateIndex
CREATE INDEX "counterparty_bank_accounts_counterparty_id_idx" ON "counterparty_bank_accounts"("counterparty_id");

-- CreateIndex
CREATE UNIQUE INDEX "counterparty_bank_accounts_cp_iban_uidx" ON "counterparty_bank_accounts"("counterparty_id", "iban");

-- CreateIndex
CREATE INDEX "digital_signature_logs_organization_id_signed_at_idx" ON "digital_signature_logs"("organization_id", "signed_at");

-- CreateIndex
CREATE INDEX "digital_signature_logs_organization_id_document_id_idx" ON "digital_signature_logs"("organization_id", "document_id");

-- CreateIndex
CREATE INDEX "digital_signature_logs_organization_id_status_idx" ON "digital_signature_logs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_recipes_finished_product_id_key" ON "product_recipes"("finished_product_id");

-- CreateIndex
CREATE INDEX "product_recipes_organization_id_idx" ON "product_recipes"("organization_id");

-- CreateIndex
CREATE INDEX "product_recipe_lines_recipe_id_idx" ON "product_recipe_lines"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_recipe_lines_recipe_id_component_product_id_key" ON "product_recipe_lines"("recipe_id", "component_product_id");

-- CreateIndex
CREATE INDEX "product_recipe_byproducts_recipe_id_idx" ON "product_recipe_byproducts"("recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_recipe_byproducts_recipe_id_product_id_key" ON "product_recipe_byproducts"("recipe_id", "product_id");

-- CreateIndex
CREATE INDEX "fixed_assets_organization_id_commissioning_date_idx" ON "fixed_assets"("organization_id", "commissioning_date");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_organization_id_inventory_number_key" ON "fixed_assets"("organization_id", "inventory_number");

-- CreateIndex
CREATE INDEX "fixed_asset_depreciation_months_organization_id_year_month_idx" ON "fixed_asset_depreciation_months"("organization_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_asset_depreciation_months_fixed_asset_id_year_month_key" ON "fixed_asset_depreciation_months"("fixed_asset_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_public_token_key" ON "invoices"("public_token");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_organization_id_created_at_idx" ON "invoices"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_organization_id_counterparty_id_idx" ON "invoices"("organization_id", "counterparty_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_number_key" ON "invoices"("organization_id", "number");

-- CreateIndex
CREATE INDEX "payment_alloc_org_invoice_idx" ON "payment_allocations"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "payment_alloc_org_tx_idx" ON "payment_allocations"("organization_id", "transaction_id");

-- CreateIndex
CREATE INDEX "payment_alloc_org_date_idx" ON "payment_allocations"("organization_id", "date");

-- CreateIndex
CREATE INDEX "tax_decl_org_period_idx" ON "tax_declaration_exports"("organization_id", "period");

-- CreateIndex
CREATE INDEX "tax_decl_org_status_idx" ON "tax_declaration_exports"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoice_payments_organization_id_invoice_id_idx" ON "invoice_payments"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_organization_id_date_idx" ON "invoice_payments"("organization_id", "date");

-- CreateIndex
CREATE INDEX "bank_statements_organization_id_date_idx" ON "bank_statements"("organization_id", "date");

-- CreateIndex
CREATE INDEX "bank_statements_organization_id_created_at_idx" ON "bank_statements"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "bank_statement_lines_organization_id_is_matched_idx" ON "bank_statement_lines"("organization_id", "is_matched");

-- CreateIndex
CREATE INDEX "bank_statement_lines_organization_id_counterparty_tax_id_idx" ON "bank_statement_lines"("organization_id", "counterparty_tax_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_organization_id_bank_statement_id_idx" ON "bank_statement_lines"("organization_id", "bank_statement_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_cash_flow_item_id_idx" ON "bank_statement_lines"("cash_flow_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_organization_id_integration_key_key" ON "bank_statement_lines"("organization_id", "integration_key");

-- CreateIndex
CREATE UNIQUE INDEX "cash_orders_source_invoice_payment_id_key" ON "cash_orders"("source_invoice_payment_id");

-- CreateIndex
CREATE INDEX "cash_orders_organization_id_date_idx" ON "cash_orders"("organization_id", "date");

-- CreateIndex
CREATE INDEX "cash_orders_organization_id_status_idx" ON "cash_orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "cash_orders_cash_desk_id_idx" ON "cash_orders"("cash_desk_id");

-- CreateIndex
CREATE INDEX "cash_orders_cash_flow_item_id_idx" ON "cash_orders"("cash_flow_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_orders_organization_id_order_number_key" ON "cash_orders"("organization_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "advance_reports_transaction_id_key" ON "advance_reports"("transaction_id");

-- CreateIndex
CREATE INDEX "advance_reports_organization_id_employee_id_idx" ON "advance_reports"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "invoice_items_organization_id_invoice_id_idx" ON "invoice_items"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_archives_organization_id_created_at_idx" ON "audit_log_archives"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_archives_entity_type_entity_id_idx" ON "audit_log_archives"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "absence_types_organization_id_idx" ON "absence_types"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "absence_types_organization_id_code_key" ON "absence_types"("organization_id", "code");

-- CreateIndex
CREATE INDEX "cash_desks_employee_id_idx" ON "cash_desks"("employee_id");

-- CreateIndex
CREATE INDEX "cash_desks_organization_id_idx" ON "cash_desks"("organization_id");

-- CreateIndex
CREATE INDEX "cash_flow_items_organization_id_idx" ON "cash_flow_items"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_flow_items_organization_id_code_key" ON "cash_flow_items"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_entries_template_group_code_key" ON "chart_of_accounts_entries"("template_group", "code");

-- CreateIndex
CREATE UNIQUE INDEX "global_counterparties_tax_id_key" ON "global_counterparties"("tax_id");

-- CreateIndex
CREATE INDEX "holding_memberships_holding_id_idx" ON "holding_memberships"("holding_id");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_name_key" ON "holdings"("name");

-- CreateIndex
CREATE INDEX "holdings_owner_id_idx" ON "holdings"("owner_id");

-- CreateIndex
CREATE INDEX "inventory_audit_lines_org_audit_idx" ON "inventory_audit_lines"("organization_id", "inventory_audit_id");

-- CreateIndex
CREATE INDEX "inventory_audit_lines_org_product_idx" ON "inventory_audit_lines"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_audit_lines_audit_product_uidx" ON "inventory_audit_lines"("inventory_audit_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_organization_id_warehouse_id_date_idx" ON "inventory_adjustments"("organization_id", "warehouse_id", "date");

-- CreateIndex
CREATE INDEX "inventory_adjustments_organization_id_status_idx" ON "inventory_adjustments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "inventory_adjustment_lines_product_id_idx" ON "inventory_adjustment_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustment_lines_adjustment_id_product_id_key" ON "inventory_adjustment_lines"("adjustment_id", "product_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bank_accounts" ADD CONSTRAINT "organization_bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_modules" ADD CONSTRAINT "organization_modules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_subscription_invoice_id_fkey" FOREIGN KEY ("subscription_invoice_id") REFERENCES "subscription_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "job_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_registries" ADD CONSTRAINT "salary_registries_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "organization_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_registries" ADD CONSTRAINT "salary_registries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_registries" ADD CONSTRAINT "salary_registries_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_payment_drafts" ADD CONSTRAINT "bank_payment_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_absence_type_id_fkey" FOREIGN KEY ("absence_type_id") REFERENCES "absence_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_warehouse_id_fkey" FOREIGN KEY ("default_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_chart_entry_id_fkey" FOREIGN KEY ("chart_entry_id") REFERENCES "chart_of_accounts_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_template_account_id_fkey" FOREIGN KEY ("template_account_id") REFERENCES "template_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_ifrs_account_id_fkey" FOREIGN KEY ("ifrs_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_nas_account_id_fkey" FOREIGN KEY ("nas_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifrs_mapping_rules" ADD CONSTRAINT "ifrs_mapping_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_global_id_fkey" FOREIGN KEY ("global_id") REFERENCES "global_counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterparty_bank_accounts" ADD CONSTRAINT "counterparty_bank_accounts_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signature_logs" ADD CONSTRAINT "digital_signature_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_finished_product_id_fkey" FOREIGN KEY ("finished_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipes" ADD CONSTRAINT "product_recipes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipe_lines" ADD CONSTRAINT "product_recipe_lines_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipe_lines" ADD CONSTRAINT "product_recipe_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "product_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipe_byproducts" ADD CONSTRAINT "product_recipe_byproducts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recipe_byproducts" ADD CONSTRAINT "product_recipe_byproducts_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "product_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_depreciation_months" ADD CONSTRAINT "fixed_asset_depreciation_months_fixed_asset_id_fkey" FOREIGN KEY ("fixed_asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_depreciation_months" ADD CONSTRAINT "fixed_asset_depreciation_months_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset_depreciation_months" ADD CONSTRAINT "fixed_asset_depreciation_months_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_revenue_posted_transaction_id_fkey" FOREIGN KEY ("revenue_posted_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_declaration_exports" ADD CONSTRAINT "tax_declaration_exports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_cash_flow_item_id_fkey" FOREIGN KEY ("cash_flow_item_id") REFERENCES "cash_flow_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_invoice_id_fkey" FOREIGN KEY ("matched_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_cash_desk_id_fkey" FOREIGN KEY ("cash_desk_id") REFERENCES "cash_desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_cash_flow_item_id_fkey" FOREIGN KEY ("cash_flow_item_id") REFERENCES "cash_flow_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_linked_transaction_id_fkey" FOREIGN KEY ("linked_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_posted_transaction_id_fkey" FOREIGN KEY ("posted_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_orders" ADD CONSTRAINT "cash_orders_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_reports" ADD CONSTRAINT "advance_reports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_reports" ADD CONSTRAINT "advance_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_reports" ADD CONSTRAINT "advance_reports_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_types" ADD CONSTRAINT "absence_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_desks" ADD CONSTRAINT "cash_desks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_desks" ADD CONSTRAINT "cash_desks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow_items" ADD CONSTRAINT "cash_flow_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_memberships" ADD CONSTRAINT "holding_memberships_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_memberships" ADD CONSTRAINT "holding_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_audit_fkey" FOREIGN KEY ("inventory_audit_id") REFERENCES "inventory_audits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_product_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "inventory_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
