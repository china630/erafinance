import { TariffTier } from "@erafinance/database";
import { TARIFF_TIER_LIMITS } from "../billing/tariff-limits";

export type TierQuotas = {
  maxEmployees: number | null;
  maxInvoicesPerMonth: number | null;
  maxStorageGb: number | null;
  maxWhatsappAlertsPerMonth: number | null;
  maxOcrPagesPerMonth: number | null;
  maxWorkspaces: number | null;
};

export const TIER_QUOTAS: Record<TariffTier, TierQuotas> = {
  [TariffTier.TIER_0]: {
    maxEmployees: TARIFF_TIER_LIMITS[TariffTier.TIER_0].maxUsers,
    maxInvoicesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_0].maxInvoicesPerMonth,
    maxStorageGb: 1,
    maxWhatsappAlertsPerMonth:
      TARIFF_TIER_LIMITS[TariffTier.TIER_0].maxWhatsappAlertsPerMonth,
    maxOcrPagesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_0].maxOcrPagesPerMonth,
    maxWorkspaces: TARIFF_TIER_LIMITS[TariffTier.TIER_0].maxWorkspaces,
  },
  [TariffTier.TIER_1]: {
    maxEmployees: TARIFF_TIER_LIMITS[TariffTier.TIER_1].maxUsers,
    maxInvoicesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_1].maxInvoicesPerMonth,
    maxStorageGb: 5,
    maxWhatsappAlertsPerMonth:
      TARIFF_TIER_LIMITS[TariffTier.TIER_1].maxWhatsappAlertsPerMonth,
    maxOcrPagesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_1].maxOcrPagesPerMonth,
    maxWorkspaces: TARIFF_TIER_LIMITS[TariffTier.TIER_1].maxWorkspaces,
  },
  [TariffTier.TIER_2]: {
    maxEmployees: TARIFF_TIER_LIMITS[TariffTier.TIER_2].maxUsers,
    maxInvoicesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_2].maxInvoicesPerMonth,
    maxStorageGb: 20,
    maxWhatsappAlertsPerMonth:
      TARIFF_TIER_LIMITS[TariffTier.TIER_2].maxWhatsappAlertsPerMonth,
    maxOcrPagesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_2].maxOcrPagesPerMonth,
    maxWorkspaces: TARIFF_TIER_LIMITS[TariffTier.TIER_2].maxWorkspaces,
  },
  [TariffTier.TIER_3]: {
    maxEmployees: TARIFF_TIER_LIMITS[TariffTier.TIER_3].maxUsers,
    maxInvoicesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_3].maxInvoicesPerMonth,
    maxStorageGb: 100,
    maxWhatsappAlertsPerMonth:
      TARIFF_TIER_LIMITS[TariffTier.TIER_3].maxWhatsappAlertsPerMonth,
    maxOcrPagesPerMonth: TARIFF_TIER_LIMITS[TariffTier.TIER_3].maxOcrPagesPerMonth,
    maxWorkspaces: TARIFF_TIER_LIMITS[TariffTier.TIER_3].maxWorkspaces,
  },
};
