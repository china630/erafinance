import type { Prisma } from "@erafinance/database";
import {
  normalizeCashBankActiveModules,
  PRICING_MODULE_CASH_BANK_PRO,
} from "@erafinance/database";

/** @deprecated Always use {@link computeTrialExpiresAtBaku} with 3 calendar months. */
export const DEFAULT_TRIAL_DURATION_DAYS = 90;

export const TRIAL_3_MONTHS_SLUG = "TRIAL_3_MONTHS";

const TRIAL_EXCLUDED_MODULE_SLUGS = new Set([
  "tax_pro",
  "trade_pro",
  "compliance_pro",
]);

/**
 * Slugs granted on trial when no `PricingBundle` with trial slug/default exists.
 * Excludes paid government / AI add-ons.
 */
export const DEFAULT_TRIAL_MODULE_SLUGS: readonly string[] = [
  "nas",
  "ifrs",
  "ifrs_mapping",
  "production",
  "manufacturing",
  "fixed_assets",
  PRICING_MODULE_CASH_BANK_PRO,
  "inventory",
  "hr_full",
  "audit_hub",
] as const;

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function filterTrialModules(modules: string[]): string[] {
  return modules.filter((k) => !TRIAL_EXCLUDED_MODULE_SLUGS.has(k));
}

const BAKU_TZ = "Asia/Baku";

function bakuYmd(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { y, m, day };
}

/**
 * End of calendar day in Asia/Baku after adding `months` whole calendar months to signup (Baku date).
 */
export function computeTrialExpiresAtBaku(signupAt: Date, months = 3): Date {
  const { y, m, day } = bakuYmd(signupAt);
  const totalMonths = m - 1 + Math.max(1, Math.floor(months));
  const endY = y + Math.floor(totalMonths / 12);
  const endM = (totalMonths % 12) + 1;
  const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
  const endDay = Math.min(day, lastDay);
  const iso = `${endY}-${String(endM).padStart(2, "0")}-${String(endDay).padStart(2, "0")}T23:59:59.999`;
  const utcGuess = new Date(`${iso}Z`);
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKU_TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(utcGuess);
  const tzName = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "+04";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  let offsetMin = 4 * 60;
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const h = Number(match[2]);
    const min = Number(match[3] ?? 0);
    offsetMin = sign * (h * 60 + min);
  }
  return new Date(utcGuess.getTime() - offsetMin * 60 * 1000);
}

/**
 * End of UTC day after adding `trialDurationDays` calendar days to `signupAt`.
 * @deprecated Prefer {@link computeTrialExpiresAtBaku} for new org trials.
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
  let bundle = await tx.pricingBundle.findFirst({
    where: { slug: TRIAL_3_MONTHS_SLUG },
  });
  if (!bundle) {
    bundle = await tx.pricingBundle.findFirst({
      where: { isTrialDefault: true },
      orderBy: { createdAt: "asc" },
    });
  }

  const expiresAt = computeTrialExpiresAtBaku(signupAt, 3);

  let moduleKeys = asStringArray(bundle?.moduleKeys);
  if (moduleKeys.length === 0) {
    moduleKeys = [...DEFAULT_TRIAL_MODULE_SLUGS];
  }
  moduleKeys = normalizeCashBankActiveModules(filterTrialModules(moduleKeys));

  const trialPackageId = bundle?.id ?? "default";
  const trialPlanSlug =
    bundle?.slug === TRIAL_3_MONTHS_SLUG ? TRIAL_3_MONTHS_SLUG : bundle?.slug ?? undefined;

  const customConfig: Prisma.InputJsonValue = {
    modules: moduleKeys,
    trialPackageId,
    ...(trialPlanSlug ? { trialPlanSlug } : {}),
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
