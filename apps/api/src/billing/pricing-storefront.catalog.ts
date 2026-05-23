/** Standard ERP areas on public /pricing (registry ids → optional pricing_modules keys for billing). */

import { PRICING_MODULE_CASH_BANK_PRO } from "@erafinance/database";

export type PricingStandardModuleDef = {
  id: string;
  /** Keys used for bundle dedup / entitlement (not shown as prices on storefront). */
  moduleKeys: readonly string[];
  /** When true, row describes Foundation base rather than add-on keys. */
  usesFoundation?: boolean;
};

export const PRICING_STANDARD_MODULE_REGISTRY: readonly PricingStandardModuleDef[] =
  [
    { id: "core_accounting", moduleKeys: [], usesFoundation: true },
    { id: "cash_bank", moduleKeys: [PRICING_MODULE_CASH_BANK_PRO] },
    { id: "supply_sales", moduleKeys: ["inventory"] },
    { id: "manufacturing_wip", moduleKeys: ["manufacturing"] },
    { id: "fixed_assets", moduleKeys: ["fixed_assets"] },
    { id: "hr_payroll", moduleKeys: ["hr_full"] },
  ] as const;

export const PRICING_STOREFRONT_BUNDLE_MARKETING: readonly {
  /** Match `pricing_bundles.moduleKeys` (sorted join) or name substring. */
  matchModuleKeys: readonly string[];
  marketingId: string;
}[] = [
  {
    marketingId: "cash_warehouse",
    matchModuleKeys: [PRICING_MODULE_CASH_BANK_PRO, "inventory"],
  },
  {
    marketingId: "hr_ifrs",
    matchModuleKeys: ["hr_full", "ifrs_mapping"],
  },
  {
    marketingId: "trade_ops",
    matchModuleKeys: ["inventory", "manufacturing"],
  },
];
