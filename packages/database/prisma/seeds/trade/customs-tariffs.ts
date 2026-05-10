import type { SeedContext } from "../_engine/upsert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";

type SeedRow = {
  hsCode: string;
  description: string;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
};

export async function seedCustomsTariffs(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  const path = join(__dirname, "..", "..", "..", "data", "customs-tariff-seed.json");
  const rows = JSON.parse(readFileSync(path, "utf-8")) as SeedRow[];
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
