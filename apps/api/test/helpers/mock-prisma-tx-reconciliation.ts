/**
 * Transaction clients passed to inventory flows must include `inventoryAudit`
 * because {@link assertWarehouseNotUnderReconciliation} reads it.
 */
export function mockTxInventoryReconciliationClear(): {
  inventoryAudit: { findFirst: jest.Mock };
} {
  return {
    inventoryAudit: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}
