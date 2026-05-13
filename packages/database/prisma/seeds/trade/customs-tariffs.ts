import type { SeedContext } from "../_engine/upsert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";

/** Same layout as `prisma/catalog/national/*.json` — versioned trade reference data. */
export const CUSTOMS_TARIFF_RATES_CATALOG_PATH = join(
  __dirname,
  "..",
  "..",
  "catalog",
  "trade",
  "customs-tariff-rates.json",
);

type SeedRow = {
  hsCode: string;
  description: string;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
};

/**
 * Trade layer: upsert `customs_tariff_rates` from `prisma/catalog/trade/customs-tariff-rates.json`.
 * Regenerate that file from the AZ act MD via `npm run db:parse-az-customs-md` (overwrites the catalog JSON).
 */
export async function seedCustomsTariffs(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  const rows = JSON.parse(readFileSync(CUSTOMS_TARIFF_RATES_CATALOG_PATH, "utf-8")) as SeedRow[];
  const effectiveFrom = new Date("2000-01-01T00:00:00.000Z");
  for (const r of rows) {
    const hs = r.hsCode.replace(/\D/g, "").trim();
    if (!hs) continue;
    await ctx.prisma.customsTariffRate.upsert({
      where: {
        hsCode_effectiveFrom: { hsCode: hs, effectiveFrom },
      },
      create: {
        hsCode: hs,
        description: r.description,
        dutyRatePercent: new Prisma.Decimal(r.dutyRatePercent),
        vatRatePercent: new Prisma.Decimal(r.vatRatePercent),
        excisePercent: new Prisma.Decimal(r.excisePercent),
        effectiveFrom,
      },
      update: {
        description: r.description,
        dutyRatePercent: new Prisma.Decimal(r.dutyRatePercent),
        vatRatePercent: new Prisma.Decimal(r.vatRatePercent),
        excisePercent: new Prisma.Decimal(r.excisePercent),
        deletedAt: null,
      },
    });
  }
}
