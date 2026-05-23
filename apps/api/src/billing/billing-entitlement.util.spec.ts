import {
  allocateBillableEntitlements,
  bundleDiscountedPriceAzn,
} from "./billing-entitlement.util";

describe("allocateBillableEntitlements", () => {
  const priceByKey = new Map([
    ["cash_bank_pro", 38],
    ["inventory", 25],
    ["hr_full", 30],
  ]);

  it("bills bundle once and skips overlapping standalone module", () => {
    const allocation = allocateBillableEntitlements({
      activeBundles: [
        {
          bundleId: "b1",
          name: "Cash",
          discountPercent: 10,
          moduleKeys: ["cash_bank_pro", "inventory"],
          activatedAt: new Date("2026-01-01"),
          pendingDeactivation: false,
          cancelledAt: null,
          accessUntil: null,
        },
      ],
      activeStandaloneModules: [
        {
          moduleKey: "inventory",
          pricePerMonth: 25,
          activatedAt: new Date("2026-01-02"),
          pendingDeactivation: false,
          cancelledAt: null,
          accessUntil: null,
        },
        {
          moduleKey: "hr_full",
          pricePerMonth: 30,
          activatedAt: new Date("2026-01-02"),
          pendingDeactivation: false,
          cancelledAt: null,
          accessUntil: null,
        },
      ],
      priceByKey,
    });

    expect(allocation.bundleLines).toHaveLength(1);
    expect(allocation.bundleLines[0]!.moduleKeys).toEqual([
      "cash_bank_pro",
      "inventory",
    ]);
    expect(allocation.standaloneModuleLines).toEqual([
      { moduleKey: "hr_full", amountAzn: 30 },
    ]);
    expect(allocation.coveredByBundleKeys).toEqual([
      "cash_bank_pro",
      "inventory",
    ]);
    const bundleExpected = bundleDiscountedPriceAzn(
      ["cash_bank_pro", "inventory"],
      10,
      priceByKey,
    );
    expect(allocation.totalModulesAzn).toBe(
      Math.round((bundleExpected + 30) * 100) / 100,
    );
  });

  it("assigns overlapping module only to first bundle by activation time", () => {
    const allocation = allocateBillableEntitlements({
      activeBundles: [
        {
          bundleId: "b1",
          name: "Cash",
          discountPercent: 10,
          moduleKeys: ["cash_bank_pro", "inventory"],
          activatedAt: new Date("2026-01-01"),
          pendingDeactivation: false,
          cancelledAt: null,
          accessUntil: null,
        },
        {
          bundleId: "b2",
          name: "Trade",
          discountPercent: 15,
          moduleKeys: ["inventory", "hr_full"],
          activatedAt: new Date("2026-02-01"),
          pendingDeactivation: false,
          cancelledAt: null,
          accessUntil: null,
        },
      ],
      activeStandaloneModules: [],
      priceByKey,
    });

    expect(allocation.bundleLines[0]!.moduleKeys).toContain("inventory");
    expect(allocation.bundleLines[1]!.moduleKeys).toEqual(["hr_full"]);
    expect(allocation.bundleLines[1]!.moduleKeys).not.toContain("inventory");
  });
});
