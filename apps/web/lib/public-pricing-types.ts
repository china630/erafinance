/** Response shape of `GET /api/public/pricing` (read-only marketing). */

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

export type PublicTierQuotas = {
  maxEmployees: number | null;
  maxInvoicesPerMonth: number | null;
  maxStorageGb: number | null;
};

export type PublicPricingResponse = {
  currency: "AZN";
  foundationMonthlyAzn: number;
  yearlyDiscountPercent: number;
  pricingModules: PublicPricingModule[];
  pricingBundles: PublicPricingBundle[];
  tierLegacyPricePerMonthAzn: Partial<Record<string, number>>;
  tierQuotasIncluded: Record<string, PublicTierQuotas>;
  quotaUnitPricing: unknown;
  ocrJobsPerOrgMonth: number | null;
  unavailable?: true;
};
