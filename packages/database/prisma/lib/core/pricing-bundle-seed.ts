import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type PricingBundleSeedRow = {
  name: string;
  discountPercent: number;
  moduleKeys: readonly string[];
};

/**
 * Starter rows for `pricing_bundles` (Paket konstruktoru / Super-Admin «Пакеты»).
 * Applied only when the table is empty — same contract as {@link seedPricingModuleIfEmpty}.
 */
export const PRICING_BUNDLE_SEED_DEFAULTS: ReadonlyArray<PricingBundleSeedRow> = [
  {
    name: "Cash & warehouse",
    discountPercent: 10,
    moduleKeys: ["banking_pro", "kassa_pro", "inventory"],
  },
  {
    name: "HR & IFRS",
    discountPercent: 12,
    moduleKeys: ["hr_full", "ifrs_mapping"],
  },
  {
    name: "Trade & operations",
    discountPercent: 15,
    moduleKeys: ["trade_pro", "inventory", "manufacturing"],
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
