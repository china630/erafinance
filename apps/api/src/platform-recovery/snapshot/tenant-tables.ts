/**
 * Topological-ish order of tenant tables for snapshot COPY (R3 worker).
 * Generated from Prisma models with scalar organizationId — refine with FK script when worker lands.
 */
export const TENANT_TABLE_NAMES_FOR_SNAPSHOT: string[] = [
  "departments",
  "job_positions",
  "employees",
  "warehouses",
  "warehouse_bins",
  "products",
  "stock_items",
  "counterparties",
  "counterparty_bank_accounts",
  "invoices",
  "invoice_items",
  "invoice_payments",
  "accounts",
  "transactions",
];
