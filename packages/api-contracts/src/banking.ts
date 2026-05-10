/** Shared whitelist for organization bank account kinds (NAS § cash/bank flows). */
export const ORGANIZATION_BANK_ACCOUNT_TYPES = [
  "MAIN",
  "SALARY",
  "CARD",
  "TENDER",
  "CREDIT",
  "VAT_DEPOSIT",
] as const;

export type OrganizationBankAccountType =
  (typeof ORGANIZATION_BANK_ACCOUNT_TYPES)[number];

/** Supported currencies on organization bank accounts (DTO validation; catalog lives in `Currency`). */
export const ORGANIZATION_BANK_ACCOUNT_CURRENCIES = [
  "AZN",
  "USD",
  "EUR",
  "RUB",
  "TRY",
] as const;

export type OrganizationBankAccountCurrency =
  (typeof ORGANIZATION_BANK_ACCOUNT_CURRENCIES)[number];
