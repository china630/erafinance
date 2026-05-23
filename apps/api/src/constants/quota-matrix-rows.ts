import type { TierQuotas } from "./quotas";

/** Rows for Super-Admin matrix and public /pricing resource ladder (same field keys). */
export const QUOTA_MATRIX_ROWS: readonly {
  id: keyof TierQuotas;
  /** i18n key under superAdmin.* */
  labelKey: string;
}[] = [
  { id: "maxEmployees", labelKey: "tierQuotaFieldEmployees" },
  { id: "maxInvoicesPerMonth", labelKey: "tierQuotaFieldInvoicesMonthShort" },
  { id: "maxStorageGb", labelKey: "tierQuotaFieldStorageGb" },
  { id: "maxWhatsappAlertsPerMonth", labelKey: "tierQuotaFieldWhatsapp" },
  { id: "maxOcrPagesPerMonth", labelKey: "tierQuotaFieldOcrPages" },
  { id: "maxWorkspaces", labelKey: "tierQuotaFieldWorkspaces" },
] as const;

export const QUOTA_MATRIX_TIERS = [
  "TIER_0",
  "TIER_1",
  "TIER_2",
  "TIER_3",
] as const;
