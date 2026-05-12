import { Prisma } from "@erafinance/database";
import { CustomsTaxCalculatorService } from "./customs-tax-calculator.service";

describe("CustomsTaxCalculatorService", () => {
  it("applies duty on statistical value then VAT on duty-inclusive base", async () => {
    const rows = [
      {
        hsCode: "85",
        dutyRatePercent: new Prisma.Decimal(10),
        vatRatePercent: new Prisma.Decimal(18),
        excisePercent: new Prisma.Decimal(0),
      },
      {
        hsCode: "00",
        dutyRatePercent: new Prisma.Decimal(0),
        vatRatePercent: new Prisma.Decimal(18),
        excisePercent: new Prisma.Decimal(0),
      },
    ];
    const tariffs = {
      loadActiveRates: jest.fn().mockResolvedValue(rows),
      findBestMatchFromRows: jest.fn((r: typeof rows, hs: string) => {
        const sorted = [...r].sort((a, b) => b.hsCode.length - a.hsCode.length);
        const digits = hs.replace(/\D/g, "");
        for (const row of sorted) {
          if (row.hsCode === "00") continue;
          if (digits.startsWith(row.hsCode)) return { hsCode: row.hsCode, dutyRatePercent: row.dutyRatePercent, vatRatePercent: row.vatRatePercent, excisePercent: row.excisePercent };
        }
        return {
          hsCode: "00",
          dutyRatePercent: sorted.find((x) => x.hsCode === "00")!.dutyRatePercent,
          vatRatePercent: sorted.find((x) => x.hsCode === "00")!.vatRatePercent,
          excisePercent: sorted.find((x) => x.hsCode === "00")!.excisePercent,
        };
      }),
    };

    const calc = new CustomsTaxCalculatorService(tariffs as never);
    const out = await calc.computeLines(
      [
        {
          sequenceNumber: 1,
          hsCode: "8501400000",
          description: "Test",
          quantity: 1,
          unit: null,
          unitOfMeasureCode: null,
          weightNetKg: 0,
          weightGrossKg: 0,
          invoiceValue: 1000,
          statisticalValueAzn: 1000,
          portalDutyAzn: null,
          portalVatAzn: null,
        },
      ],
      new Date("2025-06-01T00:00:00.000Z"),
    );

    expect(tariffs.loadActiveRates).toHaveBeenCalledTimes(1);
    expect(Number(out.totalDuty.toString())).toBeCloseTo(100, 4);
    expect(Number(out.totalVat.toString())).toBeCloseTo(198, 4);
  });
});
