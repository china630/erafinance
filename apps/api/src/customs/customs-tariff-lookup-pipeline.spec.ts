import { Prisma } from "@erafinance/database";
import { pickLatestTariffRatePerHsCode } from "./customs-tariff-rate-dedupe";
import { CustomsTariffRatesService } from "./customs-tariff-rates.service";

describe("Tariff lookup pipeline (dedupe + longest-prefix)", () => {
  const svc = new CustomsTariffRatesService({} as never);
  const d = (n: number) => new Prisma.Decimal(n);
  const day = (y: number, m: number, dayNum: number) => new Date(Date.UTC(y, m - 1, dayNum));

  it("uses latest revision per hs prefix then longest-prefix on item code", () => {
    const asOf = day(2025, 6, 15);
    const rawFromDb = [
      {
        hsCode: "8501",
        effectiveFrom: day(2020, 1, 1),
        dutyRatePercent: d(5),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
      {
        hsCode: "8501",
        effectiveFrom: day(2025, 1, 1),
        dutyRatePercent: d(12),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
      {
        hsCode: "85",
        effectiveFrom: day(2000, 1, 1),
        dutyRatePercent: d(7),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
      {
        hsCode: "00",
        effectiveFrom: day(2000, 1, 1),
        dutyRatePercent: d(0),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
    ].filter((r) => r.effectiveFrom <= asOf);

    const rows = pickLatestTariffRatePerHsCode(rawFromDb);
    const m = svc.findBestMatchFromRows(rows, "8501400000");
    expect(m.hsCode).toBe("8501");
    expect(Number(m.dutyRatePercent.toString())).toBe(12);
  });
});
