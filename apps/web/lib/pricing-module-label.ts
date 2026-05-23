import type { TFunction } from "i18next";

/**
 * UI label for a `pricing_modules` row: `pricingModule.<key>` in i18n, else API/DB `name`.
 * Keys are stable (`cash_bank_pro`, …); `name` remains the English canonical fallback for new modules.
 */
export function pricingModuleLabel(key: string, nameFromApi: string, t: TFunction): string {
  return t(`pricingModule.${key}`, { defaultValue: nameFromApi });
}
