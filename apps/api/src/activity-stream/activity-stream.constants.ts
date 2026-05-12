/** URL/API slug → must match `ActivityStreamService` resolution + web `entityType` param. */
export const ACTIVITY_ENTITY_SLUGS = [
  "invoice",
  "counterparty",
  "employee",
  "product",
  "inventory_audit",
  "payroll_slip",
  "customs_declaration",
] as const;

export type ActivityEntitySlug = (typeof ACTIVITY_ENTITY_SLUGS)[number];

export function isActivityEntitySlug(v: string): v is ActivityEntitySlug {
  return (ACTIVITY_ENTITY_SLUGS as readonly string[]).includes(v);
}

/** Maps Prisma `AuditLog.entityType` / domain model name to activity stream slug. */
export const AUDIT_ENTITY_TYPE_TO_SLUG: Record<string, ActivityEntitySlug> = {
  Invoice: "invoice",
  Counterparty: "counterparty",
  Employee: "employee",
  Product: "product",
  InventoryAudit: "inventory_audit",
  PayrollSlip: "payroll_slip",
  CustomsDeclaration: "customs_declaration",
};

/** Inverse map for Audit Hub timeline (slug → AuditLog.entityType). */
export const ACTIVITY_SLUG_TO_AUDIT_ENTITY_TYPE = Object.fromEntries(
  Object.entries(AUDIT_ENTITY_TYPE_TO_SLUG).map(([entityType, slug]) => [
    slug,
    entityType,
  ]),
) as Record<ActivityEntitySlug, string>;
