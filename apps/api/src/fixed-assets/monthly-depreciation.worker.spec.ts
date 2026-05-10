import { ConfigService } from "@nestjs/config";
import { MonthlyDepreciationWorker } from "./monthly-depreciation.worker";
import { FixedAssetsService } from "./fixed-assets.service";
import { PrismaService } from "../prisma/prisma.service";
import * as tenantContext from "../prisma/tenant-context";

describe("MonthlyDepreciationWorker", () => {
  it("runs depreciation per organization under tenant context", async () => {
    const runSpy = jest
      .spyOn(tenantContext, "runWithTenantContextAsync")
      .mockImplementation(async (_store, fn) => fn());

    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([{ id: "o1" }, { id: "o2" }]),
      },
    } as unknown as PrismaService;

    const fixedAssets = {
      runMonthlyDepreciation: jest.fn().mockResolvedValue(undefined),
    } as unknown as FixedAssetsService;

    const config = {
      get: jest.fn().mockReturnValue("redis://127.0.0.1:6379"),
    } as unknown as ConfigService;

    const worker = new MonthlyDepreciationWorker(
      config,
      prisma,
      fixedAssets,
    );

    await (worker as unknown as { handle: (j: { name: string }) => Promise<void> }).handle({
      name: "monthly_depreciation",
    });

    expect(prisma.organization.findMany).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(fixedAssets.runMonthlyDepreciation).toHaveBeenCalledTimes(2);
    expect(fixedAssets.runMonthlyDepreciation).toHaveBeenCalledWith(
      "o1",
      expect.objectContaining({ year: expect.any(Number), month: expect.any(Number) }),
    );

    runSpy.mockRestore();
  });
});
