import { ConflictException } from "@nestjs/common";
import { InventoryAuditStatus, Prisma } from "@erafinance/database";

type Tx = Prisma.TransactionClient;

/**
 * Blocks any StockMovement while another inventory reconciliation is in COUNTING or REVIEW for the warehouse.
 * Pass `exceptAuditId` when posting movements for that same audit (e.g. `complete`).
 */
export async function assertWarehouseNotUnderReconciliation(
  tx: Tx,
  organizationId: string,
  warehouseId: string,
  opts?: { exceptAuditId?: string },
): Promise<void> {
  const active = await tx.inventoryAudit.findFirst({
    where: {
      organizationId,
      warehouseId,
      status: { in: [InventoryAuditStatus.COUNTING, InventoryAuditStatus.REVIEW] },
      deletedAt: null,
      ...(opts?.exceptAuditId ? { id: { not: opts.exceptAuditId } } : {}),
    },
    select: { id: true },
  });
  if (active) {
    throw new ConflictException({
      code: "WAREHOUSE_LOCKED_FOR_RECONCILIATION",
      warehouseId,
      auditId: active.id,
    });
  }
}
