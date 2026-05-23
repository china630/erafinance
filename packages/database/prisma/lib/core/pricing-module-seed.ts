import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PRICING_MODULE_CASH_BANK_PRO } from "./pricing-module-keys";

export type PricingModuleSeedRow = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
  isPremium?: boolean;
};

/**
 * Canonical defaults for `pricing_modules` — synced with Super-Admin catalog (2026-05).
 * Premium flag: `isPremium` (Super-Admin + billing gates).
 * Cash + bank: single module `cash_bank_pro` (replaces kassa_pro + banking_pro).
 */
export const PRICING_MODULE_SEED_DEFAULTS: ReadonlyArray<PricingModuleSeedRow> = [
  {
    key: PRICING_MODULE_CASH_BANK_PRO,
    name: "Cash & Bank Pro",
    pricePerMonth: 38,
    sortOrder: 0,
    isPremium: false,
  },
  { key: "inventory", name: "Warehouse", pricePerMonth: 19, sortOrder: 1 },
  { key: "manufacturing", name: "Manufacturing", pricePerMonth: 19, sortOrder: 2 },
  { key: "hr_full", name: "HR", pricePerMonth: 19, sortOrder: 3 },
  { key: "ifrs_mapping", name: "IFRS", pricePerMonth: 19, sortOrder: 4 },
  { key: "tax_pro", name: "Tax Pro", pricePerMonth: 19, sortOrder: 10, isPremium: true },
  { key: "trade_pro", name: "Trade Pro", pricePerMonth: 19, sortOrder: 11, isPremium: true },
  { key: "audit_hub", name: "Audit Hub", pricePerMonth: 99, sortOrder: 12, isPremium: true },
  {
    key: "compliance_pro",
    name: "Risk & Compliance (ERM)",
    pricePerMonth: 99,
    sortOrder: 13,
    isPremium: true,
  },
];

/**
 * Seeds `pricing_modules` only when the table is empty (existing DB rows win).
 */
export async function seedPricingModuleIfEmpty(prisma: PrismaClient): Promise<void> {
  const n = await prisma.pricingModule.count();
  if (n > 0) return;
  for (const m of PRICING_MODULE_SEED_DEFAULTS) {
    await prisma.pricingModule.create({
      data: {
        key: m.key,
        name: m.name,
        pricePerMonth: new Prisma.Decimal(m.pricePerMonth),
        sortOrder: m.sortOrder,
        isPremium: m.isPremium ?? false,
      },
    });
  }
}
