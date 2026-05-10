const MOCK_AZN_PER_UNIT: Record<string, string> = {
  USD: "1.7000",
  EUR: "1.8500",
  RUB: "0.0185",
  TRY: "0.0530",
};

/** Placeholder FX until CBA integration; values are AZN per 1 unit of foreign currency. */
export function fetchExchangeRateMock(currency: string): string {
  const c = currency.trim().toUpperCase();
  if (c === "AZN") return "1.0000";
  return MOCK_AZN_PER_UNIT[c] ?? "1.0000";
}
