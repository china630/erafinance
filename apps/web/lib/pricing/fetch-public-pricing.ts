import { publicApiFetch } from "../public-api-fetch";
import type { PublicPricingResponse } from "../public-pricing-types";

export async function fetchPublicPricingSnapshot(): Promise<PublicPricingResponse> {
  try {
    const res = await publicApiFetch("/api/public/pricing", {
      next: { revalidate: 60 },
    });
    if (!res.ok) return unavailablePricingSnapshot();
    return (await res.json()) as PublicPricingResponse;
  } catch {
    return unavailablePricingSnapshot();
  }
}

function unavailablePricingSnapshot(): PublicPricingResponse {
  return {
    currency: "AZN",
    foundationMonthlyAzn: 0,
    yearlyDiscountPercent: 0,
    pricingModules: [],
    pricingBundles: [],
    meterUnitPricing: {
      pricePerUserMonthAzn: 0,
      pricePerGbMonthAzn: 0,
      pricePerWhatsappAlertAzn: 0,
      pricePerInvoiceAzn: 0,
      pricePerOcrPageAzn: 0,
    },
    tierSpendCeilings: {},
    ocrJobsPerOrgMonth: null,
    unavailable: true,
  };
}
