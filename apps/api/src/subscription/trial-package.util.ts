import type { Prisma } from "@erafinance/database";

/** Default trial length when `PricingBundle.trialDurationDays` is unset. */
export const DEFAULT_TRIAL_DURATION_DAYS = 90;

/**
 * Slugs granted on trial when no `PricingBundle` with `isTrialDefault` exists.
 * Excludes `tax_pro` / `trade_pro` (RPA / Assistant — paid add-ons).
 */
export const DEFAULT_TRIAL_MODULE_SLUGS: readonly string[] = [
  "nas",
  "ifrs",
  "ifrs_mapping",
  "production",
  "manufacturing",
  "fixed_assets",
  "banking_pro",
  "kassa_pro",
  "inventory",
  "hr_full",
  "audit_hub",
] as const;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/**
 * End of UTC day after adding `trialDurationDays` calendar days to `signupAt`.
 */
export function computeTrialExpiresAtUtc(
  signupAt: Date,
  trialDurationDays: number,
): Date {
  const d = new Date(signupAt);
  const n = Math.max(1, Math.floor(trialDurationDays));
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export type TrialSubscriptionSeed = {
  expiresAt: Date;
  activeModules: string[];
  customConfig: Prisma.InputJsonValue;
};

/**
 * Resolves initial trial subscription payload for a new organization (inside a transaction).
 */
export async function resolveNewOrganizationTrialSubscription(
  tx: Prisma.TransactionClient,
  signupAt: Date,
): Promise<TrialSubscriptionSeed> {
  const bundle = await tx.pricingBundle.findFirst({
    where: { isTrialDefault: true },
    orderBy: { createdAt: "asc" },
  });

  const days =
    bundle?.trialDurationDays != null && bundle.trialDurationDays > 0
      ? bundle.trialDurationDays
      : DEFAULT_TRIAL_DURATION_DAYS;

  const expiresAt = computeTrialExpiresAtUtc(signupAt, days);

  let moduleKeys = asStringArray(bundle?.moduleKeys);
  if (moduleKeys.length === 0) {
    moduleKeys = [...DEFAULT_TRIAL_MODULE_SLUGS];
  }
  moduleKeys = moduleKeys.filter((k) => k !== "tax_pro" && k !== "trade_pro");

  const trialPackageId = bundle?.id ?? "default";

  const customConfig: Prisma.InputJsonValue = {
    modules: moduleKeys,
    trialPackageId,
    ...(bundle?.trialQuotas != null &&
    typeof bundle.trialQuotas === "object" &&
    bundle.trialQuotas !== null
      ? { trialQuotas: bundle.trialQuotas as Prisma.InputJsonValue }
      : {}),
  };

  return {
    expiresAt,
    activeModules: moduleKeys,
    customConfig,
  };
}
