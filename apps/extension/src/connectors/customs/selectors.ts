/**
 * e-customs.gov.az BGD detail page — selectors are TODO stubs until pilot DOM is available.
 * Enable `daydayAssistantDebug=1` and extend `mapDomToFullPrefill` in `adapters/portal-to-bgd.ts`.
 */
export const CUSTOMS_SELECTORS = {
  /** Card / header area containing BGD number (placeholder). */
  bgdNumber: "[data-dayday-bgd-number], .dayday-bgd-number",
  bgdDate: "[data-dayday-bgd-date], .dayday-bgd-date",
  currency: "[data-dayday-currency], .dayday-currency",
  customsValueAzn: "[data-dayday-value-azn], .dayday-value-azn",
  customsDutyAzn: "[data-dayday-duty-azn], .dayday-duty-azn",
  customsVatAzn: "[data-dayday-vat-azn], .dayday-vat-azn",
  feesAzn: "[data-dayday-fees-azn], .dayday-fees-azn",
  regimeCode: "[data-dayday-regime], .dayday-regime",
  senderVoen: "[data-dayday-sender-voen], .dayday-sender-voen",
  senderName: "[data-dayday-sender-name], .dayday-sender-name",
  receiverVoen: "[data-dayday-receiver-voen], .dayday-receiver-voen",
  receiverName: "[data-dayday-receiver-name], .dayday-receiver-name",
  currencyRate: "[data-dayday-currency-rate], .dayday-currency-rate",
  itemsRows: "[data-dayday-bgd-item-row]",
  itemHsCode: "[data-dayday-item-hs-code]",
  itemDescription: "[data-dayday-item-description]",
  itemQty: "[data-dayday-item-quantity]",
  itemWeightNet: "[data-dayday-item-weight-net]",
  itemWeightGross: "[data-dayday-item-weight-gross]",
  itemInvoiceValue: "[data-dayday-item-invoice-value]",
  itemStatValueAzn: "[data-dayday-item-stat-value]",
  itemPortalDuty: "[data-dayday-item-portal-duty]",
  itemPortalVat: "[data-dayday-item-portal-vat]",
  /** Anchor for injected DayDay Capture button */
  portalActionBar: "[data-dayday-bgd-actions], .declaration-actions, .toolbar-actions",
} as const;
