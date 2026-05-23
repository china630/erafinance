import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PRICING_MODULE_CASH_BANK_PRO } from "./pricing-module-keys";

export type PricingBundleSeedRow = {
  name: string;
  discountPercent: number;
  moduleKeys: readonly string[];
};

/**
 * Starter rows for `pricing_bundles` (Paket konstruktoru / Super-Admin «Пакеты»).
 * Synced with production-like catalog; trial bundle is {@link seedTrial3MonthsBundle}.
 */
export const PRICING_BUNDLE_SEED_DEFAULTS: ReadonlyArray<PricingBundleSeedRow> = [
  {
    name: "Cash & warehouse",
    discountPercent: 15,
    moduleKeys: [PRICING_MODULE_CASH_BANK_PRO, "inventory"],
  },
  {
    name: "HR & IFRS",
    discountPercent: 10,
    moduleKeys: ["hr_full", "ifrs_mapping"],
  },
  {
    name: "Trade & operations",
    discountPercent: 20,
    moduleKeys: ["inventory", "manufacturing"],
  },
];

export async function seedPricingBundleDefaultsIfEmpty(
  prisma: PrismaClient,
): Promise<void> {
  const n = await prisma.pricingBundle.count();
  if (n > 0) return;
  for (const b of PRICING_BUNDLE_SEED_DEFAULTS) {
    await prisma.pricingBundle.create({
      data: {
        name: b.name,
        discountPercent: new Prisma.Decimal(b.discountPercent),
        moduleKeys: [...b.moduleKeys],
        isTrialDefault: false,
      },
    });
  }
}
