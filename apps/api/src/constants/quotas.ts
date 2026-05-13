import { SubscriptionTier } from "@erafinance/database";

export type TierQuotas = {
  maxEmployees: number | null;
  maxInvoicesPerMonth: number | null;
  /** Max object storage for org (logos, PDFs), GB; null = unlimited. */
  maxStorageGb: number | null;
};

export const TIER_QUOTAS: Record<SubscriptionTier, TierQuotas> = {
  STARTER: {
    maxEmployees: 5,
    maxInvoicesPerMonth: 20,
    maxStorageGb: 1,
  },
  BUSINESS: {
    maxEmployees: 50,
    maxInvoicesPerMonth: 500,
    maxStorageGb: 20,
  },
  ENTERPRISE: {
    maxEmployees: null,
    maxInvoicesPerMonth: null,
    maxStorageGb: null,
  },
};
