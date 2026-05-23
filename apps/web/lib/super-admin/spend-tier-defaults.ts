import type { BillingPayload } from "./billing-types";

/** Mirrors API `DEFAULT_METER_UNIT_PRICING` / `DEFAULT_TIER_SPEND_CEILINGS_AZN`. */
export const DEFAULT_METER_UNIT_PRICING: NonNullable<
  BillingPayload["meterUnitPricing"]
> = {
  pricePerUserMonthAzn: 2,
  pricePerGbMonthAzn: 0.5,
  pricePerWhatsappAlertAzn: 0.05,
  pricePerInvoiceAzn: 0.1,
  pricePerOcrPageAzn: 0.02,
};

export const DEFAULT_TIER_SPEND_CEILINGS: NonNullable<
  BillingPayload["tierSpendCeilings"]
> = {
  TIER_0: 0,
  TIER_1: 10,
  TIER_2: 50,
  TIER_3: 200,
};
