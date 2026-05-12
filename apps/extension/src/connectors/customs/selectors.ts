/**
 * e-customs.gov.az BGD detail page — selectors are TODO stubs until pilot DOM is available.
 * Enable `erafinanceAssistantDebug=1` and extend `mapDomToFullPrefill` in `adapters/portal-to-bgd.ts`.
 */
export const CUSTOMS_SELECTORS = {
  /** Card / header area containing BGD number (placeholder). */
  bgdNumber: "[data-erafinance-bgd-number], .erafinance-bgd-number",
  bgdDate: "[data-erafinance-bgd-date], .erafinance-bgd-date",
  currency: "[data-erafinance-currency], .erafinance-currency",
  customsValueAzn: "[data-erafinance-value-azn], .erafinance-value-azn",
  customsDutyAzn: "[data-erafinance-duty-azn], .erafinance-duty-azn",
  customsVatAzn: "[data-erafinance-vat-azn], .erafinance-vat-azn",
  feesAzn: "[data-erafinance-fees-azn], .erafinance-fees-azn",
  regimeCode: "[data-erafinance-regime], .erafinance-regime",
  senderVoen: "[data-erafinance-sender-voen], .erafinance-sender-voen",
  senderName: "[data-erafinance-sender-name], .erafinance-sender-name",
  receiverVoen: "[data-erafinance-receiver-voen], .erafinance-receiver-voen",
  receiverName: "[data-erafinance-receiver-name], .erafinance-receiver-name",
  currencyRate: "[data-erafinance-currency-rate], .erafinance-currency-rate",
  itemsRows: "[data-erafinance-bgd-item-row]",
  itemHsCode: "[data-erafinance-item-hs-code]",
  itemDescription: "[data-erafinance-item-description]",
  itemQty: "[data-erafinance-item-quantity]",
  itemWeightNet: "[data-erafinance-item-weight-net]",
  itemWeightGross: "[data-erafinance-item-weight-gross]",
  itemInvoiceValue: "[data-erafinance-item-invoice-value]",
  itemStatValueAzn: "[data-erafinance-item-stat-value]",
  itemPortalDuty: "[data-erafinance-item-portal-duty]",
  itemPortalVat: "[data-erafinance-item-portal-vat]",
  /** Anchor for injected ERA Capture button */
  portalActionBar: "[data-erafinance-bgd-actions], .declaration-actions, .toolbar-actions",
} as const;
