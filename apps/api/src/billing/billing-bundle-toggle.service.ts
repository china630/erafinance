import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { Prisma, TariffTier } from "@erafinance/database";
import { AccessControlService } from "../access/access-control.service";
import { PricingService } from "../admin/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import {
  asStringArray,
  bundleDiscountedPriceAzn,
  isBundleActiveNow,
} from "./billing-entitlement.util";
import {
  hasConstructorModulesInCustomConfig,
  isCatalogModuleActive,
} from "./billing-module-toggle.helpers";
import { OrganizationBundleService } from "./organization-bundle.service";
import type { ToggleBundleDto } from "./dto/toggle-bundle.dto";

@Injectable()
export class BillingBundleToggleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly pricing: PricingService,
    private readonly orgBundles: OrganizationBundleService,
  ) {}

  async toggle(
    userId: string,
    organizationId: string,
    dto: ToggleBundleDto,
  ): Promise<{
    organizationId: string;
    bundleId: string;
    enabled: boolean;
    activeModules: string[];
    note?: string;
  }> {
    await this.access.assertOwnerForBilling(userId, organizationId);
    await this.pricing.ensurePricingModulesFromDatabase();

    const bundle = await this.prisma.pricingBundle.findUnique({
      where: { id: dto.bundleId },
    });
    if (!bundle || bundle.isTrialDefault) {
      throw new BadRequestException({
        code: "UNKNOWN_BUNDLE",
        message: "Bundle is not available for purchase.",
      });
    }

    const moduleKeys = asStringArray(bundle.moduleKeys);
    if (moduleKeys.length === 0) {
      throw new BadRequestException({
        code: "EMPTY_BUNDLE",
        message: "Bundle has no modules.",
      });
    }

    const snap = await this.subscriptionAccess.getOrganizationSnapshot(
      organizationId,
    );

    if (snap.tier === TariffTier.TIER_3) {
      throw new BadRequestException({
        code: "ENTERPRISE_ALL_MODULES",
        message: "Enterprise includes all modules; bundle toggle is not applicable.",
      });
    }

    if (hasConstructorModulesInCustomConfig(snap.customConfig)) {
      throw new BadRequestException({
        code: "CUSTOM_PLAN_MODULES",
        message:
          "This organization uses a custom constructor plan; change modules via admin.",
      });
    }

    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new BadRequestException("Organization subscription not found");
    }

    const ob = await this.prisma.organizationBundle.findUnique({
      where: {
        organizationId_bundleId: {
          organizationId,
          bundleId: dto.bundleId,
        },
      },
    });

    const now = new Date();
    const catalogModules = await this.prisma.pricingModule.findMany({
      where: { key: { in: moduleKeys } },
    });
    const priceByKey = new Map(
      catalogModules.map((m) => [m.key, Number(m.pricePerMonth)]),
    );
    const bundlePrice = new Prisma.Decimal(
      bundleDiscountedPriceAzn(
        moduleKeys,
        Number(bundle.discountPercent),
        priceByKey,
      ),
    );

    const inCatalog = moduleKeys.every((k) =>
      isCatalogModuleActive(snap.activeModules, k),
    );
    const scheduledCancel =
      ob?.cancelledAt != null &&
      ob.accessUntil != null &&
      now.getTime() <= ob.accessUntil.getTime();
    const fullyActive =
      ob != null &&
      isBundleActiveNow(
        {
          cancelledAt: ob.cancelledAt,
          accessUntil: ob.accessUntil,
          pendingDeactivation: ob.pendingDeactivation,
        },
        now,
      ) &&
      inCatalog;

    if (dto.enabled) {
      if (fullyActive) {
        return {
          organizationId,
          bundleId: dto.bundleId,
          enabled: true,
          activeModules: snap.activeModules,
          note: "already_active",
        };
      }

      if (scheduledCancel && ob) {
        await this.prisma.$transaction(async (tx) => {
          await tx.organizationBundle.update({
            where: {
              organizationId_bundleId: {
                organizationId,
                bundleId: dto.bundleId,
              },
            },
            data: {
              cancelledAt: null,
              accessUntil: null,
              pendingDeactivation: false,
            },
          });
        });
        const after = await this.subscriptionAccess.getOrganizationSnapshot(
          organizationId,
        );
        return {
          organizationId,
          bundleId: dto.bundleId,
          enabled: true,
          activeModules: after.activeModules,
          note: "reactivated_before_period_end",
        };
      }

      await this.prisma.$transaction(async (tx) => {
        await this.orgBundles.upsertActiveInTx(
          tx,
          organizationId,
          dto.bundleId,
          bundlePrice,
        );
        await this.orgBundles.enableBundleModulesInTx(
          tx,
          organizationId,
          moduleKeys,
        );
        for (const key of moduleKeys) {
          const pm = catalogModules.find((m) => m.key === key);
          if (!pm) continue;
          await tx.organizationModule.deleteMany({
            where: { organizationId, moduleKey: key },
          });
        }
      });

      const after = await this.subscriptionAccess.getOrganizationSnapshot(
        organizationId,
      );
      return {
        organizationId,
        bundleId: dto.bundleId,
        enabled: true,
        activeModules: after.activeModules,
        note: "postpaid_bundle_activation_without_immediate_payment",
      };
    }

    if (!ob || (!fullyActive && !scheduledCancel)) {
      return {
        organizationId,
        bundleId: dto.bundleId,
        enabled: false,
        activeModules: snap.activeModules,
        note: "already_inactive",
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.orgBundles.scheduleCancellationInTx(
        tx,
        organizationId,
        dto.bundleId,
        bundlePrice,
      );
    });

    const after = await this.subscriptionAccess.getOrganizationSnapshot(
      organizationId,
    );
    return {
      organizationId,
      bundleId: dto.bundleId,
      enabled: false,
      activeModules: after.activeModules,
      note: "bundle_cancellation_scheduled_end_of_month",
    };
  }
}
