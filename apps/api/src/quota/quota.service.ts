import { Injectable, Logger } from "@nestjs/common";
import { SubscriptionTier } from "@erafinance/database";
import { resolveOrganizationUuid } from "../common/organization-id.util";
import type { TierQuotas } from "../constants/quotas";
import { PrismaService } from "../prisma/prisma.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { QuotaExceededException } from "./quota-exceeded.exception";

function mergeTrialQuotasInto(
  base: TierQuotas,
  sub: {
    isTrial: boolean;
    expiresAt: Date | null;
    customConfig: unknown;
  } | null,
): TierQuotas {
  if (!sub?.isTrial || !sub.expiresAt) return base;
  if (sub.expiresAt.getTime() < Date.now()) return base;
  if (sub.customConfig == null || typeof sub.customConfig !== "object") {
    return base;
  }
  const tq = (sub.customConfig as { trialQuotas?: unknown }).trialQuotas;
  if (tq == null || typeof tq !== "object") return base;
  const o = tq as Record<string, unknown>;
  const out: TierQuotas = { ...base };
  for (const key of [
    "maxEmployees",
    "maxInvoicesPerMonth",
    "maxStorageGb",
  ] as const) {
    const v = o[key];
    if (v === null) out[key] = null;
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

function utcMonthBoundsUtc(now = new Date()): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  private async getTier(organizationId: string): Promise<SubscriptionTier> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      this.logger.warn(
        `getTier: unresolved organizationId="${organizationId}" — using STARTER quotas`,
      );
      return SubscriptionTier.STARTER;
    }
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { tier: true },
    });
    if (!sub) {
      this.logger.warn(
        `getTier: no OrganizationSubscription row for org ${orgId} — using STARTER quotas (dev / lazy billing)`,
      );
      return SubscriptionTier.STARTER;
    }
    return sub.tier;
  }

  private async quotasForTier(tier: SubscriptionTier) {
    return this.systemConfig.getTierQuotas(tier);
  }

  private async quotasForOrganization(orgId: string | null): Promise<TierQuotas> {
    if (!orgId) {
      return this.systemConfig.getTierQuotas(SubscriptionTier.STARTER);
    }
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
      select: { tier: true, isTrial: true, expiresAt: true, customConfig: true },
    });
    const tier = sub?.tier ?? SubscriptionTier.STARTER;
    const base = await this.quotasForTier(tier);
    return mergeTrialQuotasInto(base, sub);
  }

  async assertEmployeeQuota(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return;
    }
    const { maxEmployees } = await this.quotasForOrganization(orgId);
    if (maxEmployees == null) return;

    const current = await this.prisma.employee.count({
      where: { organizationId: orgId },
    });
    if (current >= maxEmployees) {
      throw new QuotaExceededException("maxEmployees", maxEmployees, current);
    }
  }

  async assertStorageQuota(
    organizationId: string,
    additionalBytes: number,
  ): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return;
    }
    if (additionalBytes <= 0) {
      return;
    }
    const { maxStorageGb } = await this.quotasForOrganization(orgId);
    if (maxStorageGb == null) {
      return;
    }
    const maxBytes = BigInt(maxStorageGb) * 1024n ** 3n;
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, isDeleted: false },
      select: { storageUsedBytes: true },
    });
    const used = org?.storageUsedBytes ?? 0n;
    const add = BigInt(additionalBytes);
    if (used + add > maxBytes) {
      const limitGb = maxStorageGb;
      const usedGb = Number(used) / (1024 * 1024 * 1024);
      const usedRounded = Math.round(usedGb * 100) / 100;
      throw new QuotaExceededException("maxStorageGb", limitGb, usedRounded);
    }
  }

  async addStorageUsage(organizationId: string, deltaBytes: number): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId || deltaBytes <= 0) {
      return;
    }
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        storageUsedBytes: { increment: BigInt(deltaBytes) },
      },
    });
  }

  async assertInvoiceMonthlyQuota(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return;
    }
    const { maxInvoicesPerMonth } = await this.quotasForOrganization(orgId);
    if (maxInvoicesPerMonth == null) return;

    const { from, to } = utcMonthBoundsUtc();
    const current = await this.prisma.invoice.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: from, lte: to },
      },
    });
    if (current >= maxInvoicesPerMonth) {
      throw new QuotaExceededException(
        "maxInvoicesPerMonth",
        maxInvoicesPerMonth,
        current,
      );
    }
  }

  /** Для UI: текущее число сотрудников и лимит по тиру (без исключения при достижении лимита). */
  async getEmployeeQuotaSnapshot(organizationId: string): Promise<{
    current: number;
    max: number | null;
    atLimit: boolean;
  }> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return { current: 0, max: null, atLimit: false };
    }

    let maxEmployees: number | null = null;
    try {
      const q = await this.quotasForOrganization(orgId);
      maxEmployees = q.maxEmployees;
    } catch (e) {
      this.logger.warn(
        `getEmployeeQuotaSnapshot: quotas failed for ${orgId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    let current = 0;
    try {
      current = await this.prisma.employee.count({
        where: { organizationId: orgId },
      });
    } catch (e) {
      this.logger.warn(
        `getEmployeeQuotaSnapshot: employee count failed for ${orgId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const atLimit = maxEmployees != null && current >= maxEmployees;
    return { current, max: maxEmployees, atLimit };
  }

  /** Инвойсы за текущий UTC-месяц — для UI лимита. */
  async getInvoiceMonthlyQuotaSnapshot(organizationId: string): Promise<{
    current: number;
    max: number | null;
    atLimit: boolean;
  }> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return { current: 0, max: null, atLimit: false };
    }

    let maxInvoicesPerMonth: number | null = null;
    try {
      const q = await this.quotasForOrganization(orgId);
      maxInvoicesPerMonth = q.maxInvoicesPerMonth;
    } catch (e) {
      this.logger.warn(
        `getInvoiceMonthlyQuotaSnapshot: quotas failed for ${orgId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const { from, to } = utcMonthBoundsUtc();
    let current = 0;
    try {
      current = await this.prisma.invoice.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: from, lte: to },
        },
      });
    } catch (e) {
      this.logger.warn(
        `getInvoiceMonthlyQuotaSnapshot: invoice count failed for ${orgId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const atLimit =
      maxInvoicesPerMonth != null && current >= maxInvoicesPerMonth;
    return { current, max: maxInvoicesPerMonth, atLimit };
  }

  async getStorageQuotaSnapshot(organizationId: string): Promise<{
    currentBytes: string;
    maxGb: number | null;
    atLimit: boolean;
  }> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return { currentBytes: "0", maxGb: null, atLimit: false };
    }
    let maxStorageGb: number | null = null;
    try {
      const q = await this.quotasForOrganization(orgId);
      maxStorageGb = q.maxStorageGb;
    } catch (e) {
      this.logger.warn(
        `getStorageQuotaSnapshot: quotas failed for ${orgId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, isDeleted: false },
      select: { storageUsedBytes: true },
    });
    const used = org?.storageUsedBytes ?? 0n;
    const maxBytes =
      maxStorageGb != null ? BigInt(maxStorageGb) * 1024n ** 3n : null;
    const atLimit = maxBytes != null && used >= maxBytes;
    return {
      currentBytes: used.toString(),
      maxGb: maxStorageGb,
      atLimit,
    };
  }

  /**
   * Trade Pro OCR uploads: per-org monthly cap from `SystemConfig` (`quota.ocr_jobs_per_org_month_v1`).
   * ENTERPRISE is exempt.
   */
  async assertOcrJobsPerMonth(organizationId: string): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return;
    }
    const tier = await this.getTier(organizationId);
    if (tier === SubscriptionTier.ENTERPRISE) {
      return;
    }
    const limit = await this.systemConfig.getOcrJobsPerOrgMonthLimit();
    const { from, to } = utcMonthBoundsUtc();
    const current = await this.prisma.ocrJob.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: from, lte: to },
      },
    });
    if (current >= limit) {
      throw new QuotaExceededException("maxOcrJobsPerMonth", limit, current);
    }
  }

  /**
   * Remaining prepaid outbound WhatsApp sends (organization balance, PRD §6.8).
   */
  async getWhatsappOutboundMessagesSnapshot(organizationId: string): Promise<{
    balance: number;
    atLimit: boolean;
  }> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return { balance: 0, atLimit: true };
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, isDeleted: false },
      select: { whatsappOutboundMessagesBalance: true },
    });
    const balance = org?.whatsappOutboundMessagesBalance ?? 0;
    return { balance, atLimit: balance <= 0 };
  }

  /**
   * Call before enqueueing a billable WhatsApp send; decrements are done by the sender after success.
   */
  async assertWhatsappOutboundMessagesRemaining(
    organizationId: string,
  ): Promise<void> {
    const orgId = resolveOrganizationUuid(organizationId);
    if (!orgId) {
      return;
    }
    const { balance } = await this.getWhatsappOutboundMessagesSnapshot(
      organizationId,
    );
    if (balance <= 0) {
      throw new QuotaExceededException("whatsappOutboundMessages", 1, 0);
    }
  }
}
