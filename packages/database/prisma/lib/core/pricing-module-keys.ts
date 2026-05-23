/** Canonical billing key: kassa + banking (single commercial module). */
export const PRICING_MODULE_CASH_BANK_PRO = "cash_bank_pro" as const;

export const LEGACY_CASH_BANK_MODULE_KEYS = [
  "kassa_pro",
  "banking_pro",
  "kassa",
] as const;

export type LegacyCashBankModuleKey = (typeof LEGACY_CASH_BANK_MODULE_KEYS)[number];

export function isLegacyCashBankModuleKey(key: string): key is LegacyCashBankModuleKey {
  return (LEGACY_CASH_BANK_MODULE_KEYS as readonly string[]).includes(key);
}

export function hasCashBankModuleInList(modules: readonly string[]): boolean {
  const set = new Set(modules);
  if (set.has(PRICING_MODULE_CASH_BANK_PRO)) return true;
  return LEGACY_CASH_BANK_MODULE_KEYS.some((k) => set.has(k));
}

/** Collapse legacy slugs to `cash_bank_pro` for persistence. */
export function normalizeCashBankActiveModules(modules: readonly string[]): string[] {
  const set = new Set(modules);
  const hadCashBank = hasCashBankModuleInList(modules);
  for (const legacy of LEGACY_CASH_BANK_MODULE_KEYS) {
    set.delete(legacy);
  }
  set.delete(PRICING_MODULE_CASH_BANK_PRO);
  if (hadCashBank) {
    set.add(PRICING_MODULE_CASH_BANK_PRO);
  }
  return [...set];
}
