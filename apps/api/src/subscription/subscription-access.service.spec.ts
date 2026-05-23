import { ForbiddenException } from "@nestjs/common";
import { TariffTier } from "@erafinance/database";
import { SubscriptionAccessService } from "./subscription-access.service";

describe("SubscriptionAccessService (assertModuleAccess trial)", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  function makeService(sub: {
    isTrial: boolean;
    expiresAt: Date | null;
    customConfig: unknown;
    activeModules?: unknown;
    tier?: TariffTier;
  }) {
    const prisma = {
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          organizationId: orgId,
          tier: sub.tier ?? TariffTier.TIER_1,
          activeModules: sub.activeModules ?? [],
          isTrial: sub.isTrial,
          expiresAt: sub.expiresAt,
          customConfig: sub.customConfig,
        }),
      },
      organizationModule: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as never;
    const pricing = {
      isPremiumModuleKey: (key: string) =>
        ["tax_pro", "trade_pro", "compliance_pro", "audit_hub"].includes(key),
    } as never;
    return new SubscriptionAccessService(prisma, pricing);
  }

  it("allows a module listed in trial customConfig.modules while trial is active", async () => {
    const future = new Date(Date.now() + 86400_000);
    const svc = makeService({
      isTrial: true,
      expiresAt: future,
      customConfig: { modules: ["fixed_assets", "inventory"] },
      activeModules: [],
      tier: TariffTier.TIER_1,
    });
    await expect(svc.assertModuleAccess(orgId, "fixed_assets")).resolves.toBeUndefined();
  });

  it("blocks tax_pro when not included in trial modules", async () => {
    const future = new Date(Date.now() + 86400_000);
    const svc = makeService({
      isTrial: true,
      expiresAt: future,
      customConfig: { modules: ["fixed_assets"] },
      activeModules: [],
      tier: TariffTier.TIER_1,
    });
    await expect(svc.assertModuleAccess(orgId, "tax_pro")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("after trial expiry ignores constructor modules and falls back to tier entitlements", async () => {
    const past = new Date(Date.now() - 86400_000);
    const svc = makeService({
      isTrial: true,
      expiresAt: past,
      customConfig: { modules: ["fixed_assets"] },
      activeModules: [],
      tier: TariffTier.TIER_1,
    });
    await expect(svc.assertModuleAccess(orgId, "fixed_assets")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MODULE_NOT_ENTITLED" }),
    });
  });
});

