import { Prisma } from "@erafinance/database";
import { pickLatestTariffRatePerHsCode } from "./customs-tariff-rate-dedupe";

describe("pickLatestTariffRatePerHsCode", () => {
  const d = (n: number) => new Prisma.Decimal(n);
  const day = (y: number, m: number, dnum: number) => new Date(Date.UTC(y, m - 1, dnum));

  it("keeps the row with the latest effective_from per hs_code", () => {
    const older = day(2020, 1, 1);
    const newer = day(2025, 6, 1);
    const out = pickLatestTariffRatePerHsCode([
      {
        hsCode: "8501",
        effectiveFrom: older,
        dutyRatePercent: d(5),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
      {
        hsCode: "8501",
        effectiveFrom: newer,
        dutyRatePercent: d(12),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
    ]);
    expect(out).toHaveLength(1);
    expect(Number(out[0]!.dutyRatePercent.toString())).toBe(12);
  });

  it("treats distinct hs_code prefixes as independent rows", () => {
    const t = day(2000, 1, 1);
    const out = pickLatestTariffRatePerHsCode([
      {
        hsCode: "85",
        effectiveFrom: t,
        dutyRatePercent: d(5),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
      {
        hsCode: "8501",
        effectiveFrom: t,
        dutyRatePercent: d(10),
        vatRatePercent: d(18),
        excisePercent: d(0),
      },
    ]);
    expect(out.map((r) => r.hsCode).sort()).toEqual(["85", "8501"]);
  });
});
