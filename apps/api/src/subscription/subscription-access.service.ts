import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TariffTier } from "@erafinance/database";
import {
  isOrganizationUuid,
  parseOrganizationId,
} from "../common/organization-id.util";
import {
  hasCashBankModuleInList,
  normalizeCashBankActiveModules,
  PRICING_MODULE_CASH_BANK_PRO,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../admin/pricing.service";
import { type ModuleEntitlementKey } from "./subscription.constants";

/**
 * v8.9 / v12.5: аварийный полный доступ к модулям только вне production (TZ §14.6).
 * В production не экспортируется реальный адрес — bypass отключён.
 */
const EMERGENCY_MODULE_ACCESS_EMAIL_DEV =
  process.env.NODE_ENV !== "production"
    ? "shirinov.chingiz@gmail.com"
    : "";

export const EMERGENCY_MODULE_ACCESS_EMAIL = EMERGENCY_MODULE_ACCESS_EMAIL_DEV;

export function isEmergencyModuleAccessEmail(
  email: string | null | undefined,
): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!EMERGENCY_MODULE_ACCESS_EMAIL_DEV) return false;
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === EMERGENCY_MODULE_ACCESS_EMAIL_DEV;
}

const TIER_ORDER: Record<TariffTier, number> = {
  TIER_0: 0,
  TIER_1: 1,
  TIER_2: 2,
  TIER_3: 3,
};

function tierGte(
  tier: TariffTier,
  min: TariffTier,
): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[min];
}

export type OrganizationModuleEntitlements = {
  manufacturing: boolean;
  fixedAssets: boolean;
  ifrsMapping: boolean;
  bankingPro: boolean;
  /** Расширенный HR (add-on); legacy без customConfig — true (без замка в UI). */
  hrFull: boolean;
  /** Tax module (DVX/e-taxes). */
  taxPro: boolean;
  /** Customs / e-customs widget capture (trade). */
  tradePro: boolean;
  /** Paid Audit Hub (timeline, sampling, bulk export, backdating). */
  auditHub: boolean;
  /** Risk & Compliance (ERM): automated risk alerts and dashboard. */
  compliancePro: boolean;
  industryRetailEcom: boolean;
  industryLogisticsCustoms: boolean;
  industryConstruction: boolean;
  industryCrmWhatsapp: boolean;
};

/** v8.1: снимок поля custom_config (конструктор тарифа). */
export type SubscriptionCustomConfig = {
  modules?: string[];
  /** Явный флаг модуля кассы (v8.4); дублирует slug `kassa_pro` в `modules`. */
  kassaPro?: boolean;
  preset?: string;
  quotas?: Record<string, unknown>;
  /** UUID `PricingBundle` or `"default"` for seeded trial without bundle row. */
  trialPackageId?: string;
  /** Trial-only quota overrides (subset of TierQuotas). */
  trialQuotas?: Record<string, unknown>;
  [key: string]: unknown;
};

function parseCustomModules(raw: unknown): string[] | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as SubscriptionCustomConfig;
  const m = o.modules;
  let list: string[] = [];
  if (Array.isArray(m) && m.length > 0) {
    list = m.map((x) => String(x).trim()).filter(Boolean);
  }
  if (o.kassaPro === true && !hasCashBankModuleInList(list)) {
    list = normalizeCashBankActiveModules([...list, PRICING_MODULE_CASH_BANK_PRO]);
  }
  if (list.length === 0) return null;
  return list;
}

function entitlementsFromConstructorModules(
  modules: string[],
): OrganizationModuleEntitlements {
  const set = new Set(modules);
  const has = (s: string) => set.has(s);
  return {
    manufacturing: has("manufacturing") || has("production"),
    fixedAssets: has("fixed_assets"),
    ifrsMapping: has("ifrs") || has("ifrs_mapping"),
    bankingPro: hasCashBankModuleInList(modules),
    hrFull: has("hr_full"),
    taxPro: has("tax_pro"),
    tradePro: has("trade_pro"),
    auditHub: has("audit_hub"),
    compliancePro: has("compliance_pro"),
    industryRetailEcom: has("industry_retail_ecom"),
    industryLogisticsCustoms: has("industry_logistics_customs"),
    industryConstruction: has("industry_construction"),
    industryCrmWhatsapp: has("industry_crm_whatsapp"),
  };
}

function normalizeActiveModules(m: unknown): string[] {
  if (!Array.isArray(m)) return [];
  return m.map((x) => String(x).trim()).filter(Boolean);
}

function isTariffTier(v: unknown): v is TariffTier {
  return (
    v === TariffTier.TIER_1 ||
    v === TariffTier.TIER_2 ||
    v === TariffTier.TIER_3
  );
}

/** Минимальный снимок без строки подписки (в схеме нет tier FREE — STARTER = базовый доступ). */
function emptyOrganizationSnapshot(): {
  tier: TariffTier;
  activeModules: string[];
  customConfig: unknown | null;
  modules: OrganizationModuleEntitlements;
  expiresAt: Date | null;
  isTrial: boolean;
} {
  return {
    tier: TariffTier.TIER_1,
    activeModules: [],
    customConfig: null,
    modules: {
      manufacturing: false,
      fixedAssets: false,
      ifrsMapping: false,
      bankingPro: false,
      hrFull: false,
      taxPro: false,
      tradePro: false,
      auditHub: false,
      compliancePro: false,
      industryRetailEcom: false,
      industryLogisticsCustoms: false,
      industryConstruction: false,
      industryCrmWhatsapp: false,
    },
    expiresAt: null,
    isTrial: false,
  };
}

function computeEntitlementsLegacy(sub: {
  tier: TariffTier;
  activeModules: string[];
}): OrganizationModuleEntitlements {
  const modules = new Set(normalizeActiveModules(sub.activeModules));
  const has = (slug: string) => modules.has(slug);
  return {
    manufacturing:
      tierGte(sub.tier, TariffTier.TIER_2) ||
      has("production") ||
      has("manufacturing"),
    fixedAssets:
      tierGte(sub.tier, TariffTier.TIER_2) ||
      has("production") ||
      has("fixed_assets"),
    ifrsMapping: tierGte(sub.tier, TariffTier.TIER_3) || has("ifrs"),
    bankingPro:
      tierGte(sub.tier, TariffTier.TIER_3) ||
      hasCashBankModuleInList([...modules]),
    /** Legacy: расширенный HR не блокировался отдельно — оставляем открытым. */
    hrFull: true,
    taxPro: has("tax_pro"),
    tradePro: has("trade_pro"),
    auditHub: has("audit_hub"),
    compliancePro: has("compliance_pro"),
    industryRetailEcom: false,
    industryLogisticsCustoms: false,
    industryConstruction: false,
    industryCrmWhatsapp: false,
  };
}

function computeEntitlements(sub: {
  tier: TariffTier;
  activeModules: string[];
  customConfig: unknown | null;
}): OrganizationModuleEntitlements {
  const tier = isTariffTier(sub.tier)
    ? sub.tier
    : TariffTier.TIER_1;
  const safe = {
    tier,
    activeModules: normalizeActiveModules(sub.activeModules),
    customConfig: sub.customConfig ?? null,
  };
  if (safe.tier === TariffTier.TIER_3) {
    return {
      manufacturing: true,
      fixedAssets: true,
      ifrsMapping: true,
      bankingPro: true,
      hrFull: true,
      taxPro: true,
      tradePro: true,
      auditHub: true,
      compliancePro: true,
      industryRetailEcom: false,
      industryLogisticsCustoms: false,
      industryConstruction: false,
      industryCrmWhatsapp: false,
    };
  }
  const customList = parseCustomModules(safe.customConfig);
  if (customList && customList.length > 0) {
    return entitlementsFromConstructorModules(customList);
  }
  return computeEntitlementsLegacy(safe);
}

/**
 * Проверка slug из customConfig.modules (и алиасов) для assertModuleAccess.
 */
function isAllowedByConstructorModules(
  modules: string[],
  moduleKey: ModuleEntitlementKey | string,
): boolean {
  const key = String(moduleKey);
  const set = new Set(modules);
  const has = (s: string) => set.has(s);
  if (has(key)) return true;
  switch (key) {
    case "manufacturing":
      return has("production") || has("manufacturing");
    case "fixed_assets":
      return has("fixed_assets");
    case "ifrs_mapping":
      return has("ifrs") || has("ifrs_mapping");
    case "banking_pro":
    case "kassa_pro":
    case PRICING_MODULE_CASH_BANK_PRO:
      return hasCashBankModuleInList(modules);
    case "hr_full":
      return has("hr_full");
    case "tax_pro":
      return has("tax_pro");
    case "trade_pro":
      return has("trade_pro");
    case "audit_hub":
      return has("audit_hub");
    case "compliance_pro":
      return has("compliance_pro");
    case "industry_retail_ecom":
      return has("industry_retail_ecom");
    case "industry_logistics_customs":
      return has("industry_logistics_customs");
    case "industry_construction":
      return has("industry_construction");
    case "industry_crm_whatsapp":
      return has("industry_crm_whatsapp");
    case "recovery_pro":
      return has("recovery_pro");
    default:
      return has(key);
  }
}

@Injectable()
export class SubscriptionAccessService {
  private readonly logger = new Logger(SubscriptionAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Доступ к модулю по подписке. Для `ENTERPRISE` всегда `true` (в т.ч. kassa_pro).
   */
  async hasModule(
    organizationId: string,
    moduleKey: ModuleEntitlementKey | string,
    userEmail?: string | null,
    isSuperAdmin?: boolean,
  ): Promise<boolean> {
    if (isSuperAdmin) {
      return true;
    }
    if (isEmergencyModuleAccessEmail(userEmail)) {
      return true;
    }
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) return false;
    if (sub.currentTier === TariffTier.TIER_3) return true;
    try {
      await this.assertModuleAccess(organizationId, moduleKey, { userEmail });
      return true;
    } catch {
      return false;
    }
  }

  async assertModuleAccess(
    organizationId: string,
    moduleKey: ModuleEntitlementKey | string,
    opts?: { userEmail?: string | null; isSuperAdmin?: boolean },
  ): Promise<void> {
    if (opts?.isSuperAdmin) {
      return;
    }
    if (isEmergencyModuleAccessEmail(opts?.userEmail)) {
      return;
    }
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "SUBSCRIPTION_MISSING",
        message: "Organization has no subscription record.",
      });
    }

    const moduleSlug = String(moduleKey);
    if (
      sub.currentTier === TariffTier.TIER_0 &&
      this.pricing.isPremiumModuleKey(moduleSlug)
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "PREMIUM_TIER0_LOCKED",
        message:
          "Premium modules require commercial status (Tier 1 or higher). Upgrade your resource tier first.",
        module: moduleSlug,
      });
    }
    if (sub.isTrial && this.pricing.isPremiumModuleKey(moduleSlug)) {
      const trialEnd = sub.trialExpiresAt ?? sub.expiresAt;
      const trialActive = trialEnd != null && trialEnd.getTime() > Date.now();
      const activated = sub.activatedPremiumModules ?? [];
      if (trialActive && !activated.includes(moduleSlug)) {
        throw new ForbiddenException({
          statusCode: 403,
          code: "PREMIUM_TRIAL_LOCKED",
          message:
            "Премиум-модули недоступны в триал-периоде. Для активации перейдите на коммерческий платный тариф.",
          module: moduleSlug,
        });
      }
    }

    const om = await this.prisma.organizationModule.findUnique({
      where: {
        organizationId_moduleKey: {
          organizationId,
          moduleKey: String(moduleKey),
        },
      },
    });
    if (
      om?.cancelledAt &&
      om.accessUntil &&
      new Date().getTime() > om.accessUntil.getTime()
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "MODULE_NOT_ENTITLED",
        message:
          "This module subscription has ended; renew or enable it again.",
        module: moduleKey,
        tier: sub.currentTier,
      });
    }

    if (sub.currentTier === TariffTier.TIER_3) {
      return;
    }

    const trialExpired =
      Boolean(sub.isTrial) &&
      sub.expiresAt != null &&
      new Date().getTime() > sub.expiresAt.getTime();

    const entitlementCustomConfig = trialExpired ? null : (sub.customConfig ?? null);

    const customList = parseCustomModules(entitlementCustomConfig);
    if (customList && customList.length > 0) {
      if (isAllowedByConstructorModules(customList, moduleKey)) {
        return;
      }
      throw new ForbiddenException({
        statusCode: 403,
        code: "MODULE_NOT_ENTITLED",
        message:
          "This feature is not included in the current plan or add-ons.",
        module: moduleKey,
        tier: sub.currentTier,
      });
    }

    const ent = computeEntitlements({
      tier: sub.currentTier,
      activeModules: normalizeActiveModules(sub.activeModules),
      customConfig: entitlementCustomConfig,
    });
    let allowed = false;
    switch (moduleKey) {
      case "manufacturing":
        allowed = ent.manufacturing;
        break;
      case "fixed_assets":
        allowed = ent.fixedAssets;
        break;
      case "ifrs_mapping":
        allowed = ent.ifrsMapping;
        break;
      case "banking_pro":
      case "kassa_pro":
      case PRICING_MODULE_CASH_BANK_PRO:
        allowed = ent.bankingPro;
        break;
      case "hr_full":
        allowed = ent.hrFull;
        break;
      case "tax_pro":
        allowed = ent.taxPro;
        break;
      case "trade_pro":
        allowed = ent.tradePro;
        break;
      case "audit_hub":
        allowed = ent.auditHub;
        break;
      case "recovery_pro":
        allowed = new Set(normalizeActiveModules(sub.activeModules)).has(
          "recovery_pro",
        );
        break;
      default:
        allowed = new Set(normalizeActiveModules(sub.activeModules)).has(
          String(moduleKey),
        );
    }

    if (!allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "MODULE_NOT_ENTITLED",
        message:
          "This feature is not included in the current plan or add-ons.",
        module: moduleKey,
        tier: sub.currentTier,
      });
    }
  }

  async getOrganizationSnapshot(organizationId: string): Promise<{
    tier: TariffTier;
    activeModules: string[];
    customConfig: unknown | null;
    modules: OrganizationModuleEntitlements;
    expiresAt: Date | null;
    isTrial: boolean;
  }> {
    const id = parseOrganizationId(organizationId);
    if (!id || !isOrganizationUuid(id)) {
      if (organizationId !== undefined && organizationId !== null && organizationId !== "") {
        this.logger.warn(
          `getOrganizationSnapshot: invalid organizationId (no DB query), raw=${String(organizationId)}`,
        );
      }
      return emptyOrganizationSnapshot();
    }

    try {
      let sub: Awaited<
        ReturnType<PrismaService["organizationSubscription"]["findUnique"]>
      >;
      try {
        sub = await this.prisma.organizationSubscription.findUnique({
          where: { organizationId: id },
        });
      } catch (e) {
        this.logger.warn(
          `getOrganizationSnapshot: subscription findUnique failed for ${id}: ${e instanceof Error ? e.message : String(e)}`,
        );
        return emptyOrganizationSnapshot();
      }

      if (!sub) {
        this.logger.warn(
          `getOrganizationSnapshot: no subscription row for org ${id}, returning default snapshot`,
        );
        return emptyOrganizationSnapshot();
      }

      const now = new Date();
      if (
        sub.expiresAt &&
        sub.expiresAt.getTime() < now.getTime() &&
        sub.isTrial
      ) {
        await this.prisma.organizationSubscription.update({
          where: { organizationId: id },
          data: {
            isTrial: false,
            customConfig: Prisma.DbNull,
          },
        });
        const refreshed = await this.prisma.organizationSubscription.findUnique({
          where: { organizationId: id },
        });
        if (!refreshed) {
          this.logger.warn(
            `getOrganizationSnapshot: subscription row missing after trial rollover for ${id}`,
          );
          return emptyOrganizationSnapshot();
        }
        sub = refreshed;
      }

      const tier = isTariffTier(sub.currentTier)
        ? sub.currentTier
        : TariffTier.TIER_1;
      const activeModules = normalizeActiveModules(sub.activeModules);
      const customConfig = sub.customConfig ?? null;

      return {
        tier,
        activeModules,
        customConfig,
        modules: computeEntitlements({
          tier,
          activeModules,
          customConfig,
        }),
        expiresAt: sub.expiresAt ?? null,
        isTrial: Boolean(sub.isTrial),
      };
    } catch (e) {
      this.logger.warn(
        `getOrganizationSnapshot failed for ${id}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`,
      );
      return emptyOrganizationSnapshot();
    }
  }

  async updateTier(
    organizationId: string,
    tier: TariffTier,
  ): Promise<void> {
    await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: { currentTier: tier },
    });
  }

  async updateModuleAddons(
    organizationId: string,
    patch: {
      production?: boolean;
      ifrs?: boolean;
      cash_bank_pro?: boolean;
      /** @deprecated — maps to `cash_bank_pro` */
      kassa_pro?: boolean;
      /** @deprecated — maps to `cash_bank_pro` */
      banking_pro?: boolean;
      inventory?: boolean;
      manufacturing?: boolean;
      hr_full?: boolean;
      tax_pro?: boolean;
      trade_pro?: boolean;
      audit_hub?: boolean;
      compliance_pro?: boolean;
      recovery_pro?: boolean;
      ifrs_mapping?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<{ activeModules: string[] }> {
    const db = tx ?? this.prisma;
    const sub = await db.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!sub) {
      throw new NotFoundException("Organization subscription not found");
    }
    const set = new Set(sub.activeModules);

    const apply = (slug: string, v: boolean | undefined) => {
      if (v === undefined) return;
      if (v) set.add(slug);
      else set.delete(slug);
    };

    const cashBankPatch =
      patch.cash_bank_pro ??
      (patch.kassa_pro === true || patch.banking_pro === true
        ? true
        : patch.kassa_pro === false && patch.banking_pro === false
          ? false
          : undefined);
    if (cashBankPatch === true) {
      set.add(PRICING_MODULE_CASH_BANK_PRO);
      set.delete("kassa_pro");
      set.delete("banking_pro");
      set.delete("kassa");
    } else if (cashBankPatch === false) {
      set.delete(PRICING_MODULE_CASH_BANK_PRO);
      set.delete("kassa_pro");
      set.delete("banking_pro");
      set.delete("kassa");
    }
    apply("inventory", patch.inventory);
    apply("manufacturing", patch.manufacturing);
    apply("hr_full", patch.hr_full);
    apply("tax_pro", patch.tax_pro);
    apply("trade_pro", patch.trade_pro);
    apply("audit_hub", patch.audit_hub);
    apply("compliance_pro", patch.compliance_pro);
    apply("recovery_pro", patch.recovery_pro);
    apply("ifrs_mapping", patch.ifrs_mapping);

    if (patch.production === true) {
      set.add("production");
    }
    if (patch.production === false) {
      set.delete("production");
    }

    if (patch.ifrs === true) {
      set.add("ifrs");
    }
    if (patch.ifrs === false) {
      set.delete("ifrs");
    }

    if (patch.manufacturing === false) {
      set.delete("production");
    }

    if (patch.ifrs_mapping === false) {
      set.delete("ifrs");
    }

    const activeModules = normalizeCashBankActiveModules(Array.from(set));

    const customList = parseCustomModules(sub.customConfig);
    let customConfigData: Prisma.InputJsonValue | undefined;
    if (customList && customList.length > 0) {
      const raw =
        sub.customConfig != null && typeof sub.customConfig === "object"
          ? (sub.customConfig as Record<string, unknown>)
          : {};
      customConfigData = { ...raw, modules: activeModules } as Prisma.InputJsonValue;
    }

    await db.organizationSubscription.update({
      where: { organizationId },
      data: {
        activeModules,
        ...(customConfigData !== undefined ? { customConfig: customConfigData } : {}),
      },
    });
    await db.organization.update({
      where: { id: organizationId },
      data: { activeModules },
    });
    return { activeModules };
  }
}

