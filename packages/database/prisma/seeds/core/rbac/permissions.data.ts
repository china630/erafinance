export const PERMISSIONS = [
  { code: "billing.manage", category: "BILLING", description: "Manage subscription and checkout (Owner-only in product policy)" },
  { code: "accounting.post", category: "ACCOUNTING", description: "Post accounting transactions (ledger)" },
  { code: "invoices.create", category: "SALES", description: "Create sales invoices" },
  { code: "invoices.update", category: "SALES", description: "Update sales invoices" },
  { code: "purchases.manage", category: "PURCHASES", description: "Purchase documents and procurement workflow (no ledger post)" },
  { code: "hr.manage", category: "HR", description: "HR master data, timesheets, absences (non-payroll money)" },
  { code: "inventory.manage", category: "INVENTORY", description: "Stock, warehouses, manufacturing logistics" },
  { code: "psa.manage", category: "PSA", description: "Projects and time entries" },
  { code: "reporting.view", category: "REPORTING", description: "Read financial and operational reports" },
  { code: "admin.system", category: "ADMIN", description: "Platform super-admin operations" },
] as const;
