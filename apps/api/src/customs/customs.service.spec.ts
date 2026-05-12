import { Prisma } from "@erafinance/database";
import { CustomsService } from "./customs.service";

describe("CustomsService", () => {
  const syncRuns = {
    start: jest.fn().mockResolvedValue("run-1"),
    complete: jest.fn().mockResolvedValue(undefined),
  };

  const counterparties = {
    findOrCreateByVoen: jest.fn().mockResolvedValue({ id: "cp-1" }),
  };

  it("createDraftFromCapture returns deduplicated when BGD exists", async () => {
    const prisma = {
      customsDeclaration: {
        findUnique: jest.fn().mockResolvedValue({ id: "existing-id" }),
      },
      $transaction: jest.fn(),
    };
    const taxCalculator = { computeLines: jest.fn() };
    const service = new CustomsService(
      prisma as never,
      {} as never,
      syncRuns as never,
      counterparties as never,
      taxCalculator as never,
    );
    const out = await service.createDraftFromCapture(
      "00000000-0000-0000-0000-000000000099",
      {
        bgdNumber: "BGD-1",
        bgdDate: "2025-01-01",
        currency: "AZN",
        customsValueAzn: 1,
        customsDutyAzn: 0,
        customsVatAzn: 0,
        feesAzn: 0,
        source: "WIDGET",
        capturedAt: new Date().toISOString(),
      },
      "00000000-0000-0000-0000-000000000088",
    );
    expect(out).toEqual({
      id: "existing-id",
      bgdNumber: "BGD-1",
      deduplicated: true,
    });
    expect(syncRuns.start).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(taxCalculator.computeLines).not.toHaveBeenCalled();
  });

  it("createDraftFromCapture inserts declaration with items and completes sync run", async () => {
    const taxCalc = {
      computeLines: jest.fn().mockResolvedValue({
        lines: [
          {
            sequenceNumber: 1,
            dutyRatePercent: new Prisma.Decimal(15),
            vatRatePercent: new Prisma.Decimal(18),
            excisePercent: new Prisma.Decimal(0),
            calculatedDutyAzn: new Prisma.Decimal(0.15),
            calculatedExciseAzn: new Prisma.Decimal(0),
            calculatedVatAzn: new Prisma.Decimal(0.0207),
          },
        ],
        totalDuty: new Prisma.Decimal(0.15),
        totalVat: new Prisma.Decimal(0.0207),
        totalExcise: new Prisma.Decimal(0),
      }),
    };

    const txCreate = jest.fn().mockResolvedValue({ id: "new-id", bgdNumber: "BGD-NEW" });
    const prisma = {
      customsDeclaration: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          customsDeclaration: { create: txCreate },
        }),
      ),
    };
    const service = new CustomsService(
      prisma as never,
      {} as never,
      syncRuns as never,
      counterparties as never,
      taxCalc as never,
    );
    const out = await service.createDraftFromCapture(
      "00000000-0000-0000-0000-000000000099",
      {
        bgdNumber: "BGD-NEW",
        bgdDate: "2025-02-01",
        currency: "AZN",
        customsValueAzn: 10,
        customsDutyAzn: 1,
        customsVatAzn: 2,
        feesAzn: 0,
        source: "WIDGET",
        capturedAt: new Date().toISOString(),
      },
      "00000000-0000-0000-0000-000000000088",
    );
    expect(out.deduplicated).toBe(false);
    expect(out.id).toBe("new-id");
    expect(syncRuns.start).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "00000000-0000-0000-0000-000000000099",
        portal: "CUSTOMS",
        flow: "bgd-capture-full",
        transport: "RPA_WIDGET",
      }),
      expect.anything(),
    );
    expect(txCreate).toHaveBeenCalled();
    expect(syncRuns.complete).toHaveBeenCalled();
  });
});
