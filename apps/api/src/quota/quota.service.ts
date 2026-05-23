import { Injectable, Logger } from "@nestjs/common";
import { TariffTier } from "@erafinance/database";
import { BillingMeterService } from "../billing/billing-meter.service";
import { bakuMonthBounds, billingPeriodKeyBaku } from "../billing/baku-billing.util";
import { TARIFF_TIER_LIMITS } from "../billing/tariff-limits";
import { resolveOrganizationUuid } from "../common/organization-id.util";
import type { TierQuotas } from "../constants/quotas";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { QuotaExceededException } from "./quota-exceeded.exception";

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly billingMeter: BillingMeterService,
  ) {}

  private async getSubscriptionTier(organizationId: string): Promise<TariffTier> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return TariffTier.TIER_0;
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { currentTier: true },
    });
    return sub?.currentTier ?? TariffTier.TIER_0;
  }

  async assertEmployeeQuota(organizationId: string): Promise<void> {
    await this.billingMeter.assertBillingNotHardBlocked(organizationId);
  }

  async assertStorageQuota(
    organizationId: string,
    additionalBytes: number,
  ): Promise<void> {
    await this.billingMeter.assertBillingNotHardBlocked(organizationId);
    if (additionalBytes <= 0) return;
    const gb = additionalBytes / 1024 ** 3;
    if (gb > 0) {
      await this.billingMeter.recordUsage(
        organizationId,
        "STORAGE_GB_MONTHLY",
        Math.ceil(gb * 100) / 100,
      );
    }
  }

  async assertInvoiceQuota(organizationId: string): Promise<void> {
    await this.billingMeter.recordUsage(organizationId, "INVOICE_CREATED", 1);
  }

  async assertWhatsappQuota(organizationId: string, quantity = 1): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;
    await this.billingMeter.recordUsage(
      organizationId,
      "WHATSAPP_ALERT",
      quantity,
    );
    const periodKey = billingPeriodKeyBaku();
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { whatsappAlertsUsed: true },
    });
    const used = org?.whatsappAlertsUsed ?? 0;
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { whatsappAlertsUsed: used + quantity, billingPeriodKey: periodKey },
    });
  }

  async assertOcrQuota(organizationId: string, pages = 1): Promise<void> {
    await this.billingMeter.recordUsage(organizationId, "OCR_PAGE", pages);
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { ocrPagesUsed: true },
    });
    const used = org?.ocrPagesUsed ?? 0;
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { ocrPagesUsed: used + pages },
    });
  }

  async getQuotaSnapshot(organizationId: string) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return null;
    const tier = await this.getSubscriptionTier(orgId);
    const limits = TARIFF_TIER_LIMITS[tier];
    const meterUnitPricing = await this.systemConfig.getMeterUnitPricing();
    const tierSpendCeilings = await this.billingMeter.getAllTierSpendCeilings();
    const monthlySpendAzn = await this.billingMeter.getMonthlySpendAzn(orgId);

    const periodKey = billingPeriodKeyBaku();
    const { from, to } = bakuMonthBounds(periodKey);

    const [employees, invoicesThisMonth] = await Promise.all([
      this.prisma.organizationMembership.count({ where: { organizationId: orgId } }),
      this.prisma.invoice.count({
        where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
      }),
    ]);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { storageUsedBytes: true, whatsappAlertsUsed: true, ocrPagesUsed: true },
    });

    return {
      tier,
      limits,
      meterUnitPricing,
      tierSpendCeilings,
      monthlySpendAzn,
      usage: {
        employees,
        invoicesThisMonth,
        storageBytes: Number(org?.storageUsedBytes ?? 0n),
        whatsappAlertsUsed: org?.whatsappAlertsUsed ?? 0,
        ocrPagesUsed: org?.ocrPagesUsed ?? 0,
      },
      billingPeriodKey: periodKey,
    };
  }

  async assertInvoiceMonthlyQuota(organizationId: string): Promise<void> {
    return this.assertInvoiceQuota(organizationId);
  }

  async assertOcrJobsPerMonth(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return;
    const limit = await this.systemConfig.getOcrJobsPerOrgMonthLimit();
    const tier = await this.getSubscriptionTier(orgId);
    if (tier === TariffTier.TIER_3) return;
    const periodKey = billingPeriodKeyBaku();
    const { from, to } = bakuMonthBounds(periodKey);
    const count = await this.prisma.ocrJob.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: from, lte: to },
      },
    });
    if (count >= limit) {
      throw new QuotaExceededException("maxOcrJobsPerMonth", limit, count);
    }
  }

  async addStorageUsage(organizationId: string, additionalBytes: number): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId || additionalBytes <= 0) return;
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { storageUsedBytes: { increment: BigInt(additionalBytes) } },
    });
  }

  async getEmployeeQuotaSnapshot(organizationId: string) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return { used: 0, limit: null, remaining: null };
    const used = await this.prisma.organizationMembership.count({
      where: { organizationId: orgId },
    });
    return { used, limit: null, remaining: null };
  }

  async getInvoiceMonthlyQuotaSnapshot(organizationId: string) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return { used: 0, limit: null, remaining: null };
    const periodKey = billingPeriodKeyBaku();
    const { from, to } = bakuMonthBounds(periodKey);
    const used = await this.prisma.invoice.count({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
    });
    return { used, limit: null, remaining: null };
  }

  async getStorageQuotaSnapshot(organizationId: string) {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) return { used: 0, limit: null, remaining: null };
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { storageUsedBytes: true },
    });
    const usedGb = Number(org?.storageUsedBytes ?? 0n) / 1024 ** 3;
    const usedRounded = Math.round(usedGb * 100) / 100;
    return { used: usedRounded, limit: null, remaining: null };
  }
}
