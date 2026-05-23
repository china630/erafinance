import { Injectable, Logger } from "@nestjs/common";
import { BillingStatus } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { billingPeriodKeyBaku } from "./baku-billing.util";
import { BillingMeterService } from "./billing-meter.service";

export type SettlementOptions = {
  /** Bump tariff tier only after intraday tier-ceiling payment. */
  tierBumpOrganizationIds?: string[];
};

@Injectable()
export class BillingSettlementService {
  private readonly logger = new Logger(BillingSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingMeter: BillingMeterService,
  ) {}

  /** After owner pays platform invoice — unlock orgs; optional tier bump for intraday unlock. */
  async settleOrganizationsForOwner(
    ownerId: string,
    options?: SettlementOptions,
  ): Promise<number> {
    const bumpSet = new Set(options?.tierBumpOrganizationIds ?? []);
    const orgs = await this.prisma.organization.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true },
    });

    const periodKey = billingPeriodKeyBaku();
    let updated = 0;
    for (const org of orgs) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: {
          billingStatus: BillingStatus.ACTIVE,
          whatsappAlertsUsed: 0,
          ocrPagesUsed: 0,
        },
      });
      await this.prisma.organizationSubscription.updateMany({
        where: { organizationId: org.id },
        data: { billingPeriodKey: periodKey },
      });
      if (bumpSet.has(org.id)) {
        await this.billingMeter.bumpTierAfterIntradayPayment(org.id);
      } else {
        await this.billingMeter.resetMonthlySpendAfterInvoiced(org.id);
      }
      updated += 1;
    }

    this.logger.log(`Settlement: reset ${updated} org(s) for owner ${ownerId}`);
    return updated;
  }
}
