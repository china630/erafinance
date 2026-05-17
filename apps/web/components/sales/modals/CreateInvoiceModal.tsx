"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";
import { coerceSupportedCurrency, type SupportedCurrency } from "../../../lib/currencies";
import { fetchExchangeRateMock } from "../../../lib/mock-exchange-rates";
import { useLedger } from "../../../lib/ledger-context";
import { notifyListRefresh } from "../../../lib/list-refresh-bus";
import { useAuth } from "../../../lib/auth-context";
import {
  DEFAULT_INVOICE_VAT_RATES,
  VAT_LINE_UNSET,
  fetchInvoiceVatRatesFromApi,
  type InvoiceVatRateValue,
  type VatRateFormChoice,
  formStringToVatRate,
  normalizeProductVatRate,
  vatPercentForMath,
  vatRateToFormString,
} from "../../../lib/vat-line-rates";
import { AsyncCombobox } from "../../ui/async-combobox";
import { ProductCombobox, type ProductRow } from "../../ui/product-combobox";
import { Button } from "../../ui/button";
import { CurrencySelect } from "../../ui/currency-select";
import { DatePicker } from "../../ui/date-picker";
import { NumericAmountInput } from "../../ui/numeric-amount-input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../ui/select";
import { InvoiceDocumentModalLayout } from "../../invoices/invoice-document-modal-layout";
import { SalesModalFooter, SalesModalShell } from "./modal-shell";

type Counterparty = { id: string; name: string; taxId: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  price: unknown;
  vatRate: unknown;
  isService?: boolean;
};

type InvoiceGoodsLineForm = {
  productId: string;
  quantity: string;
  unitPrice: string;
  vatRate: VatRateFormChoice;
};

type InvoiceServiceLineForm = {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: VatRateFormChoice;
};

type InvoiceFormValues = {
  counterpartyId: string;
  dueDate: string;
  debitAccountCode: "101" | "221";
  currency: SupportedCurrency;
  fxRateToAzn: string;
  vatInclusive: boolean;
  isInternational: boolean;
  goods: InvoiceGoodsLineForm[];
  services: InvoiceServiceLineForm[];
};

function blankGoodsLine(): InvoiceGoodsLineForm {
  return { productId: "", quantity: "0", unitPrice: "0", vatRate: VAT_LINE_UNSET };
}

function blankServiceLine(): InvoiceServiceLineForm {
  return { productId: "", description: "", quantity: "0", unitPrice: "0", vatRate: VAT_LINE_UNSET };
}

function lineVatPercentFromForm(
  vatRate: VatRateFormChoice | undefined,
  allowedRates: readonly number[],
): number {
  const r = formStringToVatRate(String(vatRate ?? VAT_LINE_UNSET), allowedRates);
  if (r === null) return 0;
  return vatPercentForMath(r);
}

function vatLineSelectLabel(rate: InvoiceVatRateValue, t: (k: string) => string): string {
  if (rate === -1) return t("invoiceNew.vatExemptLine");
  if (rate === 0) return t("products.vatOption0");
  if (rate === 2) return t("products.vatOption2");
  if (rate === 8) return t("products.vatOption8");
  return t("products.vatOption18");
}

/**
 * `unitPriceNet` — нетто за единицу (в форме так и хранится: при «цены с НДС» ввод брутто
 * конвертируется в нетто при сохранении в поле).
 * Нетто строки = qty * unitPriceNet; НДС и брутто — стандартная аддитивная схема.
 */
function calculateInvoiceLineTotals(
  qty: number,
  unitPriceNet: number,
  vatRatePct: number,
): { net: number; vat: number; gross: number } {
  const v = vatRatePct / 100;
  const net = qty * unitPriceNet;
  const vat = net * v;
  const gross = net + vat;
  return { net, vat, gross };
}

type NettingPreview = {
  payable531: string;
  receivable: string;
  suggestedAmount: string;
  canNet: boolean;
};

function fmtDoc(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

function parseFxRate(raw: string | undefined | null): number {
  return Number(String(raw ?? "").replace(",", ".").trim());
}

/** Document-currency unit price rounded to 4 decimals (ERP line precision). */
function formatInvoiceUnitPrice4(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.round(n * 10_000) / 10_000);
}

/**
 * Catalog `product.price` is stored in AZN per unit (net). Convert to document currency using
 * `fxRateToAzn` = AZN per 1 unit of document currency.
 */
function catalogAznUnitToDocUnit(priceAzn: number, currency: SupportedCurrency, fxToAzn: number): number {
  if (!Number.isFinite(priceAzn) || priceAzn < 0) return 0;
  if (currency === "AZN") return priceAzn;
  if (!Number.isFinite(fxToAzn) || fxToAzn <= 0) return priceAzn;
  return priceAzn / fxToAzn;
}

export function CreateInvoiceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { currencyCodes } = useAuth();
  const [vatRateOptions, setVatRateOptions] = useState<number[]>(() => [...DEFAULT_INVOICE_VAT_RATES]);
  const { ledgerType, ready: ledgerReady } = useLedger();
  const [busy, setBusy] = useState(false);
  const [netting, setNetting] = useState<NettingPreview | null>(null);
  const [counterpartyLabel, setCounterpartyLabel] = useState("");
  const [lineProductLabels, setLineProductLabels] = useState<Record<string, string>>({});

  const fieldClass = "mt-1 max-w-2xl";

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    defaultValues: {
      counterpartyId: "",
      dueDate: new Date().toISOString().slice(0, 10),
      debitAccountCode: "101",
      currency: "AZN",
      fxRateToAzn: "1.0000",
      vatInclusive: false,
      isInternational: false,
      goods: [blankGoodsLine()],
      services: [blankServiceLine()],
    },
  });

  const { fields: goodsFields, append: appendGoods, remove: removeGoods } = useFieldArray({
    control,
    name: "goods",
  });
  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control,
    name: "services",
  });

  const watchedGoods = useWatch({ control, name: "goods" });
  const watchedServices = useWatch({ control, name: "services" });
  const watchedVatInclusive = useWatch({ control, name: "vatInclusive" });
  const watchedCounterpartyId = useWatch({ control, name: "counterpartyId" });
  const watchedCurrency = useWatch({ control, name: "currency" });
  const watchedFx = useWatch({ control, name: "fxRateToAzn" });

  /** Last committed (currency, fx) used for repricing lines when either changes. */
  const invoiceFxPrevRef = useRef<{ currency: SupportedCurrency; fxStr: string } | null>(null);

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

  const fetchProductsGoods = useCallback(async (search: string) => {
    const q = new URLSearchParams();
    q.set("isService", "false");
    q.set("limit", "20");
    const trimmed = search.trim();
    if (trimmed) q.set("search", trimmed);
    const res = await apiFetch(`/api/products?${q}`);
    if (!res.ok) return [];
    const list = (await res.json()) as Product[];
    return Array.isArray(list) ? list : [];
  }, []);

  const fetchProductsServices = useCallback(async (search: string) => {
    const q = new URLSearchParams();
    q.set("isService", "true");
    q.set("limit", "20");
    const trimmed = search.trim();
    if (trimmed) q.set("search", trimmed);
    const res = await apiFetch(`/api/products?${q}`);
    if (!res.ok) return [];
    const list = (await res.json()) as Product[];
    return Array.isArray(list) ? list : [];
  }, []);

  useEffect(() => {
    if (!open) return;
    invoiceFxPrevRef.current = null;
    setBusy(false);
    setCounterpartyLabel("");
    setLineProductLabels({});
    reset({
      counterpartyId: "",
      dueDate: new Date().toISOString().slice(0, 10),
      debitAccountCode: "101",
      currency: "AZN",
      fxRateToAzn: "1.0000",
      vatInclusive: false,
      isInternational: false,
      goods: [blankGoodsLine()],
      services: [blankServiceLine()],
    });
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    void fetchInvoiceVatRatesFromApi().then(setVatRateOptions);
  }, [open]);

  useEffect(() => {
    if (!open) {
      invoiceFxPrevRef.current = null;
    }
  }, [open]);

  /** Sync header FX with document currency (mock rates); does not run on manual FX edits alone. */
  useEffect(() => {
    if (!open) return;
    /* Use getValues so after reset() in the sibling effect we read AZN, not a stale useWatch snapshot. */
    const cur = coerceSupportedCurrency(getValues("currency"), currencyCodes);
    if (cur === "AZN") {
      setValue("fxRateToAzn", "1.0000", { shouldValidate: true, shouldDirty: true });
      return;
    }
    setValue("fxRateToAzn", fetchExchangeRateMock(cur), { shouldValidate: true, shouldDirty: true });
  }, [open, watchedCurrency, getValues, setValue, currencyCodes]);

  /**
   * Reprices all lines that already have a product when currency or FX changes:
   * AZN_doc = price_doc * fx; price_new = AZN_doc / fx_new.
   */
  useEffect(() => {
    if (!open) return;

    const cur = coerceSupportedCurrency(getValues("currency"), currencyCodes);
    const prev = invoiceFxPrevRef.current;

    let fxStr: string;
    if (cur === "AZN") {
      fxStr = "1.0000";
    } else if (prev !== null && prev.currency !== cur) {
      /* Same tick as currency effect: getValues("fxRateToAzn") may still be 1.0000 for AZN→FX switch. */
      fxStr = fetchExchangeRateMock(cur);
    } else {
      fxStr = String(getValues("fxRateToAzn") ?? watchedFx ?? "1.0000").trim();
      const parsed = parseFxRate(fxStr);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        fxStr = fetchExchangeRateMock(cur);
      }
    }

    const newFx = parseFxRate(fxStr);

    if (prev === null) {
      invoiceFxPrevRef.current = { currency: cur, fxStr };
      return;
    }

    const oldCur = prev.currency;
    const oldFx = parseFxRate(prev.fxStr);
    const sameCur = oldCur === cur;
    const sameFx = Math.abs(oldFx - newFx) < 1e-9;

    if (sameCur && sameFx) {
      invoiceFxPrevRef.current = { currency: cur, fxStr };
      return;
    }

    if (!Number.isFinite(newFx) || newFx <= 0 || !Number.isFinite(oldFx) || oldFx <= 0) {
      invoiceFxPrevRef.current = { currency: cur, fxStr };
      return;
    }

    const goods = getValues("goods") ?? [];
    for (let i = 0; i < goods.length; i++) {
      const row = goods[i];
      if (!row?.productId?.trim()) continue;
      const u = Number(String(row.unitPrice ?? "").replace(",", "."));
      if (!Number.isFinite(u)) continue;
      const azn = oldCur === "AZN" ? u : u * oldFx;
      const newU = cur === "AZN" ? azn : azn / newFx;
      setValue(`goods.${i}.unitPrice`, formatInvoiceUnitPrice4(newU));
    }

    const services = getValues("services") ?? [];
    for (let i = 0; i < services.length; i++) {
      const row = services[i];
      if (!row?.productId?.trim()) continue;
      const u = Number(String(row.unitPrice ?? "").replace(",", "."));
      if (!Number.isFinite(u)) continue;
      const azn = oldCur === "AZN" ? u : u * oldFx;
      const newU = cur === "AZN" ? azn : azn / newFx;
      setValue(`services.${i}.unitPrice`, formatInvoiceUnitPrice4(newU));
    }

    invoiceFxPrevRef.current = { currency: cur, fxStr };
  }, [open, watchedCurrency, watchedFx, getValues, setValue, currencyCodes]);

  useEffect(() => {
    if (!open) {
      setNetting(null);
      return;
    }
    if (!ledgerReady || !watchedCounterpartyId) {
      setNetting(null);
      return;
    }
    let cancelled = false;
    const h = window.setTimeout(() => {
      void (async () => {
        const res = await apiFetch(
          `/api/reporting/netting/preview?counterpartyId=${encodeURIComponent(watchedCounterpartyId)}&ledgerType=${encodeURIComponent(ledgerType)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setNetting(null);
          return;
        }
        setNetting((await res.json()) as NettingPreview);
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(h);
    };
  }, [open, watchedCounterpartyId, ledgerType, ledgerReady]);

  const vatTotals = useMemo(() => {
    let net = 0;
    let vat = 0;
    let gross = 0;
    const add = (rows: InvoiceGoodsLineForm[] | undefined) => {
      if (!rows) return;
      for (const row of rows) {
        const q = Number(String(row.quantity).replace(",", "."));
        const u = Number(String(row.unitPrice).replace(",", "."));
        if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(u) || u < 0) continue;
        if (!row.productId) continue;
        if (formStringToVatRate(String(row.vatRate), vatRateOptions) === null) continue;
        const vrPct = lineVatPercentFromForm(row.vatRate, vatRateOptions);
        const unitNet = u;
        const s = calculateInvoiceLineTotals(q, unitNet, vrPct);
        net += s.net;
        vat += s.vat;
        gross += s.gross;
      }
    };
    add(watchedGoods as InvoiceGoodsLineForm[]);
    for (const row of watchedServices ?? []) {
      const r = row as InvoiceServiceLineForm;
      const q = Number(String(r.quantity).replace(",", "."));
      const u = Number(String(r.unitPrice).replace(",", "."));
      if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(u) || u < 0) continue;
      if (!r.productId) continue;
      if (formStringToVatRate(String(r.vatRate), vatRateOptions) === null) continue;
      const vrPct = lineVatPercentFromForm(r.vatRate, vatRateOptions);
      const unitNet = u;
      const s = calculateInvoiceLineTotals(q, unitNet, vrPct);
      net += s.net;
      vat += s.vat;
      gross += s.gross;
    }
    return { net, vat, gross };
  }, [watchedGoods, watchedServices, vatRateOptions]);

  const fxNum = Number(String(watchedFx ?? "1").replace(",", "."));
  const fxOk = Number.isFinite(fxNum) && fxNum > 0;
  const grossAznHint =
    watchedCurrency !== "AZN" && fxOk ? vatTotals.gross * fxNum : null;

  const onValid = async (data: InvoiceFormValues) => {
    const items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
      description?: string;
    }> = [];

    const pushLine = (
      row: InvoiceGoodsLineForm | InvoiceServiceLineForm,
      desc?: string,
    ): boolean => {
      if (!row.productId) return true;
      const q = Number(String(row.quantity).replace(",", "."));
      const u = Number(String(row.unitPrice).replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) {
        toast.error(t("invoiceNew.quantityLineRequired"));
        return false;
      }
      if (!Number.isFinite(u) || u < 0) {
        toast.error(t("invoiceNew.selectBoth"));
        return false;
      }
      const vrParsed = formStringToVatRate(String(row.vatRate), vatRateOptions);
      if (vrParsed === null) {
        toast.error(t("invoiceNew.vatLineRequired"));
        return false;
      }
      items.push({
        productId: row.productId,
        quantity: q,
        unitPrice: u,
        vatRate: vrParsed,
        ...(desc?.trim() ? { description: desc.trim() } : {}),
      });
      return true;
    };

    for (const row of data.goods) {
      if (!pushLine(row)) return;
    }
    for (const row of data.services) {
      const d = (row as InvoiceServiceLineForm).description;
      if (!pushLine(row, d)) return;
    }

    if (items.length === 0) {
      toast.error(t("invoiceNew.selectBoth"));
      return;
    }

    const fx =
      data.currency === "AZN" ? 1 : Number(String(data.fxRateToAzn).replace(",", "."));
    if (!Number.isFinite(fx) || fx <= 0) {
      toast.error(t("inventory.purchaseValidationFx"));
      return;
    }

    setBusy(true);
    const res = await apiFetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterpartyId: data.counterpartyId,
        dueDate: data.dueDate,
        debitAccountCode: data.debitAccountCode,
        currency: data.currency,
        fxRateToAzn: data.currency === "AZN" ? 1 : fx,
        vatInclusive: data.vatInclusive,
        isInternational: data.isInternational,
        items,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    const resp = (await res.json()) as { stockWarnings?: string[] };
    if (resp.stockWarnings?.length) {
      toast.warning(t("invoiceNew.stockWarningsTitle"), {
        description: resp.stockWarnings.join("\n"),
      });
    }
    toast.success(t("common.save"));
    notifyListRefresh("invoices");
    onClose();
  };

  function productOptionLabel(p: Product | ProductRow): string {
    if (p.isService) {
      return `${p.name} (Xidmət)`;
    }
    return `${p.name} (${p.sku})`;
  }

  function onGoodsProductChange(index: number, rowId: string, productId: string, p: ProductRow | null) {
    setValue(`goods.${index}.productId`, productId);
    setLineProductLabels((prev) => ({
      ...prev,
      [rowId]: p ? productOptionLabel(p) : "",
    }));
    if (p) {
      const priceAzn = Number(p.price) || 0;
      const cur = coerceSupportedCurrency(getValues("currency"), currencyCodes);
      const fx = cur === "AZN" ? 1 : parseFxRate(getValues("fxRateToAzn"));
      const docUnit = catalogAznUnitToDocUnit(priceAzn, cur, fx);
      setValue(`goods.${index}.unitPrice`, formatInvoiceUnitPrice4(docUnit));
      setValue(`goods.${index}.vatRate`, vatRateToFormString(normalizeProductVatRate(Number(p.vatRate))));
    } else {
      setValue(`goods.${index}.unitPrice`, "0");
      setValue(`goods.${index}.vatRate`, VAT_LINE_UNSET);
    }
  }

  function onServiceProductChange(index: number, rowId: string, productId: string, p: ProductRow | null) {
    setValue(`services.${index}.productId`, productId);
    setLineProductLabels((prev) => ({
      ...prev,
      [rowId]: p ? productOptionLabel(p) : "",
    }));
    if (p) {
      const priceAzn = Number(p.price) || 0;
      const cur = coerceSupportedCurrency(getValues("currency"), currencyCodes);
      const fx = cur === "AZN" ? 1 : parseFxRate(getValues("fxRateToAzn"));
      const docUnit = catalogAznUnitToDocUnit(priceAzn, cur, fx);
      setValue(`services.${index}.unitPrice`, formatInvoiceUnitPrice4(docUnit));
      setValue(`services.${index}.vatRate`, vatRateToFormString(normalizeProductVatRate(Number(p.vatRate))));
      if (!String((p as { name?: string }).name ?? "").trim()) return;
      setValue(`services.${index}.description`, p.name);
    } else {
      setValue(`services.${index}.unitPrice`, "0");
      setValue(`services.${index}.vatRate`, VAT_LINE_UNSET);
      setValue(`services.${index}.description`, "");
    }
  }

  function renderGoodsTable() {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[#34495E] m-0">{t("invoiceNew.blockGoods")}</h3>
        <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-2">
          <div className="max-h-[min(55vh,22rem)] overflow-x-auto overflow-y-auto">
          <table className={`${DATA_TABLE_CLASS} w-full table-fixed normal-case`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} min-w-0`}>{t("invoiceNew.lineNomenclature")}</th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-[5.25rem] shrink-0`}>
                  {t("invoiceNew.lineVatColumn")}
                </th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-20 shrink-0`}>{t("invoiceNew.quantity")}</th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-28 shrink-0`}>
                  {watchedVatInclusive ? t("invoiceNew.priceHintGross") : t("invoiceNew.priceHintNet")}
                </th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-24 shrink-0`}>{t("invoiceNew.colAmount")}</th>
                <th className={`${DATA_TABLE_TH_CENTER_CLASS} w-10 shrink-0`} />
              </tr>
            </thead>
            <tbody>
              {goodsFields.map((field, idx) => {
                const row = (watchedGoods ?? [])[idx] as InvoiceGoodsLineForm | undefined;
                const vrPct = row ? lineVatPercentFromForm(row.vatRate, vatRateOptions) : 0;
                const displayPrice = (() => {
                  if (!row) return "";
                  const v = Number(String(row.unitPrice).replace(",", "."));
                  if (!watchedVatInclusive || !Number.isFinite(v)) return row.unitPrice;
                  const mult = 1 + vrPct / 100;
                  const gross = v * mult;
                  return String(Math.round(gross * 10_000) / 10_000);
                })();
                const q = row ? Number(String(row.quantity).replace(",", ".")) : 0;
                const uNet = row ? Number(String(row.unitPrice).replace(",", ".")) : 0;
                const money =
                  row?.productId && Number.isFinite(q) && q > 0 && Number.isFinite(uNet)
                    ? calculateInvoiceLineTotals(q, uNet, vrPct)
                    : null;

                return (
                  <tr key={field.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} min-w-0 !py-1.5 !px-2`}>
                      <ProductCombobox
                        isService={false}
                        value={row?.productId ?? ""}
                        onChange={(id, item) => onGoodsProductChange(idx, field.id, id, item)}
                        selectedLabel={lineProductLabels[field.id] ?? ""}
                        listClassName="min-w-[16rem]"
                        className="min-w-0"
                        portaled
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-[5.25rem] shrink-0 !py-1.5 !px-2`}>
                      <Select
                        value={row?.vatRate ?? VAT_LINE_UNSET}
                        onValueChange={(v) =>
                          setValue(`goods.${idx}.vatRate`, v as VatRateFormChoice)
                        }
                        className="box-border w-full max-w-full py-1.5 px-2 text-right"
                      >
                        <SelectTrigger className="" />
                        <SelectContent>
                          <SelectItem value={VAT_LINE_UNSET}>{t("invoiceNew.vatRateLinePlaceholder")}</SelectItem>
                          {vatRateOptions.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              {vatLineSelectLabel(rate, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-20 shrink-0 !py-1.5 !px-2`}>
                      <Controller
                        control={control}
                        name={`goods.${idx}.quantity`}
                        render={({ field }) => (
                          <NumericAmountInput
                            value={field.value}
                            onValueChange={field.onChange}
                            decimalScale={4}
                            className="box-border w-full max-w-full py-1.5 px-2"
                          />
                        )}
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-28 shrink-0 !py-1.5 !px-2`}>
                      <NumericAmountInput
                        value={displayPrice}
                        onValueChange={(plain) => {
                          const n = Number(String(plain).replace(",", "."));
                          if (!Number.isFinite(n)) {
                            setValue(`goods.${idx}.unitPrice`, plain);
                            return;
                          }
                          const mult = 1 + vrPct / 100;
                          const net = watchedVatInclusive ? n / mult : n;
                          const normalized = String(Math.round(net * 10_000) / 10_000);
                          setValue(`goods.${idx}.unitPrice`, normalized);
                        }}
                        decimalScale={4}
                        className="box-border w-full max-w-full py-1.5 px-2"
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-24 shrink-0 !py-1.5 !px-2 tabular-nums text-[#34495E]`}>
                      {money && watchedCurrency ? fmtDoc(money.gross, watchedCurrency) : "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} w-10 shrink-0 text-center !py-1.5 !px-1`}>
                      <button
                        type="button"
                        className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#E74C3C]`}
                        title={t("inventory.purchaseRemoveLine")}
                        onClick={() => removeGoods(idx)}
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
        <Button type="button" variant="secondary" onClick={() => appendGoods(blankGoodsLine())}>
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {t("inventory.purchaseAddLine")}
        </Button>
      </section>
    );
  }

  function renderServicesTable() {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[#34495E] m-0">{t("invoiceNew.blockServices")}</h3>
        <div className="rounded-lg border border-[#D5DADF] bg-[#F8F9FA] p-2">
          <div className="max-h-[min(55vh,22rem)] overflow-x-auto overflow-y-auto">
          <table className={`${DATA_TABLE_CLASS} w-full table-fixed normal-case`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} min-w-0`}>{t("invoiceNew.colService")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} min-w-[8rem]`}>{t("invoiceNew.colServiceDesc")}</th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-[5.25rem] shrink-0`}>
                  {t("invoiceNew.lineVatColumn")}
                </th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-20 shrink-0`}>{t("invoiceNew.quantity")}</th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-28 shrink-0`}>
                  {watchedVatInclusive ? t("invoiceNew.priceHintGross") : t("invoiceNew.priceHintNet")}
                </th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-24 shrink-0`}>{t("invoiceNew.colAmount")}</th>
                <th className={`${DATA_TABLE_TH_CENTER_CLASS} w-10 shrink-0`} />
              </tr>
            </thead>
            <tbody>
              {serviceFields.map((field, idx) => {
                const row = (watchedServices ?? [])[idx] as InvoiceServiceLineForm | undefined;
                const vrPct = row ? lineVatPercentFromForm(row.vatRate, vatRateOptions) : 0;
                const displayPrice = (() => {
                  if (!row) return "";
                  const v = Number(String(row.unitPrice).replace(",", "."));
                  if (!watchedVatInclusive || !Number.isFinite(v)) return row.unitPrice;
                  const mult = 1 + vrPct / 100;
                  const gross = v * mult;
                  return String(Math.round(gross * 10_000) / 10_000);
                })();
                const q = row ? Number(String(row.quantity).replace(",", ".")) : 0;
                const uNet = row ? Number(String(row.unitPrice).replace(",", ".")) : 0;
                const money =
                  row?.productId && Number.isFinite(q) && q > 0 && Number.isFinite(uNet)
                    ? calculateInvoiceLineTotals(q, uNet, vrPct)
                    : null;

                return (
                  <tr key={field.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} min-w-0 !py-1.5 !px-2`}>
                      <ProductCombobox
                        isService
                        value={row?.productId ?? ""}
                        onChange={(id, item) => onServiceProductChange(idx, field.id, id, item)}
                        selectedLabel={lineProductLabels[field.id] ?? ""}
                        listClassName="min-w-[16rem]"
                        className="min-w-0"
                        portaled
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} !py-1.5 !px-2`}>
                      <Controller
                        control={control}
                        name={`services.${idx}.description`}
                        render={({ field }) => (
                          <input
                            {...field}
                            className={`${MODAL_INPUT_CLASS} w-full`}
                            placeholder={t("invoiceNew.colServiceDescPh")}
                          />
                        )}
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-[5.25rem] shrink-0 !py-1.5 !px-2`}>
                      <Select
                        value={row?.vatRate ?? VAT_LINE_UNSET}
                        onValueChange={(v) =>
                          setValue(`services.${idx}.vatRate`, v as VatRateFormChoice)
                        }
                        className="box-border w-full max-w-full py-1.5 px-2 text-right"
                      >
                        <SelectTrigger className="" />
                        <SelectContent>
                          <SelectItem value={VAT_LINE_UNSET}>{t("invoiceNew.vatRateLinePlaceholder")}</SelectItem>
                          {vatRateOptions.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>
                              {vatLineSelectLabel(rate, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-20 shrink-0 !py-1.5 !px-2`}>
                      <Controller
                        control={control}
                        name={`services.${idx}.quantity`}
                        render={({ field }) => (
                          <NumericAmountInput
                            value={field.value}
                            onValueChange={field.onChange}
                            decimalScale={4}
                            className="box-border w-full max-w-full py-1.5 px-2"
                          />
                        )}
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-28 shrink-0 !py-1.5 !px-2`}>
                      <NumericAmountInput
                        value={displayPrice}
                        onValueChange={(plain) => {
                          const n = Number(String(plain).replace(",", "."));
                          if (!Number.isFinite(n)) {
                            setValue(`services.${idx}.unitPrice`, plain);
                            return;
                          }
                          const mult = 1 + vrPct / 100;
                          const net = watchedVatInclusive ? n / mult : n;
                          const normalized = String(Math.round(net * 10_000) / 10_000);
                          setValue(`services.${idx}.unitPrice`, normalized);
                        }}
                        decimalScale={4}
                        className="box-border w-full max-w-full py-1.5 px-2"
                      />
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} w-24 shrink-0 !py-1.5 !px-2 tabular-nums text-[#34495E]`}>
                      {money && watchedCurrency ? fmtDoc(money.gross, watchedCurrency) : "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} w-10 shrink-0 text-center !py-1.5 !px-1`}>
                      <button
                        type="button"
                        className={`${TABLE_ROW_ICON_BTN_CLASS} text-[#E74C3C]`}
                        title={t("inventory.purchaseRemoveLine")}
                        onClick={() => removeService(idx)}
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
        <Button type="button" variant="secondary" onClick={() => appendService(blankServiceLine())}>
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {t("inventory.purchaseAddLine")}
        </Button>
      </section>
    );
  }

  return (
    <SalesModalShell
      open={open}
      title={t("invoiceNew.title")}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      footer={
        <SalesModalFooter onCancel={onClose} busy={busy} formId="create-invoice-form" />
      }
    >
      <form
        id="create-invoice-form"
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => void handleSubmit(onValid)(e)}
      >
        <InvoiceDocumentModalLayout
          footerActions={
            <div className="space-y-2 rounded-lg border border-[#D5DADF] bg-[#F8F9FA] px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <Controller
                  control={control}
                  name="vatInclusive"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#34495E]">
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      {t("invoiceNew.vatInclusive")}
                    </label>
                  )}
                />
                <Controller
                  control={control}
                  name="isInternational"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#34495E]">
                      <input
                        type="checkbox"
                        className={MODAL_CHECKBOX_CLASS}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      {t("trade.export.toggle")}
                    </label>
                  )}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-[13px] text-[#34495E]">
                <span>
                  {t("invoiceNew.totalsNet")}:{" "}
                  <strong className="tabular-nums">
                    {watchedCurrency ? fmtDoc(vatTotals.net, watchedCurrency) : "—"}
                  </strong>
                </span>
                <span>
                  {t("invoiceNew.totalsVat")}:{" "}
                  <strong className="tabular-nums">
                    {watchedCurrency ? fmtDoc(vatTotals.vat, watchedCurrency) : "—"}
                  </strong>
                </span>
                <span>
                  {t("invoiceNew.totalsGross")}:{" "}
                  <strong className="tabular-nums">
                    {watchedCurrency ? fmtDoc(vatTotals.gross, watchedCurrency) : "—"}
                  </strong>
                </span>
              </div>
              {watchedCurrency && watchedCurrency !== "AZN" && grossAznHint != null && fxOk ? (
                <p className="m-0 text-[12px] text-[#7F8C8D]">
                  {t("invoiceNew.fxAznHint", { amount: grossAznHint.toFixed(2) })}
                </p>
              ) : null}
            </div>
          }
        >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="block md:col-span-2">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("invoiceNew.counterparty")}</span>
            <Controller
              control={control}
              name="counterpartyId"
              rules={{ required: t("invoiceNew.selectCounterpartyRequired") }}
              render={({ field }) => (
                <AsyncCombobox<Counterparty>
                  value={field.value}
                  onChange={(id, item) => {
                    field.onChange(id);
                    setCounterpartyLabel(item ? `${item.name} (${item.taxId})` : "");
                  }}
                  fetcher={fetchCounterparties}
                  getOptionLabel={(c) => `${c.name} (${c.taxId})`}
                  placeholder={t("invoiceNew.selectCounterpartyPlaceholder")}
                  selectedLabel={counterpartyLabel}
                  className={`mt-1 ${fieldClass}`}
                  portaled
                  aria-invalid={!!errors.counterpartyId}
                />
              )}
            />
            {errors.counterpartyId?.message ? (
              <p className="mt-1 text-[13px] text-red-600">{String(errors.counterpartyId.message)}</p>
            ) : null}
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("invoiceNew.dueDate")}</span>
            <Controller
              control={control}
              name="dueDate"
              rules={{ required: true }}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  className={fieldClass}
                  required
                  aria-invalid={!!errors.dueDate}
                />
              )}
            />
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("invoiceNew.debitOnPayment")}</span>
            <Controller
              control={control}
              name="debitAccountCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} className={fieldClass}>
                  <SelectTrigger className="" />
                  <SelectContent>
                    <SelectItem value="101">{t("invoiceNew.cash101")}</SelectItem>
                    <SelectItem value="221">{t("invoiceNew.bank221")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("invoiceNew.currency")}</span>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <CurrencySelect
                  value={field.value}
                  onValueChange={field.onChange}
                  className={fieldClass}
                />
              )}
            />
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("inventory.purchaseFieldFx")}</span>
            <Controller
              control={control}
              name="fxRateToAzn"
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  inputMode="decimal"
                  disabled={watchedCurrency === "AZN"}
                  className={`${MODAL_INPUT_CLASS} ${fieldClass}`}
                />
              )}
            />
          </label>
        </div>

        {netting?.canNet ? (
          <div className="rounded-lg border border-[#2980B9]/35 bg-[#EBEDF0] px-3 py-2.5 text-[13px] text-[#34495E]">
            <p className="m-0 font-semibold">{t("invoiceNew.nettingAvailable")}</p>
            <p className="mb-0 mt-1 text-[12px] leading-snug text-[#7F8C8D]">
              {t("invoiceNew.nettingDetail", {
                pay531: netting.payable531,
                rec: netting.receivable,
                suggested: netting.suggestedAmount,
              })}
            </p>
          </div>
        ) : null}

        {renderGoodsTable()}
        {renderServicesTable()}
        </InvoiceDocumentModalLayout>
      </form>
    </SalesModalShell>
  );
}
