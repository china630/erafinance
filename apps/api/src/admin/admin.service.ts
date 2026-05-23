import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountType,
  cashProfileForNasCode,
  OrganizationKind,
  PaymentOrderStatus,
  Prisma,
  TariffTier,
} from "@erafinance/database";
import type { TierQuotas } from "../constants/quotas";
import { PrismaService } from "../prisma/prisma.service";
import {
  blindIndex,
  decodeOrganizationTaxId,
  decryptText,
  normalizeVoen,
} from "../security/pii-crypto.util";
import { SystemConfigService } from "../system-config/system-config.service";
import type { AdminSubscriptionPatchDto } from "./dto/admin-subscription-patch.dto";
import type { PatchBillingGlobalLimitsDto } from "./dto/patch-billing-global-limits.dto";
import type { PatchBillingPricingCatalogDto } from "./dto/patch-billing-pricing-catalog.dto";
import type {
  CreatePricingBundleDto,
  UpdatePricingBundleDto,
} from "./dto/pricing-bundle.dto";
import type { PatchPricingBundleTrialConfigDto } from "./dto/pricing-bundle-trial-config.dto";
import type { PatchFoundationDto } from "./dto/patch-foundation.dto";
import type { PatchOcrJobsPerOrgMonthDto } from "./dto/patch-ocr-jobs-per-org-month.dto";
import type { PatchPricingModulePriceDto } from "./dto/patch-pricing-module-price.dto";
import type { PatchQuotaUnitPricingDto } from "./dto/patch-quota-unit-pricing.dto";
import type { PatchYearlyDiscountDto } from "./dto/patch-yearly-discount.dto";
import type { SetBillingPriceDto } from "./dto/set-billing-price.dto";
import type { PatchMeterUnitPricingDto } from "./dto/patch-meter-unit-pricing.dto";
import type { PatchTierSpendCeilingsDto } from "./dto/patch-tier-spend-ceilings.dto";
import type { SetTierQuotasDto } from "./dto/set-tier-quotas.dto";
import {
  DEFAULT_TIER_SPEND_CEILINGS_AZN,
  TIER_SPEND_CEILING_KEYS,
} from "../billing/tier-spend-ceiling";
import {
  quotasMatrixToRecord,
  type SetBillingQuotasMatrixDto,
} from "./dto/set-billing-quotas-matrix.dto";
import type { TranslationUpsertDto } from "./dto/translation-upsert.dto";
import type { PatchChartTemplateEntryDto } from "./dto/patch-chart-template-entry.dto";
import type { UpsertChartTemplateEntryDto } from "./dto/upsert-chart-template-entry.dto";
import { getDefaultFlatTranslations } from "./i18n-default-catalog";
import { enrichPublicPricingStorefront } from "../billing/pricing-storefront-snapshot.util";
import { PricingService } from "./pricing.service";

const I18N_CACHE_KEY = "i18n.cacheVersion";

const BILLING_SYSTEM_KEYS = {
  foundation: "billing.foundation_monthly_azn",
  yearlyDiscount: "billing.yearly_discount_percent",
  quotaUnitPricing: "billing.quota_unit_pricing_v1",
  ocrJobsPerOrgMonth: "quota.ocr_jobs_per_org_month_v1",
} as const;

const TIER_LEGACY_PRICE_KEYS: Record<TariffTier, string> = {
  TIER_0: "billing.price.TIER_0",
  TIER_1: "billing.price.TIER_1",
  TIER_2: "billing.price.TIER_2",
  TIER_3: "billing.price.TIER_3",
};

const tierQuotaConfigKey = (tier: TariffTier) => `quota.tier.${tier}`;

function pricingBundleTrialPatch(
  trial: PatchPricingBundleTrialConfigDto | undefined,
): Prisma.PricingBundleUpdateInput {
  if (!trial) return {};
  const data: Prisma.PricingBundleUpdateInput = {};
  if (trial.isTrialDefault !== undefined) {
    data.isTrialDefault = trial.isTrialDefault;
  }
  if (trial.trialDurationDays !== undefined) {
    data.trialDurationDays =
      trial.trialDurationDays === null ? null : trial.trialDurationDays;
  }
  if (trial.trialQuotas !== undefined) {
    data.trialQuotas =
      trial.trialQuotas === null
        ? Prisma.DbNull
        : (trial.trialQuotas as Prisma.InputJsonValue);
  }
  return data;
}

function parseExpiresAtFromDto(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException("Invalid expiresAt: could not parse as date");
  }
  return d;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly pricing: PricingService,
  ) {}

  async getStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalOrganizations, revenueAgg, newUsers24h, activeTrials] =
      await Promise.all([
        this.prisma.organization.count(),
        this.prisma.paymentOrder.aggregate({
          where: { status: PaymentOrderStatus.PAID },
          _sum: { amountAzn: true },
        }),
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.organizationSubscription.count({
          where: {
            isTrial: true,
            isBlocked: false,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      ]);
    return {
      totalOrganizations,
      revenueTotalAzn: revenueAgg._sum.amountAzn?.toString() ?? "0",
      newUsers24h,
      activeTrials,
    };
  }

  async listUsers(
    q: string | undefined,
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;
    const trimmed = q?.trim();
    const where: Prisma.UserWhereInput = trimmed
      ? {
          OR: [
            { email: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          firstNameCipher: true,
          lastNameCipher: true,
          isSuperAdmin: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstNameCipher ? decryptText(u.firstNameCipher) : null,
        lastName: u.lastNameCipher ? decryptText(u.lastNameCipher) : null,
        fullName: [
          u.firstNameCipher ? decryptText(u.firstNameCipher) : null,
          u.lastNameCipher ? decryptText(u.lastNameCipher) : null,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || null,
        isSuperAdmin: u.isSuperAdmin,
        membershipCount: u._count.memberships,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  async listOrganizations(
    q: string | undefined,
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;
    const trimmed = q?.trim();
    const normalizedVoen = trimmed ? normalizeVoen(trimmed) : "";
    const voenBlind =
      normalizedVoen.length > 0 ? blindIndex("voen", normalizedVoen) : null;
    const where: Prisma.OrganizationWhereInput = trimmed
      ? {
          OR: [
            ...(voenBlind
              ? [{ taxIdBlindIndex: { equals: voenBlind } } as Prisma.OrganizationWhereInput]
              : []),
            { name: { contains: trimmed, mode: "insensitive" } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          subscription: true,
          memberships: {
            take: 1,
            orderBy: { joinedAt: "asc" },
            select: { userId: true, role: true },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: rows.map((o) => ({
        id: o.id,
        name: o.name,
        taxId: decodeOrganizationTaxId(o),
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        primaryUserId: o.memberships[0]?.userId ?? null,
        subscription: o.subscription
          ? {
              tier: o.subscription.currentTier,
              expiresAt: o.subscription.expiresAt?.toISOString() ?? null,
              isTrial: o.subscription.isTrial,
              isBlocked: o.subscription.isBlocked,
              activeModules: o.subscription.activeModules,
            }
          : null,
      })),
    };
  }

  async patchSubscription(
    organizationId: string,
    dto: AdminSubscriptionPatchDto,
  ) {
    const existing = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true },
    });
    if (!existing) {
      throw new NotFoundException("Organization not found");
    }

    let expiresAt: Date | null | undefined = undefined;
    if (dto.expiresAt !== undefined) {
      expiresAt =
        dto.expiresAt === null || dto.expiresAt === ""
          ? null
          : parseExpiresAtFromDto(String(dto.expiresAt).trim());
    }
    if (dto.extendMonths != null && dto.extendMonths > 0) {
      const sub = existing.subscription;
      const base =
        sub?.expiresAt && sub.expiresAt > new Date()
          ? sub.expiresAt
          : new Date();
      const d = new Date(base);
      d.setMonth(d.getMonth() + dto.extendMonths);
      expiresAt = d;
    }

    const data: Prisma.OrganizationSubscriptionUncheckedUpdateInput = {};
    if (dto.isBlocked !== undefined) {
      data.isBlocked = dto.isBlocked;
    }
    if (dto.tier !== undefined) {
      data.currentTier = dto.tier;
    }
    if (expiresAt !== undefined) {
      data.expiresAt = expiresAt;
    }
    if (dto.activeModules !== undefined) {
      data.activeModules = dto.activeModules;
    }
    if (dto.isTrial !== undefined) {
      data.isTrial = dto.isTrial;
    }

    if (existing.subscription) {
      if (Object.keys(data).length === 0) {
        throw new BadRequestException("Nothing to update");
      }
      return this.prisma.organizationSubscription.update({
        where: { organizationId },
        data,
      });
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nothing to update");
    }
    return this.prisma.organizationSubscription.create({
      data: {
        organizationId,
        currentTier: dto.tier ?? TariffTier.TIER_1,
        isTrial: false,
        isBlocked: dto.isBlocked ?? false,
        expiresAt: expiresAt ?? null,
        activeModules: dto.activeModules ?? [],
      },
    });
  }

  async getUserOrganizations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const rows = await this.prisma.organizationMembership.findMany({
      where: { userId },
      include: {
        organization: {
          include: { subscription: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return {
      userId: user.id,
      email: user.email,
      items: rows.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        taxId: decodeOrganizationTaxId(m.organization),
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        subscription: m.organization.subscription
          ? {
              tier: m.organization.subscription.currentTier,
              expiresAt:
                m.organization.subscription.expiresAt?.toISOString() ?? null,
              isTrial: m.organization.subscription.isTrial,
              isBlocked: m.organization.subscription.isBlocked,
              activeModules: m.organization.subscription.activeModules,
            }
          : null,
      })),
    };
  }

  async getBillingConfig() {
    const prices = await this.systemConfig.getAllBillingPrices();
    const tiers = Object.keys(prices) as TariffTier[];
    const quotas: Record<string, TierQuotas> = {};
    for (const t of tiers) {
      quotas[t] = await this.systemConfig.getTierQuotas(t);
    }
    const constructorData = await this.pricing.getConstructorData();
    const [
      yearlyDiscountPercent,
      quotaPricing,
      meterUnitPricing,
      tierSpendCeilings,
      pricingBundles,
      ocrJobsPerOrgMonth,
    ] = await Promise.all([
      this.systemConfig.getYearlyDiscountPercent(),
      this.systemConfig.getQuotaUnitPricing(),
      this.systemConfig.getMeterUnitPricing(),
      this.getTierSpendCeilings(),
      this.prisma.pricingBundle.findMany({ orderBy: { updatedAt: "desc" } }),
      this.systemConfig.getOcrJobsPerOrgMonthLimit(),
    ]);
    return {
      prices,
      quotas,
      ocrJobsPerOrgMonth,
      foundationMonthlyAzn: constructorData.basePrice,
      yearlyDiscountPercent,
      quotaPricing,
      meterUnitPricing,
      tierSpendCeilings,
      basePrice: constructorData.basePrice,
      pricingModules: constructorData.modules.map((m) =>
        serializePricingModule({
          id: m.id,
          key: m.key,
          name: m.name,
          pricePerMonth: m.pricePerMonth,
          sortOrder: m.sortOrder,
          isPremium: m.isPremium,
        }),
      ),
      pricingBundles: pricingBundles.map(serializePricingBundle),
    };
  }

  /**
   * Read-only marketing snapshot: no JWT, no org secrets.
   * Omits module/bundle UUIDs and trial quota JSON from bundles.
   */
  async getPublicPricingSnapshot() {
    const config = await this.getBillingConfig();
    const pricingModules = config.pricingModules.map((m) => ({
      key: m.key,
      name: m.name,
      pricePerMonth: m.pricePerMonth,
      sortOrder: m.sortOrder,
      isPremium: m.isPremium,
    }));
    const pricingBundles = config.pricingBundles.map((b) => ({
      name: b.name,
      discountPercent: b.discountPercent,
      moduleKeys: b.moduleKeys,
      isTrialDefault: Boolean(b.isTrialDefault),
      trialDurationDays: b.trialDurationDays ?? null,
    }));
    const storefront = enrichPublicPricingStorefront({
      foundationMonthlyAzn: config.foundationMonthlyAzn,
      pricingModules,
      pricingBundles,
      tierSpendCeilingsAzn: config.tierSpendCeilings,
      meterUnitPricing: config.meterUnitPricing,
    });
    return {
      currency: "AZN" as const,
      foundationMonthlyAzn: config.foundationMonthlyAzn,
      yearlyDiscountPercent: config.yearlyDiscountPercent,
      pricingModules,
      pricingBundles,
      meterUnitPricing: config.meterUnitPricing,
      tierSpendCeilings: config.tierSpendCeilings,
      ocrJobsPerOrgMonth: config.ocrJobsPerOrgMonth,
      standardModules: storefront.standardModules,
      premiumModules: storefront.premiumModules,
      bundles: storefront.bundles,
      tiers: storefront.tiers,
    };
  }

  async getTierSpendCeilings(): Promise<Record<TariffTier, number>> {
    const tiers = Object.keys(TIER_SPEND_CEILING_KEYS) as TariffTier[];
    const out = { ...DEFAULT_TIER_SPEND_CEILINGS_AZN };
    for (const tier of tiers) {
      const raw = await this.systemConfig.getJson(TIER_SPEND_CEILING_KEYS[tier]);
      if (typeof raw === "number" && Number.isFinite(raw)) out[tier] = raw;
      else if (typeof raw === "string") {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) out[tier] = n;
      }
    }
    return out;
  }

  async patchMeterUnitPricing(dto: PatchMeterUnitPricingDto) {
    const meterUnitPricing = await this.systemConfig.setMeterUnitPricing(dto);
    return { ok: true as const, meterUnitPricing };
  }

  async patchTierSpendCeilings(dto: PatchTierSpendCeilingsDto) {
    const tiers: TariffTier[] = [
      TariffTier.TIER_0,
      TariffTier.TIER_1,
      TariffTier.TIER_2,
      TariffTier.TIER_3,
    ];
    for (const tier of tiers) {
      const v = dto[tier];
      await this.systemConfig.setJson(
        TIER_SPEND_CEILING_KEYS[tier],
        Math.max(0, v),
      );
    }
    const tierSpendCeilings = await this.getTierSpendCeilings();
    return { ok: true as const, tierSpendCeilings };
  }

  async seedPricingCatalogDefaults() {
    const modules = await this.pricing.resetPricingCatalogToDefaults();
    return {
      ok: true as const,
      pricingModules: modules.map((m) =>
        serializePricingModule({
          id: m.id,
          key: m.key,
          name: m.name,
          pricePerMonth: m.pricePerMonth,
          sortOrder: m.sortOrder,
          isPremium: m.isPremium,
        }),
      ),
    };
  }

  async patchFoundation(dto: PatchFoundationDto) {
    await this.systemConfig.setFoundationMonthlyAzn(dto.amountAzn);
    return { ok: true, foundationMonthlyAzn: dto.amountAzn };
  }

  async patchBillingPricingCatalog(dto: PatchBillingPricingCatalogDto) {
    const keys = [...new Set(dto.modules.map((m) => m.key))];
    const found = await this.prisma.pricingModule.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });
    if (found.length !== keys.length) {
      throw new BadRequestException(
        "pricing-catalog: unknown or duplicate module keys",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.systemConfig.upsert({
        where: { key: BILLING_SYSTEM_KEYS.foundation },
        create: {
          key: BILLING_SYSTEM_KEYS.foundation,
          value: dto.foundationMonthlyAzn,
        },
        update: { value: dto.foundationMonthlyAzn },
      });
      for (const m of dto.modules) {
        await tx.pricingModule.update({
          where: { key: m.key },
          data: {
            pricePerMonth: m.pricePerMonth,
            isPremium: m.isPremium,
          },
        });
      }
    });
    await this.pricing.refreshPremiumModuleKeys();
    return { ok: true as const };
  }

  async patchBillingGlobalLimits(dto: PatchBillingGlobalLimitsDto) {
    await this.prisma.$transaction(async (tx) => {
      const upsert = (key: string, value: unknown) =>
        tx.systemConfig.upsert({
          where: { key },
          create: { key, value: value as object },
          update: { value: value as object },
        });
      await upsert(
        BILLING_SYSTEM_KEYS.yearlyDiscount,
        dto.yearlyDiscountPercent,
      );
      await upsert(
        BILLING_SYSTEM_KEYS.ocrJobsPerOrgMonth,
        dto.ocrJobsPerOrgMonth,
      );
      await upsert(BILLING_SYSTEM_KEYS.quotaUnitPricing, dto.quotaPricing);
      const tiers = Object.keys(TIER_LEGACY_PRICE_KEYS) as TariffTier[];
      for (const tier of tiers) {
        await upsert(
          TIER_LEGACY_PRICE_KEYS[tier],
          dto.tierPrices[tier],
        );
      }
    });
    return { ok: true as const };
  }

  async patchYearlyDiscount(dto: PatchYearlyDiscountDto) {
    await this.systemConfig.setYearlyDiscountPercent(dto.percent);
    return { ok: true, yearlyDiscountPercent: dto.percent };
  }

  async patchQuotaUnitPricing(dto: PatchQuotaUnitPricingDto) {
    const quotaPricing = await this.systemConfig.setQuotaUnitPricing(dto);
    return { ok: true, quotaPricing };
  }

  async patchPricingModulePrice(idOrKey: string, dto: PatchPricingModulePriceDto) {
    const raw = idOrKey.trim();
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        raw,
      );
    const row = await this.prisma.pricingModule.update({
      where: looksLikeUuid ? { id: raw } : { key: raw },
      data: { pricePerMonth: dto.pricePerMonth },
    });
    return serializePricingModule(row);
  }

  async createPricingBundle(dto: CreatePricingBundleDto) {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pricingBundle.create({
        data: {
          name: dto.name.trim(),
          discountPercent: dto.discountPercent,
          moduleKeys: dto.moduleKeys,
        },
      });
      if (dto.trial?.isTrialDefault === true) {
        await tx.pricingBundle.updateMany({
          where: { id: { not: created.id }, isTrialDefault: true },
          data: { isTrialDefault: false },
        });
      }
      const trialData = pricingBundleTrialPatch(dto.trial);
      if (Object.keys(trialData).length > 0) {
        return tx.pricingBundle.update({
          where: { id: created.id },
          data: trialData,
        });
      }
      return created;
    });
    return serializePricingBundle(row);
  }

  async updatePricingBundle(id: string, dto: UpdatePricingBundleDto) {
    const data: Prisma.PricingBundleUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.discountPercent !== undefined) {
      data.discountPercent = dto.discountPercent;
    }
    if (dto.moduleKeys !== undefined) {
      data.moduleKeys = dto.moduleKeys;
    }
    Object.assign(data, pricingBundleTrialPatch(dto.trial));
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nothing to update");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.trial?.isTrialDefault === true) {
        await tx.pricingBundle.updateMany({
          where: { id: { not: id }, isTrialDefault: true },
          data: { isTrialDefault: false },
        });
      }
      return tx.pricingBundle.update({
        where: { id },
        data,
      });
    });
    return serializePricingBundle(row);
  }

  async patchPricingBundleTrialConfig(
    id: string,
    dto: PatchPricingBundleTrialConfigDto,
  ) {
    const trialData = pricingBundleTrialPatch(dto);
    if (Object.keys(trialData).length === 0) {
      throw new BadRequestException("Nothing to update");
    }
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isTrialDefault === true) {
        await tx.pricingBundle.updateMany({
          where: { id: { not: id }, isTrialDefault: true },
          data: { isTrialDefault: false },
        });
      }
      return tx.pricingBundle.update({
        where: { id },
        data: trialData,
      });
    });
    return serializePricingBundle(row);
  }

  async deletePricingBundle(id: string) {
    await this.prisma.pricingBundle.delete({ where: { id } });
    return { ok: true };
  }

  async setBillingPrice(dto: SetBillingPriceDto) {
    await this.systemConfig.setBillingPriceAzn(dto.tier, dto.amountAzn);
    return { ok: true, tier: dto.tier, amountAzn: dto.amountAzn };
  }

  async patchOcrJobsPerOrgMonth(dto: PatchOcrJobsPerOrgMonthDto) {
    await this.systemConfig.setOcrJobsPerOrgMonthLimit(dto.limit);
    const ocrJobsPerOrgMonth =
      await this.systemConfig.getOcrJobsPerOrgMonthLimit();
    return { ok: true as const, ocrJobsPerOrgMonth };
  }

  async setTierQuotas(dto: SetTierQuotasDto) {
    const current = await this.systemConfig.getTierQuotas(dto.tier);
    const merged: TierQuotas = {
      maxEmployees:
        dto.quotas.maxEmployees !== undefined
          ? dto.quotas.maxEmployees
          : current.maxEmployees,
      maxInvoicesPerMonth:
        dto.quotas.maxInvoicesPerMonth !== undefined
          ? dto.quotas.maxInvoicesPerMonth
          : current.maxInvoicesPerMonth,
      maxStorageGb:
        dto.quotas.maxStorageGb !== undefined
          ? dto.quotas.maxStorageGb
          : current.maxStorageGb,
      maxWhatsappAlertsPerMonth:
        dto.quotas.maxWhatsappAlertsPerMonth !== undefined
          ? dto.quotas.maxWhatsappAlertsPerMonth
          : current.maxWhatsappAlertsPerMonth,
      maxOcrPagesPerMonth:
        dto.quotas.maxOcrPagesPerMonth !== undefined
          ? dto.quotas.maxOcrPagesPerMonth
          : current.maxOcrPagesPerMonth,
      maxWorkspaces:
        dto.quotas.maxWorkspaces !== undefined
          ? dto.quotas.maxWorkspaces
          : current.maxWorkspaces,
    };
    const key = tierQuotaConfigKey(dto.tier);
    await this.prisma.$transaction(async (tx) => {
      await tx.systemConfig.upsert({
        where: { key },
        create: { key, value: merged as object },
        update: { value: merged as object },
      });
    });
    return { ok: true, tier: dto.tier, quotas: merged };
  }

  async setBillingQuotasMatrix(dto: SetBillingQuotasMatrixDto) {
    const byTier = quotasMatrixToRecord(dto.quotas);
    await this.prisma.$transaction(async (tx) => {
      for (const tier of Object.keys(byTier) as TariffTier[]) {
        const merged = this.mergeTierQuotasFromDto(byTier[tier]);
        const key = tierQuotaConfigKey(tier);
        await tx.systemConfig.upsert({
          where: { key },
          create: { key, value: merged as object },
          update: { value: merged as object },
        });
      }
    });
    return { ok: true as const, quotas: byTier };
  }

  private mergeTierQuotasFromDto(dto: SetTierQuotasDto["quotas"]): TierQuotas {
    const fields: (keyof TierQuotas)[] = [
      "maxEmployees",
      "maxInvoicesPerMonth",
      "maxStorageGb",
      "maxWhatsappAlertsPerMonth",
      "maxOcrPagesPerMonth",
      "maxWorkspaces",
    ];
    const out = {} as TierQuotas;
    for (const field of fields) {
      if (dto[field] === undefined) {
        throw new BadRequestException(`Missing quota field: ${field}`);
      }
      out[field] = dto[field] ?? null;
    }
    return out;
  }

  async listTranslations(
    locale: string,
    q: string | undefined,
    skip: number,
    take: number,
  ) {
    const loc = locale.trim().toLowerCase();
    const trimmed = q?.trim();
    const defaults = getDefaultFlatTranslations(loc);

    const overrideRows = await this.prisma.translationOverride.findMany({
      where: { locale: loc },
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        value: true,
        isActive: true,
        updatedAt: true,
      },
    });
    const overrideByKey = new Map(overrideRows.map((r) => [r.key, r]));

    const allKeys = new Set<string>([
      ...Object.keys(defaults),
      ...overrideRows.map((r) => r.key),
    ]);

    let keys = [...allKeys].sort((a, b) => a.localeCompare(b));

    if (trimmed) {
      const L = trimmed.toLowerCase();
      keys = keys.filter(
        (k) =>
          k.toLowerCase().includes(L) ||
          (defaults[k] ?? "").toLowerCase().includes(L) ||
          (overrideByKey.get(k)?.value ?? "").toLowerCase().includes(L),
      );
    }

    const total = keys.length;
    const pageKeys = keys.slice(skip, skip + take);

    const items = pageKeys.map((key) => {
      const o = overrideByKey.get(key);
      const defaultVal = defaults[key] ?? "";
      const stored = o?.value ?? defaultVal;
      const active = o?.isActive !== false;
      const effective = o && !active ? defaultVal : stored;
      return {
        id: o?.id ?? null,
        key,
        value: stored,
        effectiveValue: effective,
        defaultValue: defaultVal,
        isOverride: !!o,
        isActive: o ? active : true,
        updatedAt: o?.updatedAt.toISOString() ?? null,
      };
    });

    return {
      locale: loc,
      total,
      items,
    };
  }

  async upsertTranslation(dto: TranslationUpsertDto) {
    const locale = dto.locale.trim().toLowerCase();
    const row = await this.prisma.translationOverride.upsert({
      where: {
        locale_key: { locale, key: dto.key },
      },
      create: { locale, key: dto.key, value: dto.value, isActive: true },
      update: { value: dto.value, isActive: true },
    });
    return row;
  }

  async patchTranslationOverride(
    id: string,
    patch: { value?: string; isActive?: boolean },
  ) {
    if (patch.value === undefined && patch.isActive === undefined) {
      throw new BadRequestException("Provide value and/or isActive");
    }
    try {
      return await this.prisma.translationOverride.update({
        where: { id },
        data: {
          ...(patch.value !== undefined ? { value: patch.value } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        },
      });
    } catch {
      throw new NotFoundException("Translation override not found");
    }
  }

  async syncTranslationsCache() {
    const v = Date.now();
    await this.systemConfig.setJson(I18N_CACHE_KEY, v);
    return { ok: true, cacheVersion: v };
  }

  async getTranslationCacheVersion(): Promise<number> {
    const v = await this.systemConfig.getJson(I18N_CACHE_KEY);
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
    return 0;
  }

  async publicTranslationsFlat(locale: string): Promise<Record<string, string>> {
    const loc = locale.trim().toLowerCase();
    const rows = await this.prisma.translationOverride.findMany({
      where: { locale: loc, isActive: true },
      select: { key: true, value: true },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value;
    }
    return out;
  }

  async globalAuditLogs(params: {
    organizationId?: string;
    userId?: string;
    from?: string;
    to?: string;
    take: number;
    skip: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.organizationId) {
      where.organizationId = params.organizationId;
    }
    if (params.userId) {
      where.userId = params.userId;
    }
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) {
        where.createdAt.gte = new Date(params.from);
      }
      if (params.to) {
        where.createdAt.lte = new Date(params.to);
      }
    }
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.take,
        skip: params.skip,
        select: {
          id: true,
          organizationId: true,
          userId: true,
          entityType: true,
          entityId: true,
          action: true,
          createdAt: true,
          changes: true,
          oldValues: true,
          newValues: true,
          hash: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      total,
      items: items.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Глобальный шаблон NAS (`chart_of_accounts_entries`) — источник для новых организаций
   * (`syncAzChartForOrganization` читает БД, если в каталоге есть строки).
   */
  listChartTemplateEntries(includeUsage = false) {
    return this.prisma.chartOfAccountsEntry.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      ...(includeUsage
        ? { include: { _count: { select: { accounts: true } } } }
        : {}),
    });
  }

  async patchChartTemplateEntry(id: string, dto: PatchChartTemplateEntryDto) {
    const row = await this.prisma.chartOfAccountsEntry.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException("Chart template row not found");
    }
    if (dto.kind !== undefined && dto.kind !== row.kind) {
      throw new BadRequestException("kind is immutable for an existing row");
    }
    if (dto.code !== undefined && dto.code.trim() !== row.code) {
      throw new BadRequestException("code is immutable for an existing row");
    }
    const kind = row.kind;
    const code = row.code;
    const nameAz = dto.nameAz?.trim() ?? row.nameAz;
    const nameRu = dto.nameRu?.trim() ?? row.nameRu;
    const nameEn = dto.nameEn?.trim() ?? row.nameEn;
    let parentCode =
      dto.parentCode !== undefined
        ? dto.parentCode?.trim() || null
        : row.parentCode;
    if (parentCode === code) {
      throw new BadRequestException("parentCode cannot equal code");
    }
    if (parentCode) {
      const parent = await this.prisma.chartOfAccountsEntry.findFirst({
        where: { kind, code: parentCode },
      });
      if (!parent) {
        throw new BadRequestException(`Unknown parentCode in ${kind}: ${parentCode}`);
      }
    }
    let cashProfile =
      dto.cashProfile !== undefined
        ? dto.cashProfile?.trim() || null
        : row.cashProfile;
    if (!cashProfile) {
      cashProfile = cashProfileForNasCode(kind, code);
    }
    const accountType = dto.accountType ?? row.accountType;
    const sortOrder = dto.sortOrder ?? row.sortOrder;
    const isDeprecated = dto.isDeprecated ?? row.isDeprecated;

    return this.prisma.chartOfAccountsEntry.update({
      where: { id },
      data: {
        nameAz,
        nameRu,
        nameEn,
        accountType: accountType as AccountType,
        parentCode,
        cashProfile,
        sortOrder,
        isDeprecated,
      },
    });
  }

  async upsertChartTemplateEntry(dto: UpsertChartTemplateEntryDto) {
    const kind = dto.kind ?? OrganizationKind.COMMERCIAL;
    const code = dto.code.trim();
    const nameAz = dto.nameAz.trim();
    const nameRu = dto.nameRu.trim();
    const nameEn = dto.nameEn.trim();
    const parentRaw = dto.parentCode?.trim();
    const parentCode = parentRaw && parentRaw.length > 0 ? parentRaw : null;
    if (parentCode === code) {
      throw new BadRequestException("parentCode не может совпадать с code");
    }
    if (parentCode) {
      const parent = await this.prisma.chartOfAccountsEntry.findFirst({
        where: { kind, code: parentCode },
      });
      if (!parent) {
        throw new BadRequestException(`Unknown parentCode in ${kind}: ${parentCode}`);
      }
    }
    let cashProfile = dto.cashProfile?.trim() || null;
    if (!cashProfile) {
      cashProfile = cashProfileForNasCode(kind, code);
    }
    const sortOrder = dto.sortOrder ?? 0;
    const isDeprecated = dto.isDeprecated ?? false;
    return this.prisma.chartOfAccountsEntry.upsert({
      where: {
        kind_code: {
          kind,
          code,
        },
      },
      create: {
        kind,
        code,
        nameAz,
        nameRu,
        nameEn,
        accountType: dto.accountType,
        parentCode,
        cashProfile,
        sortOrder,
        isDeprecated,
      },
      update: {
        nameAz,
        nameRu,
        nameEn,
        accountType: dto.accountType,
        parentCode,
        cashProfile,
        sortOrder,
        isDeprecated,
      },
    });
  }

  async listPublicLandingModules() {
    const rows = await this.prisma.landingModuleMarketing.findMany({
      orderBy: [{ sortOrder: "asc" }, { moduleSlug: "asc" }],
    });
    return { items: rows.map(serializeLandingModule) };
  }

  async listLandingModulesAdmin() {
    return this.listPublicLandingModules();
  }

  async patchLandingModuleMarketing(
    moduleSlug: string,
    dto: import("./dto/patch-landing-module-marketing.dto").PatchLandingModuleMarketingDto,
  ) {
    const existing = await this.prisma.landingModuleMarketing.findUnique({
      where: { moduleSlug },
    });
    if (!existing) {
      throw new NotFoundException("Landing module not found");
    }
    const row = await this.prisma.landingModuleMarketing.update({
      where: { moduleSlug },
      data: {
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
        names: dto.names as object,
        descriptions: dto.descriptions as object,
        tasks: dto.tasks as object,
      },
    });
    return serializeLandingModule(row);
  }
}

function serializePricingModule(m: {
  id: string;
  key: string;
  name: string;
  pricePerMonth: unknown;
  sortOrder: number;
  isPremium: boolean;
}) {
  return {
    id: m.id,
    key: m.key,
    name: m.name,
    pricePerMonth: Number(m.pricePerMonth),
    sortOrder: m.sortOrder,
    isPremium: m.isPremium,
  };
}

function serializePricingBundle(b: {
  id: string;
  name: string;
  discountPercent: unknown;
  moduleKeys: unknown;
  isTrialDefault?: boolean;
  trialDurationDays?: number | null;
  trialQuotas?: unknown;
}) {
  const keys = b.moduleKeys;
  return {
    id: b.id,
    name: b.name,
    discountPercent: Number(b.discountPercent),
    moduleKeys: Array.isArray(keys) ? keys.map(String) : [],
    isTrialDefault: Boolean(b.isTrialDefault),
    trialDurationDays: b.trialDurationDays ?? null,
    trialQuotas:
      b.trialQuotas != null && typeof b.trialQuotas === "object"
        ? (b.trialQuotas as Record<string, unknown>)
        : null,
  };
}

function serializeLandingModule(row: {
  moduleSlug: string;
  sortOrder: number;
  names: unknown;
  descriptions: unknown;
  tasks: unknown;
}) {
  return {
    moduleSlug: row.moduleSlug,
    sortOrder: row.sortOrder,
    names: row.names,
    descriptions: row.descriptions,
    tasks: row.tasks,
  };
}

export type AdminLandingModuleMarketingRow = ReturnType<
  typeof serializeLandingModule
>;

