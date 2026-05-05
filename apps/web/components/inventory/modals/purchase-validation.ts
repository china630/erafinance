import type { TFunction } from "i18next";

/** Line VAT mode; empty string = use product catalog (omit vatMode in API). */
export type PurchaseLineVatMode = "" | "18" | "0" | "exempt" | "not_applicable";

export type PurchaseLineFormValue = {
  productId: string;
  quantity: string;
  unitPrice: string;
  vatMode: PurchaseLineVatMode;
};

export type PurchaseFormValues = {
  counterpartyId: string;
  documentDate: string;
  currency: string;
  fxRateToAzn: string;
  pricesIncludeVat: boolean;
  goodsLines: PurchaseLineFormValue[];
  serviceLines: PurchaseLineFormValue[];
};

export function numFromFormField(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .trim()
    .replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
}

function isRowEmpty(line: PurchaseLineFormValue): boolean {
  return (
    !line.productId?.trim() &&
    !String(line.quantity ?? "").trim() &&
    !String(line.unitPrice ?? "").trim()
  );
}

export function validatePurchaseForm(
  t: TFunction,
  data: PurchaseFormValues,
): { ok: true; values: PurchaseFormValues } | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  if (!data.counterpartyId?.trim()) {
    fieldErrors.counterpartyId = t("inventory.purchaseValidationCounterparty");
  }

  if (!data.documentDate?.trim()) {
    fieldErrors.documentDate = t("inventory.purchaseValidationDocumentDate");
  }

  const fx = numFromFormField(data.fxRateToAzn);
  if (!Number.isFinite(fx) || fx <= 0) {
    fieldErrors.fxRateToAzn = t("inventory.purchaseValidationFx");
  }

  const gMeaningful = data.goodsLines.filter((l) => !isRowEmpty(l));
  const sMeaningful = data.serviceLines.filter((l) => !isRowEmpty(l));
  if (gMeaningful.length === 0 && sMeaningful.length === 0) {
    fieldErrors["goodsLines.0.productId"] = t("inventory.purchaseValidationMinLinesDual");
    return { ok: false, fieldErrors };
  }

  const validateBlock = (lines: PurchaseLineFormValue[], prefix: "goodsLines" | "serviceLines") => {
    lines.forEach((line, i) => {
      if (isRowEmpty(line)) return;
      const lineNo = i + 1;
      const hasProduct = !!line.productId?.trim();
      const q = numFromFormField(line.quantity);
      const u = numFromFormField(line.unitPrice);
      if (!hasProduct) {
        fieldErrors[`${prefix}.${i}.productId`] = t("inventory.purchaseValidationLineProduct", {
          line: lineNo,
        });
      }
      if (!Number.isFinite(q) || q <= 0) {
        fieldErrors[`${prefix}.${i}.quantity`] = t("inventory.purchaseValidationLineQty", { line: lineNo });
      }
      if (!Number.isFinite(u) || u < 0) {
        fieldErrors[`${prefix}.${i}.unitPrice`] = t("inventory.purchaseValidationLinePrice", { line: lineNo });
      }
    });
  };

  validateBlock(data.goodsLines, "goodsLines");
  validateBlock(data.serviceLines, "serviceLines");

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, values: data };
}

function mapLine(
  l: PurchaseLineFormValue,
): { productId: string; quantity: number; unitPrice: number; vatMode?: "18" | "0" | "exempt" | "not_applicable" } {
  const base: {
    productId: string;
    quantity: number;
    unitPrice: number;
    vatMode?: "18" | "0" | "exempt" | "not_applicable";
  } = {
    productId: l.productId.trim(),
    quantity: numFromFormField(l.quantity),
    unitPrice: numFromFormField(l.unitPrice),
  };
  if (l.vatMode !== "") {
    base.vatMode = l.vatMode as "18" | "0" | "exempt" | "not_applicable";
  }
  return base;
}

export function buildPurchasePayload(values: PurchaseFormValues): {
  goodsLines: ReturnType<typeof mapLine>[];
  serviceLines: ReturnType<typeof mapLine>[];
  counterpartyId: string;
  documentDate: string;
  currency: string;
  fxRateToAzn: number;
  pricesIncludeVat: boolean;
  reference: string;
} {
  const goodsLines = values.goodsLines
    .filter(
      (l) =>
        l.productId?.trim() &&
        String(l.quantity ?? "").trim() &&
        String(l.unitPrice ?? "").trim(),
    )
    .map(mapLine);
  const serviceLines = values.serviceLines
    .filter(
      (l) =>
        l.productId?.trim() &&
        String(l.quantity ?? "").trim() &&
        String(l.unitPrice ?? "").trim(),
    )
    .map(mapLine);

  const cur = (values.currency || "AZN").toUpperCase();
  let fx = numFromFormField(values.fxRateToAzn);
  if (cur === "AZN") {
    fx = 1;
  }

  return {
    goodsLines,
    serviceLines,
    counterpartyId: values.counterpartyId.trim(),
    documentDate: values.documentDate.trim(),
    currency: cur,
    fxRateToAzn: fx,
    pricesIncludeVat: values.pricesIncludeVat,
    reference: "PURCHASE_INVOICE",
  };
}

function effectiveVatPercent(vatMode: PurchaseLineVatMode, productVatPercent: number): number {
  if (vatMode === "18") return 18;
  if (vatMode === "0" || vatMode === "exempt" || vatMode === "not_applicable") return 0;
  const p = productVatPercent === -1 ? 0 : productVatPercent;
  return p;
}

/**
 * Per-line net / vat / gross in document currency.
 * `inputUnitPrice` is gross per unit when pricesIncludeVat, else net per unit.
 */
export function purchaseLineMoney(
  qty: number,
  inputUnitPrice: number,
  vatMode: PurchaseLineVatMode,
  productVatPercent: number,
  pricesIncludeVat: boolean,
): { net: number; vat: number; gross: number } {
  const vatPct = effectiveVatPercent(vatMode, productVatPercent);
  const r = vatPct / 100;
  if (pricesIncludeVat) {
    const rowGross = inputUnitPrice * qty;
    const rowNet = rowGross / (1 + r);
    const rowVat = rowGross - rowNet;
    return { net: rowNet, vat: rowVat, gross: rowGross };
  }
  const rowNet = inputUnitPrice * qty;
  const rowVat = rowNet * r;
  const rowGross = rowNet + rowVat;
  return { net: rowNet, vat: rowVat, gross: rowGross };
}
