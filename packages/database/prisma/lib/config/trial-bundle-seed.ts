import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PRICING_MODULE_CASH_BANK_PRO } from "../core/pricing-module-keys";

export const TRIAL_3_MONTHS_SLUG = "TRIAL_3_MONTHS";

export const TRIAL_3_MONTHS_MODULE_KEYS: readonly string[] = [
  "nas",
  "ifrs",
  "ifrs_mapping",
  "inventory",
  PRICING_MODULE_CASH_BANK_PRO,
  "production",
  "manufacturing",
  "fixed_assets",
  "hr_full",
  "audit_hub",
];

export async function seedTrial3MonthsBundle(prisma: PrismaClient): Promise<void> {
  await prisma.pricingBundle.updateMany({
    where: { isTrialDefault: true, slug: { not: TRIAL_3_MONTHS_SLUG } },
    data: { isTrialDefault: false },
  });

  await prisma.pricingBundle.upsert({
    where: { slug: TRIAL_3_MONTHS_SLUG },
    create: {
      slug: TRIAL_3_MONTHS_SLUG,
      name: "3 months free trial",
      discountPercent: new Prisma.Decimal(0),
      moduleKeys: [...TRIAL_3_MONTHS_MODULE_KEYS],
      isTrialDefault: true,
      trialDurationDays: 90,
    },
    update: {
      name: "3 months free trial",
      moduleKeys: [...TRIAL_3_MONTHS_MODULE_KEYS],
      isTrialDefault: true,
      trialDurationDays: 90,
    },
  });
}
