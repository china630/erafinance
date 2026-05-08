import { ManufacturingOverheadService } from "./manufacturing-overhead.service";

describe("ManufacturingOverheadService.allocatePeriod", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  it("returns zero allocations when no pools exist for period", async () => {
    const prisma = {
      overheadPool: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      manufacturingRelease: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const accounting = {};
    const svc = new ManufacturingOverheadService(prisma as any, accounting as any);
    const out = await svc.allocatePeriod(orgId, "2026-05");
    expect(out.poolsProcessed).toBe(0);
    expect(out.allocationsCreated).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
