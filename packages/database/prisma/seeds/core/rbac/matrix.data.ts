/**
 * Coarse Role → Permission grants for catalog seeding (PRD §7.9).
 * Endpoint-level guards remain source of truth until Policy Guard consumes this matrix.
 *
 * - OWNER: full org power including billing (PRD §7.12.1).
 * - ADMIN: operational admin without billing.manage or platform admin.system.
 * - PROCUREMENT: purchases + inventory ops, no accounting.post.
 * - AUDITOR: read-only reporting surface.
 * - WAREHOUSE_KEEPER: inventory only.
 * - HR_* / DEPARTMENT_HEAD: HR catalog; payroll money stays Owner/Accountant in API.
 * - SUPER_ADMIN: all flags for platform row (future use).
 */
export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  OWNER: [
    "billing.manage",
    "accounting.post",
    "invoices.create",
    "invoices.update",
    "purchases.manage",
    "hr.manage",
    "inventory.manage",
    "psa.manage",
    "reporting.view",
    "admin.system",
  ],
  ADMIN: [
    "accounting.post",
    "invoices.create",
    "invoices.update",
    "purchases.manage",
    "hr.manage",
    "inventory.manage",
    "psa.manage",
    "reporting.view",
  ],
  ACCOUNTANT: [
    "accounting.post",
    "invoices.create",
    "invoices.update",
    "purchases.manage",
    "reporting.view",
  ],
  USER: ["invoices.create"],
  PROCUREMENT: ["purchases.manage", "inventory.manage"],
  AUDITOR: ["reporting.view"],
  WAREHOUSE_KEEPER: ["inventory.manage"],
  HR_OFFICER: ["hr.manage"],
  HR_MANAGER: ["hr.manage"],
  DEPARTMENT_HEAD: ["hr.manage", "reporting.view"],
  DIRECTOR: ["reporting.view", "invoices.create", "invoices.update"],
  SUPER_ADMIN: [
    "billing.manage",
    "accounting.post",
    "invoices.create",
    "invoices.update",
    "purchases.manage",
    "hr.manage",
    "inventory.manage",
    "psa.manage",
    "reporting.view",
    "admin.system",
  ],
};
