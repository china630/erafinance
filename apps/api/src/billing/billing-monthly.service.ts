import { Injectable, Logger } from "@nestjs/common";
import {
  BillingStatus,
  Prisma,
  SubscriptionInvoiceStatus,
} from "@erafinance/database";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { runWithTenantContextAsync } from "../prisma/tenant-context";
import { BillingPlatformService } from "./billing-platform.service";
import { BillingNotificationService } from "./billing-notification.service";
import { OrganizationModuleService } from "./organization-module.service";
import { OrganizationBundleService } from "./organization-bundle.service";
import { BillingEntitlementService } from "./billing-entitlement.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";
import { ReferralsService } from "../referrals/referrals.service";
import {
  bakuMonthBounds,
  billingPeriodKeyBaku,
  previousBillingPeriodKeyBaku,
} from "./baku-billing.util";
import { PREMIUM_MODULE_MONTHLY_AZN } from "./tariff-limits";

const Decimal = Prisma.Decimal;

function startOfMonthUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function endOfMonthUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

function previousMonthAnchorUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

function billingPeriodLabelUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class BillingMonthlyService {
  private readonly logger = new Logger(BillingMonthlyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingPlatform: BillingPlatformService,
    private readonly billingNotifications: BillingNotificationService,
    private readonly orgModules: OrganizationModuleService,
    private readonly orgBundles: OrganizationBundleService,
    private readonly entitlements: BillingEntitlementService,
    private readonly referrals: ReferralsService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /**
   * Hybrid monthly billing (Asia/Baku): base ERP tariff + premium add-ons per organization.
   * Base line is 0 AZN while trial is active; premium modules bill even during trial.
   */
  async runMonthlyBilling(now = new Date()): Promise<void> {
    const billingPeriod = previousBillingPeriodKeyBaku(now);
    const { from: periodStart, to: periodEnd } = bakuMonthBounds(billingPeriod);
    const dateOnly = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    await this.orgModules.finalizeExpiredModuleCancellations(now);
    await this.orgBundles.finalizeExpiredBundleCancellations(now);

    await runWithTenantContextAsync(
      { organizationId: null, skipTenantFilter: true },
      async () => {
        const expiredTrials = await this.prisma.organizationSubscription.findMany({
          where: {
            isTrial: true,
            expiresAt: { lt: now },
          },
          select: { organizationId: true },
        });
        const transitionedFromDemoOrgIds = new Set<string>();
        for (const sub of expiredTrials) {
          const updated = await this.prisma.organizationSubscription.updateMany({
            where: {
              organizationId: sub.organizationId,
              isTrial: true,
              expiresAt: { lt: now },
            },
            data: { isTrial: false, customConfig: Prisma.DbNull },
          });
          if (updated.count > 0) {
            transitionedFromDemoOrgIds.add(sub.organizationId);
            await this.billingNotifications.notifyDemoPeriodFinished(
              sub.organizationId,
              now,
            );
          }
        }

        const orgs = await this.prisma.organization.findMany({
          where: {
            id: { notIn: Array.from(transitionedFromDemoOrgIds) },
            subscription: { isNot: null },
          },
          include: { subscription: true },
        });

        const byOwner = new Map<string, typeof orgs>();
        for (const o of orgs) {
          const ownerId = await this.billingPlatform.resolveOwnerUserId(
            this.prisma,
            o.id,
          );
          if (!ownerId) continue;
          if (!byOwner.has(ownerId)) byOwner.set(ownerId, []);
          byOwner.get(ownerId)!.push(o);
        }

        let created = 0;
        const billedOrgIds: string[] = [];
        for (const [ownerUserId, list] of byOwner) {
          const dup = await this.prisma.subscriptionInvoice.findFirst({
            where: {
              userId: ownerUserId,
              billingPeriod,
              paymentOrderId: null,
              status: {
                in: [
                  SubscriptionInvoiceStatus.ISSUED,
                  SubscriptionInvoiceStatus.PAID,
                  SubscriptionInvoiceStatus.OVERDUE,
                ],
              },
            },
          });
          if (dup) continue;

          const items: Array<{
            organizationId: string;
            description: string;
            amount: Prisma.Decimal;
          }> = [];

          for (const o of list) {
            const sub = o.subscription;
            if (!sub) continue;
            const meteredSpendAzn = Number(o.accumulatedBalance ?? 0);
            const lines = await this.hybridInvoiceLinesForOrg(
              o.id,
              o.name,
              decodeOrganizationTaxId(o),
              sub,
              periodStart,
              periodEnd,
              meteredSpendAzn,
            );
            for (const line of lines) {
              if (line.amountAzn <= 0) continue;
              items.push({
                organizationId: o.id,
                description: line.description,
                amount: new Decimal(roundMoney2(line.amountAzn)),
              });
              if (!billedOrgIds.includes(o.id)) billedOrgIds.push(o.id);
            }
          }

          if (items.length === 0) continue;

          const totalDec = items.reduce(
            (s, it) => s.add(it.amount),
            new Decimal(0),
          );

          const subscriptionInvoice = await this.prisma.subscriptionInvoice.create({
            data: {
              userId: ownerUserId,
              amount: totalDec,
              status: SubscriptionInvoiceStatus.ISSUED,
              date: dateOnly,
              periodStart,
              periodEnd,
              billingPeriod,
              items: {
                create: items.map((it) => ({
                  organizationId: it.organizationId,
                  description: it.description,
                  amount: it.amount,
                })),
              },
            },
          });
          try {
            await this.referrals.accrueCommissionsForSubscriptionInvoice(
              subscriptionInvoice.id,
              billingPeriod,
            );
          } catch (e) {
            this.logger.error(
              `Referral commission accrual failed for invoice ${subscriptionInvoice.id}: ${e}`,
            );
          }
          await this.prisma.organization.updateMany({
            where: {
              id: { in: billedOrgIds },
            },
            data: {
              billingStatus: BillingStatus.SOFT_BLOCK,
              accumulatedBalance: new Decimal(0),
            },
          });
          created++;
        }

        await this.prisma.organizationSubscription.updateMany({
          where: { organizationId: { in: billedOrgIds } },
          data: { billingPeriodKey: billingPeriodKeyBaku(now) },
        });

        this.logger.log(
          `Hybrid billing: period ${billingPeriod} (Baku) — ${created} owner invoice(s), ${orgs.length} org(s) scanned`,
        );

        const deactivated = await this.orgModules.finalizePendingDeactivations();
        if (deactivated > 0) {
          this.logger.log(
            `Post-paid billing cleanup: finalized ${deactivated} pending deactivation module(s)`,
          );
        }
      },
    );
  }

  @Cron("0 0 1 * *", { timeZone: "Asia/Baku" })
  async runMonthlyBillingCron(): Promise<void> {
    await this.runMonthlyBilling(new Date());
  }

  private async hybridInvoiceLinesForOrg(
    organizationId: string,
    orgName: string,
    taxId: string,
    sub: {
      currentTier: import("@erafinance/database").TariffTier;
      isTrial: boolean;
      trialExpiresAt: Date | null;
      expiresAt: Date | null;
      activatedPremiumModules: string[];
    },
    periodStart: Date,
    periodEnd: Date,
    meteredSpendAzn: number,
  ): Promise<Array<{ description: string; amountAzn: number }>> {
    const lines: Array<{ description: string; amountAzn: number }> = [];
    const trialEnd = sub.trialExpiresAt ?? sub.expiresAt;
    const trialCoversPeriod =
      sub.isTrial && trialEnd != null && trialEnd.getTime() > periodEnd.getTime();

    const foundationAzn = trialCoversPeriod
      ? 0
      : await this.systemConfig.getFoundationMonthlyAzn();
    if (foundationAzn > 0) {
      lines.push({
        description: `ERA Core (Foundation) — ${orgName} (VÖEN ${taxId})`,
        amountAzn: foundationAzn,
      });
    }

    if (meteredSpendAzn > 0) {
      lines.push({
        description: `Metered usage — ${orgName} (VÖEN ${taxId})`,
        amountAzn: roundMoney2(meteredSpendAzn),
      });
    }

    const moduleLines = await this.entitlements.computeInvoiceModuleLines(
      organizationId,
      periodStart,
      periodEnd,
    );
    for (const ml of moduleLines) {
      lines.push({
        description: `${ml.description} — ${orgName} (VÖEN ${taxId})`,
        amountAzn: ml.amountAzn,
      });
    }

    for (const slug of sub.activatedPremiumModules ?? []) {
      const fee =
        PREMIUM_MODULE_MONTHLY_AZN[
          slug as keyof typeof PREMIUM_MODULE_MONTHLY_AZN
        ] ?? 0;
      if (fee <= 0) continue;
      lines.push({
        description: `Premium module ${slug} — ${orgName} (VÖEN ${taxId})`,
        amountAzn: fee,
      });
    }
    return lines;
  }

  @Cron("0 10 25 * *")
  async runBillingReminderCron(): Promise<void> {
    await runWithTenantContextAsync(
      { organizationId: null, skipTenantFilter: true },
      async () => {
        const orgsWithPaidModules = await this.prisma.organizationModule.findMany({
          distinct: ["organizationId"],
          select: { organizationId: true },
        });
        for (const row of orgsWithPaidModules) {
          await this.billingNotifications.notifyUpcomingInvoice(
            row.organizationId,
            new Date(),
          );
        }
        this.logger.log(
          `Billing reminder cron: notified ${orgsWithPaidModules.length} organization(s)`,
        );
      },
    );
  }

  @Cron("0 0 6 * *")
  async runHardBlockEscalationCron(): Promise<void> {
    const previousMonth = previousMonthAnchorUtc(new Date());
    const billingPeriod = billingPeriodLabelUtc(previousMonth);
    await runWithTenantContextAsync(
      { organizationId: null, skipTenantFilter: true },
      async () => {
        const soft = await this.prisma.organization.findMany({
          where: { billingStatus: BillingStatus.SOFT_BLOCK },
          select: { id: true },
        });
        if (soft.length === 0) return;
        const softIds = soft.map((o) => o.id);
        const unpaid = await this.prisma.billingInvoiceItem.findMany({
          where: {
            organizationId: { in: softIds },
            subscriptionInvoice: {
              billingPeriod,
              status: { not: SubscriptionInvoiceStatus.PAID },
            },
          },
          select: { organizationId: true },
          distinct: ["organizationId"],
        });
        const hardIds = unpaid.map((r) => r.organizationId);
        if (hardIds.length === 0) return;
        const upd = await this.prisma.organization.updateMany({
          where: { id: { in: hardIds } },
          data: { billingStatus: BillingStatus.HARD_BLOCK },
        });
        this.logger.log(
          `Billing hard-block cron: period ${billingPeriod}, escalated ${upd.count} organization(s)`,
        );
      },
    );
  }

  private async estimatePostpaidMonthlyAznForOrganization(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const lines = await this.entitlements.computeInvoiceModuleLines(
      organizationId,
      periodStart,
      periodEnd,
    );
    return lines.reduce((s, l) => s + l.amountAzn, 0);
  }
}
