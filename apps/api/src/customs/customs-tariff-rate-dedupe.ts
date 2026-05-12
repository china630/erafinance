import { Prisma } from "@erafinance/database";

export type TariffRateRow = {
  hsCode: string;
  dutyRatePercent: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  excisePercent: Prisma.Decimal;
};

/** One revision per hs_code: latest effective_from wins among rows active on `asOf`. */
export function pickLatestTariffRatePerHsCode<
  T extends {
    hsCode: string;
    effectiveFrom: Date;
    dutyRatePercent: Prisma.Decimal;
    vatRatePercent: Prisma.Decimal;
    excisePercent: Prisma.Decimal;
  },
>(rows: T[]): TariffRateRow[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const prev = best.get(r.hsCode);
    if (!prev || r.effectiveFrom > prev.effectiveFrom) {
      best.set(r.hsCode, r);
    }
  }
  return [...best.values()].map((r) => ({
    hsCode: r.hsCode,
    dutyRatePercent: r.dutyRatePercent,
    vatRatePercent: r.vatRatePercent,
    excisePercent: r.excisePercent,
  }));
}
