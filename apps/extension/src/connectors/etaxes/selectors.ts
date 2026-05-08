/**
 * Centralized selectors for new.e-taxes.gov.az/login.e-taxes.gov.az.
 * TODO: validate all selectors on real DVX pages during portal pilot.
 */
export const EtaxesSelectors = {
  authIndicators: [
    '[class*="user"]',
    '[class*="profile"]',
    '[class*="cabinet"]',
    "a[href*='logout']",
    "button[title*='Çıxış']",
  ],
  activeVoenCandidates: [
    '[data-testid*="voen"]',
    '[id*="voen"]',
    '[class*="voen"]',
    '[class*="tax"]',
    '[class*="tin"]',
    '[class*="profile"]',
    "header",
  ],
  formInputs: "input[type=text], input:not([type]), textarea",
  eqaimeFields: {
    counterpartyName: [
      "input[name*='counterparty']",
      "input[id*='counterparty']",
      "input[name*='alici']",
    ],
    counterpartyVoen: [
      "input[name*='voen']",
      "input[id*='voen']",
      "input[name*='tin']",
    ],
    invoiceDate: ["input[name*='date']", "input[id*='date']"],
    invoiceNumber: ["input[name*='number']", "input[id*='number']"],
    totalNet: ["input[name*='net']", "input[id*='net']"],
    totalVat: ["input[name*='vat']", "input[id*='vat']"],
    totalGross: ["input[name*='total']", "input[id*='total']"],
  },
} as const;
