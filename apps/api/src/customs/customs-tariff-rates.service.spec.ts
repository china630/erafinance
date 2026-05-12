import { Prisma } from "@erafinance/database";
import { CustomsTariffRatesService } from "./customs-tariff-rates.service";

describe("CustomsTariffRatesService.findBestMatchFromRows", () => {
  const svc = new CustomsTariffRatesService({} as never);

  it("prefers longest HS prefix", () => {
    const rows = [
      {
        hsCode: "85",
        dutyRatePercent: new Prisma.Decimal(5),
        vatRatePercent: new Prisma.Decimal(18),
        excisePercent: new Prisma.Decimal(0),
      },
      {
        hsCode: "8501",
        dutyRatePercent: new Prisma.Decimal(12),
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
    const m = svc.findBestMatchFromRows(rows, "8501400000");
    expect(m.hsCode).toBe("8501");
    expect(Number(m.dutyRatePercent.toString())).toBe(12);
  });

  it("falls back to 00", () => {
    const rows = [
      {
        hsCode: "00",
        dutyRatePercent: new Prisma.Decimal(0),
        vatRatePercent: new Prisma.Decimal(18),
        excisePercent: new Prisma.Decimal(0),
      },
    ];
    const m = svc.findBestMatchFromRows(rows, "999999");
    expect(m.hsCode).toBe("00");
  });
});
