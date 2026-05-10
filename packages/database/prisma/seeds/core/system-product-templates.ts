import { Prisma, SystemProductKind } from "@prisma/client";
import type { SeedContext } from "../_engine/upsert";
import { seedTaxRates } from "../national/tax-rates";
import { seedUnitsOfMeasure } from "../trade/units-of-measure";

const SYSTEM_PRODUCTS = [
  {
    code: "__PSA_HOUR__",
    kind: SystemProductKind.SERVICE,
    defaultUomCode: "hour",
    defaultVatRateCode: "EDV_18",
    defaultPrice: new Prisma.Decimal(0),
    nameAz: "PSA saatı",
    nameRu: "PSA час",
    nameEn: "PSA hour",
    sortOrder: 0,
  },
  {
    code: "__DELIVERY__",
    kind: SystemProductKind.SERVICE,
    defaultUomCode: "pcs",
    defaultVatRateCode: "EDV_18",
    defaultPrice: new Prisma.Decimal(0),
    nameAz: "Çatdırılma",
    nameRu: "Доставка",
    nameEn: "Delivery",
    sortOrder: 1,
  },
] as const;

export async function seedSystemProductTemplates(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  await seedUnitsOfMeasure(ctx);
  if (ctx.region === "AZ") {
    await seedTaxRates(ctx);
  }
  for (const row of SYSTEM_PRODUCTS) {
    await ctx.prisma.systemProductTemplate.upsert({
      where: { code: row.code },
      create: { ...row, isActive: true },
      update: { ...row, isActive: true },
    });
  }
}
