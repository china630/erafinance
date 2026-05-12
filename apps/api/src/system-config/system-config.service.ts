import { BadRequestException, Injectable } from "@nestjs/common";
import { SubscriptionTier } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import type { TierQuotas } from "../constants/quotas";
import { TIER_QUOTAS } from "../constants/quotas";

const BILLING_PRICE_KEYS: Record<SubscriptionTier, string> = {
  STARTER: "billing.price.STARTER",
  BUSINESS: "billing.price.BUSINESS",
  ENTERPRISE: "billing.price.ENTERPRISE",
};

const QUOTA_KEY = (tier: SubscriptionTier) => `quota.tier.${tier}`;

const FOUNDATION_MONTHLY_KEY = "billing.foundation_monthly_azn";
const YEARLY_DISCOUNT_KEY = "billing.yearly_discount_percent";
const QUOTA_UNIT_PRICING_KEY = "billing.quota_unit_pricing_v1";
/** Positive integer: max OCR jobs created per organization per UTC month (`trade_pro` flows). */
const OCR_JOBS_PER_ORG_MONTH_KEY = "quota.ocr_jobs_per_org_month_v1";

/** FX dashboard rows (CBAR vs AZN); override via `system_config.fx.dashboard_currency_codes`. */
const FX_DASHBOARD_CODES_KEY = "fx.dashboard_currency_codes";
/** CBAR preliminary→final check pair; override via `system_config.fx.cbar_check_currency_codes`. */
const FX_CBAR_CHECK_CODES_KEY = "fx.cbar_check_currency_codes";

const DEFAULT_FX_DASHBOARD_CODES = [
  "USD",
  "EUR",
  "GBP",
  "RUB",
  "CNY",
  "TRY",
  "JPY",
] as const;

const DEFAULT_FX_CHECK_CODES = ["USD", "EUR"] as const;

const I18N_CACHE_VERSION_KEY = "i18n.cacheVersion";

/** Keys editable via Super-Admin data hub (whitelist). */
export type SystemConfigAdminKeyMeta = {
  key: string;
  description: string;
  allowReset: boolean;
  allowPut: boolean;
  valueKind:
    | "iso_codes_array"
    | "positive_number"
    | "percent_0_100"
    | "tier_quotas"
    | "quota_unit_pricing"
    | "positive_int";
};

export type SystemConfigAdminRow = SystemConfigAdminKeyMeta & {
  storedValue: unknown | null;
  effectiveValue: unknown;
  defaultValue: unknown;
};

export type QuotaUnitPricing = {
  employeeBlockSize: number;
  pricePerEmployeeBlockAzn: number;
  documentPackSize: number;
  pricePerDocumentPackAzn: number;
};

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getJson(key: string): Promise<unknown | null> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key },
      select: { value: true },
    });
    return row?.value ?? null;
  }

  async setJson(key: string, value: unknown): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }

  async getBillingPriceAzn(tier: SubscriptionTier): Promise<number> {
    const key = BILLING_PRICE_KEYS[tier];
    const row = await this.prisma.systemConfig.findUnique({
      where: { key },
      select: { value: true },
    });
    if (row?.value === null || row?.value === undefined) {
      return this.defaultPrice(tier);
    }
    const v = row.value as unknown;
    if (typeof v === "number") {
      return v;
    }
    if (typeof v === "string") {
      return Number.parseFloat(v) || this.defaultPrice(tier);
    }
    return this.defaultPrice(tier);
  }

  async setBillingPriceAzn(
    tier: SubscriptionTier,
    amountAzn: number,
  ): Promise<void> {
    const key = BILLING_PRICE_KEYS[tier];
    await this.setJson(key, amountAzn);
  }

  async getAllBillingPrices(): Promise<
    Record<SubscriptionTier, number>
  > {
    const out = {} as Record<SubscriptionTier, number>;
    for (const tier of Object.keys(BILLING_PRICE_KEYS) as SubscriptionTier[]) {
      out[tier] = await this.getBillingPriceAzn(tier);
    }
    return out;
  }

  private defaultPrice(tier: SubscriptionTier): number {
    const defaults: Record<SubscriptionTier, number> = {
      STARTER: 49,
      BUSINESS: 149,
      ENTERPRISE: 499,
    };
    return defaults[tier];
  }

  /**
   * Квоты по тиру: из SystemConfig (JSON) или константы TIER_QUOTAS.
   */
  async getTierQuotas(tier: SubscriptionTier): Promise<TierQuotas> {
    const key = QUOTA_KEY(tier);
    const raw = await this.getJson(key);
    const base = TIER_QUOTAS[tier];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      return {
        maxOrganizations:
          o.maxOrganizations !== undefined
            ? toNullableNum(o.maxOrganizations)
            : base.maxOrganizations,
        maxEmployees:
          o.maxEmployees !== undefined ? toNullableNum(o.maxEmployees) : base.maxEmployees,
        maxInvoicesPerMonth:
          o.maxInvoicesPerMonth !== undefined
            ? toNullableNum(o.maxInvoicesPerMonth)
            : base.maxInvoicesPerMonth,
        maxStorageGb:
          o.maxStorageGb !== undefined ? toNullableNum(o.maxStorageGb) : base.maxStorageGb,
      };
    }
    return base;
  }

  async setTierQuotas(tier: SubscriptionTier, quotas: TierQuotas): Promise<void> {
    await this.setJson(QUOTA_KEY(tier), quotas);
  }

  async getFoundationMonthlyAzn(): Promise<number> {
    const raw = await this.getJson(FOUNDATION_MONTHLY_KEY);
    const n = toPositiveNum(raw, 29);
    return n;
  }

  async setFoundationMonthlyAzn(amountAzn: number): Promise<void> {
    await this.setJson(FOUNDATION_MONTHLY_KEY, amountAzn);
  }

  async getYearlyDiscountPercent(): Promise<number> {
    const raw = await this.getJson(YEARLY_DISCOUNT_KEY);
    const n = toPositiveNum(raw, 20);
    return Math.min(100, n);
  }

  async setYearlyDiscountPercent(percent: number): Promise<void> {
    await this.setJson(YEARLY_DISCOUNT_KEY, percent);
  }

  async getQuotaUnitPricing(): Promise<QuotaUnitPricing> {
    const raw = await this.getJson(QUOTA_UNIT_PRICING_KEY);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      return {
        employeeBlockSize: Math.max(1, toPositiveNum(o.employeeBlockSize, 10)),
        pricePerEmployeeBlockAzn: toPositiveNum(o.pricePerEmployeeBlockAzn, 15),
        documentPackSize: Math.max(1, toPositiveNum(o.documentPackSize, 1000)),
        pricePerDocumentPackAzn: toPositiveNum(o.pricePerDocumentPackAzn, 5),
      };
    }
    return {
      employeeBlockSize: 10,
      pricePerEmployeeBlockAzn: 15,
      documentPackSize: 1000,
      pricePerDocumentPackAzn: 5,
    };
  }

  async setQuotaUnitPricing(patch: Partial<QuotaUnitPricing>): Promise<QuotaUnitPricing> {
    const current = await this.getQuotaUnitPricing();
    const next: QuotaUnitPricing = {
      employeeBlockSize:
        patch.employeeBlockSize !== undefined
          ? Math.max(1, patch.employeeBlockSize)
          : current.employeeBlockSize,
      pricePerEmployeeBlockAzn:
        patch.pricePerEmployeeBlockAzn !== undefined
          ? Math.max(0, patch.pricePerEmployeeBlockAzn)
          : current.pricePerEmployeeBlockAzn,
      documentPackSize:
        patch.documentPackSize !== undefined
          ? Math.max(1, patch.documentPackSize)
          : current.documentPackSize,
      pricePerDocumentPackAzn:
        patch.pricePerDocumentPackAzn !== undefined
          ? Math.max(0, patch.pricePerDocumentPackAzn)
          : current.pricePerDocumentPackAzn,
    };
    await this.setJson(QUOTA_UNIT_PRICING_KEY, next);
    return next;
  }

  /**
   * OCR upload quota (per org, per UTC month). Default 200 when unset; ENTERPRISE bypass in QuotaService.
   */
  async getOcrJobsPerOrgMonthLimit(): Promise<number> {
    const raw = await this.getJson(OCR_JOBS_PER_ORG_MONTH_KEY);
    const n = toPositiveNum(raw, 200);
    return Math.max(1, Math.floor(n));
  }

  /**
   * Currency codes shown on the FX dashboard (`GET /fx/rates`). Config value: JSON string array.
   */
  async getFxDashboardCurrencyCodes(): Promise<string[]> {
    const raw = await this.getJson(FX_DASHBOARD_CODES_KEY);
    const parsed = parseJsonStringArray(raw);
    const normalized = normalizeIso4217Codes(parsed);
    return normalized.length > 0 ? normalized : [...DEFAULT_FX_DASHBOARD_CODES];
  }

  /**
   * Pair(s) used to detect CBAR doc vs stored rate drift (preliminary/final). JSON string array.
   */
  async getFxCbarCheckCurrencyCodes(): Promise<string[]> {
    const raw = await this.getJson(FX_CBAR_CHECK_CODES_KEY);
    const parsed = parseJsonStringArray(raw);
    const normalized = normalizeIso4217Codes(parsed);
    return normalized.length > 0 ? normalized : [...DEFAULT_FX_CHECK_CODES];
  }

  adminSystemConfigDefinitions(): SystemConfigAdminKeyMeta[] {
    const tiers = Object.keys(BILLING_PRICE_KEYS) as SubscriptionTier[];
    const defs: SystemConfigAdminKeyMeta[] = [
      {
        key: FX_DASHBOARD_CODES_KEY,
        description: "FX dashboard currency codes (ISO 4217, JSON array of strings)",
        allowReset: true,
        allowPut: true,
        valueKind: "iso_codes_array",
      },
      {
        key: FX_CBAR_CHECK_CODES_KEY,
        description: "CBAR preliminary vs stored rate check currencies (JSON array)",
        allowReset: true,
        allowPut: true,
        valueKind: "iso_codes_array",
      },
      {
        key: OCR_JOBS_PER_ORG_MONTH_KEY,
        description: "Max OCR jobs per organization per UTC month",
        allowReset: true,
        allowPut: true,
        valueKind: "positive_int",
      },
      {
        key: FOUNDATION_MONTHLY_KEY,
        description: "Foundation monthly price (AZN)",
        allowReset: true,
        allowPut: true,
        valueKind: "positive_number",
      },
      {
        key: YEARLY_DISCOUNT_KEY,
        description: "Yearly billing discount (percent 0–100)",
        allowReset: true,
        allowPut: true,
        valueKind: "percent_0_100",
      },
      {
        key: QUOTA_UNIT_PRICING_KEY,
        description: "Quota unit pricing (employee blocks / document packs)",
        allowReset: true,
        allowPut: true,
        valueKind: "quota_unit_pricing",
      },
      ...tiers.map(
        (tier): SystemConfigAdminKeyMeta => ({
          key: BILLING_PRICE_KEYS[tier],
          description: `Monthly subscription price for tier ${tier} (AZN)`,
          allowReset: true,
          allowPut: true,
          valueKind: "positive_number",
        }),
      ),
      ...tiers.map(
        (tier): SystemConfigAdminKeyMeta => ({
          key: QUOTA_KEY(tier),
          description: `Tier quotas JSON for ${tier}`,
          allowReset: true,
          allowPut: true,
          valueKind: "tier_quotas",
        }),
      ),
      {
        key: I18N_CACHE_VERSION_KEY,
        description: "i18n bundle cache version (numeric timestamp); managed by sync — read-only here",
        allowReset: false,
        allowPut: false,
        valueKind: "positive_int",
      },
    ];
    return defs;
  }

  async listAdminSystemConfigRows(): Promise<SystemConfigAdminRow[]> {
    const defs = this.adminSystemConfigDefinitions();
    const rows: SystemConfigAdminRow[] = [];
    for (const def of defs) {
      const stored = await this.getJson(def.key);
      let effectiveValue: unknown;
      let defaultValue: unknown;
      switch (def.valueKind) {
        case "iso_codes_array":
          defaultValue =
            def.key === FX_DASHBOARD_CODES_KEY
              ? [...DEFAULT_FX_DASHBOARD_CODES]
              : [...DEFAULT_FX_CHECK_CODES];
          effectiveValue =
            def.key === FX_DASHBOARD_CODES_KEY
              ? await this.getFxDashboardCurrencyCodes()
              : await this.getFxCbarCheckCurrencyCodes();
          break;
        case "positive_int":
          defaultValue =
            def.key === OCR_JOBS_PER_ORG_MONTH_KEY ? 200 : 0;
          effectiveValue =
            def.key === OCR_JOBS_PER_ORG_MONTH_KEY
              ? await this.getOcrJobsPerOrgMonthLimit()
              : await this.getTranslationCacheVersion();
          break;
        case "positive_number":
          if (def.key === FOUNDATION_MONTHLY_KEY) {
            defaultValue = 29;
            effectiveValue = await this.getFoundationMonthlyAzn();
          } else if (def.key.startsWith("billing.price.")) {
            const tier = def.key.replace("billing.price.", "") as SubscriptionTier;
            defaultValue = this.defaultPrice(tier);
            effectiveValue = await this.getBillingPriceAzn(tier);
          } else {
            defaultValue = 20;
            effectiveValue = await this.getYearlyDiscountPercent();
          }
          break;
        case "percent_0_100":
          defaultValue = 20;
          effectiveValue = await this.getYearlyDiscountPercent();
          break;
        case "tier_quotas": {
          const tier = def.key.replace("quota.tier.", "") as SubscriptionTier;
          defaultValue = TIER_QUOTAS[tier];
          effectiveValue = await this.getTierQuotas(tier);
          break;
        }
        case "quota_unit_pricing":
          defaultValue = {
            employeeBlockSize: 10,
            pricePerEmployeeBlockAzn: 15,
            documentPackSize: 1000,
            pricePerDocumentPackAzn: 5,
          };
          effectiveValue = await this.getQuotaUnitPricing();
          break;
        default:
          effectiveValue = stored;
          defaultValue = null;
      }
      rows.push({
        ...def,
        storedValue: stored ?? null,
        effectiveValue,
        defaultValue,
      });
    }
    return rows;
  }

  async putAdminSystemConfig(key: string, value: unknown): Promise<void> {
    const def = this.adminSystemConfigDefinitions().find((d) => d.key === key);
    if (!def || !def.allowPut) {
      throw new BadRequestException(`Key not editable: ${key}`);
    }
    const normalized = this.normalizeAdminSystemConfigValue(def.valueKind, value);
    await this.setJson(key, normalized as object);
  }

  async resetAdminSystemConfig(key: string): Promise<void> {
    const def = this.adminSystemConfigDefinitions().find((d) => d.key === key);
    if (!def || !def.allowReset) {
      throw new BadRequestException(`Key cannot be reset: ${key}`);
    }
    await this.prisma.systemConfig.deleteMany({ where: { key } });
  }

  private normalizeAdminSystemConfigValue(
    kind: SystemConfigAdminKeyMeta["valueKind"],
    value: unknown,
  ): unknown {
    switch (kind) {
      case "iso_codes_array": {
        const parsed = parseJsonStringArray(value);
        if (!parsed?.length) {
          throw new BadRequestException("Expected JSON array of ISO currency codes");
        }
        const n = normalizeIso4217Codes(parsed);
        if (n.length === 0) {
          throw new BadRequestException("No valid ISO 4217 codes in array");
        }
        return n;
      }
      case "positive_int": {
        const n = Math.floor(toPositiveNum(value, NaN));
        if (!Number.isFinite(n) || n < 1) {
          throw new BadRequestException("Expected positive integer");
        }
        return n;
      }
      case "positive_number": {
        const n = toPositiveNum(value, NaN);
        if (!Number.isFinite(n) || n < 0) {
          throw new BadRequestException("Expected non-negative number");
        }
        return n;
      }
      case "percent_0_100": {
        const n = toPositiveNum(value, NaN);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          throw new BadRequestException("Expected percent between 0 and 100");
        }
        return Math.min(100, n);
      }
      case "tier_quotas": {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new BadRequestException("Expected tier quotas object");
        }
        const o = value as Record<string, unknown>;
        const q: TierQuotas = {
          maxOrganizations: toNullableNum(o.maxOrganizations),
          maxEmployees: toNullableNum(o.maxEmployees),
          maxInvoicesPerMonth: toNullableNum(o.maxInvoicesPerMonth),
          maxStorageGb: toNullableNum(o.maxStorageGb),
        };
        return q;
      }
      case "quota_unit_pricing": {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new BadRequestException("Expected quota unit pricing object");
        }
        const o = value as Record<string, unknown>;
        return {
          employeeBlockSize: Math.max(1, toPositiveNum(o.employeeBlockSize, 10)),
          pricePerEmployeeBlockAzn: toPositiveNum(o.pricePerEmployeeBlockAzn, 15),
          documentPackSize: Math.max(1, toPositiveNum(o.documentPackSize, 1000)),
          pricePerDocumentPackAzn: toPositiveNum(o.pricePerDocumentPackAzn, 5),
        };
      }
      default:
        throw new BadRequestException("Unsupported value kind");
    }
  }

  async getTranslationCacheVersion(): Promise<number> {
    const v = await this.getJson(I18N_CACHE_VERSION_KEY);
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
    return 0;
  }
}

function toPositiveNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

function toNullableNum(v: unknown): number | null {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseJsonStringArray(raw: unknown): string[] | null {
  if (raw == null) {
    return null;
  }
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const x of raw) {
      if (typeof x === "string" && x.trim()) {
        out.push(x.trim());
      }
    }
    return out;
  }
  return null;
}

function normalizeIso4217Codes(codes: string[] | null): string[] {
  if (!codes?.length) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const u = c.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(u) || seen.has(u)) {
      continue;
    }
    seen.add(u);
    out.push(u);
  }
  return out;
}
