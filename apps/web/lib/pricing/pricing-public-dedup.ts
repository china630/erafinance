/**
 * Public /pricing calculator dedup — mirrors API `allocateBillableEntitlements`.
 */

export function bundleDiscountedPriceAzn(
  moduleKeys: string[],
  discountPercent: number,
  priceByKey: Map<string, number>,
): number {
  const list = moduleKeys.reduce((s, k) => s + (priceByKey.get(k) ?? 0), 0);
  return Math.round(list * (1 - discountPercent / 100) * 100) / 100;
}

export function estimatePostpaidWithBundleDedup(input: {
  foundationMonthlyAzn: number;
  selectedBundle: {
    moduleKeys: string[];
    discountedPriceAzn: number;
  } | null;
  selectedPremiumMonthly: number;
}): number {
  const total =
    input.foundationMonthlyAzn +
    (input.selectedBundle?.discountedPriceAzn ?? 0) +
    input.selectedPremiumMonthly;
  return Math.round(total * 100) / 100;
}
