import { TariffTier } from "@erafinance/database";

export const TIER_SPEND_CEILING_KEYS: Record<TariffTier, string> = {
  TIER_0: "billing.tier_spend_ceiling.TIER_0",
  TIER_1: "billing.tier_spend_ceiling.TIER_1",
  TIER_2: "billing.tier_spend_ceiling.TIER_2",
  TIER_3: "billing.tier_spend_ceiling.TIER_3",
};

export const DEFAULT_TIER_SPEND_CEILINGS_AZN: Record<TariffTier, number> = {
  [TariffTier.TIER_0]: 0,
  [TariffTier.TIER_1]: 10,
  [TariffTier.TIER_2]: 50,
  [TariffTier.TIER_3]: 200,
};

export function nextTariffTier(current: TariffTier): TariffTier | null {
  switch (current) {
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

export function spendReachedTierCeiling(
  spentAzn: number,
  ceilingAzn: number,
): boolean {
  if (ceilingAzn <= 0) return spentAzn > 0;
  return spentAzn >= ceilingAzn;
}
