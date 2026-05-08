import { z } from "zod";

export const SubscriptionTierSchema = z.enum([
  "STARTER",
  "BUSINESS",
  "ENTERPRISE",
]);

/** Entitlement flags returned by GET /api/subscription/me `modules`. */
export const OrganizationModuleEntitlementsSchema = z.object({
  manufacturing: z.boolean(),
  fixedAssets: z.boolean(),
  ifrsMapping: z.boolean(),
  bankingPro: z.boolean(),
  hrFull: z.boolean(),
  taxPro: z.boolean(),
  tradePro: z.boolean(),
});

export const QuotaSnapshotSchema = z.object({
  used: z.number().optional(),
  limit: z.number().nullable().optional(),
  remaining: z.number().nullable().optional(),
});

export const SubscriptionSnapshotSchema = z.object({
  tier: SubscriptionTierSchema,
  activeModules: z.array(z.string()),
  customConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  modules: OrganizationModuleEntitlementsSchema,
  expiresAt: z.string().nullable(),
  isTrial: z.boolean(),
  billingStatus: z.string().optional(),
  readOnly: z.boolean().optional(),
  trialDaysLeft: z.number().nullable().optional(),
  quotas: z
    .object({
      employees: QuotaSnapshotSchema.optional(),
      invoicesThisMonth: QuotaSnapshotSchema.optional(),
      storage: QuotaSnapshotSchema.optional(),
    })
    .optional(),
});

export type OrganizationModuleEntitlements = z.infer<
  typeof OrganizationModuleEntitlementsSchema
>;
export type SubscriptionSnapshot = z.infer<typeof SubscriptionSnapshotSchema>;

/** Slug keys used for @RequiresModule / extension gating. */
export const ModuleEntitlementKeySchema = z.enum([
  "manufacturing",
  "fixed_assets",
  "ifrs_mapping",
  "banking_pro",
  "kassa_pro",
  "hr_full",
  "nas",
  "ifrs",
  "production",
  "kassa",
  "tax_pro",
  "trade_pro",
]);

export type ModuleEntitlementKey = z.infer<typeof ModuleEntitlementKeySchema>;
