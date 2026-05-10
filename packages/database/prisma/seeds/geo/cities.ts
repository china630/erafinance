import type { SeedContext } from "../_engine/upsert";

const CITIES = [
  { code: "AZ_BAKU", countryIso2: "AZ", region: "Absheron", isCapital: true, nameAz: "Bakı", nameRu: "Баку", nameEn: "Baku", sortOrder: 0 },
  { code: "AZ_GANJA", countryIso2: "AZ", region: "Ganja-Dashkasan", isCapital: false, nameAz: "Gəncə", nameRu: "Гянджа", nameEn: "Ganja", sortOrder: 1 },
  { code: "AZ_SUMQAYIT", countryIso2: "AZ", region: "Absheron", isCapital: false, nameAz: "Sumqayıt", nameRu: "Сумгаит", nameEn: "Sumqayit", sortOrder: 2 },
  { code: "AZ_MINGACHEVIR", countryIso2: "AZ", region: "Mingachevir", isCapital: false, nameAz: "Mingəçevir", nameRu: "Мингячевир", nameEn: "Mingachevir", sortOrder: 3 },
  { code: "AZ_LANKARAN", countryIso2: "AZ", region: "Lankaran", isCapital: false, nameAz: "Lənkəran", nameRu: "Ленкорань", nameEn: "Lankaran", sortOrder: 4 },
  { code: "AZ_SHEKI", countryIso2: "AZ", region: "Shaki-Zagatala", isCapital: false, nameAz: "Şəki", nameRu: "Шеки", nameEn: "Sheki", sortOrder: 5 },
  { code: "AZ_QUBA", countryIso2: "AZ", region: "Quba-Khachmaz", isCapital: false, nameAz: "Quba", nameRu: "Губа", nameEn: "Quba", sortOrder: 6 },
] as const;

export async function seedCities(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  for (const row of CITIES) {
    await ctx.prisma.city.upsert({
      where: { code: row.code },
      create: row,
      update: row,
    });
  }
}
