import type { PrismaClient } from "@prisma/client";
import { CURRENCIES } from "../../seeds/core/currencies.data";

/**
 * Idempotent upsert of platform `currencies` (same rows as `prisma db seed` core `seedCurrencies`).
 * Scripts that run without `db:seed` must call this before creating organizations (FK `organizations_currency_fkey`).
 */
export async function ensurePlatformCurrenciesSeeded(prisma: PrismaClient): Promise<void> {
  for (const r of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        symbol: r.symbol,
        decimals: r.decimals,
        nameAz: r.nameAz,
        nameRu: r.nameRu,
        nameEn: r.nameEn,
        sortOrder: r.sortOrder,
        isActive: true,
      },
      update: {
        symbol: r.symbol,
        decimals: r.decimals,
        nameAz: r.nameAz,
        nameRu: r.nameRu,
        nameEn: r.nameEn,
        sortOrder: r.sortOrder,
        isActive: true,
      },
    });
  }
}
