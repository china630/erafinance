import type { CustomsDeclarationFullPrefill, CustomsDeclarationPrefill } from "@erafinance/api-contracts";
import { CUSTOMS_SELECTORS } from "../selectors";

function textOrNum(doc: Document, sel: string, fallbackNum: number): string | number {
  const el = doc.querySelector(sel);
  if (!el) return fallbackNum;
  const t = (el.textContent ?? "").replace(/\s/g, "").replace(",", ".");
  if (!t) return fallbackNum;
  const n = Number(t);
  return Number.isFinite(n) ? n : t;
}

function textStr(doc: Document, sel: string, fallback: string): string {
  const el = doc.querySelector(sel);
  const t = (el?.textContent ?? "").trim();
  return t || fallback;
}

function voenFromText(raw: string): string | null {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return d.length === 10 ? d : null;
}

/**
 * Map open BGD page DOM → flat prefill (legacy / header-only).
 */
export function mapDomToPrefill(doc: Document): CustomsDeclarationPrefill {
  const today = new Date().toISOString().slice(0, 10);
  return {
    bgdNumber: textStr(doc, CUSTOMS_SELECTORS.bgdNumber, `BGD-WIDGET-${Date.now()}`),
    bgdDate: textStr(doc, CUSTOMS_SELECTORS.bgdDate, today),
    currency: textStr(doc, CUSTOMS_SELECTORS.currency, "AZN"),
    customsValueAzn: Number(textOrNum(doc, CUSTOMS_SELECTORS.customsValueAzn, 0)),
    customsDutyAzn: Number(textOrNum(doc, CUSTOMS_SELECTORS.customsDutyAzn, 0)),
    customsVatAzn: Number(textOrNum(doc, CUSTOMS_SELECTORS.customsVatAzn, 0)),
    feesAzn: Number(textOrNum(doc, CUSTOMS_SELECTORS.feesAzn, 0)),
    regimeCode: textStr(doc, CUSTOMS_SELECTORS.regimeCode, "") || undefined,
    notes: null,
    portalVoen: null,
  };
}

function numFromEl(el: Element | null, fallback: number): number {
  if (!el) return fallback;
  const t = (el.textContent ?? "").replace(/\s/g, "").replace(",", ".");
  if (!t) return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function strFromEl(el: Element | null, fallback: string): string {
  if (!el) return fallback;
  const t = (el.textContent ?? "").trim();
  return t || fallback;
}

/**
 * Parse line items from `[data-erafinance-bgd-item-row]` rows. Empty → caller uses synthetic single line.
 */
export function parseItemRowsFromDom(doc: Document): Array<{
  sequenceNumber: number;
  hsCode: string;
  description: string;
  quantity: number;
  unit: string | null;
  weightNetKg: number;
  weightGrossKg: number;
  invoiceValue: number;
  statisticalValueAzn: number;
  portalDutyAzn: number | null;
  portalVatAzn: number | null;
}> {
  const rows = doc.querySelectorAll(CUSTOMS_SELECTORS.itemsRows);
  const out: ReturnType<typeof parseItemRowsFromDom> = [];
  let seq = 0;
  rows.forEach((row) => {
    seq += 1;
    const hs = strFromEl(row.querySelector(CUSTOMS_SELECTORS.itemHsCode), "");
    const desc = strFromEl(row.querySelector(CUSTOMS_SELECTORS.itemDescription), `Line ${seq}`);
    const qty = numFromEl(row.querySelector(CUSTOMS_SELECTORS.itemQty), 1);
    const wn = numFromEl(row.querySelector(CUSTOMS_SELECTORS.itemWeightNet), 0);
    const wg = numFromEl(row.querySelector(CUSTOMS_SELECTORS.itemWeightGross), 0);
    const inv = numFromEl(row.querySelector(CUSTOMS_SELECTORS.itemInvoiceValue), 0);
    const stat = numFromEl(row.querySelector(CUSTOMS_SELECTORS.itemStatValueAzn), inv);
    const pd = row.querySelector(CUSTOMS_SELECTORS.itemPortalDuty);
    const pv = row.querySelector(CUSTOMS_SELECTORS.itemPortalVat);
    const pdVal = pd ? numFromEl(pd, NaN) : NaN;
    const pvVal = pv ? numFromEl(pv, NaN) : NaN;
    out.push({
      sequenceNumber: seq,
      hsCode: hs.length >= 2 ? hs : "00000000",
      description: desc,
      quantity: qty > 0 ? qty : 1,
      unit: null,
      weightNetKg: wn,
      weightGrossKg: wg,
      invoiceValue: inv,
      statisticalValueAzn: stat,
      portalDutyAzn: Number.isFinite(pdVal) ? pdVal : null,
      portalVatAzn: Number.isFinite(pvVal) ? pvVal : null,
    });
  });
  return out;
}

/**
 * Map open BGD page DOM → full prefill (header + ≥1 line item for API).
 */
export function mapDomToFullPrefill(doc: Document): CustomsDeclarationFullPrefill {
  const header = mapDomToPrefill(doc);
  const items = parseItemRowsFromDom(doc);
  const rateRaw = textStr(doc, CUSTOMS_SELECTORS.currencyRate, "");
  const currencyRate = rateRaw ? Number(String(rateRaw).replace(",", ".")) : null;
  const senderVoen = voenFromText(textStr(doc, CUSTOMS_SELECTORS.senderVoen, ""));
  const receiverVoen = voenFromText(textStr(doc, CUSTOMS_SELECTORS.receiverVoen, ""));

  const finalItems =
    items.length > 0
      ? items
      : [
          {
            sequenceNumber: 1,
            hsCode: "00000000",
            description: "Aggregate capture (no line item rows in DOM)",
            quantity: 1,
            unit: null,
            weightNetKg: 0,
            weightGrossKg: 0,
            invoiceValue: header.customsValueAzn,
            statisticalValueAzn: header.customsValueAzn,
            portalDutyAzn: header.customsDutyAzn,
            portalVatAzn: header.customsVatAzn,
          },
        ];

  return {
    ...header,
    senderVoen,
    senderName: textStr(doc, CUSTOMS_SELECTORS.senderName, "") || null,
    receiverVoen,
    receiverName: textStr(doc, CUSTOMS_SELECTORS.receiverName, "") || null,
    currencyRate: currencyRate != null && Number.isFinite(currencyRate) && currencyRate > 0 ? currencyRate : null,
    items: finalItems,
  };
}
