import { Injectable } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PricingService } from "../admin/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import {
  allocateBillableEntitlements,
  asStringArray,
  bundleDiscountedPriceAzn,
  bundleListPriceAzn,
  decimalToNumber,
  isBundleActiveNow,
  isModuleBillableForPeriod,
  type ActiveBundleRow,
  type ActiveModuleRow,
  type EntitlementAllocation,
} from "./billing-entitlement.util";
import { PREMIUM_MODULE_MONTHLY_AZN } from "./tariff-limits";

export type MarketplaceBundleRow = {
  id: string;
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  listPriceAzn: number;
  discountedPriceAzn: number;
  active: boolean;
  pendingDeactivation: boolean;
  incrementalPriceAzn: number;
};

export type MarketplaceModuleRow = {
  key: string;
  name: string;
  pricePerMonth: number;
  active: boolean;
  coveredByBundle: boolean;
  coveredByBundleName: string | null;
  pendingDeactivation: boolean;
  billableStandalone: boolean;
};

export type SubscriptionMarketplaceSnapshot = {
  currency: "AZN";
  foundationMonthlyAzn: number;
  bundles: MarketplaceBundleRow[];
  modules: MarketplaceModuleRow[];
  allocation: EntitlementAllocation;
  premiumModules: Array<{
    key: string;
    monthlyAzn: number;
    activated: boolean;
    trialLocked: boolean;
  }>;
  monthlyTotalAzn: number;
  isTrial: boolean;
};

@Injectable()
export class BillingEntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async getMarketplaceSnapshot(
    organizationId: string,
    now = new Date(),
  ): Promise<SubscriptionMarketplaceSnapshot> {
    await this.pricing.ensurePricingModulesFromDatabase();
    const [constructor, catalogModules, catalogBundles, sub, orgBundles, orgModules] =
      await Promise.all([
        this.pricing.getConstructorData(),
        this.prisma.pricingModule.findMany({ orderBy: { sortOrder: "asc" } }),
        this.prisma.pricingBundle.findMany({
          where: { isTrialDefault: false },
          orderBy: { updatedAt: "desc" },
        }),
        this.prisma.organizationSubscription.findUnique({
          where: { organizationId },
        }),
        this.prisma.organizationBundle.findMany({
          where: { organizationId },
          include: { bundle: true },
        }),
        this.prisma.organizationModule.findMany({
          where: { organizationId },
        }),
      ]);

    const priceByKey = new Map(
      catalogModules.map((m) => [m.key, Number(m.pricePerMonth)]),
    );

    const activeBundles = this.toActiveBundles(orgBundles, now);
    const activeStandalone = this.toActiveStandaloneModules(
      orgModules,
      priceByKey,
      now,
    );
    const allocation = allocateBillableEntitlements({
      activeBundles,
      activeStandaloneModules: activeStandalone,
      priceByKey,
    });

    const coveredSet = new Set(allocation.coveredByBundleKeys);
    const bundleNameByModule = new Map<string, string>();
    for (const line of allocation.bundleLines) {
      for (const k of line.moduleKeys) {
        if (!bundleNameByModule.has(k)) bundleNameByModule.set(k, line.name);
      }
    }

    const orgBundleById = new Map(orgBundles.map((r) => [r.bundleId, r]));

    const bundles: MarketplaceBundleRow[] = catalogBundles.map((b) => {
      const moduleKeys = asStringArray(b.moduleKeys);
      const listPriceAzn = bundleListPriceAzn(moduleKeys, priceByKey);
      const discountedPriceAzn = bundleDiscountedPriceAzn(
        moduleKeys,
        Number(b.discountPercent),
        priceByKey,
      );
      const ob = orgBundleById.get(b.id);
      const active =
        ob != null &&
        isBundleActiveNow(
          {
            cancelledAt: ob.cancelledAt,
            accessUntil: ob.accessUntil,
            pendingDeactivation: ob.pendingDeactivation,
          },
          now,
        );
      const hypothetical = allocateBillableEntitlements({
        activeBundles: active
          ? activeBundles
          : [
              ...activeBundles,
              {
                bundleId: b.id,
                name: b.name,
                discountPercent: Number(b.discountPercent),
                moduleKeys,
                activatedAt: new Date(8640000000000000),
                pendingDeactivation: false,
                cancelledAt: null,
                accessUntil: null,
              },
            ],
        activeStandaloneModules: activeStandalone,
        priceByKey,
      });
      const incrementalPriceAzn = active
        ? 0
        : Math.max(
            0,
            round2(hypothetical.totalModulesAzn - allocation.totalModulesAzn),
          );
      return {
        id: b.id,
        name: b.name,
        discountPercent: Number(b.discountPercent),
        moduleKeys,
        listPriceAzn,
        discountedPriceAzn,
        active,
        pendingDeactivation: ob?.pendingDeactivation ?? false,
        incrementalPriceAzn,
      };
    });

    const orgModuleByKey = new Map(orgModules.map((r) => [r.moduleKey, r]));

    const modules: MarketplaceModuleRow[] = constructor.modules
      .filter((m) => !this.pricing.isPremiumModuleKey(m.key))
      .map((m) => {
        const om = orgModuleByKey.get(m.key);
        const active =
          sub?.activeModules?.includes(m.key) ||
          sub?.activeModules?.includes(
            m.key === "manufacturing" ? "production" : "",
          ) ||
          false;
        const coveredByBundle = coveredSet.has(m.key);
        const billableStandalone = allocation.standaloneModuleLines.some(
          (l) => l.moduleKey === m.key,
        );
        return {
          key: m.key,
          name: m.name,
          pricePerMonth: m.pricePerMonth,
          active: active || coveredByBundle,
          coveredByBundle,
          coveredByBundleName: bundleNameByModule.get(m.key) ?? null,
          pendingDeactivation: om?.pendingDeactivation ?? false,
          billableStandalone,
        };
      });

    const trialEnd = sub?.trialExpiresAt ?? sub?.expiresAt ?? null;
    const trialActive =
      Boolean(sub?.isTrial) &&
      trialEnd != null &&
      trialEnd.getTime() > now.getTime();
    const activatedPremium = sub?.activatedPremiumModules ?? [];

    const premiumModules = this.pricing.getPremiumModuleKeys().map((key) => ({
      key,
      monthlyAzn:
        priceByKey.get(key) ??
        PREMIUM_MODULE_MONTHLY_AZN[key as keyof typeof PREMIUM_MODULE_MONTHLY_AZN] ??
        0,
      activated: activatedPremium.includes(key),
      trialLocked: trialActive && !activatedPremium.includes(key),
    }));

    const foundationMonthlyAzn = await this.systemConfig.getFoundationMonthlyAzn();
    const trialCoversFoundation = trialActive;
    const foundation = trialCoversFoundation ? 0 : foundationMonthlyAzn;
    const premiumTotal = premiumModules
      .filter((p) => p.activated)
      .reduce((s, p) => s + p.monthlyAzn, 0);

    const monthlyTotalAzn = round2(
      foundation + allocation.totalModulesAzn + premiumTotal,
    );

    return {
      currency: "AZN",
      foundationMonthlyAzn: trialCoversFoundation ? 0 : foundationMonthlyAzn,
      bundles,
      modules,
      allocation,
      premiumModules,
      monthlyTotalAzn,
      isTrial: trialActive,
    };
  }

  async computeInvoiceModuleLines(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<
    Array<{ description: string; amountAzn: number; kind: "bundle" | "module" }>
  > {
    const [catalogModules, orgBundles, orgModules] = await Promise.all([
      this.prisma.pricingModule.findMany(),
      this.prisma.organizationBundle.findMany({
        where: { organizationId },
        include: { bundle: true },
      }),
      this.prisma.organizationModule.findMany({
        where: { organizationId },
      }),
    ]);

    const priceByKey = new Map(
      catalogModules.map((m) => [m.key, Number(m.pricePerMonth)]),
    );

    const activeBundles: ActiveBundleRow[] = orgBundles
      .filter((row) =>
        isModuleBillableForPeriod(
          {
            activatedAt: row.activatedAt,
            cancelledAt: row.cancelledAt,
            pendingDeactivation: row.pendingDeactivation,
            accessUntil: row.accessUntil,
          },
          periodStart,
          periodEnd,
        ),
      )
      .map((row) => ({
        bundleId: row.bundleId,
        name: row.bundle.name,
        discountPercent: Number(row.bundle.discountPercent),
        moduleKeys: asStringArray(row.bundle.moduleKeys),
        activatedAt: row.activatedAt,
        pendingDeactivation: row.pendingDeactivation,
        cancelledAt: row.cancelledAt,
        accessUntil: row.accessUntil,
      }));

    const activeStandalone: ActiveModuleRow[] = orgModules
      .filter((row) =>
        isModuleBillableForPeriod(
          {
            activatedAt: row.activatedAt,
            cancelledAt: row.cancelledAt,
            pendingDeactivation: row.pendingDeactivation,
            accessUntil: row.accessUntil,
          },
          periodStart,
          periodEnd,
        ),
      )
      .map((row) => ({
        moduleKey: row.moduleKey,
        pricePerMonth: decimalToNumber(row.priceSnapshot),
        activatedAt: row.activatedAt,
        pendingDeactivation: row.pendingDeactivation,
        cancelledAt: row.cancelledAt,
        accessUntil: row.accessUntil,
      }));

    const allocation = allocateBillableEntitlements({
      activeBundles,
      activeStandaloneModules: activeStandalone,
      priceByKey,
    });

    const lines: Array<{
      description: string;
      amountAzn: number;
      kind: "bundle" | "module";
    }> = [];

    for (const b of allocation.bundleLines) {
      if (b.amountAzn <= 0) continue;
      lines.push({
        kind: "bundle",
        description: `Package ${b.name} (${b.moduleKeys.join(", ")})`,
        amountAzn: b.amountAzn,
      });
    }
    for (const m of allocation.standaloneModuleLines) {
      if (m.amountAzn <= 0) continue;
      lines.push({
        kind: "module",
        description: `Module ${m.moduleKey}`,
        amountAzn: m.amountAzn,
      });
    }
    return lines;
  }

  private toActiveBundles(
    rows: Array<{
      bundleId: string;
      activatedAt: Date;
      pendingDeactivation: boolean;
      cancelledAt: Date | null;
      accessUntil: Date | null;
      bundle: {
        name: string;
        discountPercent: Prisma.Decimal;
        moduleKeys: unknown;
      };
    }>,
    now: Date,
  ): ActiveBundleRow[] {
    return rows
      .filter((r) =>
        isBundleActiveNow(
          {
            cancelledAt: r.cancelledAt,
            accessUntil: r.accessUntil,
            pendingDeactivation: r.pendingDeactivation,
          },
          now,
        ),
      )
      .map((r) => ({
        bundleId: r.bundleId,
        name: r.bundle.name,
        discountPercent: Number(r.bundle.discountPercent),
        moduleKeys: asStringArray(r.bundle.moduleKeys),
        activatedAt: r.activatedAt,
        pendingDeactivation: r.pendingDeactivation,
        cancelledAt: r.cancelledAt,
        accessUntil: r.accessUntil,
      }));
  }

  private toActiveStandaloneModules(
    rows: Array<{
      moduleKey: string;
      priceSnapshot: Prisma.Decimal;
      activatedAt: Date;
      pendingDeactivation: boolean;
      cancelledAt: Date | null;
      accessUntil: Date | null;
    }>,
    priceByKey: Map<string, number>,
    now: Date,
  ): ActiveModuleRow[] {
    return rows
      .filter((r) =>
        isBundleActiveNow(
          {
            cancelledAt: r.cancelledAt,
            accessUntil: r.accessUntil,
            pendingDeactivation: r.pendingDeactivation,
          },
          now,
        ),
      )
      .map((r) => ({
        moduleKey: r.moduleKey,
        pricePerMonth:
          decimalToNumber(r.priceSnapshot) ||
          priceByKey.get(r.moduleKey) ||
          0,
        activatedAt: r.activatedAt,
        pendingDeactivation: r.pendingDeactivation,
        cancelledAt: r.cancelledAt,
        accessUntil: r.accessUntil,
      }));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
