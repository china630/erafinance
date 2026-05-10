import { Prisma, UnitOfMeasureKind } from "@prisma/client";
import type { SeedContext } from "../_engine/upsert";

const UOMS = [
  { code: "pcs", kind: UnitOfMeasureKind.COUNT, factor: "1", nameAz: "ədəd", nameRu: "шт", nameEn: "pcs", sortOrder: 0 },
  { code: "kg", kind: UnitOfMeasureKind.WEIGHT, factor: "1", nameAz: "kq", nameRu: "кг", nameEn: "kg", sortOrder: 1 },
  { code: "m", kind: UnitOfMeasureKind.LENGTH, factor: "1", nameAz: "m", nameRu: "м", nameEn: "m", sortOrder: 2 },
  { code: "m2", kind: UnitOfMeasureKind.AREA, factor: "1", nameAz: "m²", nameRu: "м²", nameEn: "m2", sortOrder: 3 },
  { code: "pack", kind: UnitOfMeasureKind.PACK, factor: "1", nameAz: "paçka", nameRu: "пачка", nameEn: "pack", sortOrder: 4 },
  { code: "litre", kind: UnitOfMeasureKind.VOLUME, factor: "1", nameAz: "litr", nameRu: "литр", nameEn: "litre", sortOrder: 5 },
  { code: "hour", kind: UnitOfMeasureKind.TIME, factor: "1", nameAz: "saat", nameRu: "час", nameEn: "hour", sortOrder: 6 },
] as const;

export async function seedUnitsOfMeasure(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of UOMS) {
    await ctx.prisma.unitOfMeasure.upsert({
      where: { code: row.code },
      create: { ...row, factor: new Prisma.Decimal(row.factor), isActive: true },
      update: { ...row, factor: new Prisma.Decimal(row.factor), isActive: true },
    });
  }
}
