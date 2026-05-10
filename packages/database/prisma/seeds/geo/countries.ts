import type { SeedContext } from "../_engine/upsert";

const COUNTRIES = [
  { iso2: "AZ", iso3: "AZE", dialingCode: "+994", currencyCode: "AZN", nameAz: "Azərbaycan", nameRu: "Азербайджан", nameEn: "Azerbaijan", sortOrder: 0 },
  { iso2: "TR", iso3: "TUR", dialingCode: "+90", currencyCode: "TRY", nameAz: "Türkiyə", nameRu: "Турция", nameEn: "Turkey", sortOrder: 1 },
  { iso2: "GE", iso3: "GEO", dialingCode: "+995", currencyCode: "GEL", nameAz: "Gürcüstan", nameRu: "Грузия", nameEn: "Georgia", sortOrder: 2 },
  { iso2: "US", iso3: "USA", dialingCode: "+1", currencyCode: "USD", nameAz: "ABŞ", nameRu: "США", nameEn: "United States", sortOrder: 3 },
] as const;

export async function seedCountries(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of COUNTRIES) {
    await ctx.prisma.country.upsert({
      where: { iso2: row.iso2 },
      create: row,
      update: row,
    });
  }
}
