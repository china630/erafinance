import { Prisma } from "@erafinance/database";

export type BundleCatalogRow = {
  id: string;
  name: string;
  discountPercent: number;
  moduleKeys: string[];
};

export type ActiveBundleRow = {
  bundleId: string;
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  activatedAt: Date;
  pendingDeactivation: boolean;
  cancelledAt: Date | null;
  accessUntil: Date | null;
};

export type ActiveModuleRow = {
  moduleKey: string;
  pricePerMonth: number;
  activatedAt: Date;
  pendingDeactivation: boolean;
  cancelledAt: Date | null;
  accessUntil: Date | null;
};

export type BillableBundleLine = {
  bundleId: string;
  name: string;
  moduleKeys: string[];
  amountAzn: number;
};

export type BillableModuleLine = {
  moduleKey: string;
  amountAzn: number;
};

export type EntitlementAllocation = {
  bundleLines: BillableBundleLine[];
  standaloneModuleLines: BillableModuleLine[];
  coveredByBundleKeys: string[];
  totalModulesAzn: number;
};

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function bundleListPriceAzn(
  moduleKeys: string[],
  priceByKey: Map<string, number>,
): number {
  return moduleKeys.reduce((s, k) => s + (priceByKey.get(k) ?? 0), 0);
}

export function bundleDiscountedPriceAzn(
  moduleKeys: string[],
  discountPercent: number,
  priceByKey: Map<string, number>,
): number {
  const list = bundleListPriceAzn(moduleKeys, priceByKey);
  return roundMoney2(list * (1 - discountPercent / 100));
}

/**
 * Each module slug is billed at most once: earliest active bundle (by activatedAt) claims
 * overlapping keys; remaining keys may be billed à la carte from organization_modules.
 */
export function allocateBillableEntitlements(input: {
  activeBundles: ActiveBundleRow[];
  activeStandaloneModules: ActiveModuleRow[];
  priceByKey: Map<string, number>;
}): EntitlementAllocation {
  const sortedBundles = [...input.activeBundles].sort(
    (a, b) => a.activatedAt.getTime() - b.activatedAt.getTime(),
  );
  const claimed = new Set<string>();
  const coveredByBundle = new Set<string>();
  const bundleLines: BillableBundleLine[] = [];

  for (const b of sortedBundles) {
    const billableKeys = b.moduleKeys.filter((k) => !claimed.has(k));
    if (billableKeys.length === 0) continue;
    for (const k of billableKeys) {
      claimed.add(k);
      coveredByBundle.add(k);
    }
    bundleLines.push({
      bundleId: b.bundleId,
      name: b.name,
      moduleKeys: billableKeys,
      amountAzn: bundleDiscountedPriceAzn(
        billableKeys,
        b.discountPercent,
        input.priceByKey,
      ),
    });
  }

  const standaloneModuleLines: BillableModuleLine[] = [];
  for (const m of input.activeStandaloneModules) {
    if (claimed.has(m.moduleKey)) continue;
    standaloneModuleLines.push({
      moduleKey: m.moduleKey,
      amountAzn: roundMoney2(m.pricePerMonth),
    });
    claimed.add(m.moduleKey);
  }

  const totalModulesAzn = roundMoney2(
    bundleLines.reduce((s, l) => s + l.amountAzn, 0) +
      standaloneModuleLines.reduce((s, l) => s + l.amountAzn, 0),
  );

  return {
    bundleLines,
    standaloneModuleLines,
    coveredByBundleKeys: Array.from(coveredByBundle),
    totalModulesAzn,
  };
}

export function isBundleActiveNow(
  row: Pick<
    ActiveBundleRow,
    "cancelledAt" | "accessUntil" | "pendingDeactivation"
  >,
  now: Date,
): boolean {
  if (row.cancelledAt == null) return true;
  if (row.accessUntil == null) return false;
  return now.getTime() <= row.accessUntil.getTime();
}

export function isModuleBillableForPeriod(
  row: Pick<
    ActiveModuleRow,
    "activatedAt" | "cancelledAt" | "pendingDeactivation" | "accessUntil"
  >,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (row.activatedAt.getTime() >= periodStart.getTime()) {
    return false;
  }
  if (row.cancelledAt == null) return true;
  if (row.pendingDeactivation && row.accessUntil) {
    return row.accessUntil.getTime() >= periodEnd.getTime();
  }
  return false;
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function decimalToNumber(d: Prisma.Decimal | number): number {
  return typeof d === "number" ? d : Number(d);
}
