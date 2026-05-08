import type { PortalFlowDescriptor } from "../../types";

export const eQaimeFlow: PortalFlowDescriptor = {
  id: "e-qaime",
  titleKey: "extension.portal.flowEqaime",
  entitlement: "tax_pro",
};

/**
 * Ordered hints for expected e-qaimə sections.
 * TODO: align with real DVX field map after pilot.
 */
export const eQaimeFieldHints = [
  "counterpartyName",
  "counterpartyVoen",
  "invoiceDate",
  "invoiceNumber",
  "lineItems",
  "totals",
] as const;
