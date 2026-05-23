/**
 * Ключи для @RequiresModule — см. SubscriptionAccessService.
 * Slugs в activeModules / customConfig.modules: production, manufacturing, fixed_assets, ifrs, banking_pro, hr_full, kassa (и др.).
 */
export const REQUIRES_MODULE_KEY = "subscription:requiresModule" as const;

/**
 * Trial period for new organizations: **Trial-пакет** (`PricingBundle.isTrialDefault`)
 * + `computeTrialExpiresAtUtc` in `trial-package.util.ts` (fallback **90** calendar days).
 */

/**
 * Модули, записываемые в `OrganizationSubscription.activeModules` и `Organization.activeModules`
 * при создании организации (без внешних скриптов).
 * - `nas` — национальный план счетов (ядро книги NAS);
 * - `ifrs` / `ifrs_mapping` — Multi-GAAP / маппинг (согласовано с биллингом и `computeEntitlements`).
 */
export const DEFAULT_NEW_ORGANIZATION_ACTIVE_MODULES: string[] = [
  "nas",
  "ifrs",
  "ifrs_mapping",
];

export const ModuleEntitlement = {
  MANUFACTURING: "manufacturing",
  FIXED_ASSETS: "fixed_assets",
  /** NAS ↔ IFRS mapping — ENTERPRISE или модуль ifrs */
  IFRS_MAPPING: "ifrs_mapping",
  /** Kassa + banking (single commercial module). */
  CASH_BANK_PRO: "cash_bank_pro",
  /** @deprecated Alias for guards — same entitlement as `cash_bank_pro`. */
  BANKING_PRO: "banking_pro",
  /** @deprecated Alias for guards — same entitlement as `cash_bank_pro`. */
  KASSA_PRO: "kassa_pro",
  /** Расширенный HR (полный пакет) — v8.1 конструктор */
  HR_FULL: "hr_full",
  /** Tax automation features (DVX/e-taxes connector). */
  TAX_PRO: "tax_pro",
  /** Customs / trade portal capture (e-customs widget) + related premium flows. */
  TRADE_PRO: "trade_pro",
  /**
   * Extended tenant recovery (retention / replay) when exposed as a paid add-on — see STAGE_D_BILLING.md.
   * Today recovery admin APIs are super-admin only; this slug is reserved for constructor billing alignment.
   */
  RECOVERY_PRO: "recovery_pro",
  /** Auditor workplace: timeline, sampling, bulk export, backdating reports (paid add-on). */
  AUDIT_HUB: "audit_hub",
  /** Risk & Compliance (ERM): automated signals and dashboard. */
  COMPLIANCE_PRO: "compliance_pro",
  /** Industry Solutions verticals (beta; explicit tenant toggle). */
  INDUSTRY_RETAIL_ECOM: "industry_retail_ecom",
  INDUSTRY_LOGISTICS_CUSTOMS: "industry_logistics_customs",
  INDUSTRY_CONSTRUCTION: "industry_construction",
  INDUSTRY_CRM_WHATSAPP: "industry_crm_whatsapp",
} as const;

export type ModuleEntitlementKey =
  (typeof ModuleEntitlement)[keyof typeof ModuleEntitlement];
