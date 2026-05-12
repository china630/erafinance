import type { EmployeeContractPrefill } from "@erafinance/api-contracts";
import { EmasSelectors } from "../selectors";

/** Map ERP prefill DTO to the first matching inputs (best-effort MVP). */
export function mapPrefillToFields(
  prefill: EmployeeContractPrefill,
  doc: Document,
): { applied: HTMLElement[] } {
  const applied: HTMLElement[] = [];
  const inputs = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      EmasSelectors.formInputs,
    ),
  );

  const trySet = (value: string | null | undefined, hints: RegExp[]) => {
    if (value == null || value === "") return;
    for (const el of inputs) {
      if (applied.includes(el)) continue;
      const hay =
        `${el.name} ${el.id} ${el.placeholder} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
      if (hints.some((h) => h.test(hay))) {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        applied.push(el);
        return;
      }
    }
  };

  trySet(prefill.firstName, [/ad/i, /name/i, /first/i]);
  trySet(prefill.lastName, [/soyad/i, /last/i, /surname/i]);
  trySet(prefill.finCode, [/fin/i, /şəxs/i]);
  trySet(prefill.positionTitle, [/vezif/i, /position/i, /title/i]);
  trySet(prefill.salaryGrossAzn, [/maaş/i, /salary/i, /amount/i]);
  trySet(prefill.contractStartDate, [/başlan/i, /start/i, /from/i]);

  return { applied };
}
