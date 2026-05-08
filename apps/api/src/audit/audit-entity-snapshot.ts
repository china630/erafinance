import type { PrismaService } from "../prisma/prisma.service";

/**
 * Full-row fetch for audit `oldValues` / `newValues` (masked later in AuditService).
 * Keys are Prisma model / `entityType` strings used in `AuditLog`.
 */
export async function loadEntitySnapshotForAudit(
  prisma: PrismaService,
  entityType: string,
  organizationId: string,
  entityId: string,
): Promise<unknown | null> {
  switch (entityType) {
    case "Invoice":
      return prisma.invoice.findFirst({
        where: { id: entityId, organizationId },
        include: { items: true, payments: true },
      });
    case "InvoiceItem":
      return prisma.invoiceItem.findFirst({
        where: { id: entityId, organizationId },
      });
    case "InvoicePayment":
      return prisma.invoicePayment.findFirst({
        where: { id: entityId, organizationId },
      });
    case "Product":
      return prisma.product.findFirst({
        where: { id: entityId, organizationId },
      });
    case "Employee":
      return prisma.employee.findFirst({
        where: { id: entityId, organizationId },
        include: {
          jobPosition: {
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });
    case "Counterparty":
      return prisma.counterparty.findFirst({
        where: { id: entityId, organizationId },
        include: { bankAccounts: true },
      });
    case "CounterpartyBankAccount":
      return prisma.counterpartyBankAccount.findFirst({
        where: { id: entityId },
      });
    case "CustomsDeclaration":
      return prisma.customsDeclaration.findFirst({
        where: { id: entityId, organizationId },
      });
    case "Warehouse":
      return prisma.warehouse.findFirst({
        where: { id: entityId, organizationId },
      });
    case "WarehouseBin":
      return prisma.warehouseBin.findFirst({
        where: { id: entityId, organizationId },
      });
    case "StockItem":
      return prisma.stockItem.findFirst({
        where: { id: entityId, organizationId },
      });
    case "Department":
      return prisma.department.findFirst({
        where: { id: entityId, organizationId },
      });
    case "JobPosition":
      return prisma.jobPosition.findFirst({
        where: { id: entityId },
      });
    case "Account":
      return prisma.account.findFirst({
        where: { id: entityId, organizationId },
      });
    case "AccountMapping":
      return prisma.accountMapping.findFirst({
        where: { id: entityId, organizationId },
      });
    case "IfrsMappingRule":
      return prisma.ifrsMappingRule.findFirst({
        where: { id: entityId, organizationId },
      });
    case "OrganizationBankAccount":
      return prisma.organizationBankAccount.findFirst({
        where: { id: entityId, organizationId },
      });
    case "CashDesk":
      return prisma.cashDesk.findFirst({
        where: { id: entityId, organizationId },
      });
    case "CashFlowItem":
      return prisma.cashFlowItem.findFirst({
        where: { id: entityId, organizationId },
      });
    case "CashOrder":
      return prisma.cashOrder.findFirst({
        where: { id: entityId, organizationId },
      });
    case "AdvanceReport":
      return prisma.advanceReport.findFirst({
        where: { id: entityId, organizationId },
      });
    case "BankPaymentDraft":
      return prisma.bankPaymentDraft.findFirst({
        where: { id: entityId, organizationId },
      });
    case "Timesheet":
      return prisma.timesheet.findFirst({
        where: { id: entityId, organizationId },
      });
    case "TimesheetEntry":
      return prisma.timesheetEntry.findFirst({
        where: { id: entityId },
      });
    case "Absence":
      return prisma.absence.findFirst({
        where: { id: entityId, organizationId },
      });
    case "PayrollRun":
      return prisma.payrollRun.findFirst({
        where: { id: entityId, organizationId },
      });
    case "PayrollSlip":
      return prisma.payrollSlip.findFirst({
        where: { id: entityId, organizationId },
      });
    case "SalaryRegistry":
      return prisma.salaryRegistry.findFirst({
        where: { id: entityId, organizationId },
      });
    case "ProductRecipe":
      return prisma.productRecipe.findFirst({
        where: { id: entityId, organizationId },
        include: { lines: true, byproducts: true },
      });
    case "ProductRecipeLine":
      return prisma.productRecipeLine.findFirst({
        where: { id: entityId },
      });
    case "ProductRecipeByproduct":
      return prisma.productRecipeByproduct.findFirst({
        where: { id: entityId },
      });
    case "FixedAsset":
      return prisma.fixedAsset.findFirst({
        where: { id: entityId, organizationId },
      });
    case "FixedAssetDepreciationMonth":
      return prisma.fixedAssetDepreciationMonth.findFirst({
        where: { id: entityId, organizationId },
      });
    case "InventoryAudit":
      return prisma.inventoryAudit.findFirst({
        where: { id: entityId, organizationId },
        include: { lines: true },
      });
    case "InventoryAuditLine":
      return prisma.inventoryAuditLine.findFirst({
        where: { id: entityId, organizationId },
      });
    case "InventoryAdjustment":
      return prisma.inventoryAdjustment.findFirst({
        where: { id: entityId, organizationId },
        include: { lines: true },
      });
    case "InventoryAdjustmentLine":
      return prisma.inventoryAdjustmentLine.findFirst({
        where: { id: entityId },
      });
    case "TaxDeclarationExport":
      return prisma.taxDeclarationExport.findFirst({
        where: { id: entityId, organizationId },
      });
    case "OrganizationInvite":
      return prisma.organizationInvite.findFirst({
        where: { id: entityId, organizationId },
      });
    case "AccessRequest":
      return prisma.accessRequest.findFirst({
        where: { id: entityId, organizationId },
      });
    case "Notification":
      return prisma.notification.findFirst({
        where: { id: entityId },
      });
    default:
      return null;
  }
}

/** Path rules: normalized path (no /api prefix) → entity type + id capture group index. */
export const AUDIT_SNAPSHOT_PATH_RULES: Array<{
  pattern: RegExp;
  entityType: string;
  methods: Set<string>;
}> = [
  {
    pattern: /^\/invoices\/([^/]+)/,
    entityType: "Invoice",
    methods: new Set(["PATCH", "DELETE", "PUT"]),
  },
  {
    pattern: /^\/products\/([^/]+)$/,
    entityType: "Product",
    methods: new Set(["PATCH", "DELETE", "PUT"]),
  },
  {
    pattern: /^\/counterparties\/([^/]+)$/,
    entityType: "Counterparty",
    methods: new Set(["PATCH", "DELETE", "PUT"]),
  },
  {
    pattern: /^\/hr\/employees\/([^/]+)/,
    entityType: "Employee",
    methods: new Set(["PATCH", "DELETE", "PUT"]),
  },
  {
    pattern: /^\/hr\/departments\/([^/]+)$/,
    entityType: "Department",
    methods: new Set(["PATCH", "DELETE", "PUT"]),
  },
  {
    pattern: /^\/customs\/declarations\/([^/]+)/,
    entityType: "CustomsDeclaration",
    methods: new Set(["PATCH", "DELETE", "PUT"]),
  },
];

export function matchAuditSnapshotPath(
  normalizedPath: string,
  method: string,
): { entityType: string; entityId: string } | null {
  for (const rule of AUDIT_SNAPSHOT_PATH_RULES) {
    if (!rule.methods.has(method)) {
      continue;
    }
    const m = rule.pattern.exec(normalizedPath);
    if (m?.[1]) {
      return { entityType: rule.entityType, entityId: m[1] };
    }
  }
  return null;
}
