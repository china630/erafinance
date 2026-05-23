import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { TariffTier } from "@erafinance/database";
import { billingPeriodKeyBaku } from "./baku-billing.util";
import { ActivatePremiumDto } from "./dto/activate-premium.dto";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../admin/pricing.service";
import { catalogModuleKeyToPatch } from "./billing-module-toggle.helpers";
import { OrganizationModuleService } from "./organization-module.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";

@Injectable()
export class BillingPremiumActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly orgModules: OrganizationModuleService,
  ) {}

  async activatePremium(
    organizationId: string,
    dto: ActivatePremiumDto,
  ): Promise<{ ok: true; activatedPremiumModules: string[] }> {
    if (!dto.confirmCommercialStatus) {
      throw new BadRequestException({
        code: "COMMERCIAL_STATUS_REQUIRED",
        message: "Commercial status confirmation is required to unlock premium modules.",
      });
    }

    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new BadRequestException("Organization subscription not found");
    }

    const modules = dto.modules.filter((m) => this.pricing.isPremiumModuleKey(m));
    if (modules.length === 0) {
      throw new BadRequestException("No valid premium module slugs provided");
    }

    const periodKey = billingPeriodKeyBaku();
    const merged = Array.from(
      new Set([...(sub.activatedPremiumModules ?? []), ...modules]),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationSubscription.update({
        where: { organizationId },
        data: {
          activatedPremiumModules: merged,
          billingPeriodKey: periodKey,
          currentTier: sub.currentTier ?? TariffTier.TIER_1,
        },
      });

      for (const slug of modules) {
        await this.subscriptionAccess.updateModuleAddons(
          organizationId,
          catalogModuleKeyToPatch(slug, true),
          tx,
        );
        const pm = await tx.pricingModule.findUnique({ where: { key: slug } });
        if (pm) {
          await this.orgModules.upsertActiveInTx(
            tx,
            organizationId,
            slug,
            pm.pricePerMonth,
          );
        }
      }
    });

    return { ok: true, activatedPremiumModules: merged };
  }

  assertNotTrialLockedPremium(
    sub: {
      isTrial: boolean;
      trialExpiresAt: Date | null;
      expiresAt: Date | null;
      activatedPremiumModules: string[];
    },
    moduleKey: string,
  ): void {
    if (!sub.isTrial || !this.pricing.isPremiumModuleKey(moduleKey)) return;
    const trialEnd = sub.trialExpiresAt ?? sub.expiresAt;
    if (!trialEnd || trialEnd.getTime() <= Date.now()) return;
    if (!(sub.activatedPremiumModules ?? []).includes(moduleKey)) {
      throw new BadRequestException({
        statusCode: 403,
        code: "PREMIUM_TRIAL_LOCKED",
        message:
          "Премиум-модули недоступны в триал-периоде. Для активации перейдите на коммерческий платный тариф.",
        module: moduleKey,
        allowedPremium: this.pricing.getPremiumModuleKeys(),
      });
    }
  }
}
