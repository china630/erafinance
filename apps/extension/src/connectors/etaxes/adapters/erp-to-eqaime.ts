import type { InvoicePrefill } from "@erafinance/api-contracts";
import { EtaxesSelectors } from "../selectors";

function trySetBySelectors(
  doc: Document,
  selectors: string[],
  value: string,
  applied: HTMLElement[],
): void {
  for (const sel of selectors) {
    let el: HTMLInputElement | HTMLTextAreaElement | null = null;
    try {
      el = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
    } catch {
      continue;
    }
    if (!el) continue;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    applied.push(el);
    return;
  }
}

export function mapInvoicePrefillToFields(
  prefill: InvoicePrefill,
  doc: Document,
): { applied: HTMLElement[] } {
  const applied: HTMLElement[] = [];
  const fields = EtaxesSelectors.eqaimeFields;

  trySetBySelectors(doc, fields.counterpartyName, prefill.counterparty.name, applied);
  if (prefill.counterparty.taxId) {
    trySetBySelectors(doc, fields.counterpartyVoen, prefill.counterparty.taxId, applied);
  }
  trySetBySelectors(doc, fields.invoiceDate, prefill.issueDate.slice(0, 10), applied);
  trySetBySelectors(doc, fields.invoiceNumber, prefill.number, applied);
  trySetBySelectors(doc, fields.totalNet, String(prefill.totals.netAzn), applied);
  trySetBySelectors(doc, fields.totalVat, String(prefill.totals.vatAzn), applied);
  trySetBySelectors(doc, fields.totalGross, String(prefill.totals.grossAzn), applied);

  // TODO: implement robust line-items grid fill once real DVX table DOM is verified.
  return { applied };
}
