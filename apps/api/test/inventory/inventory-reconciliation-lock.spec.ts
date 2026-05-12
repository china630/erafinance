import { ConflictException } from "@nestjs/common";
import { InventoryAuditStatus } from "@erafinance/database";
import { assertWarehouseNotUnderReconciliation } from "../../src/inventory/inventory-reconciliation-lock";

describe("assertWarehouseNotUnderReconciliation", () => {
  it("throws when another audit is COUNTING", async () => {
    const tx = {
      inventoryAudit: {
        findFirst: jest.fn().mockResolvedValue({ id: "other-audit" }),
      },
    } as any;

    await expect(
      assertWarehouseNotUnderReconciliation(tx, "org-1", "wh-1"),
    ).rejects.toThrow(ConflictException);
  });

  it("passes when no active audit", async () => {
    const tx = {
      inventoryAudit: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await assertWarehouseNotUnderReconciliation(tx, "org-1", "wh-1");
    expect(tx.inventoryAudit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [InventoryAuditStatus.COUNTING, InventoryAuditStatus.REVIEW] },
        }),
      }),
    );
  });

  it("ignores current audit when exceptAuditId is set", async () => {
    const tx = {
      inventoryAudit: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await assertWarehouseNotUnderReconciliation(tx, "org-1", "wh-1", {
      exceptAuditId: "self-audit",
    });
    expect(tx.inventoryAudit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "self-audit" },
        }),
      }),
    );
  });
});
