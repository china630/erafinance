import { TariffTier } from "@erafinance/database";

/** Fallback when `pricing_modules.is_premium` is empty (dev / migration gap). */
export const DEFAULT_PREMIUM_MODULE_SLUGS = [
  "tax_pro",
  "trade_pro",
  "compliance_pro",
  "audit_hub",
] as const;

/** @deprecated Use `PricingService.isPremiumModuleKey` + DB flag `is_premium`. */
export const PREMIUM_MODULE_SLUGS = DEFAULT_PREMIUM_MODULE_SLUGS;

export type PremiumModuleSlug = (typeof DEFAULT_PREMIUM_MODULE_SLUGS)[number];

export function isPremiumModuleSlug(
  slug: string,
  premiumKeys?: ReadonlySet<string>,
): slug is PremiumModuleSlug {
  const set = premiumKeys ?? new Set(DEFAULT_PREMIUM_MODULE_SLUGS);
  return set.has(slug);
}

export type TariffResourceLimits = {
  maxUsers: number;
  maxWorkspaces: number;
  maxWhatsappAlertsPerMonth: number;
  maxOcrPagesPerMonth: number;
  maxInvoicesPerMonth: number;
  /** Base ERP platform fee when not in active trial window (AZN). */
  baseMonthlyFeeAzn: number;
};

export const TARIFF_TIER_LIMITS: Record<TariffTier, TariffResourceLimits> = {
  [TariffTier.TIER_0]: {
    maxUsers: 2,
    maxWorkspaces: 1,
    maxWhatsappAlertsPerMonth: 20,
    maxOcrPagesPerMonth: 10,
    maxInvoicesPerMonth: 20,
    baseMonthlyFeeAzn: 0,
  },
  [TariffTier.TIER_1]: {
    maxUsers: 5,
    maxWorkspaces: 1,
    maxWhatsappAlertsPerMonth: 100,
    maxOcrPagesPerMonth: 50,
    maxInvoicesPerMonth: 100,
    baseMonthlyFeeAzn: 49,
  },
  [TariffTier.TIER_2]: {
    maxUsers: 15,
    maxWorkspaces: 3,
    maxWhatsappAlertsPerMonth: 500,
    maxOcrPagesPerMonth: 250,
    maxInvoicesPerMonth: 500,
    baseMonthlyFeeAzn: 129,
  },
  [TariffTier.TIER_3]: {
    maxUsers: 50,
    maxWorkspaces: 10,
    maxWhatsappAlertsPerMonth: 2000,
    maxOcrPagesPerMonth: 1000,
    maxInvoicesPerMonth: 5000,
    baseMonthlyFeeAzn: 299,
  },
};

/**
 * Fallback commercial rates for premium add-ons (AZN / month).
 * Runtime billing prefers `pricing_modules.price_per_month` when present.
 */
export const PREMIUM_MODULE_MONTHLY_AZN: Record<PremiumModuleSlug, number> = {
  tax_pro: 19,
  trade_pro: 19,
  compliance_pro: 99,
  audit_hub: 99,
};
