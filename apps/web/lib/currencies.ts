/**
 * Fallback ISO codes when catalog is not loaded (logged out or API error).
 * Prefer `useAuth().currencyCodes` after session bootstrap.
 */
export const FALLBACK_CURRENCY_CODES = ["AZN", "USD", "EUR", "RUB", "TRY"] as const;

/** @deprecated Prefer `FALLBACK_CURRENCY_CODES` or auth `currencyCodes`. */
export const SUPPORTED_CURRENCIES = FALLBACK_CURRENCY_CODES;

export type SupportedCurrency = string;

export const DEFAULT_CURRENCY: SupportedCurrency = "AZN";

export function isSupportedCurrency(
  v: string,
  allowed: readonly string[] = [...FALLBACK_CURRENCY_CODES],
): v is SupportedCurrency {
  const u = v.trim().toUpperCase();
  return (allowed as readonly string[]).includes(u);
}

export function coerceSupportedCurrency(
  v: string | undefined | null,
  allowed: readonly string[] = [...FALLBACK_CURRENCY_CODES],
): SupportedCurrency {
  const u = String(v ?? "")
    .trim()
    .toUpperCase();
  return isSupportedCurrency(u, allowed) ? u : DEFAULT_CURRENCY;
}
