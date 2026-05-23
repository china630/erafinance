/** Response shape of `GET /api/public/pricing` (read-only marketing storefront). */

export type MeterUnitPricing = {
  pricePerUserMonthAzn: number;
  pricePerGbMonthAzn: number;
  pricePerWhatsappAlertAzn: number;
  pricePerInvoiceAzn: number;
  pricePerOcrPageAzn: number;
};

export type PublicPricingModule = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
};

export type PublicPricingBundle = {
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  isTrialDefault: boolean;
  trialDurationDays: number | null;
};

export type PublicStandardModule = {
  id: string;
  moduleKeys: string[];
  pricePerMonthAzn: number;
};

export type PublicBundleStorefront = PublicPricingBundle & {
  marketingId: string;
  listPriceAzn: number;
  discountedPriceAzn: number;
};

export type PublicPremiumModule = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
};

export type PublicTierStorefront = {
  id: "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
  spendCeilingAzn: number;
};

export type PublicPricingResponse = {
  currency: "AZN";
  foundationMonthlyAzn: number;
  yearlyDiscountPercent: number;
  pricingModules: PublicPricingModule[];
  pricingBundles: PublicPricingBundle[];
  meterUnitPricing: MeterUnitPricing;
  tierSpendCeilings: Partial<Record<string, number>>;
  ocrJobsPerOrgMonth: number | null;
  standardModules?: PublicStandardModule[];
  premiumModules?: PublicPremiumModule[];
  bundles?: PublicBundleStorefront[];
  tiers?: PublicTierStorefront[];
  unavailable?: true;
};
