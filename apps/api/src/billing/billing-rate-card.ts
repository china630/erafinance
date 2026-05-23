/** @deprecated Post-paid micro-cost model removed — use tariff-limits.ts */
export { TARIFF_TIER_LIMITS as CREDIT_TIER_LIMITS } from "./tariff-limits";
export { billingPeriodKeyBaku as utcBillingPeriodKey } from "./baku-billing.util";

export type BillableActionType =
  | "USER_MONTHLY"
  | "ORG_WORKSPACE_MONTHLY"
  | "WHATSAPP_ALERT"
  | "OCR_PAGE"
  | "INVOICE_CREATED";

import { TariffTier } from "@erafinance/database";

export function nextTariffTierAfterSettlement(tier: TariffTier): TariffTier | null {
  switch (tier) {
    case TariffTier.TIER_0:
      return TariffTier.TIER_1;
    case TariffTier.TIER_1:
      return TariffTier.TIER_2;
    case TariffTier.TIER_2:
      return TariffTier.TIER_3;
    default:
      return null;
  }
}
