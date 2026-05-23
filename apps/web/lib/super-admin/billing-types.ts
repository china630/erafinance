export type TierKey = "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";

export type BillingPayload = {
  prices: Record<string, number>;
  quotas: Record<string, unknown>;
  ocrJobsPerOrgMonth: number;
  foundationMonthlyAzn: number;
  yearlyDiscountPercent: number;
  quotaPricing: {
    employeeBlockSize: number;
    pricePerEmployeeBlockAzn: number;
    documentPackSize: number;
    pricePerDocumentPackAzn: number;
  };
  pricingModules: Array<{
    id: string;
    key: string;
    name: string;
    pricePerMonth: number;
    sortOrder: number;
    isPremium: boolean;
  }>;
  meterUnitPricing?: {
    pricePerUserMonthAzn: number;
    pricePerGbMonthAzn: number;
    pricePerWhatsappAlertAzn: number;
    pricePerInvoiceAzn: number;
    pricePerOcrPageAzn: number;
  };
  tierSpendCeilings?: Record<TierKey, number>;
  pricingBundles: Array<{
    id: string;
    name: string;
    discountPercent: number;
    moduleKeys: string[];
    isTrialDefault?: boolean;
    trialDurationDays?: number | null;
    trialQuotas?: Record<string, unknown> | null;
  }>;
};
