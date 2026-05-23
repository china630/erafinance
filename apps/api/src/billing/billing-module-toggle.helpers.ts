import { BadRequestException } from "@nestjs/common";
import {
  hasCashBankModuleInList,
  isLegacyCashBankModuleKey,
  PRICING_MODULE_CASH_BANK_PRO,
} from "@erafinance/database";

export const TOGGLE_MODULE_META_PURPOSE = "toggle_module" as const;

export type ToggleModuleMetadata = {
  purpose: typeof TOGGLE_MODULE_META_PURPOSE;
  moduleKey: string;
  enabled: boolean;
};

export function parseToggleModuleMetadata(
  raw: unknown,
): ToggleModuleMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.purpose !== TOGGLE_MODULE_META_PURPOSE) return null;
  if (typeof o.moduleKey !== "string" || !o.moduleKey) return null;
  if (typeof o.enabled !== "boolean") return null;
  return {
    purpose: TOGGLE_MODULE_META_PURPOSE,
    moduleKey: o.moduleKey,
    enabled: o.enabled,
  };
}

/**
 * PATCH для `SubscriptionAccessService.updateModuleAddons` по ключу из `pricing_modules`.
 */
export function catalogModuleKeyToPatch(
  moduleKey: string,
  enabled: boolean,
): {
  production?: boolean;
  ifrs?: boolean;
  cash_bank_pro?: boolean;
  inventory?: boolean;
  manufacturing?: boolean;
  hr_full?: boolean;
  tax_pro?: boolean;
  trade_pro?: boolean;
  recovery_pro?: boolean;
  ifrs_mapping?: boolean;
  audit_hub?: boolean;
  compliance_pro?: boolean;
} {
  if (moduleKey === PRICING_MODULE_CASH_BANK_PRO || isLegacyCashBankModuleKey(moduleKey)) {
    return { cash_bank_pro: enabled };
  }
  switch (moduleKey) {
    case "inventory":
      return { inventory: enabled };
    case "manufacturing":
      return { manufacturing: enabled, production: enabled };
    case "hr_full":
      return { hr_full: enabled };
    case "tax_pro":
      return { tax_pro: enabled };
    case "trade_pro":
      return { trade_pro: enabled };
    case "recovery_pro":
      return { recovery_pro: enabled };
    case "ifrs_mapping":
      return { ifrs_mapping: enabled, ifrs: enabled };
    case "audit_hub":
      return { audit_hub: enabled };
    case "compliance_pro":
      return { compliance_pro: enabled };
    default:
      throw new BadRequestException({
        code: "UNKNOWN_MODULE",
        message: "Unknown module key",
      });
  }
}

export function isCatalogModuleActive(
  activeModules: string[],
  moduleKey: string,
): boolean {
  const set = new Set(activeModules);
  if (moduleKey === PRICING_MODULE_CASH_BANK_PRO || isLegacyCashBankModuleKey(moduleKey)) {
    return hasCashBankModuleInList(activeModules);
  }
  switch (moduleKey) {
    case "manufacturing":
      return set.has("manufacturing") || set.has("production");
    case "ifrs_mapping":
      return set.has("ifrs_mapping") || set.has("ifrs");
    default:
      return set.has(moduleKey);
  }
}

/** Доля месяца от текущего UTC-дня до конца месяца включительно (для Pro-rata). */
export function proRataFractionUtc(now = new Date()): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = now.getUTCDate();
  const daysLeftIncludingToday = daysInMonth - day + 1;
  return daysLeftIncludingToday / daysInMonth;
}

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function hasConstructorModulesInCustomConfig(
  customConfig: unknown,
): boolean {
  if (customConfig == null || typeof customConfig !== "object") return false;
  const o = customConfig as { modules?: unknown; trialPackageId?: unknown };
  // Trial orgs use `customConfig.modules` but owners may toggle marketplace modules (TZ §14.3).
  if (o.trialPackageId != null) return false;
  const m = o.modules;
  return Array.isArray(m) && m.length > 0;
}
