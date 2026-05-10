import { Prisma, TaxRateKind } from "@prisma/client";
import type { SeedContext } from "../_engine/upsert";

const TAX_RATES = [
  { code: "EDV_18", kind: TaxRateKind.VAT, percent: 18, nameAz: "ƏDV 18%", nameRu: "НДС 18%", nameEn: "VAT 18%", sortOrder: 0 },
  { code: "EDV_8", kind: TaxRateKind.VAT, percent: 8, nameAz: "ƏDV 8%", nameRu: "НДС 8%", nameEn: "VAT 8%", sortOrder: 1 },
  { code: "EDV_2", kind: TaxRateKind.VAT, percent: 2, nameAz: "ƏDV 2%", nameRu: "НДС 2%", nameEn: "VAT 2%", sortOrder: 2 },
  { code: "EDV_0", kind: TaxRateKind.VAT, percent: 0, nameAz: "ƏDV 0%", nameRu: "НДС 0%", nameEn: "VAT 0%", sortOrder: 3 },
  { code: "EDV_EXEMPT", kind: TaxRateKind.VAT, percent: 0, nameAz: "ƏDV-dən azad", nameRu: "Освобождено от НДС", nameEn: "VAT exempt", sortOrder: 4 },
  { code: "EXCISE_TOBACCO", kind: TaxRateKind.EXCISE, percent: 35, nameAz: "Aksiz (tütün)", nameRu: "Акциз (табак)", nameEn: "Excise (tobacco)", sortOrder: 10 },
] as const;

export async function seedTaxRates(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of TAX_RATES) {
    await ctx.prisma.taxRate.upsert({
      where: { code: row.code },
      create: {
        ...row,
        region: "AZ",
        isActive: true,
        effectiveFrom: new Date("2000-01-01"),
        percent: new Prisma.Decimal(row.percent),
      },
      update: {
        ...row,
        region: "AZ",
        isActive: true,
        effectiveFrom: new Date("2000-01-01"),
        percent: new Prisma.Decimal(row.percent),
      },
    });
  }
}
