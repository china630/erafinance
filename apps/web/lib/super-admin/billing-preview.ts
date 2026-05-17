import type { TFunction } from "i18next";
import { pricingModuleLabel } from "../pricing-module-label";
import type { BillingPayload } from "./billing-types";

export function computeBundlePreview(
  foundation: number,
  modules: BillingPayload["pricingModules"],
  selectedKeys: string[],
  bundleDiscountPct: number,
  yearlyDiscPct: number,
) {
  const keySet = new Set(selectedKeys);
  const modulesSum = modules
    .filter((m) => keySet.has(m.key))
    .reduce((s, m) => s + m.pricePerMonth, 0);
  const subtotal = foundation + modulesSum;
  const afterBundle = subtotal * (1 - bundleDiscountPct / 100);
  const monthly = afterBundle;
  const yearly = monthly * 12 * (1 - yearlyDiscPct / 100);
  return { subtotal, modulesSum, afterBundle, monthly, yearly };
}

export function moduleNamesFromKeys(
  keys: string[],
  modules: BillingPayload["pricingModules"],
  t: TFunction,
): string {
  const map = new Map(
    modules.map((m) => [m.key, pricingModuleLabel(m.key, m.name, t)] as const),
  );
  if (keys.length === 0) return "—";
  return keys.map((k) => map.get(k) ?? k).join(", ");
}
