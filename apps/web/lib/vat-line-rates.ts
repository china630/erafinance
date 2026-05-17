import { apiFetch } from "./api-client";

/**
 * Default ƏDV line options when `GET /api/system/invoice-vat-rates` is unavailable.
 */
export const DEFAULT_INVOICE_VAT_RATES = [-1, 0, 2, 8, 18] as const;

/** @deprecated Use `DEFAULT_INVOICE_VAT_RATES` or server-driven list in UI. */
export const INVOICE_VAT_RATE_VALUES = DEFAULT_INVOICE_VAT_RATES;

export type InvoiceVatRateValue = number;

export const VAT_LINE_UNSET = "__unset__" as const;

export type VatRateFormString = "-1" | "0" | "2" | "8" | "18";

export type VatRateFormChoice = VatRateFormString | typeof VAT_LINE_UNSET;

export function vatRateToFormString(v: InvoiceVatRateValue): VatRateFormString {
  return String(v) as VatRateFormString;
}

export function formStringToVatRate(
  s: string,
  allowed: readonly number[] = [...DEFAULT_INVOICE_VAT_RATES],
): InvoiceVatRateValue | null {
  if (s === VAT_LINE_UNSET || s === "" || s.trim() === "") return null;
  const n = Number(s);
  for (const x of allowed) {
    if (x === n) return x;
  }
  return null;
}

export function normalizeProductVatRate(raw: number): InvoiceVatRateValue {
  if (raw === -1) return -1;
  if (raw === 0) return 0;
  if (raw === 2) return 2;
  if (raw === 8) return 8;
  return 18;
}

/** Percent for math (exemption → 0%). */
export function vatPercentForMath(rate: InvoiceVatRateValue): number {
  if (rate === -1) return 0;
  return rate;
}

export async function fetchInvoiceVatRatesFromApi(): Promise<number[]> {
  try {
    const res = await apiFetch("/api/system/invoice-vat-rates");
    if (!res.ok) {
      return [...DEFAULT_INVOICE_VAT_RATES];
    }
    const body = (await res.json()) as { rates?: unknown };
    if (!Array.isArray(body.rates)) {
      return [...DEFAULT_INVOICE_VAT_RATES];
    }
    const out = body.rates
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
    return out.length > 0 ? out : [...DEFAULT_INVOICE_VAT_RATES];
  } catch {
    return [...DEFAULT_INVOICE_VAT_RATES];
  }
}
