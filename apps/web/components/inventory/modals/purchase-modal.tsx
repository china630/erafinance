"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { fetchExchangeRateMock } from "../../../lib/mock-exchange-rates";
import { notifyInventoryListsRefresh } from "../../../lib/list-refresh-bus";
import {
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";
import { normalizeProductVatRate } from "../../../lib/vat-line-rates";
import { uuidV4 } from "../../../lib/uuid";
import { ProductCombobox, type ProductRow } from "../../ui/product-combobox";
import { Button } from "../../ui/button";
import { NumericAmountInput } from "../../ui/numeric-amount-input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../ui/select";
import { AsyncCombobox } from "../../ui/async-combobox";
import { InvoiceDocumentModalLayout } from "../../invoices/invoice-document-modal-layout";
import { InventoryModalFooter, InventoryModalShell } from "./modal-shell";
import {
  buildPurchasePayload,
  purchaseLineMoney,
  validatePurchaseForm,
  type PurchaseFormValues,
  type PurchaseLineFormValue,
  type PurchaseLineVatMode,
} from "./purchase-validation";

type Counterparty = { id: string; name: string; taxId: string };

type LineRow = PurchaseLineFormValue & { key: string };

const FORM_ID = "inventory-modal-purchase-form";

function newGoodsLine(): LineRow {
  return { key: uuidV4(), productId: "", quantity: "", unitPrice: "", vatMode: "" };
}

function newServiceLine(): LineRow {
  return { key: uuidV4(), productId: "", quantity: "", unitPrice: "", vatMode: "" };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function fieldErrorClass(hasError: boolean) {
  return hasError
    ? `${MODAL_INPUT_CLASS} border-red-500 ring-2 ring-red-500/25`
    : MODAL_INPUT_CLASS;
}

const VAT_SELECT_TRIGGER = `${MODAL_INPUT_CLASS} w-full min-w-[6.5rem] max-w-[9rem]`;

const CURRENCIES = ["AZN", "USD", "EUR", "TRY", "RUB"] as const;

export function PurchaseModal({
  open,
  onClose,
  onSaved,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  prefill?: {
    supplier?: { name?: string };
    issueDate?: string;
    currency?: string;
  } | null;
}) {
  const { t } = useTranslation();
  const [counterpartyId, setCounterpartyId] = useState("");
  const [counterpartyLabel, setCounterpartyLabel] = useState("");
  const [documentDate, setDocumentDate] = useState(todayIsoDate);
  const [currency, setCurrency] = useState<string>("AZN");
  const [fxRateToAzn, setFxRateToAzn] = useState("1.0000");
  const [pricesIncludeVat, setPricesIncludeVat] = useState(false);
  const [goodsLines, setGoodsLines] = useState<LineRow[]>(() => [newGoodsLine()]);
  const [serviceLines, setServiceLines] = useState<LineRow[]>(() => [newServiceLine()]);
  const [productLabels, setProductLabels] = useState<Record<string, string>>({});
  const [productVatByKey, setProductVatByKey] = useState<Record<string, number>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /** Runs before [open] reset so a stale foreign currency from the last session does not overwrite fx after reset. */
  useEffect(() => {
    if (!open) return;
    if (currency === "AZN") {
      setFxRateToAzn("1.0000");
      return;
    }
    setFxRateToAzn(fetchExchangeRateMock(currency));
  }, [open, currency]);

  useEffect(() => {
    if (!open) return;
    setCounterpartyId("");
    setCounterpartyLabel("");
    setDocumentDate(todayIsoDate());
    setCurrency("AZN");
    setFxRateToAzn("1.0000");
    setPricesIncludeVat(false);
    setGoodsLines([newGoodsLine()]);
    setServiceLines([newServiceLine()]);
    setProductLabels({});
    setProductVatByKey({});
    setFieldErrors({});
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open || !prefill) return;
    if (prefill.issueDate) setDocumentDate(prefill.issueDate.slice(0, 10));
    if (prefill.currency) setCurrency(prefill.currency);
  }, [open, prefill]);

  function err(path: string): string | undefined {
    return fieldErrors[path];
  }

  const fetchCounterparties = useCallback(async (search: string) => {
    const q = new URLSearchParams();
    q.set("limit", "20");
    const trimmed = search.trim();
    if (trimmed) q.set("search", trimmed);
    const res = await apiFetch(`/api/counterparties?${q}`);
    if (!res.ok) return [];
    const list = (await res.json()) as Counterparty[];
    return Array.isArray(list) ? list : [];
  }, []);

  function updateGoodsLine(i: number, patch: Partial<PurchaseLineFormValue>) {
    setGoodsLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    clearErrorsPrefix(`goodsLines.${i}.`);
  }

  function updateServiceLine(i: number, patch: Partial<PurchaseLineFormValue>) {
    setServiceLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    clearErrorsPrefix(`serviceLines.${i}.`);
  }

  function clearErrorsPrefix(prefix: string) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(prefix)) delete next[k];
      }
      return next;
    });
  }

  const totals = useMemo(() => {
    let net = 0;
    let vat = 0;
    let gross = 0;
    const addBlock = (rows: LineRow[]) => {
      for (const row of rows) {
        if (!row.productId?.trim()) continue;
        const q = Number(String(row.quantity).replace(",", "."));
        const u = Number(String(row.unitPrice).replace(",", "."));
        if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(u) || u < 0) continue;
        const vr = productVatByKey[row.key] ?? normalizeProductVatRate(18);
        const m = purchaseLineMoney(q, u, row.vatMode, vr, pricesIncludeVat);
        net += m.net;
        vat += m.vat;
        gross += m.gross;
      }
    };
    addBlock(goodsLines);
    addBlock(serviceLines);
    return { net, vat, gross };
  }, [goodsLines, serviceLines, pricesIncludeVat, productVatByKey]);

  function onProductPicked(
    rowKey: string,
    item: ProductRow | null,
    setLine: (i: number, patch: Partial<PurchaseLineFormValue>) => void,
    idx: number,
  ) {
    setLine(idx, { productId: item?.id ?? "" });
    setProductLabels((prev) => ({
      ...prev,
      [rowKey]: item ? (item.isService ? item.name : `${item.name} (${item.sku})`) : "",
    }));
    if (item) {
      setProductVatByKey((prev) => ({
        ...prev,
        [rowKey]: normalizeProductVatRate(Number(item.vatRate)),
      }));
    } else {
      setProductVatByKey((prev) => {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const formValues: PurchaseFormValues = {
      counterpartyId,
      documentDate,
      currency,
      fxRateToAzn,
      pricesIncludeVat,
      goodsLines: goodsLines.map(({ productId, quantity, unitPrice, vatMode }) => ({
        productId,
        quantity,
        unitPrice,
        vatMode,
      })),
      serviceLines: serviceLines.map(({ productId, quantity, unitPrice, vatMode }) => ({
        productId,
        quantity,
        unitPrice,
        vatMode,
      })),
    };
    const validated = validatePurchaseForm(t, formValues);
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      return;
    }

    const body = buildPurchasePayload(validated.values);
    setBusy(true);
    const res = await apiFetch("/api/inventory/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    notifyInventoryListsRefresh();
    onSaved?.();
    onClose();
  }

  const goodsHasRows = goodsLines.some((r) => r.productId?.trim());

  function renderLineTable(
    title: string,
    rows: LineRow[],
    isGoods: boolean,
    updateLine: (i: number, patch: Partial<PurchaseLineFormValue>) => void,
    removeLine: (i: number) => void,
    addLine: () => void,
    prefix: "goodsLines" | "serviceLines",
  ) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[#34495E] m-0">{title}</h3>
        {isGoods ? (
          <p className="m-0 text-[12px] leading-snug text-[#7F8C8D]">{t("inventory.purchaseReceiptHint")}</p>
        ) : null}
        <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-2">
          <div className="max-h-[min(55vh,22rem)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-[13px]">
              <thead className="border-b border-[#D5DADF] bg-[#F8FAFC] text-left text-[#34495E]">
                <tr>
                  <th className="px-3 py-2 text-xs font-bold text-[#475569]">
                    {isGoods ? t("inventory.purchaseColProduct") : t("inventory.purchaseColService")}
                  </th>
                  <th className="px-3 py-2 text-xs font-bold text-[#475569] w-[6.5rem]">
                    {t("inventory.purchaseColQty")}
                  </th>
                  <th className="px-3 py-2 text-xs font-bold text-[#475569] w-[7.5rem]">
                    {t("inventory.purchaseColPrice")}
                  </th>
                  <th className="px-3 py-2 text-xs font-bold text-[#475569] w-[8.5rem]">
                    {t("inventory.purchaseColVat")}
                  </th>
                  <th className="px-3 py-2 text-xs font-bold text-[#475569] w-[7rem] text-right">
                    {t("inventory.purchaseColAmount")}
                  </th>
                  <th className="px-2 py-2 w-[2.75rem]" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const q = Number(String(row.quantity).replace(",", "."));
                  const u = Number(String(row.unitPrice).replace(",", "."));
                  const vr = productVatByKey[row.key] ?? normalizeProductVatRate(18);
                  const money =
                    row.productId && Number.isFinite(q) && q > 0 && Number.isFinite(u) && u >= 0
                      ? purchaseLineMoney(q, u, row.vatMode, vr, pricesIncludeVat)
                      : null;
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-[#D5DADF] bg-white transition-colors hover:bg-[#F1F5F9] last:border-b-0"
                    >
                      <td className="px-3 py-2 align-middle min-w-0">
                        <ProductCombobox
                          isService={!isGoods}
                          value={row.productId}
                          onChange={(id, item) => onProductPicked(row.key, item, updateLine, idx)}
                          selectedLabel={productLabels[row.key] ?? ""}
                          className="min-w-0"
                          listClassName="min-w-[14rem]"
                          portaled
                          aria-invalid={!!err(`${prefix}.${idx}.productId`)}
                        />
                        {err(`${prefix}.${idx}.productId`) ? (
                          <p className="mt-1 text-xs text-red-600 m-0">{err(`${prefix}.${idx}.productId`)}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <NumericAmountInput
                          value={row.quantity}
                          onValueChange={(plain) => updateLine(idx, { quantity: plain })}
                          decimalScale={4}
                          className={err(`${prefix}.${idx}.quantity`) ? "border-red-500 ring-2 ring-red-500/25" : ""}
                          aria-invalid={!!err(`${prefix}.${idx}.quantity`)}
                        />
                        {err(`${prefix}.${idx}.quantity`) ? (
                          <p className="mt-1 text-xs text-red-600 m-0">{err(`${prefix}.${idx}.quantity`)}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <NumericAmountInput
                          value={row.unitPrice}
                          onValueChange={(plain) => updateLine(idx, { unitPrice: plain })}
                          decimalScale={4}
                          className={err(`${prefix}.${idx}.unitPrice`) ? "border-red-500 ring-2 ring-red-500/25" : ""}
                          aria-invalid={!!err(`${prefix}.${idx}.unitPrice`)}
                        />
                        {err(`${prefix}.${idx}.unitPrice`) ? (
                          <p className="mt-1 text-xs text-red-600 m-0">{err(`${prefix}.${idx}.unitPrice`)}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Select
                          value={row.vatMode === "" ? "__catalog__" : row.vatMode}
                          onValueChange={(v) =>
                            updateLine(idx, {
                              vatMode: (v === "__catalog__" ? "" : v) as PurchaseLineVatMode,
                            })
                          }
                          aria-label={t("inventory.purchaseColVat")}
                        >
                          <SelectTrigger className={VAT_SELECT_TRIGGER} />
                          <SelectContent>
                            <SelectItem value="__catalog__">{t("inventory.purchaseVatCatalog")}</SelectItem>
                            <SelectItem value="18">{t("inventory.purchaseVat18")}</SelectItem>
                            <SelectItem value="0">{t("inventory.purchaseVat0")}</SelectItem>
                            <SelectItem value="exempt">{t("inventory.purchaseVatExempt")}</SelectItem>
                            <SelectItem value="not_applicable">
                              {t("inventory.purchaseVatNotApplicable")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 align-middle text-right tabular-nums text-[#34495E]">
                        {money ? money.gross.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-2 align-middle text-center">
                        <button
                          type="button"
                          className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#E74C3C]`}
                          title={t("inventory.purchaseRemoveLine")}
                          onClick={() => removeLine(idx)}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={addLine}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {t("inventory.purchaseAddLine")}
        </Button>
      </section>
    );
  }

  return (
    <InventoryModalShell
      open={open}
      title={t("inventory.purchaseModalTitle")}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      headerActions={
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 gap-1.5 border-[#805AD5]/35 bg-white text-[13px] font-medium text-[#5B21B6] shadow-sm hover:bg-[#F5F3FF]"
          onClick={() => toast.info(t("inventory.purchasePdfAiToast"))}
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          {t("inventory.purchasePdfAiToastBtn")}
        </Button>
      }
      footer={<InventoryModalFooter onCancel={onClose} busy={busy} formId={FORM_ID} />}
    >
      <form id={FORM_ID} className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
        <InvoiceDocumentModalLayout
          footerActions={
            <div className="space-y-2 rounded-lg border border-[#D5DADF] bg-[#F8F9FA] px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#34495E]">
                <input
                  type="checkbox"
                  checked={pricesIncludeVat}
                  onChange={(e) => setPricesIncludeVat(e.target.checked)}
                  className={MODAL_CHECKBOX_CLASS}
                />
                <span>{t("inventory.purchasePricesIncludeVat")}</span>
              </label>
              <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-[13px] text-[#34495E]">
                <span>
                  {t("inventory.purchaseTotalNet")}:{" "}
                  <strong className="tabular-nums">{totals.net.toFixed(2)}</strong> {currency}
                </span>
                <span>
                  {t("inventory.purchaseTotalVat")}:{" "}
                  <strong className="tabular-nums">{totals.vat.toFixed(2)}</strong> {currency}
                </span>
                <span>
                  {t("inventory.purchaseTotalGross")}:{" "}
                  <strong className="tabular-nums">{totals.gross.toFixed(2)}</strong> {currency}
                </span>
              </div>
              {currency !== "AZN" ? (
                <p className="m-0 text-[12px] text-[#7F8C8D]">
                  {t("inventory.purchaseFxFooterHint", {
                    azn: (totals.gross * Number(fxRateToAzn.replace(",", ".")) || 0).toFixed(2),
                  })}
                </p>
              ) : null}
              {goodsHasRows ? (
                <p className="m-0 text-[12px] font-medium text-[#2980B9]">
                  {t("inventory.purchaseReceiptBadgeDraft")}
                </p>
              ) : null}
            </div>
          }
        >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("inventory.purchaseFieldCounterparty")}</span>
            <AsyncCombobox<Counterparty>
              value={counterpartyId}
              onChange={(id, item) => {
                setCounterpartyId(id);
                setCounterpartyLabel(item ? `${item.name} (${item.taxId})` : "");
              }}
              fetcher={fetchCounterparties}
              getOptionLabel={(c) => `${c.name} (${c.taxId})`}
              placeholder={t("invoiceNew.selectCounterpartyPlaceholder")}
              selectedLabel={counterpartyLabel}
              className="mt-1"
              portaled
              aria-invalid={!!err("counterpartyId")}
            />
            {err("counterpartyId") ? (
              <p className="mt-1 text-xs text-red-600 m-0">{err("counterpartyId")}</p>
            ) : null}
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("inventory.purchaseFieldDate")}</span>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className={fieldErrorClass(!!err("documentDate"))}
            />
            {err("documentDate") ? (
              <p className="mt-1 text-xs text-red-600 m-0">{err("documentDate")}</p>
            ) : null}
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("inventory.purchaseFieldCurrency")}</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={MODAL_INPUT_CLASS}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("inventory.purchaseFieldFx")}</span>
            <input
              type="text"
              inputMode="decimal"
              value={fxRateToAzn}
              onChange={(e) => setFxRateToAzn(e.target.value)}
              disabled={currency === "AZN"}
              className={fieldErrorClass(!!err("fxRateToAzn"))}
              aria-invalid={!!err("fxRateToAzn")}
            />
            {err("fxRateToAzn") ? (
              <p className="mt-1 text-xs text-red-600 m-0">{err("fxRateToAzn")}</p>
            ) : null}
          </label>
        </div>

        {renderLineTable(
          t("inventory.purchaseBlockGoods"),
          goodsLines,
          true,
          (i, p) => updateGoodsLine(i, p),
          (i) => {
            if (goodsLines.length <= 1) return;
            setGoodsLines((prev) => prev.filter((_, j) => j !== i));
            clearErrorsPrefix(`goodsLines.${i}.`);
          },
          () => setGoodsLines((prev) => [...prev, newGoodsLine()]),
          "goodsLines",
        )}

        {renderLineTable(
          t("inventory.purchaseBlockServices"),
          serviceLines,
          false,
          (i, p) => updateServiceLine(i, p),
          (i) => {
            if (serviceLines.length <= 1) return;
            setServiceLines((prev) => prev.filter((_, j) => j !== i));
            clearErrorsPrefix(`serviceLines.${i}.`);
          },
          () => setServiceLines((prev) => [...prev, newServiceLine()]),
          "serviceLines",
        )}
        </InvoiceDocumentModalLayout>
      </form>
    </InventoryModalShell>
  );
}
