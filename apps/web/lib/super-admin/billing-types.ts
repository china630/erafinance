export type TierKey = "STARTER" | "BUSINESS" | "ENTERPRISE";

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
  }>;
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
