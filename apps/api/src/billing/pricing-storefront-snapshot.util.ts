import { TariffTier } from "@erafinance/database";
import type { MeterUnitPricing } from "../system-config/system-config.service";
import {
  PRICING_STANDARD_MODULE_REGISTRY,
  PRICING_STOREFRONT_BUNDLE_MARKETING,
} from "./pricing-storefront.catalog";

export type PublicPricingModuleRow = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
  isPremium: boolean;
};

export type PublicPricingBundleRow = {
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  isTrialDefault: boolean;
  trialDurationDays: number | null;
};

export type PublicStandardModuleRow = {
  id: string;
  moduleKeys: string[];
  pricePerMonthAzn: number;
};

export type PublicBundleStorefrontRow = PublicPricingBundleRow & {
  marketingId: string;
  listPriceAzn: number;
  discountedPriceAzn: number;
};

export type PublicTierStorefrontRow = {
  id: TariffTier;
  spendCeilingAzn: number;
};

const TIER_ORDER: TariffTier[] = [
  TariffTier.TIER_0,
  TariffTier.TIER_1,
  TariffTier.TIER_2,
  TariffTier.TIER_3,
];

function modulePriceSum(
  keys: readonly string[],
  byKey: Map<string, PublicPricingModuleRow>,
): number {
  let sum = 0;
  for (const k of keys) {
    sum += byKey.get(k)?.pricePerMonth ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

function bundleMarketingId(moduleKeys: string[]): string {
  const sorted = [...moduleKeys].sort().join(",");
  const hit = PRICING_STOREFRONT_BUNDLE_MARKETING.find(
    (m) => [...m.matchModuleKeys].sort().join(",") === sorted,
  );
  if (hit) return hit.marketingId;
  return `bundle_${sorted.replace(/,/g, "_")}`;
}

export function enrichPublicPricingStorefront(input: {
  foundationMonthlyAzn: number;
  pricingModules: PublicPricingModuleRow[];
  pricingBundles: PublicPricingBundleRow[];
  tierSpendCeilingsAzn: Record<string, number>;
  meterUnitPricing: MeterUnitPricing;
}) {
  const byKey = new Map(input.pricingModules.map((m) => [m.key, m]));

  const standardModules: PublicStandardModuleRow[] =
    PRICING_STANDARD_MODULE_REGISTRY.map((reg) => ({
      id: reg.id,
      moduleKeys: [...reg.moduleKeys],
      pricePerMonthAzn: reg.usesFoundation
        ? input.foundationMonthlyAzn
        : modulePriceSum(reg.moduleKeys, byKey),
    }));

  const premiumModules = input.pricingModules
    .filter((m) => m.isPremium)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({
      key: row.key,
      name: row.name,
      pricePerMonth: row.pricePerMonth,
      sortOrder: row.sortOrder,
    }));

  const bundles: PublicBundleStorefrontRow[] = input.pricingBundles
    .filter((b) => !b.isTrialDefault && b.discountPercent < 100)
    .map((b) => {
      const listPriceAzn = modulePriceSum(b.moduleKeys, byKey);
      const discountedPriceAzn =
        Math.round(listPriceAzn * (1 - b.discountPercent / 100) * 100) / 100;
      return {
        ...b,
        marketingId: bundleMarketingId(b.moduleKeys),
        listPriceAzn,
        discountedPriceAzn,
      };
    })
    .filter((b) => b.discountedPriceAzn > 0)
    .sort((a, b) => b.discountedPriceAzn - a.discountedPriceAzn);

  const tiers: PublicTierStorefrontRow[] = TIER_ORDER.map((id) => ({
    id,
    spendCeilingAzn: Number(input.tierSpendCeilingsAzn[id] ?? 0),
  }));

  return { standardModules, premiumModules, bundles, tiers, meterUnitPricing: input.meterUnitPricing };
}
